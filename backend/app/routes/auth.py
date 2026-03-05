"""
Auth: register, login, refresh, me. JWT and DB to be wired.
"""
from flask import Blueprint, request, jsonify
auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    return jsonify({"message": "Registration endpoint — DB not connected yet"}), 501


@auth_bp.route("/login", methods=["POST"])
def login():
    return jsonify({"message": "Login endpoint — DB not connected yet"}), 501


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    return jsonify({"message": "Refresh endpoint — auth not wired"}), 501


@auth_bp.route("/me", methods=["GET"])
def me():
    return jsonify({"message": "Me endpoint — auth not wired"}), 501
