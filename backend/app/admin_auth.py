"""Shared admin JWT gate for admin blueprints."""
from __future__ import annotations

from bson import ObjectId
from flask import current_app, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity

from app.db import get_users_collection


def admin_panel_allowed_email() -> str:
    return (current_app.config.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()


def admin_required():
    claims = get_jwt()
    if claims.get("role") != "admin" or claims.get("admin_portal") is not True:
        return jsonify({"error": "Admin access required", "code": "admin_portal_required"}), 403
    email = (claims.get("email") or "").strip().lower()
    if email != admin_panel_allowed_email():
        return jsonify({"error": "Admin panel access denied"}), 403
    return None


def admin_actor() -> dict:
    claims = get_jwt() or {}
    uid = get_jwt_identity()
    email = (claims.get("email") or "").strip().lower()
    name = ""
    if uid and ObjectId.is_valid(str(uid)):
        u = get_users_collection().find_one({"_id": ObjectId(str(uid))}, {"name": 1, "fullName": 1, "email": 1})
        if u:
            name = (u.get("name") or u.get("fullName") or "").strip()
            if not email:
                email = (u.get("email") or "").strip().lower()
    return {
        "actor_id": str(uid) if uid else "",
        "actor_email": email,
        "actor_name": name or email,
    }
