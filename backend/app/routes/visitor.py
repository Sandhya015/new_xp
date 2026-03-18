"""
Visitor / track: lead tracking (pages visited, course viewed).
"""
from datetime import datetime
from flask import Blueprint, request, jsonify

from app.db import get_db, get_visitors_collection

visitor_bp = Blueprint("visitor", __name__)


@visitor_bp.route("/track", methods=["POST"])
def track():
    db = get_db()
    if db is None:
        return jsonify({"ok": True}), 200
    data = request.get_json() or {}
    doc = {
        "path": (data.get("path") or "").strip(),
        "courseId": (data.get("courseId") or "").strip() or None,
        "referrer": (data.get("referrer") or "").strip() or None,
        "createdAt": datetime.utcnow(),
    }
    get_visitors_collection().insert_one(doc)
    return jsonify({"ok": True}), 200
