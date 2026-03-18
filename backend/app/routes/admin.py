"""
Admin: course CRUD, student list, leads, payments. Admin JWT required.
"""
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.db import (
    get_db,
    get_users_collection,
    get_contacts_collection,
    get_orders_collection,
    get_courses_collection,
)

admin_bp = Blueprint("admin", __name__)


def _admin_required():
    """After @jwt_required(), check role is admin. Returns (error_response, status) or None."""
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


def _user_to_row(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("name") or u.get("fullName") or "",
        "email": u.get("email", ""),
        "mobile": u.get("mobile") or "",
        "university": u.get("university") or "",
        "course": u.get("course") or "",
        "registered": u.get("createdAt").strftime("%Y-%m-%d") if u.get("createdAt") else "",
        "status": "Active",
    }


def _lead_to_row(c):
    return {
        "id": str(c["_id"]),
        "name": c.get("name", ""),
        "mobile": c.get("phone") or c.get("mobile") or "",
        "email": c.get("email", ""),
        "university": c.get("university") or "",
        "course": c.get("course") or "",
        "queryType": c.get("queryFor", "General"),
        "submitted": c.get("createdAt").strftime("%Y-%m-%d") if c.get("createdAt") else "",
        "status": (c.get("status") or "new").replace("_", " ").title(),
        "assignedTo": c.get("assignedTo") or "—",
    }


def _course_to_item(c):
    return {
        "id": str(c["_id"]),
        "title": c.get("title", ""),
        "description": c.get("description", ""),
        "category": c.get("category", "technical"),
        "duration": c.get("duration", ""),
        "mode": c.get("mode", "Online"),
        "universities": c.get("universities", ""),
        "price": c.get("price", 0),
        "tag": c.get("tag", ""),
        "active": c.get("active", True),
    }


@admin_bp.route("/courses", methods=["GET", "POST"])
@jwt_required()
def courses():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    if request.method == "GET":
        q = {}
        search = request.args.get("search", "").strip()
        if search:
            q["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]
        cursor = coll.find(q).sort("createdAt", -1)
        items = [_course_to_item(c) for c in cursor]
        return jsonify({"items": items})
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    from datetime import datetime
    doc = {
        "title": title,
        "description": (data.get("description") or "").strip(),
        "category": (data.get("category") or "technical").strip(),
        "duration": (data.get("duration") or "").strip(),
        "mode": (data.get("mode") or "Online").strip(),
        "universities": (data.get("universities") or "").strip(),
        "price": int(data.get("price") or 0),
        "tag": (data.get("tag") or "").strip(),
        "active": data.get("active", True),
        "createdAt": datetime.utcnow(),
    }
    result = coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(_course_to_item(doc)), 201


@admin_bp.route("/students", methods=["GET"])
@jwt_required()
def students():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    search = request.args.get("search", "").strip()
    q = {"role": "student"}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"fullName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
        ]
    cursor = get_users_collection().find(q).sort("createdAt", -1)
    items = [_user_to_row(u) for u in cursor]
    return jsonify({"items": items})


@admin_bp.route("/leads", methods=["GET"])
@jwt_required()
def leads():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    q = {}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if status and status != "all":
        q["status"] = status
    cursor = get_contacts_collection().find(q).sort("createdAt", -1)
    items = [_lead_to_row(c) for c in cursor]
    return jsonify({"items": items})


@admin_bp.route("/payments", methods=["GET"])
@jwt_required()
def payments():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    search = request.args.get("search", "").strip()
    q = {}
    if search:
        q["$or"] = [
            {"studentId": {"$regex": search, "$options": "i"}},
            {"orderId": {"$regex": search, "$options": "i"}},
        ]
    cursor = get_orders_collection().find(q).sort("createdAt", -1)
    items = []
    for o in cursor:
        items.append({
            "id": str(o["_id"]),
            "orderId": o.get("orderId", ""),
            "studentId": o.get("userId") or o.get("studentId", ""),
            "amount": o.get("amount", 0),
            "status": o.get("status", "pending"),
            "createdAt": o.get("createdAt").strftime("%Y-%m-%d %H:%M") if o.get("createdAt") else "",
        })
    return jsonify({"items": items})
