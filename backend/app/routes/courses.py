"""
Courses: list (paginated), get by id, get content for enrolled student. Public + admin CRUD.
"""
import re
from datetime import datetime

from bson import ObjectId
from flask import Blueprint, request, jsonify, abort, Response
from flask_jwt_extended import jwt_required, get_jwt_identity

from pathlib import Path

from app.course_features import course_has_completion_quiz
from app.db import get_db, get_courses_collection, get_enrollments_collection
from app.services.course_media_storage import (
    course_media_object_exists,
    featured_s3_object_head_exists,
    load_featured_servable_body,
    make_course_media_response,
    object_key,
    uses_s3,
)
from app.enrollment_lookup import course_id_enrollment_filter, user_course_enrollment_filter
from app.python_quiz import completion_quiz_pass_percent, quiz_has_questions, quiz_questions_for_client
from app.quiz_attempt_limits import QUIZ_MAX_ATTEMPTS


def _as_int_list(raw) -> list:
    if not isinstance(raw, list):
        return []
    out = []
    for v in raw[:200]:
        try:
            out.append(int(v))
        except (TypeError, ValueError):
            continue
    return out

courses_bp = Blueprint("courses", __name__)

# Treat missing `active` as published (legacy rows); only explicit false hides from catalog.
_PUBLIC_ACTIVE_OR_LEGACY = {"$or": [{"active": True}, {"active": {"$exists": False}}]}


def _public_catalog_match(category: str, search: str) -> dict:
    """Active trainings visible on the public catalog (excludes unlisted)."""
    visibility_clause = {
        "$or": [
            {"listingVisibility": {"$exists": False}},
            {"listingVisibility": "public"},
        ]
    }
    clauses = [_PUBLIC_ACTIVE_OR_LEGACY, visibility_clause]
    if category:
        clauses.append({"category": category})
    if search:
        clauses.append({
            "$or": [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]
        })
    return {"$and": clauses}


# List view only — excludes curriculum, materials, quizzes, etc. (large nested blobs).
_LIST_FIELDS = {
    "_id": 1,
    "title": 1,
    "description": 1,
    "shortDescription": 1,
    "category": 1,
    "duration": 1,
    "mode": 1,
    "universities": 1,
    "price": 1,
    "originalPrice": 1,
    "tag": 1,
    "active": 1,
    "createdAt": 1,
    "slug": 1,
    "featuredImageUrl": 1,
    "trainingTags": 1,
    "courses": 1,
    "streams": 1,
    "subjects": 1,
    "trainingStartDate": 1,
    "trainingEndDate": 1,
    "trainingMaxSeats": 1,
}

_COURSE_MEDIA_NAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(jpe?g|png|mp4|mov|avi)$",
    re.IGNORECASE,
)
_STUDY_MATERIAL_NAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(pdf|pptx?|docx?|xlsx?|zip|txt|csv)$",
    re.IGNORECASE,
)


def _course_to_item(c):
    if not c:
        return None
    tms = c.get("trainingMaxSeats")
    try:
        training_max_seats = int(tms) if tms is not None and str(tms).strip() != "" else None
    except (TypeError, ValueError):
        training_max_seats = None
    return {
        "id": str(c["_id"]),
        "title": c.get("title", ""),
        "description": c.get("description", ""),
        "shortDescription": c.get("shortDescription", "") or "",
        "category": c.get("category", "technical"),
        "duration": c.get("duration", ""),
        "mode": c.get("mode", "Online"),
        "universities": c.get("universities", ""),
        "price": c.get("price", 0),
        "originalPrice": int(c.get("originalPrice") or 0),
        "tag": c.get("tag", ""),
        "active": c.get("active", True),
        "slug": c.get("slug", "") or "",
        "featuredImageUrl": c.get("featuredImageUrl", "") or "",
        "trainingTags": c.get("trainingTags") if isinstance(c.get("trainingTags"), list) else [],
        "courses": c.get("courses") if isinstance(c.get("courses"), list) else [],
        "streams": c.get("streams") if isinstance(c.get("streams"), list) else [],
        "subjects": c.get("subjects") if isinstance(c.get("subjects"), list) else [],
        "trainingStartDate": (c.get("trainingStartDate") or "") or "",
        "trainingEndDate": (c.get("trainingEndDate") or "") or "",
        "trainingMaxSeats": training_max_seats,
    }


