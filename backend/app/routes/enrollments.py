"""
Enrollments: list for current user, create (after payment or direct), get by course,
assignment submissions, protected submission file download. JWT for student (or admin for files).
"""
import mimetypes
import os
import re
import uuid
from pathlib import Path

from bson import ObjectId
from datetime import date, datetime
from flask import Blueprint, abort, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from app.cert_constants import CERTIFICATE_PDF_DOWNLOAD_LIMIT
from app.course_features import course_has_completion_quiz
from app.db import get_db, get_enrollments_collection, get_courses_collection
from app.notifications import schedule_enrollment_email
from app.certificate_quiz_pass import try_auto_email_certificate_on_quiz_pass
from app.python_quiz import completion_quiz_pass_percent, find_quiz_topic_by_title, grade_quiz
from app.quiz_attempt_limits import QUIZ_MAX_ATTEMPTS
from app.enrollment_lookup import user_course_enrollment_filter
from app.attendance_util import class_link_session_key, norm_attendance_status, parse_class_link_date

enrollments_bp = Blueprint("enrollments", __name__)

_SUBMISSION_FNAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(pdf|docx?|zip|jpe?g|png|txt)$",
    re.IGNORECASE,
)
_SUBMISSION_EXTS = frozenset({".pdf", ".doc", ".docx", ".zip", ".jpg", ".jpeg", ".png", ".txt"})
MAX_SUBMISSION_UPLOAD_BYTES = 25 * 1024 * 1024


