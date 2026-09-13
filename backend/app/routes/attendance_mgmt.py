"""Admin attendance management APIs."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.admin_auth import admin_actor, admin_required
from app.attendance import service as att_svc

attendance_mgmt_bp = Blueprint("attendance_mgmt", __name__)


@attendance_mgmt_bp.route("/attendance-mgmt/config/<course_id>", methods=["GET", "PUT"])
@jwt_required()
def attendance_config(course_id: str):
    err = admin_required()
    if err:
        return err
    if request.method == "GET":
        cfg = att_svc.get_config(course_id, session=request.args.get("session") or "", semester=request.args.get("semester") or "")
        return jsonify({"config": cfg})
    data = request.get_json() or {}
    cfg = att_svc.upsert_config(course_id, data)
    return jsonify({"config": cfg})


@attendance_mgmt_bp.route("/attendance-mgmt/<course_id>/students", methods=["GET"])
@jwt_required()
def attendance_students(course_id: str):
    err = admin_required()
    if err:
        return err
    students = att_svc.list_students_with_percent(course_id)
    cfg = att_svc.get_config(course_id)
    return jsonify({"students": students, "config": cfg})


@attendance_mgmt_bp.route("/attendance-mgmt/<course_id>/students/<user_id>/history", methods=["GET"])
@jwt_required()
def attendance_student_history(course_id: str, user_id: str):
    err = admin_required()
    if err:
        return err
    history = att_svc.attendance_history_for_user(course_id, user_id)
    pct = att_svc.attendance_percent_for_user(course_id, user_id)
    return jsonify({"history": history, "percent": pct})


@attendance_mgmt_bp.route("/attendance-mgmt/mark", methods=["POST"])
@jwt_required()
def attendance_bulk_mark():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    user_ids = data.get("userIds") or []
    if not course_id or not user_ids:
        return jsonify({"error": "courseId and userIds required"}), 400
    actor = admin_actor()
    result = att_svc.admin_bulk_mark(
        course_id=course_id,
        user_ids=[str(u) for u in user_ids],
        date_from=data.get("dateFrom") or "",
        date_to=data.get("dateTo") or "",
        status=(data.get("status") or "present").strip(),
        actor_id=actor.get("actor_id") or "",
    )
    if not result.get("ok"):
        return jsonify(result), 400
    return jsonify(result)