def _iso_utc(dt):
    if not dt or not isinstance(dt, datetime):
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _sanitize_curriculum_public(curriculum):
    """Marketing-safe curriculum: titles/types/durations only; topics shown as locked until enroll."""
    if not isinstance(curriculum, list):
        return []
    out = []
    for i, mod in enumerate(curriculum):
        if not isinstance(mod, dict):
            continue
        topics = []
        for j, t in enumerate(mod.get("topics") or []):
            if not isinstance(t, dict):
                continue
            topics.append({
                "id": str(t.get("id", f"{i}_{j}")),
                "title": (t.get("title", "") or "").strip() or "Untitled",
                "type": (t.get("type", "Lecture") or "Lecture"),
                "duration": (t.get("duration") or t.get("durationLabel") or "").strip() or "—",
                "locked": True,
            })
        out.append({
            "id": str(mod.get("id", f"mod_{i}")),
            "title": (mod.get("title", "") or "").strip() or f"Module {i + 1}",
            "order": mod.get("order", i),
            "topics": topics,
        })
    return out


def _course_to_public_detail(c, enrollment_count=0):
    """Rich course payload for public marketing page (GET /api/courses/:id)."""
    base = _course_to_item(c) or {}
    tms = c.get("trainingMaxSeats")
    training_max_seats = None
    if tms is not None and str(tms).strip() != "":
        try:
            training_max_seats = int(tms)
        except (TypeError, ValueError):
            training_max_seats = None
    base.update({
        "fullDescription": (c.get("fullDescription") or c.get("description", "") or ""),
        "difficulty": c.get("difficulty") or "all",
        "introVideoUrl": (c.get("introVideoUrl") or "") or "",
        "originalPrice": int(c.get("originalPrice") or 0),
        "trainerName": (c.get("trainerName") or "") or "",
        "whatYouWillLearn": c.get("whatYouWillLearn") if isinstance(c.get("whatYouWillLearn"), list) else [],
        "targetAudience": (c.get("targetAudience") or "") or "",
        "materialsIncluded": c.get("materialsIncluded") if isinstance(c.get("materialsIncluded"), list) else [],
        "instructions": (c.get("instructions") or "") or "",
        "trainingTags": c.get("trainingTags") if isinstance(c.get("trainingTags"), list) else [],
        "marketingCategories": c.get("marketingCategories") if isinstance(c.get("marketingCategories"), list) else [],
        "authorName": (c.get("authorName") or "") or "",
        "courses": c.get("courses") if isinstance(c.get("courses"), list) else [],
        "streams": c.get("streams") if isinstance(c.get("streams"), list) else [],
        "curriculum": _sanitize_curriculum_public(c.get("curriculum") or []),
        "batches": c.get("batches") if isinstance(c.get("batches"), list) else [],
        "subjects": c.get("subjects") if isinstance(c.get("subjects"), list) else [],
        "trainingStartDate": (c.get("trainingStartDate") or "") or "",
        "trainingEndDate": (c.get("trainingEndDate") or "") or "",
        "trainingMaxSeats": training_max_seats,
        "enrollmentCount": int(enrollment_count or 0),
        "updatedAt": _iso_utc(c.get("updatedAt")) or _iso_utc(c.get("createdAt")),
    })
    return base


