"""
Contact: submit contact form (stored as leads).
"""
from datetime import datetime
from flask import Blueprint, request, jsonify

from app.db import get_db, get_contacts_collection

contact_bp = Blueprint("contact", __name__)

ALLOWED_QUERY_FOR = {"Training", "Internship", "Certificate", "General"}


@contact_bp.route("", methods=["POST"])
def submit():
    db = get_db()
    if db is None:
        return jsonify({"error": "Service unavailable"}), 503
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or data.get("mobile") or "").strip()
    message = (data.get("message") or "").strip()
    query_for = (data.get("queryFor") or data.get("query_for") or "").strip()
    university = (data.get("university") or "").strip()
    semester = (data.get("semester") or "").strip()
    course = (data.get("course") or "").strip()
    stream = (data.get("stream") or "").strip()

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if query_for and query_for not in ALLOWED_QUERY_FOR:
        query_for = "General"

    doc = {
        "name": name,
        "email": email,
        "phone": phone or None,
        "message": message or None,
        "queryFor": query_for or "General",
        "university": university or None,
        "semester": semester or None,
        "course": course or None,
        "stream": stream or None,
        "status": "new",
        "createdAt": datetime.utcnow(),
    }
    get_contacts_collection().insert_one(doc)
    return jsonify({"message": "Thank you. We have received your query and will get back to you soon."}), 201
