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
from datetime import datetime
from flask import Blueprint, abort, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from app.cert_constants import CERTIFICATE_PDF_DOWNLOAD_LIMIT
from app.course_features import course_has_completion_quiz
from app.db import get_db, get_enrollments_collection, get_courses_collection
from app.notifications import schedule_enrollment_email
from app.python_quiz import PASS_PERCENT, grade_quiz
from app.enrollment_lookup import user_course_enrollment_filter

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
                return assigns[i], aid
        except (ValueError, IndexError):
            return None, None
        return None, None
    for a in assigns:
        if isinstance(a, dict) and str(a.get("id", "")) == aid:
            return a, aid
    return None, None


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
        "completedAt": e.get("completedAt").strftime("%Y-%m-%d") if e.get("completedAt") else None,
        "pythonQuizPassed": bool(pq.get("passedAt")),
        "pythonQuizScore": pq.get("scorePercent"),
        "certificateIssued": bool(cc.get("issuedAt")),
        "certificateNumber": cc.get("certNo") or None,
        "certificatePdfDownloadCount": pdf_n,
        "certificatePdfDownloadsRemaining": max(0, CERTIFICATE_PDF_DOWNLOAD_LIMIT - pdf_n),
        "pythonQuizAvailable": bool(course and course_has_completion_quiz(course)),
    }
    subs = e.get("assignmentSubmissions") if isinstance(e.get("assignmentSubmissions"), list) else []
    out["assignmentSubmissions"] = [_serialize_submission(x) for x in subs if isinstance(x, dict)]
    return out


@enrollments_bp.route("", methods=["GET"])
@jwt_required()
def list_enrollments():
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    user_id = get_jwt_identity()
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
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    return jsonify(_enrollment_to_item(e, c))


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
    doc = {
        "userId": user_id,
        "courseId": course_id,
        "orderId": order_id or None,
        "status": "active",
        "createdAt": datetime.utcnow(),
    }
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
    if pq.get("passedAt"):
        return jsonify({
            "passed": True,
            "scorePercent": pq.get("scorePercent", 100),
            "passPercent": PASS_PERCENT,
            "alreadyCompleted": True,
        }), 200

    data = request.get_json() or {}
    answers = data.get("answers")
    if not isinstance(answers, list):
        return jsonify({"error": "answers must be a list of selected option indices (same order as questions)"}), 400

    passed, pct = grade_quiz(answers, c)
    if not passed:
        return jsonify({
            "passed": False,
            "scorePercent": pct,
            "passPercent": PASS_PERCENT,
            "message": f"You need at least {PASS_PERCENT}% to pass. Try again.",
        }), 200

    enroll_coll.update_one(
        {"_id": e["_id"]},
        {"$set": {
            "pythonQuiz.passedAt": datetime.utcnow(),
            "pythonQuiz.scorePercent": pct,
        }},
    )
    return jsonify({"passed": True, "scorePercent": pct, "passPercent": PASS_PERCENT}), 200
