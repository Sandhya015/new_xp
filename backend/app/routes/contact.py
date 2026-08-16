"""
Contact: submit contact form (stored as leads).
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app

from app.db import get_db, get_contacts_collection

contact_bp = Blueprint("contact", __name__)

ALLOWED_QUERY_FOR = {"Training", "Internship", "Certificate", "General"}


def _ingest_crm(event_type: str, source: str, **kwargs):
    try:
        from app.lead_crm import ingest_lead_event
        ingest_lead_event(event_type=event_type, source=source, **kwargs)
    except Exception:
        current_app.logger.exception("CRM ingest failed for %s", event_type)


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
    result = get_contacts_collection().insert_one(doc)
    _ingest_crm(
        "contact.submitted",
        "contact_us",
        mobile=phone,
        email=email,
        full_name=name,
        payload={
            "message": message,
            "queryFor": query_for,
            "university": university,
            "course": course,
            "stream": stream,
            "legacyContactId": str(result.inserted_id),
        },
        idempotency_key=f"contact:{result.inserted_id}",
    )
    return jsonify({"message": "Thank you. We have received your query and will get back to you soon."}), 201


@contact_bp.route("/callback", methods=["POST"])
def callback_request():
    """Homepage 'Request a Free Call Back' form."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Service unavailable"}), 503
    data = request.get_json() or {}
    name = (data.get("fullName") or data.get("name") or "").strip()
    phone = (data.get("contactNumber") or data.get("phone") or data.get("mobile") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not phone:
        return jsonify({"error": "Contact number is required"}), 400

    payload = {
        k: v
        for k, v in {
            "course": data.get("course"),
            "branch": data.get("branch"),
            "subject": data.get("subject"),
            "university": data.get("university"),
            "college": data.get("college") or data.get("collegeName"),
            "semester": data.get("semester"),
            "message": data.get("message"),
        }.items()
        if v
    }
    _ingest_crm(
        "callback.requested",
        "callback",
        mobile=phone,
        email=data.get("email"),
        full_name=name,
        payload=payload,
    )
    return jsonify({"message": "Thank you! Our team will contact you within 24–48 hours."}), 201
