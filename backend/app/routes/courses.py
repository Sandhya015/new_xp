"""
Courses: list (paginated), get by id. Admin CRUD in admin blueprint.
"""
from flask import Blueprint, request, jsonify
courses_bp = Blueprint("courses", __name__)


@courses_bp.route("", methods=["GET"])
def list_courses():
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 10, type=int), 50)
    return jsonify({"items": [], "page": page, "limit": limit, "total": 0, "message": "Courses list — DB not connected yet"})


@courses_bp.route("/<course_id>", methods=["GET"])
def get_course(course_id):
    return jsonify({"id": course_id, "message": "Course detail — DB not connected yet"}), 501
