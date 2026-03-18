"""
Student dashboard: notifications, support tickets. JWT required, role student.
"""
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import get_db, get_notifications_collection, get_support_tickets_collection

student_bp = Blueprint("student", __name__)


@student_bp.route("/notifications", methods=["GET"])
@jwt_required()
def list_notifications():
    """List notifications for current user (SD-WF-16). Student or company."""
    user_id = get_jwt_identity()
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    coll = get_notifications_collection()
    unread_only = request.args.get("unread", "").strip().lower() in ("1", "true", "yes")
    q = {"userId": user_id}
    if unread_only:
        q["read"] = {"$ne": True}
    cursor = coll.find(q).sort("createdAt", -1).limit(100)
    items = []
    for n in cursor:
        items.append({
            "id": str(n["_id"]),
            "type": n.get("type", ""),
            "title": n.get("title", ""),
            "message": n.get("message", ""),
            "read": n.get("read", False),
            "link": n.get("link", ""),
            "createdAt": n.get("createdAt").strftime("%Y-%m-%dT%H:%M:%S") if n.get("createdAt") else "",
        })
    return jsonify({"items": items})


@student_bp.route("/support/tickets", methods=["GET"])
@jwt_required()
def list_support_tickets():
    """List support tickets for current user (SD-WF-19)."""
    user_id = get_jwt_identity()
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    coll = get_support_tickets_collection()
    cursor = coll.find({"userId": user_id}).sort("createdAt", -1)
    items = []
    for t in cursor:
        items.append({
            "id": str(t["_id"]),
            "ticketId": t.get("ticketId", str(t["_id"])[:8].upper()),
            "subject": t.get("subject", ""),
            "category": t.get("category", ""),
            "description": t.get("description", ""),
            "status": t.get("status", "open"),
            "priority": t.get("priority", "medium"),
            "createdAt": t.get("createdAt").strftime("%Y-%m-%dT%H:%M:%S") if t.get("createdAt") else "",
        })
    return jsonify({"items": items})


@student_bp.route("/support/tickets", methods=["POST"])
@jwt_required()
def create_support_ticket():
    """Raise a support ticket (SD-WF-19)."""
    user_id = get_jwt_identity()
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    data = request.get_json() or {}
    subject = (data.get("subject") or "").strip()
    if not subject:
        return jsonify({"error": "Subject is required"}), 400
    description = (data.get("description") or "").strip()
    if len(description) < 20:
        return jsonify({"error": "Description must be at least 20 characters"}), 400
    doc = {
        "userId": user_id,
        "ticketId": "TKT-" + uuid.uuid4().hex[:8].upper(),
        "subject": subject,
        "category": (data.get("category") or "Other").strip(),
        "description": description,
        "status": "open",
        "priority": (data.get("priority") or "medium").strip().lower(),
        "createdAt": datetime.utcnow(),
    }
    result = get_support_tickets_collection().insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify({
        "id": str(doc["_id"]),
        "ticketId": doc["ticketId"],
        "message": "Ticket submitted successfully. We will respond within 24 hours.",
    }), 201
