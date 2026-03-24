"""
Courses: list (paginated), get by id, get content for enrolled student. Public + admin CRUD.
"""
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.course_features import course_has_python_quiz
from app.db import get_db, get_courses_collection, get_enrollments_collection
from app.python_quiz import PASS_PERCENT, quiz_questions_for_client

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
        "curriculum": c.get("curriculum", []),
        "classLinks": c.get("classLinks", []),
        "studyMaterials": c.get("studyMaterials", []),
        "assignments": c.get("assignments", []),
        "quizzes": c.get("quizzes", []),
        "announcements": c.get("announcements", []),
    }


@courses_bp.route("/<course_id>/python-quiz", methods=["GET"])
@jwt_required()
def get_python_quiz(course_id):
    """Quiz questions for Python-flagged courses (enrolled students only)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    user_id = get_jwt_identity()
    enroll_coll = get_enrollments_collection()
    if not enroll_coll.find_one({"userId": user_id, "courseId": course_id}):
        return jsonify({"error": "Not enrolled in this course"}), 403
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c or not course_has_python_quiz(c):
        return jsonify({"error": "Python quiz is not available for this course"}), 404
    return jsonify({
        "passPercent": PASS_PERCENT,
        "questions": quiz_questions_for_client(),
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
    if not enroll_coll.find_one({"userId": user_id, "courseId": course_id}):
        return jsonify({"error": "Not enrolled in this course"}), 403
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    return jsonify(_course_to_content(c))
