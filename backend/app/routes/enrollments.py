"""
Enrollments: create after payment success, list for student. DB to be wired.
"""
from flask import Blueprint, jsonify
enrollments_bp = Blueprint("enrollments", __name__)


@enrollments_bp.route("", methods=["GET"])
def list_enrollments():
    return jsonify({"items": [], "message": "Enrollments — DB not connected yet"}), 501


@enrollments_bp.route("", methods=["POST"])
def create_enrollment():
    return jsonify({"message": "Create enrollment — after payment verify"}), 501
