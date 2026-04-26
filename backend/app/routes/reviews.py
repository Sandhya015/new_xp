"""
Course reviews: public list + stats, student create/update, admin delete/flag.
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.db import get_course_reviews_collection, get_courses_collection, get_db, get_users_collection
from app.enrollment_lookup import user_course_enrollment_filter

reviews_bp = Blueprint("reviews", __name__)


def _admin_ok() -> bool:
    claims = get_jwt() or {}
    email = (current_app.config.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()
    return (
        claims.get("role") == "admin"
        and claims.get("admin_portal") is True
        and (claims.get("email") or "").strip().lower() == email
    )


def _iso(dt):
    if not dt or not isinstance(dt, datetime):
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


def _display_name(user: dict) -> str:
    raw = (user.get("name") or user.get("fullName") or "").strip()
    if not raw:
        return "Student"
    parts = raw.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


def _serialize_review(r: dict) -> dict:
    return {
        "id": str(r["_id"]),
        "courseId": str(r.get("courseId") or ""),
        "studentName": r.get("studentName") or "Student",
        "rating": int(r.get("rating") or 0),
        "title": r.get("title") or "",
        "body": r.get("body") or "",
        "createdAt": _iso(r.get("createdAt")),
        "updatedAt": _iso(r.get("updatedAt")),
        "helpfulCount": int(r.get("helpfulCount") or 0),
        "flagged": bool(r.get("flagged")),
    }


def _stats_for_course(coll, course_id: str) -> dict:
    pipeline = [
        {"$match": {"courseId": course_id, "deleted": {"$ne": True}}},
        {
            "$facet": {
                "avg": [{"$group": {"_id": None, "avg": {"$avg": "$rating"}, "total": {"$sum": 1}}}],
                "hist": [{"$group": {"_id": "$rating", "c": {"$sum": 1}}}],
            }
        },
    ]
    doc = next(coll.aggregate(pipeline), None)
    if not doc:
        return {"average": 0.0, "total": 0, "breakdown": {str(i): 0 for i in range(1, 6)}}
    avg_row = (doc.get("avg") or [{}])[0]
    total = int(avg_row.get("total") or 0)
    average = float(avg_row.get("avg") or 0) if total else 0.0
    breakdown = {str(i): 0 for i in range(1, 6)}
    for h in doc.get("hist") or []:
        star = int(h.get("_id") or 0)
        if 1 <= star <= 5:
            breakdown[str(star)] = int(h.get("c") or 0)
    return {"average": round(average, 2), "total": total, "breakdown": breakdown}


@reviews_bp.route("/me", methods=["GET"])
@jwt_required()
def my_review():
    db = get_db()
    if db is None:
        return jsonify({"review": None}), 503
    course_id = (request.args.get("courseId") or "").strip()
    if not course_id or not ObjectId.is_valid(course_id):
        return jsonify({"error": "Valid courseId is required"}), 400
    user_id = str(get_jwt_identity())
    coll = get_course_reviews_collection()
    r = coll.find_one({"courseId": course_id, "userId": user_id, "deleted": {"$ne": True}})
    return jsonify({"review": _serialize_review(r) if r else None})


@reviews_bp.route("", methods=["GET"])
def list_reviews():
    db = get_db()
    if db is None:
        return jsonify({"stats": {}, "items": [], "page": 1, "limit": 5, "totalPages": 0}), 503
    course_id = (request.args.get("courseId") or "").strip()
    if not course_id or not ObjectId.is_valid(course_id):
        return jsonify({"error": "Valid courseId is required"}), 400
    if not get_courses_collection().find_one({"_id": ObjectId(course_id), "$or": [{"active": True}, {"active": {"$exists": False}}]}):
        return jsonify({"error": "Course not found"}), 404

    page = max(1, request.args.get("page", 1, type=int))
    limit = min(max(1, request.args.get("limit", 5, type=int)), 50)
    sort = (request.args.get("sort") or "recent").strip().lower()
    coll = get_course_reviews_collection()
    stats = _stats_for_course(coll, course_id)

    sort_key = [("createdAt", -1)]
    if sort == "highest":
        sort_key = [("rating", -1), ("createdAt", -1)]
    elif sort == "lowest":
        sort_key = [("rating", 1), ("createdAt", -1)]
    elif sort == "helpful":
        sort_key = [("helpfulCount", -1), ("createdAt", -1)]

    q = {"courseId": course_id, "deleted": {"$ne": True}}
    total = coll.count_documents(q)
    total_pages = max(1, (total + limit - 1) // limit)
    skip = (page - 1) * limit
    rows = list(coll.find(q).sort(sort_key).skip(skip).limit(limit))
    return jsonify({
        "stats": stats,
        "items": [_serialize_review(r) for r in rows],
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": total_pages,
    })


@reviews_bp.route("", methods=["POST"])
@jwt_required()
def create_review():
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    rating = data.get("rating")
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    if not course_id or not ObjectId.is_valid(course_id):
        return jsonify({"error": "Valid courseId is required"}), 400
    try:
        rating_int = int(rating)
    except (TypeError, ValueError):
        rating_int = 0
    if rating_int < 1 or rating_int > 5:
        return jsonify({"error": "rating must be 1–5"}), 400
    if len(body) < 20:
        return jsonify({"error": "Review text must be at least 20 characters"}), 400
    if len(body) > 500:
        return jsonify({"error": "Review text must be at most 500 characters"}), 400
    if len(title) > 80:
        return jsonify({"error": "Title must be at most 80 characters"}), 400

    courses_coll = get_courses_collection()
    if not courses_coll.find_one({"_id": ObjectId(course_id), "$or": [{"active": True}, {"active": {"$exists": False}}]}):
        return jsonify({"error": "Course not found"}), 404

    enroll_coll = get_db()["enrollments"]
    if not enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id)):
        return jsonify({"error": "Only enrolled students can review this course"}), 403

    users_coll = get_users_collection()
    uid = str(user_id)
    user = users_coll.find_one({"_id": ObjectId(uid)}) if ObjectId.is_valid(uid) else {}
    display = _display_name(user or {})

    coll = get_course_reviews_collection()
    existing = coll.find_one({"courseId": course_id, "userId": str(user_id), "deleted": {"$ne": True}})
    now = datetime.utcnow()
    if existing:
        coll.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "rating": rating_int,
                "title": title,
                "body": body,
                "studentName": display,
                "updatedAt": now,
            }},
        )
        updated = coll.find_one({"_id": existing["_id"]})
        return jsonify(_serialize_review(updated)), 200

    result = coll.insert_one({
        "courseId": course_id,
        "userId": str(user_id),
        "studentName": display,
        "rating": rating_int,
        "title": title,
        "body": body,
        "helpfulCount": 0,
        "flagged": False,
        "deleted": False,
        "createdAt": now,
        "updatedAt": now,
    })
    created = coll.find_one({"_id": result.inserted_id})
    return jsonify(_serialize_review(created)), 201


@reviews_bp.route("/<review_id>", methods=["PUT"])
@jwt_required()
def update_review(review_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(review_id):
        return jsonify({"error": "Invalid review id"}), 400
    user_id = str(get_jwt_identity())
    data = request.get_json() or {}
    rating = data.get("rating")
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    try:
        rating_int = int(rating)
    except (TypeError, ValueError):
        rating_int = 0
    if rating_int < 1 or rating_int > 5:
        return jsonify({"error": "rating must be 1–5"}), 400
    if len(body) < 20:
        return jsonify({"error": "Review text must be at least 20 characters"}), 400
    if len(body) > 500:
        return jsonify({"error": "Review text must be at most 500 characters"}), 400
    if len(title) > 80:
        return jsonify({"error": "Title must be at most 80 characters"}), 400

    coll = get_course_reviews_collection()
    r = coll.find_one({"_id": ObjectId(review_id), "deleted": {"$ne": True}})
    if not r:
        return jsonify({"error": "Review not found"}), 404
    if str(r.get("userId")) != user_id:
        return jsonify({"error": "Not allowed"}), 403

    now = datetime.utcnow()
    coll.update_one(
        {"_id": r["_id"]},
        {"$set": {"rating": rating_int, "title": title, "body": body, "updatedAt": now}},
    )
    return jsonify(_serialize_review(coll.find_one({"_id": r["_id"]})))


@reviews_bp.route("/<review_id>", methods=["DELETE"])
@jwt_required()
def delete_review(review_id):
    if not _admin_ok():
        return jsonify({"error": "Admin access required"}), 403
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(review_id):
        return jsonify({"error": "Invalid review id"}), 400
    coll = get_course_reviews_collection()
    coll.update_one(
        {"_id": ObjectId(review_id)},
        {"$set": {"deleted": True, "updatedAt": datetime.utcnow()}},
    )
    return jsonify({"ok": True})


@reviews_bp.route("/<review_id>/flag", methods=["PATCH"])
@jwt_required()
def flag_review(review_id):
    if not _admin_ok():
        return jsonify({"error": "Admin access required"}), 403
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(review_id):
        return jsonify({"error": "Invalid review id"}), 400
    data = request.get_json() or {}
    flagged = bool(data.get("flagged", True))
    coll = get_course_reviews_collection()
    coll.update_one(
        {"_id": ObjectId(review_id)},
        {"$set": {"flagged": flagged, "updatedAt": datetime.utcnow()}},
    )
    return jsonify({"ok": True})