@courses_bp.route("", methods=["GET"])
def list_courses():
    db = get_db()
    if db is None:
        return jsonify({"items": [], "page": 1, "limit": 10, "total": 0, "message": "Database not configured"}), 503
    coll = get_courses_collection()
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(max(1, request.args.get("limit", 10, type=int)), 200)
    category = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip()
    q = _public_catalog_match(category, search)
    skip = (page - 1) * limit
    # Single round-trip: match + sort + page + count (avoids extra latency vs count + find on Lambda↔Mongo).
    pipeline = [
        {"$match": q},
        {
            "$facet": {
                "items": [
                    {"$sort": {"createdAt": -1}},
                    {"$skip": skip},
                    {"$limit": limit},
                    {"$project": _LIST_FIELDS},
                ],
                "total": [{"$count": "c"}],
            }
        },
    ]
    doc = next(coll.aggregate(pipeline), None)
    if not doc:
        return jsonify({"items": [], "page": page, "limit": limit, "total": 0})
    rows = doc.get("items") or []
    total_bits = doc.get("total") or []
    total = int(total_bits[0]["c"]) if total_bits else 0
    items = [_course_to_item(c) for c in rows]
    return jsonify({"items": items, "page": page, "limit": limit, "total": total})


def _course_media_not_found_json(kind: str, fname: str, reason: str) -> tuple:
    """Explicit 404 JSON so operators do not confuse missing S3 objects with a broken route."""
    key = object_key(kind, fname)
    if reason == "invalid_featured_payload":
        hint = (
            "An object exists at this key but the bytes are not a valid JPEG/PNG (corrupt or legacy bad upload). "
            "Delete the object in S3 or choose the image file again in Admin and Save so a fresh file is uploaded."
        )
    else:
        hint = (
            "Nothing is stored at this path. Upload again from Admin while your browser uses this same API "
            "(same VITE_API_URL / stage). If you upload only against local Flask without "
            "COURSE_MEDIA_S3_BUCKET, files stay on your laptop and never reach S3."
        )
    return (
        jsonify(
            {
                "error": "Course media not found",
                "code": reason,
                "kind": kind,
                "file": fname,
                "objectKey": key,
                "storage": "s3" if uses_s3() else "local",
                "hint": hint,
            }
        ),
        404,
    )


def _featured_media_ok_headers():
    return {
        "Cache-Control": "public, max-age=600",
        "Content-Disposition": "inline",
    }


def _featured_mimetype(fname: str) -> str:
    ext = Path(str(fname or "")).suffix.lower()
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    return "application/octet-stream"


@courses_bp.route("/media/<kind>/<path:fname>", methods=["GET", "HEAD"])
def serve_course_media(kind, fname):
    """Public binary for uploaded featured images, videos, and study materials (admin upload)."""
    if kind not in ("featured", "intro", "lesson", "material"):
        if request.method == "HEAD":
            return Response(status=404)
        return _course_media_not_found_json(kind or "", fname or "", "invalid_kind")
    if kind == "material":
        if not _STUDY_MATERIAL_NAME_RE.match(fname or ""):
            if request.method == "HEAD":
                return Response(status=404)
            return _course_media_not_found_json(kind, fname or "", "invalid_filename")
    elif not _COURSE_MEDIA_NAME_RE.match(fname or ""):
        if request.method == "HEAD":
            return Response(status=404)
        return _course_media_not_found_json(kind, fname or "", "invalid_filename")
    # Featured: on S3, GET redirects to presigned URL (browser loads S3 directly). Local disk still
    # streams through Flask with full JPEG/PNG validation. HEAD on S3 uses HeadObject only.
    if kind == "featured":
        if uses_s3():
            if request.method == "HEAD":
                try:
                    ok = featured_s3_object_head_exists(fname)
                except Exception:
                    abort(502)
                return Response(status=200 if ok else 404)
            resp = make_course_media_response("featured", fname)
            if resp is not None:
                return resp
            return _course_media_not_found_json(kind, fname or "", "object_not_found")
        try:
            body, status = load_featured_servable_body(fname)
        except Exception:
            abort(502)
        if request.method == "HEAD":
            return Response(status=200 if status == "ok" else 404)
        if status == "ok":
            return Response(
                body,
                mimetype=_featured_mimetype(fname),
                headers=_featured_media_ok_headers(),
            )
        if status == "invalid":
            return _course_media_not_found_json(kind, fname or "", "invalid_featured_payload")
        return _course_media_not_found_json(kind, fname or "", "object_not_found")

    if request.method == "HEAD":
        try:
            exists = course_media_object_exists(kind, fname)
        except Exception:
            abort(502)
        return Response(status=200 if exists else 404)
    resp = make_course_media_response(kind, fname)
    if resp is None:
        return _course_media_not_found_json(kind, fname or "", "object_not_found")
    return resp


