"""Public certificate verification helpers and admin audit logging."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from urllib.parse import quote

from bson import ObjectId
from flask import current_app

from app.certificate_pdf import build_course_certificate_pdf
from app.certificate_storage import delete_certificate_pdf, read_certificate_pdf
from app.db import get_certificates_collection, get_db

INVALID_MSG = "No certificate found with this certificate number. Please check and try again."
REVOKED_MSG = "This certificate has been revoked and is no longer valid."


def normalize_cert_no(raw: str) -> str:
    return re.sub(r"\s+", "", (raw or "").strip()).upper()


def cert_no_lookup_filter(cert_no: str) -> dict:
    """Match certNo with or without dashes/spaces (legacy rows)."""
    n = normalize_cert_no(cert_no)
    if not n:
        return {"certNo": "__invalid__"}
    variants = {n, n.replace("-", ""), n.replace("_", "")}
    alnum = re.sub(r"[^A-Z0-9]", "", n)
    if alnum:
        variants.add(alnum)
    return {"certNo": {"$in": list(variants)}}


def find_certificate_by_no(cert_no: str) -> dict | None:
    coll = get_certificates_collection()
    return coll.find_one(cert_no_lookup_filter(cert_no))


def _date_str(val: Any) -> str:
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, str):
        return val.strip()[:10]
    return str(val or "").strip()[:10]


def certificate_pdf_bytes(c: dict) -> bytes:
    key = (c.get("certificatePdfKey") or "").strip()
    if key:
        stored = read_certificate_pdf(key)
        if stored:
            return stored
    student_name = c.get("studentName") or c.get("name") or "Student"
    program = c.get("programName") or c.get("course") or c.get("domain") or "Program"
    cert_no = (c.get("certNo") or "").strip() or "CERT"
    date_str = _date_str(c.get("completionDate") or c.get("issueDate") or c.get("internshipEndDate"))
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    return build_course_certificate_pdf(
        student_name=student_name,
        course_title=program,
        cert_no=cert_no,
        issue_date_str=date_str,
        verify_url=verify_url_for_cert(cert_no),
        college_name=(c.get("collegeName") or c.get("university") or "").strip(),
        registration_no=(c.get("registrationNo") or c.get("collegeRegNo") or "").strip(),
        session=(c.get("session") or "").strip(),
        course=(c.get("course") or c.get("programName") or "").strip(),
        branch=(c.get("branch") or "").strip(),
        domain=(c.get("domain") or c.get("programName") or "").strip(),
        mode=(c.get("mode") or "").strip(),
        start_date=_date_str(c.get("internshipStartDate") or c.get("startDate")),
        end_date=_date_str(c.get("internshipEndDate") or c.get("endDate") or c.get("completionDate")),
        marks=str(c.get("marks") or "").strip(),
        attendance=str(c.get("attendance") or "").strip(),
        duration=str(c.get("duration") or c.get("internshipDuration") or "").strip(),
        performance_rating=str(c.get("performanceRating") or "Good").strip() or "Good",
    )


def public_pdf_url(cert_no: str) -> str:
    return f"/api/certificates/verify/{quote(normalize_cert_no(cert_no), safe='')}/pdf"


def verify_url_for_cert(cert_no: str) -> str:
    pub = (current_app.config.get("PUBLIC_APP_URL") or "").strip().rstrip("/")
    path = f"/verify/{quote(normalize_cert_no(cert_no), safe='')}"
    return f"{pub}{path}" if pub else path


def certificate_to_verify_response(c: dict | None, *, cert_no_input: str = "") -> tuple[dict, int]:
    if not c:
        return {
            "status": False,
            "valid": False,
            "message": INVALID_MSG,
        }, 200

    status = str(c.get("status") or "valid").lower()
    cert_no = (c.get("certNo") or cert_no_input or "").strip()
    if status == "revoked":
        return {
            "status": False,
            "valid": False,
            "message": REVOKED_MSG,
            "certificate_no": cert_no,
        }, 200

    name = (c.get("studentName") or c.get("name") or "").strip()
    college = (c.get("collegeName") or c.get("university") or "").strip()
    course = (c.get("course") or c.get("programName") or "").strip()
    branch = (c.get("branch") or "").strip()
    semester = (c.get("semester") or "").strip()
    reg_no = (c.get("registrationNo") or c.get("collegeRegNo") or "").strip()
    domain = (c.get("domain") or c.get("programName") or "").strip()
    mode = (c.get("mode") or "").strip()
    start_date = _date_str(c.get("internshipStartDate") or c.get("startDate"))
    end_date = _date_str(c.get("internshipEndDate") or c.get("endDate") or c.get("completionDate"))
    marks = str(c.get("marks") or "").strip()
    attendance_raw = c.get("attendance")
    if attendance_raw is None or attendance_raw == "":
        attendance = ""
    else:
        s = str(attendance_raw).strip()
        attendance = s if "%" in s else f"{s}%"

    pdf_url = public_pdf_url(cert_no)
    return {
        "status": True,
        "valid": True,
        "certificate_no": cert_no,
        "certificateId": cert_no,
        "name": name,
        "studentName": name,
        "college_name": college,
        "university": college,
        "course": course,
        "programName": course,
        "branch": branch,
        "semester": semester,
        "registration_no": reg_no,
        "domain": domain,
        "mode": mode,
        "start_date": start_date,
        "end_date": end_date,
        "internship_start_date": start_date,
        "internship_end_date": end_date,
        "completionDate": end_date,
        "marks": marks,
        "attendance": attendance,
        "certificate_url": pdf_url,
        "verify_url": verify_url_for_cert(cert_no),
        "has_uploaded_pdf": bool((c.get("certificatePdfKey") or "").strip()),
    }, 200


def parse_certificate_admin_fields(data: dict) -> dict:
    """Normalize admin create/update payload."""
    d = data if isinstance(data, dict) else {}

    def s(key: str, *aliases: str, max_len: int = 500) -> str:
        for k in (key, *aliases):
            v = d.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()[:max_len]
        return ""

    cert_no = normalize_cert_no(s("certNo", "certificate_no", "certificateNo"))
    name = s("studentName", "name")
    out = {
        "certNo": cert_no,
        "studentName": name,
        "collegeName": s("collegeName", "college_name"),
        "course": s("course"),
        "branch": s("branch"),
        "semester": s("semester"),
        "registrationNo": s("registrationNo", "registration_no"),
        "domain": s("domain"),
        "mode": s("mode"),
        "internshipStartDate": s("internshipStartDate", "start_date", "startDate"),
        "internshipEndDate": s("internshipEndDate", "end_date", "endDate"),
        "marks": s("marks", max_len=50),
        "attendance": s("attendance", max_len=50),
        "session": s("session", max_len=80),
        "duration": s("duration", "internshipDuration", max_len=80),
        "performanceRating": s("performanceRating", "performance_rating", max_len=80) or "Good",
        "studentEmail": s("studentEmail", "email", max_len=200),
        "university": s("university", "collegeName", "college_name"),
        "programName": s("programName", "domain", "course"),
        "completionDate": s("completionDate", "internshipEndDate", "end_date"),
    }
    if out["university"] and not out["collegeName"]:
        out["collegeName"] = out["university"]
    if out["programName"] and not out["course"]:
        out["course"] = out["programName"]
    if out["domain"] and not out["programName"]:
        out["programName"] = out["domain"]
    return out


def allocate_certificate_number(domain: str = "INT") -> str:
    """XP/{year}/{DOMAIN}/{5-digit seq} e.g. XP/2026/INT/10001"""
    year = datetime.utcnow().year
    dom = re.sub(r"[^A-Z0-9]", "", (domain or "INT").upper())[:4] or "INT"
    prefix = f"XP/{year}/{dom}/"
    coll = get_certificates_collection()
    pattern = re.compile(rf"^{re.escape(prefix)}(\d{{5}})$", re.IGNORECASE)
    max_seq = 0
    for doc in coll.find({"certNo": {"$regex": f"^{re.escape(prefix)}", "$options": "i"}}, {"certNo": 1}).limit(5000):
        m = pattern.match(str(doc.get("certNo") or ""))
        if m:
            max_seq = max(max_seq, int(m.group(1)))
    return f"{prefix}{max_seq + 1:05d}"


def log_certificate_audit(
    *,
    certificate_id: str,
    cert_no: str,
    action: str,
    admin_user_id: str,
    admin_email: str,
    changes: dict | None = None,
) -> None:
    db = get_db()
    if db is None:
        return
    db["certificate_audit_logs"].insert_one({
        "certificateId": certificate_id,
        "certNo": cert_no,
        "action": action,
        "adminUserId": admin_user_id,
        "adminEmail": admin_email,
        "changes": changes or {},
        "createdAt": datetime.utcnow(),
    })


def certificate_admin_detail_fields(c: dict) -> dict:
    return {
        "collegeName": c.get("collegeName") or c.get("university") or "",
        "course": c.get("course") or c.get("programName") or "",
        "branch": c.get("branch") or "",
        "semester": c.get("semester") or "",
        "registrationNo": c.get("registrationNo") or "",
        "domain": c.get("domain") or c.get("programName") or "",
        "mode": c.get("mode") or "",
        "internshipStartDate": _date_str(c.get("internshipStartDate")),
        "internshipEndDate": _date_str(c.get("internshipEndDate") or c.get("completionDate")),
        "marks": str(c.get("marks") or ""),
        "attendance": str(c.get("attendance") or ""),
        "session": c.get("session") or "",
        "duration": c.get("duration") or c.get("internshipDuration") or "",
        "performanceRating": c.get("performanceRating") or "Good",
        "certificatePdfKey": c.get("certificatePdfKey") or "",
        "hasUploadedPdf": bool((c.get("certificatePdfKey") or "").strip()),
        "verifyUrl": verify_url_for_cert(str(c.get("certNo") or "")),
    }
