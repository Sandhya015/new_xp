"""RBAC helpers for Lead CRM."""
from __future__ import annotations

from functools import wraps
from typing import Callable

from bson import ObjectId
from flask import g, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity

from app.db import get_users_collection

LEAD_ROLES = ("super_admin", "manager", "agent")


def get_lead_role(user: dict | None) -> str:
    if not user:
        return "agent"
    if user.get("role") != "admin":
        return "agent"
    return str(user.get("leadRole") or "super_admin")


def _load_user_from_jwt() -> dict | None:
    claims = get_jwt() or {}
    if claims.get("role") != "admin" or claims.get("admin_portal") is not True:
        return None
    uid = get_jwt_identity()
    user: dict = {
        "id": str(uid) if uid else "",
        "email": claims.get("email"),
        "role": claims.get("role"),
        "leadRole": claims.get("leadRole"),
    }
    if uid and ObjectId.is_valid(str(uid)):
        u = get_users_collection().find_one({"_id": ObjectId(str(uid))}, {"email": 1, "role": 1, "leadRole": 1, "fullName": 1, "name": 1})
        if u:
            user["email"] = u.get("email") or user.get("email")
            user["role"] = u.get("role") or user.get("role")
            user["leadRole"] = u.get("leadRole") or user.get("leadRole")
            user["fullName"] = u.get("fullName") or u.get("name") or user.get("email")
    return user


def require_lead_access(min_role: str = "agent"):
    """Decorator: admin JWT + minimum leadRole."""

    rank = {"agent": 0, "manager": 1, "super_admin": 2}

    def decorator(fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _load_user_from_jwt()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            lr = get_lead_role(user)
            if rank.get(lr, 0) < rank.get(min_role, 0):
                return jsonify({"error": "Forbidden — insufficient lead role"}), 403
            g.current_user = user
            g.lead_role = lr
            return fn(*args, **kwargs)

        return wrapper

    return decorator
