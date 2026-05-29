"""
Certificates: public verification, student list/generate, admin stubs.
"""
from io import BytesIO

from bson import ObjectId
from flask import Blueprint, Response, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.cert_constants import CERTIFICATE_PDF_DOWNLOAD_LIMIT
from app.certificate_quiz_pass import apply_quiz_pass_certificate, course_certificate_is_email_only
from app.certificate_verification import (
    certificate_pdf_bytes,
    certificate_to_verify_response,
    find_certificate_by_no,
    normalize_cert_no,
)
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
verify_public_bp = Blueprint("verify_public", __name__)


def _verify_handler(cert_no: str):
    db = get_db()
    if db is None:
        return jsonify({"status": False, "valid": False, "message": "Service unavailable"}), 503
    cert_no = normalize_cert_no(cert_no)
    if not cert_no:
        return jsonify({"status": False, "valid": False, "message": "Certificate number is required"}), 400
    c = find_certificate_by_no(cert_no)
    body, code = certificate_to_verify_response(c, cert_no_input=cert_no)
    return jsonify(body), code


@certificates_bp.route("/verify/<cert_no>", methods=["GET"])
def verify_get(cert_no):
    return _verify_handler(cert_no)


@verify_public_bp.route("/verify-certificate", methods=["POST"])
def verify_post():
    data = request.get_json(silent=True) or {}
    cert_no = (
        data.get("certificate_no")
        or data.get("certificateNo")
        or data.get("certNo")
        or data.get("cert_no")
        or ""
    )
    return _verify_handler(str(cert_no))


@certificates_bp.route("/verify/<cert_no>/pdf", methods=["GET"])
def verify_download_pdf(cert_no):
    db = get_db()
    if db is None:
        return jsonify({"error": "Service unavailable"}), 503
    cert_no = normalize_cert_no(cert_no)
    if not cert_no:
        return jsonify({"error": "Certificate number is required"}), 400
    c = find_certificate_by_no(cert_no)
    if not c:
        return jsonify({"error": "Certificate not found"}), 404
    if str(c.get("status") or "valid").lower() == "revoked":
        return jsonify({"error": "Certificate has been revoked"}), 403
    try:
        pdf_bytes = certificate_pdf_bytes(c)
    except Exception as ex:
        current_app.logger.exception("certificate pdf build failed")
        return jsonify({"error": f"Could not load certificate PDF: {ex}"}), 500
    safe = "".join(ch for ch in cert_no if ch.isalnum() or ch in "-_") or "certificate"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="XpertIntern-{safe}.pdf"'},
    )


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
            "programName": c.get("programName", "") or c.get("domain", "") or c.get("course", ""),
            "university": c.get("university", "") or c.get("collegeName", ""),
            "issueDate": issue_date or "",
            "status": c.get("status", "valid"),
        })
    return jsonify({"items": items})
