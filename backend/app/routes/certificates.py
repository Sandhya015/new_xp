"""
Certificates: verify (public), list my (student). Admin upload/bulk/send-email stubbed for later.
"""
from bson import ObjectId
from flask import Blueprint, Response, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.cert_constants import CERTIFICATE_PDF_DOWNLOAD_LIMIT
from app.certificate_quiz_pass import apply_quiz_pass_certificate, course_certificate_is_email_only
from app.course_features import course_has_completion_quiz
from app.db import (
    get_db,
    get_certificates_collection,
    get_courses_collection,
    get_enrollments_collection,
    get_users_collection,
)
from app.enrollment_lookup import user_course_enrollment_filter

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


@certificates_bp.route("/generate-from-quiz", methods=["POST"])
@jwt_required()
def generate_from_quiz():
    """
    After passing the course completion quiz: PDF certificate in the response; same PDF is emailed when SMTP is configured (each successful generation, up to download limit).
    Body: { "courseId": "<mongo id>" }
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    user_id = get_jwt_identity()
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    if not course_id or not ObjectId.is_valid(course_id):
        return jsonify({"error": "Valid courseId is required"}), 400

    enroll_coll = get_enrollments_collection()
    e = enroll_coll.find_one(user_course_enrollment_filter(user_id, course_id))
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404

    pq = e.get("pythonQuiz") or {}
    if not pq.get("passedAt"):
        return jsonify({"error": "Complete and pass the course quiz first"}), 400

    courses_coll = get_courses_collection()
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c or not course_has_completion_quiz(c):
        return jsonify({"error": "Certificate is not available for this course"}), 404
    if course_certificate_is_email_only(c):
        return jsonify({
            "error": (
                "This course delivers your certificate by email only. "
                "It was issued when you passed the completion quiz, or it will be sent as soon as mail is enabled on the server."
            ),
        }), 400

    users_coll = get_users_collection()
    try:
        user = users_coll.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        return jsonify({"error": "User not found"}), 404

    cc = e.get("courseCertificate") or {}
    download_count = int(cc.get("pdfDownloadCount", 0) or 0)
    if download_count >= CERTIFICATE_PDF_DOWNLOAD_LIMIT:
        return jsonify({
            "error": (
                "You have reached the maximum number of certificate generations (2). "
                "Check your email for previously sent copies."
            ),
        }), 429

    resp = apply_quiz_pass_certificate(
        current_app._get_current_object(),
        user_id=user_id,
        course_id=course_id,
        enrollment=e,
        course=c,
        user=user,
        for_pdf_download=True,
    )
    if isinstance(resp, dict):
        return jsonify({"error": "Could not build certificate response"}), 500
    return resp


@certificates_bp.route("/my", methods=["GET"])
@jwt_required()
def list_my_certificates():
    """List certificates issued to the current student (SD-WF-14)."""
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    user_id = get_jwt_identity()
    coll = get_certificates_collection()
    cursor = coll.find({"studentId": user_id}).sort("issueDate", -1)
    items = []
    for c in cursor:
        issue_date = c.get("issueDate") or c.get("completionDate")
        if hasattr(issue_date, "strftime"):
            issue_date = issue_date.strftime("%Y-%m-%d")
        items.append({
            "id": str(c["_id"]),
            "certNo": c.get("certNo", ""),
            "programName": c.get("programName", ""),
            "university": c.get("university", ""),
            "issueDate": issue_date or "",
            "status": c.get("status", "valid"),
        })
    return jsonify({"items": items})


@certificates_bp.route("", methods=["POST"])
def upload():
    return jsonify({"message": "Admin: upload certificate — not implemented"}), 501


@certificates_bp.route("/bulk", methods=["POST"])
def bulk_upload():
    return jsonify({"message": "Admin: bulk Excel upload — not implemented"}), 501


@certificates_bp.route("/send-email", methods=["POST"])
def send_email():
    return jsonify({"message": "Admin: send cert emails — not implemented"}), 501
