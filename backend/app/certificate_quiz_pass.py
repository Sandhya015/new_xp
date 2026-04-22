"""
Shared certificate flow after passing a course completion quiz: issue DB record, build PDF, optional email, optional download count.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Union

from flask import Response
from app.certificate_pdf import build_course_certificate_pdf
from app.db import get_certificates_collection, get_enrollments_collection, get_users_collection
from app.enrollment_lookup import user_course_enrollment_filter
from app.notifications import schedule_certificate_email


def course_certificate_is_email_only(course: dict | None) -> bool:
    if not course:
        return False
    return bool(course.get("certificateEmailOnly"))


def apply_quiz_pass_certificate(
    app,
    *,
    user_id: str,
    course_id: str,
    enrollment: dict,
    course: dict,
    user: dict,
    for_pdf_download: bool,
    cert_source: str = "python-quiz",
) -> Union[Response, dict, None]:
    """
    for_pdf_download: True = student clicked Generate; enforce download limit, increment, return PDF Response.
    False = email-only automatic issuance after pass; do not count toward PDF limit; return (None, json body dict).
    """
    enroll_coll = get_enrollments_collection()
    cert_coll = get_certificates_collection()
    course_title = course.get("title") or "Course"
    student_name = user.get("name") or user.get("fullName") or "Student"
    to_email = (user.get("email") or "").strip()
    cc = enrollment.get("courseCertificate") or {}

    # Caller must verify download limit for for_pdf_download=True before calling.

    cert_no = (cc.get("certNo") or "").strip() or None
    issue_dt = datetime.utcnow()

    if not cert_no:
        cert_no = f"XPI-{uuid.uuid4().hex[:12].upper()}"
        issue_dt = datetime.utcnow()
        cert_coll.insert_one({
            "studentId": user_id,
            "courseId": course_id,
            "certNo": cert_no,
            "studentName": student_name,
            "studentEmail": to_email,
            "programName": course_title,
            "university": user.get("university") or "",
            "issueDate": issue_dt,
            "completionDate": issue_dt.strftime("%Y-%m-%d"),
            "status": "valid",
            "source": (cert_source or "python-quiz")[:64],
        })
        enroll_coll.update_one(
            {"_id": enrollment["_id"]},
            {
                "$set": {
                    "courseCertificate": {
                        "certNo": cert_no,
                        "issuedAt": issue_dt,
                        "pdfDownloadCount": 0,
                    },
                    "status": "completed",
                    "completedAt": issue_dt,
                },
            },
        )
    else:
        issued = cc.get("issuedAt")
        if hasattr(issued, "strftime"):
            issue_dt = issued

    date_str = issue_dt.strftime("%Y-%m-%d") if hasattr(issue_dt, "strftime") else datetime.utcnow().strftime("%Y-%m-%d")
    pdf_bytes = build_course_certificate_pdf(student_name, course_title, cert_no, date_str)

    if to_email:
        schedule_certificate_email(
            app,
            student_name,
            to_email,
            course_title,
            cert_no,
            pdf_bytes,
        )

    if for_pdf_download:
        enroll_coll.update_one(
            {"_id": enrollment["_id"]},
            {"$inc": {"courseCertificate.pdfDownloadCount": 1}},
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
    return {
        "certNo": cert_no,
        "message": "Certificate is being sent to your registered email address (when mail is enabled).",
    }


def try_auto_email_certificate_on_quiz_pass(
    app,
    *,
    user_id: str,
    course_id: str,
    course: dict,
    enrollment: dict,
) -> None:
    """For certificateEmailOnly courses: first-time issue + email (no PDF download button). No-op on failure (logged)."""
    if not course_certificate_is_email_only(course):
        return
    e2 = get_enrollments_collection().find_one(user_course_enrollment_filter(user_id, course_id)) or enrollment
    cc2 = (e2 or {}).get("courseCertificate") or {}
    if (cc2.get("certNo") or "").strip():
        return
    users_coll = get_users_collection()
    try:
        from bson import ObjectId

        user = users_coll.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        return
    try:
        result = apply_quiz_pass_certificate(
            app,
            user_id=user_id,
            course_id=course_id,
            enrollment=e2,
            user=user,
            course=course,
            for_pdf_download=False,
            cert_source="python-quiz",
        )
        if not isinstance(result, dict) and app.logger:
            app.logger.warning("Quiz pass certificate: unexpected result: %r", type(result))
    except Exception as ex:
        if app.logger:
            app.logger.error("try_auto_email_certificate_on_quiz_pass: %s", ex)
