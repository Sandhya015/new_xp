"""
Courses: list (paginated), get by id. Public + admin CRUD.
"""
from bson import ObjectId
from flask import Blueprint, request, jsonify

from app.db import get_db, get_courses_collection

courses_bp = Blueprint("courses", __name__)


def _course_to_item(c):
    if not c:
        return None
    return {
        "id": str(c["_id"]),
        "title": c.get("title", ""),
        "description": c.get("description", ""),
        "category": c.get("category", "technical"),
        "duration": c.get("duration", ""),
        "mode": c.get("mode", "Online"),
        "universities": c.get("universities", ""),
        "price": c.get("price", 0),
        "tag": c.get("tag", ""),
        "active": c.get("active", True),
    }


@courses_bp.route("", methods=["GET"])
def list_courses():
    db = get_db()
    if db is None:
        return jsonify({"items": [], "page": 1, "limit": 10, "total": 0, "message": "Database not configured"}), 503
    coll = get_courses_collection()
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(max(1, request.args.get("limit", 10, type=int)), 50)
    category = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip()
    q = {"active": True}
    if category:
        q["category"] = category
    if search:
        q["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    total = coll.count_documents(q)
    cursor = coll.find(q).sort("createdAt", -1).skip(skip).limit(limit)
    items = [_course_to_item(c) for c in cursor]
    return jsonify({"items": items, "page": page, "limit": limit, "total": total})


@courses_bp.route("/<course_id>", methods=["GET"])
def get_course(course_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id), "active": True})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    return jsonify(_course_to_item(c))