@courses_bp.route("/<course_id>", methods=["GET"])
def get_course(course_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id), **_PUBLIC_ACTIVE_OR_LEGACY})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    enroll_coll = get_enrollments_collection()
    ec = enroll_coll.count_documents(course_id_enrollment_filter(course_id))
    return jsonify(_course_to_public_detail(c, ec))


def _course_to_content(c):
    """Full course for enrolled student: curriculum, classLinks, materials, assignments, quizzes, announcements."""
    if not c:
        return None
    return {
        "id": str(c["_id"]),
        "title": c.get("title", ""),
        "description": c.get("description", ""),
        "shortDescription": c.get("shortDescription", ""),
        "fullDescription": c.get("fullDescription", ""),
        "category": c.get("category", ""),
        "duration": c.get("duration", ""),
        "durationValue": c.get("durationValue", ""),
        "durationUnit": c.get("durationUnit", ""),
        "mode": c.get("mode", "Online"),
        "universities": c.get("universities", ""),
        "price": c.get("price", 0),
        "tag": c.get("tag", ""),
        "trainerName": c.get("trainerName", ""),
        "slug": (c.get("slug") or "") or "",
        "introVideoUrl": (c.get("introVideoUrl") or "") or "",
        "whatYouWillLearn": c.get("whatYouWillLearn") if isinstance(c.get("whatYouWillLearn"), list) else [],
        "curriculum": c.get("curriculum", []),
        "classLinks": c.get("classLinks", []),
        "studyMaterials": c.get("studyMaterials", []),
        "assignments": c.get("assignments", []),
        "quizzes": c.get("quizzes", []),
        "announcements": c.get("announcements", []),
        "completionQuizTitle": (c.get("completionQuizTitle") or "") or "",
        "certificateEmailOnly": bool(c.get("certificateEmailOnly")),
    }


@courses_bp.route("/<course_id>/python-quiz", methods=["GET"])
@jwt_required()
def get_python_quiz(course_id):
    """Completion quiz questions (Python or Java seed, etc.) for enrolled students."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    enroll_coll = get_enrollments_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 403
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c or not course_has_completion_quiz(c):
        return jsonify({"error": "Completion quiz is not available for this course"}), 404
    if not quiz_has_questions(c):
        return jsonify({
            "error": "Completion quiz is not configured. Ask your administrator to set completion quiz content in the course curriculum.",
        }), 404
    pq = e.get("pythonQuiz") or {}
    attempts_used = int(pq.get("attempts") or 0)
    # Lock the form only when no attempts remain (includes passed learners who used all retakes).
    read_only = bool(attempts_used >= QUIZ_MAX_ATTEMPTS)
    return jsonify({
        "passPercent": completion_quiz_pass_percent(c),
        "questions": quiz_questions_for_client(c),
        "attemptsUsed": attempts_used,
        "attemptsMax": QUIZ_MAX_ATTEMPTS,
        "readOnly": read_only,
        "lastAnswerIndices": _as_int_list(pq.get("lastAnswerIndices")),
        "lastScorePercent": pq.get("lastScorePercent"),
    }), 200


@courses_bp.route("/<course_id>/content", methods=["GET"])
@jwt_required()
def get_course_content(course_id):
    """Full course content for enrolled students only (SD-WF-10)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    enroll_coll = get_enrollments_collection()
    if not enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id)):
        return jsonify({"error": "Not enrolled in this course"}), 403
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    return jsonify(_course_to_content(c))
