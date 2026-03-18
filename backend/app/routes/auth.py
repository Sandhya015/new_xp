"""
Auth: register (student/company), login, me, refresh. JWT + MongoDB.
"""
import re
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, get_jwt
import bcrypt

from app.db import get_db, get_users_collection

auth_bp = Blueprint("auth", __name__)

# ----- helpers -----
def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _user_to_response(user: dict) -> dict:
    """Return safe user object for frontend (no password)."""
    out = {
        "id": str(user["_id"]),
        "name": user.get("name") or user.get("fullName") or "",
        "email": user.get("email", ""),
        "role": user.get("role", "student"),
        "companyName": user.get("companyName"),
        "hrName": user.get("hrName"),
    }
    if user.get("role") == "student":
        out["university"] = user.get("university") or ""
        out["course"] = user.get("course") or ""
        out["semester"] = user.get("semester") or ""
        out["stream"] = user.get("stream") or ""
        out["collegeName"] = user.get("collegeName") or ""
    return out


def _validate_email(email: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def _validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    return True, ""


# ----- routes -----
@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new user (student or company). Body: name, email, password, mobile; role optional (default student)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    role = (data.get("role") or "student").strip().lower()
    if role not in ("student", "company"):
        role = "student"

    if role == "company":
        name = (data.get("companyName") or data.get("name") or "").strip()
        email = (data.get("companyEmail") or data.get("email") or "").strip().lower()
    else:
        name = (data.get("name") or data.get("fullName") or "").strip()
        email = (data.get("email") or "").strip().lower()

    password = data.get("password") or ""
    mobile = (data.get("mobile") or "").strip()

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not _validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    ok, msg = _validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400
    if role == "company" and data.get("confirmPassword") and data["confirmPassword"] != password:
        return jsonify({"error": "Passwords do not match"}), 400
    if role == "student" and data.get("confirmPassword") and data["confirmPassword"] != password:
        return jsonify({"error": "Passwords do not match"}), 400

    users = get_users_collection()
    if users.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists"}), 409

    doc = {
        "email": email,
        "password": _hash_password(password),
        "name": name,
        "fullName": name,
        "mobile": mobile or None,
        "role": role,
        "createdAt": datetime.utcnow(),
    }
    if role == "company":
        doc["companyName"] = name
        doc["hrName"] = (data.get("hrName") or "").strip() or name
        doc["hrMobile"] = (data.get("hrMobile") or "").strip() or None
        doc["industryType"] = (data.get("industryType") or "").strip() or None
        doc["address"] = (data.get("address") or "").strip() or None
        doc["website"] = (data.get("website") or "").strip() or None
    else:
        doc["university"] = (data.get("university") or "").strip() or None
        doc["collegeName"] = (data.get("collegeName") or "").strip() or None
        doc["semester"] = (data.get("semester") or "").strip() or None
        doc["collegeRegNo"] = (data.get("collegeRegNo") or "").strip() or None
        doc["course"] = (data.get("course") or "").strip() or None
        doc["stream"] = (data.get("stream") or "").strip() or None
        doc["linkedin"] = (data.get("linkedin") or "").strip() or None

    result = users.insert_one(doc)
    user = {**doc, "_id": result.inserted_id}
    user.pop("password", None)

    token = create_access_token(
        identity=str(result.inserted_id),
        additional_claims={"email": email, "role": role},
    )
    return jsonify({
        "message": "Registration successful",
        "token": token,
        "user": _user_to_response(user),
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login with email and password. Returns JWT and user."""
    try:
        db = get_db()
        if db is None:
            return jsonify({"error": "Database not configured"}), 503

        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        users = get_users_collection()
        user = users.find_one({"email": email})
        if not user or not _check_password(password, user.get("password", "")):
            return jsonify({"error": "Invalid email or password"}), 401

        token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={"email": user["email"], "role": user.get("role", "student")},
        )
        return jsonify({
            "token": token,
            "user": _user_to_response(user),
        })
    except Exception as e:
        from flask import current_app
        current_app.logger.exception("Login error")
        err_msg = "Login failed. Please try again."
        if current_app.config.get("DEBUG"):
            err_msg = str(e)
        return jsonify({"error": err_msg}), 500


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return current user from JWT."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    from bson import ObjectId
    user_id = get_jwt_identity()
    try:
        users = get_users_collection()
        user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return jsonify({"error": "Invalid token"}), 401
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(_user_to_response(user))


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required()
def refresh():
    """Issue a new access token (same identity)."""
    identity = get_jwt_identity()
    claims = get_jwt()
    token = create_access_token(
        identity=identity,
        additional_claims={"email": claims.get("email"), "role": claims.get("role", "student")},
    )
    return jsonify({"token": token})