def _admin_panel_allowed_email() -> str:
    return (current_app.config.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()


def _submission_upload_root() -> Path:
    root = Path(current_app.instance_path) / "course_uploads" / "submission"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _iso_utc(dt):
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.replace(microsecond=0).isoformat() + "Z"
    return str(dt)


def _coerce_answer_indices(raw) -> list:
    if not isinstance(raw, list):
        return []
    out: list = []
    for v in raw[:200]:
        try:
            out.append(int(v))
        except (TypeError, ValueError):
            continue
    return out


def _serialize_curriculum_quiz_attempts(e):
    raw = e.get("curriculumQuizAttempts")
    if not isinstance(raw, list):
        return []
    out = []
    for x in raw:
        if not isinstance(x, dict):
            continue
        ai = x.get("answerIndices")
        out.append({
            "quizTitle": str(x.get("quizTitle") or ""),
            "passed": bool(x.get("passed")),
            "scorePercent": x.get("scorePercent"),
            "attempts": int(x.get("attempts") or 0),
            "attemptsMax": QUIZ_MAX_ATTEMPTS,
            "answerIndices": _coerce_answer_indices(ai) if isinstance(ai, list) else [],
            "updatedAt": _iso_utc(x.get("updatedAt")),
        })
    return out


def _serialize_submission(s):
    if not isinstance(s, dict):
        return {}
    return {
        "assignmentId": str(s.get("assignmentId") or ""),
        "assignmentTitle": str(s.get("assignmentTitle") or ""),
        "text": str(s.get("text") or ""),
        "fileUrl": str(s.get("fileUrl") or ""),
        "originalFileName": str(s.get("originalFileName") or ""),
        "mimeType": str(s.get("mimeType") or ""),
        "fileStorageName": str(s.get("fileStorageName") or ""),
        "submittedAt": _iso_utc(s.get("submittedAt")),
    }


def _resolve_assignment(course, assignment_id: str):
    """Return (assignment dict, stable assignment id key) or (None, None)."""
    assigns = course.get("assignments") or []
    if not isinstance(assigns, list):
        return None, None
    aid = (assignment_id or "").strip()
    if aid.startswith("idx_"):
        try:
            i = int(aid.split("_", 1)[1])
            if 0 <= i < len(assigns) and isinstance(assigns[i], dict):
                a = assigns[i]
                if a.get("published") is False:
                    return None, None
                return a, aid
        except (ValueError, IndexError):
            return None, None
        return None, None
    for a in assigns:
        if isinstance(a, dict) and str(a.get("id", "")) == aid:
            if a.get("published") is False:
                return None, None
            return a, aid
    return None, None


def _curriculum_topic_ids(course) -> list:
    if not course or not isinstance(course.get("curriculum"), list):
        return []
    ids = []
    for mod in course["curriculum"]:
        if not isinstance(mod, dict):
            continue
        topics = mod.get("topics")
        if not isinstance(topics, list):
            continue
        for t in topics:
            if not isinstance(t, dict):
                continue
            tid = str(t.get("id") or "").strip()
            if tid:
                ids.append(tid)
    return ids


def _enrollment_to_item(e, course=None):
    pq = e.get("pythonQuiz") or {}
    cc = e.get("courseCertificate") or {}
    raw_cid = e.get("courseId")
    course_id_str = str(raw_cid) if raw_cid is not None else ""
    pdf_n = int(cc.get("pdfDownloadCount", 0) or 0)
    out = {
        "id": str(e["_id"]),
        "courseId": course_id_str,
        "courseTitle": course.get("title", "") if course else "",
        "orderId": e.get("orderId"),
        "status": e.get("status", "active"),
        "batch": e.get("batch", ""),
        "mode": e.get("mode", ""),
        "createdAt": e.get("createdAt").strftime("%Y-%m-%d") if e.get("createdAt") else "",
        "lastAccessedAt": _iso_utc(e.get("lastAccessedAt")),
        "completedAt": e.get("completedAt").strftime("%Y-%m-%d") if e.get("completedAt") else None,
        "pythonQuizPassed": bool(pq.get("passedAt")),
        "pythonQuizScore": pq.get("scorePercent"),
        "certificateIssued": bool(cc.get("issuedAt")),
        "certificateNumber": cc.get("certNo") or None,
        "certificatePdfDownloadCount": pdf_n,
        "certificatePdfDownloadsRemaining": max(0, CERTIFICATE_PDF_DOWNLOAD_LIMIT - pdf_n),
        "pythonQuizAvailable": bool(course and course_has_completion_quiz(course)),
        "pythonQuizAttemptsUsed": int(pq.get("attempts") or 0),
        "pythonQuizAttemptsMax": QUIZ_MAX_ATTEMPTS,
        "pythonQuizLastAnswerIndices": _coerce_answer_indices(pq.get("lastAnswerIndices")),
        "pythonQuizLastScorePercent": pq.get("lastScorePercent"),
        "curriculumQuizAttempts": _serialize_curriculum_quiz_attempts(e),
    }
    raw_done = e.get("completedCurriculumTopicIds")
    out["completedCurriculumTopicIds"] = [str(x) for x in raw_done] if isinstance(raw_done, list) else []
    if course:
        ids = _curriculum_topic_ids(course)
        if ids:
            done_set = set(out["completedCurriculumTopicIds"])
            n_done = sum(1 for tid in ids if tid in done_set)
            out["curriculumProgressPercent"] = min(100, int(round(100.0 * n_done / len(ids))))
        else:
            out["curriculumProgressPercent"] = None
        out["courseFeaturedImageUrl"] = (course.get("featuredImageUrl") or "") or ""
        out["courseOriginalPrice"] = int(course.get("originalPrice") or 0)
        out["courseDuration"] = (course.get("duration") or "") or ""
        out["courseMode"] = (course.get("mode") or "") or ""
        out["courseUniversities"] = (course.get("universities") or "") or ""
        out["courseCategory"] = (course.get("category") or "") or ""
        out["courseShortDescription"] = (course.get("shortDescription") or "") or ""
    else:
        out["curriculumProgressPercent"] = None
        out["courseFeaturedImageUrl"] = ""
        out["courseOriginalPrice"] = 0
        out["courseDuration"] = ""
        out["courseMode"] = ""
        out["courseUniversities"] = ""
        out["courseCategory"] = ""
        out["courseShortDescription"] = ""
    cp = e.get("certificateProfile")
    if isinstance(cp, dict):
        out["enrollmentProfileSnapshot"] = {
            "fullName": str(cp.get("fullName") or "").strip(),
            "university": str(cp.get("university") or "").strip(),
            "collegeName": str(cp.get("collegeName") or "").strip(),
            "course": str(cp.get("course") or "").strip(),
            "branchOrSubject": str(cp.get("branchOrSubject") or "").strip(),
            "semester": str(cp.get("semester") or "").strip(),
            "registrationNumber": str(cp.get("registrationNumber") or "").strip(),
            "mobile": str(cp.get("mobile") or "").strip(),
            "email": str(cp.get("email") or "").strip(),
        }
    else:
        out["enrollmentProfileSnapshot"] = None
    return out


@enrollments_bp.route("", methods=["GET"])
@jwt_required()
def list_enrollments():
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    user_id = get_jwt_identity()
    try:
        from app.cashfree_sync import sync_pending_cashfree_for_user

        sync_pending_cashfree_for_user(str(user_id), limit=5)
    except Exception:
        pass
    coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    status_filter = request.args.get("status", "").strip().lower()
    q = {"userId": user_id}
    if status_filter in ("active", "completed"):
        q["status"] = status_filter
    rows = list(coll.find(q).sort("createdAt", -1))
    oids = []
    for e in rows:
        cid = e.get("courseId")
        if cid and ObjectId.is_valid(str(cid)):
            oids.append(ObjectId(str(cid)))
    course_by_id = {}
    if oids:
        for c in courses_coll.find({"_id": {"$in": oids}}):
            course_by_id[str(c["_id"])] = c
    items = []
    for e in rows:
        cid = e.get("courseId")
        c = course_by_id.get(str(cid)) if cid else None
        items.append(_enrollment_to_item(e, c))
    return jsonify({"items": items})


@enrollments_bp.route("/by-course/<course_id>", methods=["GET"])
@jwt_required()
def get_enrollment_by_course(course_id):
    """Get current user's enrollment for a course (for Course Content page)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    e = coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    now = datetime.utcnow()
    coll.update_one({"_id": e["_id"]}, {"$set": {"lastAccessedAt": now}})
    e = coll.find_one({"_id": e["_id"]})
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    return jsonify(_enrollment_to_item(e, c))


@enrollments_bp.route("/by-course/<course_id>/attendance", methods=["GET"])
@jwt_required()
def student_course_attendance(course_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = str(get_jwt_identity() or "")
    enroll_coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    links = c.get("classLinks") if isinstance(c.get("classLinks"), list) else []
    session_att = c.get("sessionAttendance") if isinstance(c.get("sessionAttendance"), dict) else {}
    today = date.today()
    items = []
    marked_sessions = 0
    attended = 0
    for i, link in enumerate(links):
        if not isinstance(link, dict):
            continue
        sk = class_link_session_key(link, i)
        sd = parse_class_link_date(link.get("date"))
        block = session_att.get(sk) if isinstance(session_att.get(sk), dict) else None
        recs = block.get("records") if isinstance(block, dict) and isinstance(block.get("records"), list) else []
        status = "not_marked"
        note = ""
        for r in recs:
            if not isinstance(r, dict):
                continue
            if str(r.get("userId") or "").strip() == user_id:
                status = norm_attendance_status(r.get("status"))
                note = str(r.get("note") or "").strip()
                break
        is_marked = len(recs) > 0
        if sd and sd <= today and is_marked:
            marked_sessions += 1
            if status in ("present", "late"):
                attended += 1
        items.append({
            "sessionKey": sk,
            "title": (link.get("title") or "Session").strip(),
            "sessionDate": sd.isoformat() if sd else "",
            "time": str(link.get("time") or "").strip(),
            "platform": str(link.get("platform") or "").strip(),
            "status": status if is_marked else "not_marked",
            "note": note,
        })
    pct = round(100.0 * attended / marked_sessions) if marked_sessions else None
    return jsonify({
        "sessions": items,
        "summary": {
            "markedSessions": marked_sessions,
            "attended": attended,
            "percent": pct,
        },
    })


@enrollments_bp.route("/by-course/<course_id>/curriculum-topic-complete", methods=["PATCH"])
@jwt_required()
def patch_curriculum_topic_complete(course_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    topic_id = (data.get("topicId") or "").strip()[:120]
    if not topic_id:
        return jsonify({"error": "topicId is required"}), 400
    completed = bool(data.get("completed"))
    enroll_coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    if completed:
        enroll_coll.update_one({"_id": e["_id"]}, {"$addToSet": {"completedCurriculumTopicIds": topic_id}})
    else:
        enroll_coll.update_one({"_id": e["_id"]}, {"$pull": {"completedCurriculumTopicIds": topic_id}})
    e2 = enroll_coll.find_one({"_id": e["_id"]})
    return jsonify(_enrollment_to_item(e2, c))


@enrollments_bp.route("", methods=["POST"])
@jwt_required()
def create_enrollment():
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    order_id = (data.get("orderId") or "").strip()
    if not course_id:
        return jsonify({"error": "courseId is required"}), 400
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid courseId"}), 400
    courses_coll = get_courses_collection()
    if not courses_coll.find_one({"_id": ObjectId(course_id), "active": True}):
        return jsonify({"error": "Course not found"}), 404
    enroll_coll = get_enrollments_collection()
    if enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id)):
        return jsonify({"error": "Already enrolled in this course", "code": "already_enrolled"}), 409
    cert_profile = data.get("certificateProfile")
    if cert_profile is not None and not isinstance(cert_profile, dict):
        cert_profile = None
    doc = {
        "userId": user_id,
        "courseId": course_id,
        "orderId": order_id or None,
        "status": "active",
        "createdAt": datetime.utcnow(),
    }
    if cert_profile:
        doc["certificateProfile"] = cert_profile
    result = enroll_coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    schedule_enrollment_email(current_app._get_current_object(), user_id, course_id)
    return jsonify({"id": str(result.inserted_id), "message": "Enrolled successfully"}), 201


@enrollments_bp.route("/submission-media/<fname>", methods=["GET"])
@jwt_required()
def submission_media(fname):
    """Serve an uploaded assignment file to the owning student or super-admin."""
    if not fname or not _SUBMISSION_FNAME_RE.match(fname):
        abort(404)
    db = get_db()
    if db is None:
        abort(503)
    enroll_coll = get_enrollments_collection()
    doc = enroll_coll.find_one({"assignmentSubmissions": {"$elemMatch": {"fileStorageName": fname}}})
    if not doc:
        abort(404)
    claims = get_jwt() or {}
    uid = str(get_jwt_identity() or "")
    is_owner = str(doc.get("userId") or "") == uid
    is_admin = (
        claims.get("role") == "admin"
        and claims.get("admin_portal") is True
        and (claims.get("email") or "").strip().lower() == _admin_panel_allowed_email()
    )
    if not (is_owner or is_admin):
        abort(403)
    root = _submission_upload_root()
    try:
        root = root.resolve()
    except OSError:
        abort(404)
    path = (root / fname).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        abort(404)
    if not path.is_file():
        abort(404)
    mime = mimetypes.guess_type(fname)[0] or "application/octet-stream"
    return send_from_directory(str(root), fname, mimetype=mime, conditional=True)


@enrollments_bp.route("/by-course/<course_id>/assignment-submissions", methods=["POST"])
@jwt_required()
def submit_assignment(course_id):
    """Multipart: assignmentId (required), note (optional), file (optional). At least one of note or file."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    enroll_coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404

    assignment_id = (request.form.get("assignmentId") or "").strip()
    if not assignment_id:
        return jsonify({"error": "assignmentId is required"}), 400
    assignment, stable_id = _resolve_assignment(c, assignment_id)
    if not assignment:
        return jsonify({"error": "Assignment not found for this course"}), 404

    note = (request.form.get("note") or "").strip()
    uf = request.files.get("file")
    file_url = ""
    storage_name = ""
    orig_name = ""
    mime_type = ""

    if uf and uf.filename:
        raw_name = secure_filename(uf.filename) or "file.bin"
        ext = Path(raw_name).suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        if ext not in _SUBMISSION_EXTS:
            return jsonify({"error": "Allowed file types: PDF, DOC, DOCX, ZIP, JPG, PNG, TXT"}), 400
        try:
            uf.seek(0, os.SEEK_END)
            sz = uf.tell()
            uf.seek(0)
        except OSError:
            return jsonify({"error": "Could not read upload"}), 400
        if sz > MAX_SUBMISSION_UPLOAD_BYTES:
            return jsonify({"error": f"File too large (max {MAX_SUBMISSION_UPLOAD_BYTES // 1024 // 1024}MB)"}), 400
        if sz <= 0:
            return jsonify({"error": "Empty file"}), 400
        fn = f"{uuid.uuid4().hex}_{uuid.uuid4().hex[:8]}{ext}"
        if not _SUBMISSION_FNAME_RE.match(fn):
            return jsonify({"error": "Invalid generated name"}), 500
        dest_dir = _submission_upload_root()
        dest = dest_dir / fn
        uf.save(str(dest))
        file_url = f"/api/enrollments/submission-media/{fn}"
        storage_name = fn
        orig_name = raw_name
        mime_type = (mimetypes.guess_type(fn)[0] or "application/octet-stream")

    if not note and not storage_name:
        return jsonify({"error": "Add a short note and/or attach a file"}), 400

    for x in e.get("assignmentSubmissions") or []:
        if not isinstance(x, dict):
            continue
        if str(x.get("assignmentId")) != stable_id:
            continue
        prev_fn = (x.get("fileStorageName") or "").strip()
        if prev_fn and _SUBMISSION_FNAME_RE.match(prev_fn):
            try:
                p = _submission_upload_root() / prev_fn
                if p.is_file():
                    p.unlink()
            except OSError:
                pass

    title_snap = str(assignment.get("title") or "").strip()
    new_row = {
        "assignmentId": stable_id,
        "assignmentTitle": title_snap,
        "text": note,
        "fileUrl": file_url,
        "originalFileName": orig_name,
        "mimeType": mime_type,
        "fileStorageName": storage_name,
        "submittedAt": datetime.utcnow(),
    }

    subs = [x for x in (e.get("assignmentSubmissions") or []) if isinstance(x, dict) and str(x.get("assignmentId")) != stable_id]
    subs.append(new_row)
    enroll_coll.update_one({"_id": e["_id"]}, {"$set": {"assignmentSubmissions": subs}})
    e2 = enroll_coll.find_one({"_id": e["_id"]})
    return jsonify(_enrollment_to_item(e2, c)), 200


@enrollments_bp.route("/by-course/<course_id>/python-quiz", methods=["POST"])
@jwt_required()
def submit_python_quiz(course_id):
    """Submit answers for the built-in Python quiz (courses flagged by title/tag/slug)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    enroll_coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c or not course_has_completion_quiz(c):
        return jsonify({"error": "Completion quiz is not available for this course"}), 404

    pq = e.get("pythonQuiz") or {}
    already_passed = bool(pq.get("passedAt"))

    attempts_before = int(pq.get("attempts") or 0)
    if attempts_before >= QUIZ_MAX_ATTEMPTS:
        return jsonify({
            "error": f"You have used all {QUIZ_MAX_ATTEMPTS} attempts for this quiz.",
            "code": "max_quiz_attempts",
            "attemptsUsed": attempts_before,
            "attemptsMax": QUIZ_MAX_ATTEMPTS,
        }), 400

    data = request.get_json() or {}
    answers = data.get("answers")
    if not isinstance(answers, list):
        return jsonify({"error": "answers must be a list of selected option indices (same order as questions)"}), 400
    answer_indices = _coerce_answer_indices(answers)

    passed, pct, ppass = grade_quiz(answers, c)
    if not passed:
        fail_set = {
            "pythonQuiz.attempts": attempts_before + 1,
            "pythonQuiz.lastAnswerIndices": answer_indices,
            "pythonQuiz.lastScorePercent": pct,
        }
        enroll_coll.update_one(
            {"_id": e["_id"]},
            {"$set": fail_set},
        )
        e2 = enroll_coll.find_one({"_id": e["_id"]})
        return jsonify({
            "passed": False,
            "scorePercent": pct,
            "passPercent": ppass,
            "message": f"You need at least {ppass}% to pass. Try again.",
            "attemptsUsed": attempts_before + 1,
            "attemptsMax": QUIZ_MAX_ATTEMPTS,
            "hadPassRecorded": already_passed,
            "enrollment": _enrollment_to_item(e2, c) if e2 else None,
        }), 200

    pass_set = {
        "pythonQuiz.attempts": attempts_before + 1,
        "pythonQuiz.lastAnswerIndices": answer_indices,
        "pythonQuiz.lastScorePercent": pct,
        "pythonQuiz.scorePercent": pct,
    }
    if not already_passed:
        pass_set["pythonQuiz.passedAt"] = datetime.utcnow()
    enroll_coll.update_one(
        {"_id": e["_id"]},
        {"$set": pass_set},
    )
    e2 = enroll_coll.find_one({"_id": e["_id"]})
    if not already_passed:
        try_auto_email_certificate_on_quiz_pass(
            current_app._get_current_object(),
            user_id=user_id,
            course_id=course_id,
            course=c,
            enrollment=e2 or e,
        )
    return jsonify({
        "passed": True,
        "scorePercent": pct,
        "passPercent": ppass,
        "attemptsUsed": attempts_before + 1,
        "attemptsMax": QUIZ_MAX_ATTEMPTS,
        "retakeAfterPass": already_passed,
        "enrollment": _enrollment_to_item(e2, c) if e2 else None,
    }), 200


@enrollments_bp.route("/by-course/<course_id>/curriculum-quiz", methods=["POST"])
@jwt_required()
def submit_curriculum_quiz_result(course_id):
    """Persist pass/fail for a curriculum Quiz topic (MCQ/TF self-check). Not for completionQuizTitle (server quiz)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    enroll_coll = get_enrollments_collection()
    courses_coll = get_courses_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404

    data = request.get_json() or {}
    quiz_title = str(data.get("quizTitle") or "").strip()
    if not quiz_title:
        return jsonify({"error": "quizTitle is required"}), 400
    passed = bool(data.get("passed"))
    try:
        score_pct = int(data.get("scorePercent", 0))
    except (TypeError, ValueError):
        score_pct = 0
    score_pct = max(0, min(100, score_pct))

    topic = find_quiz_topic_by_title(c, quiz_title)
    if not topic or str(topic.get("type") or "").strip().lower() != "quiz":
        return jsonify({"error": "Quiz topic not found in this course curriculum"}), 404
    if topic.get("published") is False:
        return jsonify({"error": "Quiz topic not found in this course curriculum"}), 404

    ct = (c.get("completionQuizTitle") or "").strip().lower()
    if ct and quiz_title.strip().lower() == ct:
        return jsonify({"error": "This quiz is graded on the server; use the completion quiz in the Quizzes tab."}), 400

    existing = None
    prev = []
    for x in (e.get("curriculumQuizAttempts") or []):
        if not isinstance(x, dict):
            continue
        if str(x.get("quizTitle") or "").strip().lower() == quiz_title.lower():
            existing = x
        else:
            prev.append(x)

    prev_attempts = int(existing.get("attempts") or 0) if existing else 0
    if prev_attempts >= QUIZ_MAX_ATTEMPTS:
        return jsonify({
            "error": f"You have used all {QUIZ_MAX_ATTEMPTS} attempts for this quiz.",
            "code": "max_quiz_attempts",
            "attemptsUsed": prev_attempts,
            "attemptsMax": QUIZ_MAX_ATTEMPTS,
        }), 400

    answer_indices = _coerce_answer_indices(data.get("answers"))
    new_row = {
        "quizTitle": quiz_title,
        "passed": passed,
        "scorePercent": score_pct,
        "attempts": prev_attempts + 1,
        "answerIndices": answer_indices,
        "updatedAt": datetime.utcnow(),
    }
    prev.append(new_row)
    enroll_coll.update_one({"_id": e["_id"]}, {"$set": {"curriculumQuizAttempts": prev}})
    e2 = enroll_coll.find_one({"_id": e["_id"]})
    return jsonify(_enrollment_to_item(e2, c)), 200
