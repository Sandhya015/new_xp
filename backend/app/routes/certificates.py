"""
Certificates: verify (public), upload/bulk/send-email (admin). DB to be wired.
"""
from flask import Blueprint, jsonify
certificates_bp = Blueprint("certificates", __name__)


@certificates_bp.route("/verify/<cert_no>", methods=["GET"])
def verify(cert_no):
    return jsonify({"valid": False, "message": "Verification — DB not connected yet"}), 501


@certificates_bp.route("", methods=["POST"])
def upload():
    return jsonify({"message": "Admin: upload certificate — not implemented"}), 501


@certificates_bp.route("/bulk", methods=["POST"])
def bulk_upload():
    return jsonify({"message": "Admin: bulk Excel upload — not implemented"}), 501


@certificates_bp.route("/send-email", methods=["POST"])
def send_email():
    return jsonify({"message": "Admin: send cert emails — not implemented"}), 501
