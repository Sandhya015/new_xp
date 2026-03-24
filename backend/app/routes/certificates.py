"""
Certificates: verify (public), list my (student). Admin upload/bulk/send-email stubbed for later.
"""
import uuid
from datetime import datetime

from bson import ObjectId
from flask import Blueprint, Response, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.certificate_pdf import build_course_certificate_pdf
from app.course_features import course_has_python_quiz
from app.db import (
    get_db,
    get_certificates_collection,
    get_courses_collection,
    get_enrollments_collection,
    get_users_collection,
)
from app.notifications import schedule_certificate_email

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
    After passing the Python course quiz: PDF certificate + email (first issue only).
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
    e = enroll_coll.find_one({"userId": user_id, "courseId": course_id})
    if not e:
        return jsonify({"error": "Not enrolled in this course"}), 404

    pq = e.get("pythonQuiz") or {}
    if not pq.get("passedAt"):
        return jsonify({"error": "Complete and pass the course quiz first"}), 400

    courses_coll = get_courses_collection()
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c or not course_has_python_quiz(c):
        return jsonify({"error": "Certificate is not available for this course"}), 404

    users_coll = get_users_collection()
    try:
        user = users_coll.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        return jsonify({"error": "User not found"}), 404

    student_name = user.get("name") or user.get("fullName") or "Student"
    course_title = c.get("title") or "Course"

    cc = e.get("courseCertificate") or {}
    cert_no = cc.get("certNo")
    newly_issued = False
    issue_dt = datetime.utcnow()

    if not cert_no:
        cert_no = f"XPI-{uuid.uuid4().hex[:12].upper()}"
        issue_dt = datetime.utcnow()
        cert_coll = get_certificates_collection()
        cert_coll.insert_one({
            "studentId": user_id,
            "courseId": course_id,
            "certNo": cert_no,
            "studentName": student_name,
            "programName": course_title,
            "university": user.get("university") or "",
            "issueDate": issue_dt,
            "completionDate": issue_dt.strftime("%Y-%m-%d"),
            "status": "valid",
            "source": "python-quiz",
        })
        enroll_coll.update_one(
            {"_id": e["_id"]},
            {"$set": {"courseCertificate": {"certNo": cert_no, "issuedAt": issue_dt}}},
        )
        newly_issued = True
    else:
        issued = cc.get("issuedAt")
        if hasattr(issued, "strftime"):
            issue_dt = issued

    date_str = issue_dt.strftime("%Y-%m-%d") if hasattr(issue_dt, "strftime") else datetime.utcnow().strftime("%Y-%m-%d")
    pdf_bytes = build_course_certificate_pdf(student_name, course_title, cert_no, date_str)

    to_email = (user.get("email") or "").strip()
    if newly_issued and to_email:
        schedule_certificate_email(
            current_app._get_current_object(),
            student_name,
            to_email,
            course_title,
            cert_no,
            pdf_bytes,
        )

    safe_name = "".join(ch for ch in cert_no if ch.isalnum() or ch in "-_")
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="XpertIntern-{safe_name}.pdf"',
            "X-Certificate-Id": cert_no,
        },
    )


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
