"""
Enrollments: list for current user, create (after payment or direct), get by course. JWT for student.
"""
from bson import ObjectId
from datetime import datetime
from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.course_features import course_has_python_quiz
from app.db import get_db, get_enrollments_collection, get_courses_collection
from app.notifications import schedule_enrollment_email
from app.python_quiz import PASS_PERCENT, grade_quiz

enrollments_bp = Blueprint("enrollments", __name__)


def _enrollment_to_item(e, course=None):
    pq = e.get("pythonQuiz") or {}
    cc = e.get("courseCertificate") or {}
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
        "pythonQuizPassed": bool(pq.get("passedAt")),
        "pythonQuizScore": pq.get("scorePercent"),
        "certificateIssued": bool(cc.get("issuedAt")),
        "certificateNumber": cc.get("certNo") or None,
        "pythonQuizAvailable": bool(course and course_has_python_quiz(course)),
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
        "status": "active",
        "createdAt": datetime.utcnow(),
    }
    result = enroll_coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    schedule_enrollment_email(current_app._get_current_object(), user_id, course_id)
    return jsonify({"id": str(result.inserted_id), "message": "Enrolled successfully"}), 201


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
    e = enroll_coll.find_one({"userId": user_id, "courseId": course_id})
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c or not course_has_python_quiz(c):
        return jsonify({"error": "Python quiz is not available for this course"}), 404

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

    passed, pct = grade_quiz(answers)
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
