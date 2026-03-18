"""
Enrollments: list for current user, create (after payment or direct), get by course. JWT for student.
"""
from bson import ObjectId
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import get_db, get_enrollments_collection, get_courses_collection

enrollments_bp = Blueprint("enrollments", __name__)


def _enrollment_to_item(e, course=None):
    out = {
        "id": str(e["_id"]),
        "courseId": e.get("courseId", ""),
        "courseTitle": course.get("title", "") if course else "",
        "orderId": e.get("orderId"),
        "status": e.get("status", "active"),
        "batch": e.get("batch", ""),
        "mode": e.get("mode", ""),
        "createdAt": e.get("createdAt").strftime("%Y-%m-%d") if e.get("createdAt") else "",
        "completedAt": e.get("completedAt").strftime("%Y-%m-%d") if e.get("completedAt") else None,
    }
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
    cursor = coll.find(q).sort("createdAt", -1)
    items = []
    for e in cursor:
        c = courses_coll.find_one({"_id": ObjectId(e["courseId"])}) if e.get("courseId") else None
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
    e = coll.find_one({"userId": user_id, "courseId": course_id})
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
    if enroll_coll.find_one({"userId": user_id, "courseId": course_id}):
        return jsonify({"error": "Already enrolled in this course"}), 409
    doc = {
        "userId": user_id,
        "courseId": course_id,
        "orderId": order_id or None,
        "createdAt": datetime.utcnow(),
    }
    result = enroll_coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify({"id": str(result.inserted_id), "message": "Enrolled successfully"}), 201
