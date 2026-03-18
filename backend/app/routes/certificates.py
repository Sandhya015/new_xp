"""
Certificates: verify (public). Admin upload/bulk/send-email stubbed for later.
"""
from flask import Blueprint, request, jsonify

from app.db import get_db, get_certificates_collection

certificates_bp = Blueprint("certificates", __name__)


@certificates_bp.route("/verify/<cert_no>", methods=["GET"])
def verify(cert_no):
    db = get_db()
    if db is None:
        return jsonify({"valid": False, "message": "Service unavailable"}), 503
    cert_no = (cert_no or "").strip().upper()
    if not cert_no:
        return jsonify({"valid": False, "message": "Certificate ID is required"}), 400
    coll = get_certificates_collection()
    c = coll.find_one({"certNo": cert_no})
    if not c:
        return jsonify({"valid": False, "message": "Certificate not found or invalid."})
    return jsonify({
        "valid": True,
        "certificateId": c.get("certNo", cert_no),
        "studentName": c.get("studentName", ""),
        "programName": c.get("programName", ""),
        "university": c.get("university", ""),
        "completionDate": c.get("completionDate", ""),
    })


@certificates_bp.route("", methods=["POST"])
def upload():
    return jsonify({"message": "Admin: upload certificate — not implemented"}), 501


@certificates_bp.route("/bulk", methods=["POST"])
def bulk_upload():
    return jsonify({"message": "Admin: bulk Excel upload — not implemented"}), 501


@certificates_bp.route("/send-email", methods=["POST"])
def send_email():
    return jsonify({"message": "Admin: send cert emails — not implemented"}), 501
