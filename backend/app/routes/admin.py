"""
Admin: course CRUD, student list, certificates, leads, payments. Admin JWT required.
"""
from flask import Blueprint, jsonify
admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/courses", methods=["GET", "POST"])
def courses():
    return jsonify({"message": "Admin courses — not implemented"}), 501


@admin_bp.route("/students", methods=["GET"])
def students():
    return jsonify({"items": [], "message": "Admin student list — not implemented"}), 501


@admin_bp.route("/leads", methods=["GET"])
def leads():
    return jsonify({"items": [], "message": "Admin leads — not implemented"}), 501


@admin_bp.route("/payments", methods=["GET"])
def payments():
    return jsonify({"items": [], "message": "Admin payments — not implemented"}), 501
