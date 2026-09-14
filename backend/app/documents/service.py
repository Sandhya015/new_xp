"""Generate and manage admin-issued student documents."""
from __future__ import annotations

import io
import random
import zipfile
from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId

from app.certificate_storage import save_certificate_pdf
from app.certificate_verification import allocate_certificate_number, verify_url_for_cert
from app.db import get_certificates_collection, get_courses_collection, get_student_documents_collection
from app.document_storage import read_student_document_pdf, save_student_document_pdf
from app.documents.student_profile import get_enrolled_students_for_course, profile_for_enrollment
from app.email_smtp import send_email


DOC_TYPE_LABELS = {
    "offer_letter_technical": "Technical Offer Letter",
    "offer_letter_non_technical": "Non-Technical Offer Letter",
    "id_card": "Student ID Card",
    "logbook": "Daily Training Logbook",
    "attendance_log": "Internship Attendance Log",
    "certificate_generated": "Certificate of Completion",
}

RATING_CRITERIA = [
    "Technical Knowledge & Application",
    "Quality of Work & Task Completion",
    "Initiative & Problem-Solving Ability",
    "Communication & Interpersonal Skills",
    "Punctuality, Discipline & Professional Conduct",
]


def _now() -> datetime:
    return datetime.utcnow()


def _serialize_doc(doc: dict) -> dict[str, Any]:
    created = doc.get("createdAt")
    return {
        "id": str(doc["_id"]),
        "studentId": doc.get("studentId"),
        "courseId": doc.get("courseId"),
        "enrollmentId": doc.get("enrollmentId"),
        "docType": doc.get("docType"),
        "docVariant": doc.get("docVariant"),
        "letterNo": doc.get("letterNo"),
        "title": DOC_TYPE_LABELS.get(doc.get("docType") or "", doc.get("docType") or "Document"),
        "studentName": (doc.get("profileSnapshot") or {}).get("name") or "",
        "courseTitle": doc.get("courseTitle") or "",
        "status": doc.get("status") or "active",
        "emailSentAt": doc.get("emailSentAt").isoformat() if doc.get("emailSentAt") else None,
        "createdAt": created.isoformat() if isinstance(created, datetime) else None,
        "certificateId": doc.get("certificateId"),
    }


def hub_counts() -> dict[str, int]:
    coll = get_student_documents_collection()
    counts: dict[str, int] = {}
    for dt in DOC_TYPE_LABELS:
        counts[dt] = coll.count_documents({"docType": dt, "status": "active"})
    return counts


def list_documents(
    *,
    doc_type: str | None = None,
    course_id: str | None = None,
    q: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {"status": "active"}
    if doc_type:
        filt["docType"] = doc_type
    if course_id:
        filt["courseId"] = course_id
    rows = list(get_student_documents_collection().find(filt).sort("createdAt", -1).limit(limit))
    out = [_serialize_doc(r) for r in rows]
    if q:
        ql = q.lower()
        out = [d for d in out if ql in (d.get("studentName") or "").lower() or ql in (d.get("letterNo") or "").lower()]
    return out


def student_documents_list(user_id: str) -> list[dict[str, Any]]:
    """Latest active doc per (courseId, docType) for student dashboard."""
    coll = get_student_documents_collection()
    rows = list(coll.find({"studentId": user_id, "status": "active"}).sort("createdAt", -1))
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, Any]] = []
    for r in rows:
        key = (str(r.get("courseId") or ""), str(r.get("docType") or ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(_serialize_doc(r))
    return out


def _send_document_email(config, *, to_addr: str, student_name: str, doc_title: str, course_title: str, pdf_bytes: bytes, filename: str) -> bool:
    if not to_addr:
        return False
    subject = f"Your {doc_title} — XpertIntern"
    html = (
        f"<p>Dear {student_name},</p>"
        f"<p>Please find attached your <strong>{doc_title}</strong> for "
        f"<strong>{course_title}</strong>.</p>"
        f"<p>You can also view and download it from your student dashboard under My Documents.</p>"
        f"<p>Regards,<br/>XpertIntern Team</p>"
    )
    text = (
        f"Dear {student_name},\n\nYour {doc_title} for {course_title} is attached.\n"
        f"View it anytime under My Documents on your dashboard.\n\nRegards,\nXpertIntern Team"
    )
    try:
        send_email(
            config,
            to_addr,
            subject,
            html,
            text_body=text,
            attachments=[(filename, pdf_bytes, "application/pdf")],
        )
        return True
    except Exception:
        return False


def _store_document(
    *,
    student_id: str,
    course_id: str,
    enrollment_id: str,
    doc_type: str,
    doc_variant: str,
    letter_no: str,
    profile: dict,
    inputs: dict,
    pdf_bytes: bytes,
    course_title: str,
    actor: dict,
    certificate_id: str | None = None,
    send_email: bool = True,
    app_config=None,
) -> dict[str, Any]:
    key = save_student_document_pdf(pdf_bytes)
    now = _now()
    doc = {
        "studentId": student_id,
        "courseId": course_id,
        "enrollmentId": enrollment_id,
        "docType": doc_type,
        "docVariant": doc_variant,
        "letterNo": letter_no,
        "inputs": inputs,
        "profileSnapshot": profile,
        "storageKey": key,
        "mimeType": "application/pdf",
        "courseTitle": course_title,
        "status": "active",
        "createdAt": now,
        "createdBy": actor.get("actor_email") or actor.get("actor_id"),
        "certificateId": certificate_id,
    }
    if send_email and app_config and profile.get("email"):
        sent = _send_document_email(
            app_config,
            to_addr=profile["email"],
            student_name=profile.get("name") or "Student",
            doc_title=DOC_TYPE_LABELS.get(doc_type, "Document"),
            course_title=course_title,
            pdf_bytes=pdf_bytes,
            filename=f"xpertintern-{doc_type.replace('_', '-')}.pdf",
        )
        if sent:
            doc["emailSentAt"] = now
    ins = get_student_documents_collection().insert_one(doc)
    doc["_id"] = ins.inserted_id
    return _serialize_doc(doc)


def generate_offer_letters(
    *,
    course_id: str,
    variant: str,
    student_ids: list[str],
    inputs: dict[str, Any],
    actor: dict,
    app_config,
) -> dict[str, Any]:
    from app.documents.pdf_offer_letter import build_offer_letter_pdf

    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) if ObjectId.is_valid(course_id) else None
    course_title = (course or {}).get("title") or "Training"
    created = []
    for sid in student_ids:
        prof = profile_for_enrollment(sid, course_id)
        if not prof:
            continue
        profile = prof["profile"]
        letter_no = allocate_certificate_number("INT")
        pdf = build_offer_letter_pdf(
            profile=profile,
            inputs=inputs,
            variant=variant,
            letter_no=letter_no,
        )
        doc_type = "offer_letter_technical" if variant == "technical" else "offer_letter_non_technical"
        created.append(
            _store_document(
                student_id=sid,
                course_id=course_id,
                enrollment_id=prof["enrollmentId"],
                doc_type=doc_type,
                doc_variant=variant,
                letter_no=letter_no,
                profile=profile,
                inputs=inputs,
                pdf_bytes=pdf,
                course_title=course_title,
                actor=actor,
                app_config=app_config,
            )
        )
    return {"ok": True, "created": len(created), "items": created}


def generate_id_cards(
    *,
    course_id: str,
    variant: str,
    student_ids: list[str],
    actor: dict,
    app_config,
) -> dict[str, Any]:
    from app.documents.pdf_id_card import build_id_card_pdf

    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) if ObjectId.is_valid(course_id) else None
    course_title = (course or {}).get("title") or "Training"
    created = []
    for sid in student_ids:
        prof = profile_for_enrollment(sid, course_id)
        if not prof:
            continue
        profile = prof["profile"]
        letter_no = allocate_certificate_number("INT")
        pdf = build_id_card_pdf(profile=profile, letter_no=letter_no)
        created.append(
            _store_document(
                student_id=sid,
                course_id=course_id,
                enrollment_id=prof["enrollmentId"],
                doc_type="id_card",
                doc_variant=variant,
                letter_no=letter_no,
                profile=profile,
                inputs={},
                pdf_bytes=pdf,
                course_title=course_title,
                actor=actor,
                app_config=app_config,
            )
        )
    return {"ok": True, "created": len(created), "items": created}


def generate_logbooks(
    *,
    course_id: str,
    variant: str,
    student_ids: list[str],
    inputs: dict[str, Any],
    actor: dict,
    app_config,
) -> dict[str, Any]:
    from app.documents.pdf_logbook import build_logbook_pdf

    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) if ObjectId.is_valid(course_id) else None
    course_title = (course or {}).get("title") or "Training"
    created = []
    for sid in student_ids:
        prof = profile_for_enrollment(sid, course_id)
        if not prof:
            continue
        profile = prof["profile"]
        letter_no = allocate_certificate_number("INT")
        pdf = build_logbook_pdf(profile=profile, inputs=inputs)
        created.append(
            _store_document(
                student_id=sid,
                course_id=course_id,
                enrollment_id=prof["enrollmentId"],
                doc_type="logbook",
                doc_variant=variant,
                letter_no=letter_no,
                profile=profile,
                inputs=inputs,
                pdf_bytes=pdf,
                course_title=course_title,
                actor=actor,
                app_config=app_config,
            )
        )
    return {"ok": True, "created": len(created), "items": created}


def generate_attendance_logs(
    *,
    course_id: str,
    student_ids: list[str],
    inputs: dict[str, Any],
    actor: dict,
    app_config,
) -> dict[str, Any]:
    from app.attendance.service import attendance_history_for_user
    from app.documents.pdf_attendance_log import build_attendance_log_pdf

    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) if ObjectId.is_valid(course_id) else None
    course_title = (course or {}).get("title") or "Training"
    created = []
    for sid in student_ids:
        prof = profile_for_enrollment(sid, course_id)
        if not prof:
            continue
        profile = prof["profile"]
        history = attendance_history_for_user(course_id, sid)
        letter_no = allocate_certificate_number("INT")
        pdf = build_attendance_log_pdf(profile=profile, inputs=inputs, attendance_rows=history)
        created.append(
            _store_document(
                student_id=sid,
                course_id=course_id,
                enrollment_id=prof["enrollmentId"],
                doc_type="attendance_log",
                doc_variant="technical",
                letter_no=letter_no,
                profile=profile,
                inputs=inputs,
                pdf_bytes=pdf,
                course_title=course_title,
                actor=actor,
                app_config=app_config,
            )
        )
    return {"ok": True, "created": len(created), "items": created}


def _random_marks(min_pct: int, max_pct: int) -> str:
    return str(random.randint(min_pct, max_pct))


def _random_ratings() -> str:
    return random.choice(["Outstanding", "Good"])


def generate_certificates_batch(
    *,
    course_id: str,
    variant: str,
    student_ids: list[str],
    inputs: dict[str, Any],
    actor: dict,
    app_config,
    with_sign: bool = True,
) -> dict[str, Any]:
    from app.attendance.service import attendance_percent_for_user
    from app.documents.pdf_certificate_template import build_certificate_from_profile

    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) if ObjectId.is_valid(course_id) else None
    course_title = (course or {}).get("title") or "Training"
    marks_min = int(inputs.get("marksMin") or 80)
    marks_max = int(inputs.get("marksMax") or 90)
    start = inputs.get("internshipStartDate") or ""
    weeks = int(inputs.get("durationWeeks") or 4)
    end_dt = _now()
    if start:
        try:
            sdt = datetime.strptime(str(start)[:10], "%Y-%m-%d")
            end_dt = sdt + timedelta(weeks=weeks)
            end = end_dt.strftime("%Y-%m-%d")
        except ValueError:
            end = ""
    else:
        end = ""
    created = []
    cert_coll = get_certificates_collection()
    for sid in student_ids:
        prof = profile_for_enrollment(sid, course_id)
        if not prof:
            continue
        profile = prof["profile"]
        cert_no = allocate_certificate_number("INT")
        attendance_pct = attendance_percent_for_user(course_id, sid)
        marks = _random_marks(marks_min, marks_max)
        rating = _random_ratings()
        verify_url = verify_url_for_cert(cert_no)
        pdf = build_certificate_from_profile(
            student_name=profile.get("name") or "Student",
            course_title=course_title,
            cert_no=cert_no,
            issue_date_str=inputs.get("certificationDate") or _now().strftime("%Y-%m-%d"),
            verify_url=verify_url,
            college_name=profile.get("collegeName") or "",
            registration_no=profile.get("registrationNo") or "",
            session=profile.get("session") or "",
            course=profile.get("course") or "",
            branch=profile.get("branch") or "",
            domain=profile.get("domain") or course_title,
            mode=inputs.get("mode") or "Offline",
            start_date=str(start),
            end_date=end,
            marks=marks,
            attendance=str(attendance_pct) if attendance_pct is not None else "0",
            duration=f"{weeks} weeks",
            performance_rating=rating,
        )
        cert_key = save_certificate_pdf(pdf, cert_no=cert_no)
        now = _now()
        cert_doc = {
            "certNo": cert_no,
            "studentName": profile.get("name"),
            "studentEmail": profile.get("email"),
            "studentId": sid,
            "courseId": course_id,
            "programName": course_title,
            "domain": profile.get("domain") or course_title,
            "collegeName": profile.get("collegeName"),
            "registrationNo": profile.get("registrationNo"),
            "session": profile.get("session"),
            "course": profile.get("course"),
            "branch": profile.get("branch"),
            "mode": inputs.get("mode") or "Offline",
            "internshipStartDate": start,
            "internshipEndDate": end,
            "marks": marks,
            "attendance": f"{attendance_pct}%" if attendance_pct is not None else "0%",
            "duration": f"{weeks} weeks",
            "performanceRating": rating,
            "status": "valid",
            "source": "admin-generated",
            "pdfStatus": "generated",
            "certificatePdfKey": cert_key,
            "issueDate": now,
            "createdAt": now,
            "updatedAt": now,
        }
        ins = cert_coll.insert_one(cert_doc)
        cert_id = str(ins.inserted_id)
        item = _store_document(
            student_id=sid,
            course_id=course_id,
            enrollment_id=prof["enrollmentId"],
            doc_type="certificate_generated",
            doc_variant=variant,
            letter_no=cert_no,
            profile=profile,
            inputs=inputs,
            pdf_bytes=pdf,
            course_title=course_title,
            actor=actor,
            certificate_id=cert_id,
            app_config=app_config,
        )
        created.append(item)
    return {"ok": True, "created": len(created), "items": created}


def _fresh_certificate_pdf(doc: dict) -> bytes | None:
    """Rebuild certificate PDF from DB fields (always uses latest template)."""
    cert_id = doc.get("certificateId")
    if cert_id and ObjectId.is_valid(str(cert_id)):
        cert = get_certificates_collection().find_one({"_id": ObjectId(str(cert_id))})
        if cert:
            from app.certificate_verification import certificate_pdf_bytes

            return certificate_pdf_bytes(cert)

    profile = doc.get("profileSnapshot") or {}
    inputs = doc.get("inputs") or {}
    cert_no = str(doc.get("letterNo") or "CERT")
    start = str(inputs.get("internshipStartDate") or inputs.get("startDate") or "")
    weeks = int(inputs.get("durationWeeks") or 4)
    try:
        sdt = datetime.strptime(start[:10], "%Y-%m-%d")
        end = (sdt + timedelta(weeks=weeks)).strftime("%Y-%m-%d")
    except ValueError:
        end = ""
    from app.documents.pdf_certificate_template import build_certificate_from_profile

    return build_certificate_from_profile(
        student_name=profile.get("name") or "Student",
        course_title=doc.get("courseTitle") or profile.get("domain") or "Internship",
        cert_no=cert_no,
        issue_date_str=str(inputs.get("certificationDate") or _now().strftime("%Y-%m-%d")),
        verify_url=verify_url_for_cert(cert_no),
        college_name=profile.get("collegeName") or "",
        registration_no=profile.get("registrationNo") or "",
        session=profile.get("session") or "",
        course=profile.get("course") or "",
        branch=profile.get("branch") or "",
        domain=profile.get("domain") or "",
        mode=str(inputs.get("mode") or "Offline"),
        start_date=start,
        end_date=end,
        marks=str(inputs.get("marks") or ""),
        attendance=str(inputs.get("attendance") or ""),
        duration=str(inputs.get("durationWeeks") or "") + " weeks" if inputs.get("durationWeeks") else "",
        performance_rating=str(inputs.get("performanceRating") or "Good"),
    )


def _fresh_document_pdf(doc: dict) -> bytes | None:
    """Rebuild PDF with latest templates (offer letter, attendance log, etc.)."""
    doc_type = doc.get("docType") or ""
    if doc_type == "certificate_generated":
        return _fresh_certificate_pdf(doc)

    profile = doc.get("profileSnapshot") or {}
    inputs = doc.get("inputs") or {}
    letter_no = str(doc.get("letterNo") or "DOC")

    try:
        if doc_type == "offer_letter_technical":
            from app.documents.pdf_offer_letter import build_offer_letter_pdf

            return build_offer_letter_pdf(
                profile=profile, inputs=inputs, variant="technical", letter_no=letter_no
            )
        if doc_type == "offer_letter_non_technical":
            from app.documents.pdf_offer_letter import build_offer_letter_pdf

            return build_offer_letter_pdf(
                profile=profile, inputs=inputs, variant="non-technical", letter_no=letter_no
            )
        if doc_type == "attendance_log":
            from app.attendance.service import attendance_history_for_user
            from app.documents.pdf_attendance_log import build_attendance_log_pdf

            course_id = str(doc.get("courseId") or "")
            student_id = str(doc.get("studentId") or "")
            history = (
                attendance_history_for_user(course_id, student_id)
                if course_id and student_id
                else []
            )
            return build_attendance_log_pdf(profile=profile, inputs=inputs, attendance_rows=history)
        if doc_type == "logbook":
            from app.documents.pdf_logbook import build_logbook_pdf

            return build_logbook_pdf(profile=profile, inputs=inputs)
        if doc_type == "id_card":
            from app.documents.pdf_id_card import build_id_card_pdf

            return build_id_card_pdf(profile=profile, letter_no=letter_no)
    except Exception:
        return None
    return None


def get_document_pdf(doc_id: str) -> tuple[bytes | None, str]:
    if not ObjectId.is_valid(doc_id):
        return None, ""
    doc = get_student_documents_collection().find_one({"_id": ObjectId(doc_id)})
    if not doc:
        return None, ""
    name = f"{doc.get('docType', 'document')}-{doc.get('letterNo', doc_id)}.pdf"
    fresh = _fresh_document_pdf(doc)
    if fresh:
        return fresh, name
    key = doc.get("storageKey") or ""
    data = read_student_document_pdf(key)
    return data, name


def delete_document(doc_id: str) -> bool:
    if not ObjectId.is_valid(doc_id):
        return False
    r = get_student_documents_collection().update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"status": "deleted", "updatedAt": _now()}},
    )
    return r.modified_count > 0


def bulk_download_zip(doc_ids: list[str], *, with_sign: bool = True) -> bytes | None:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for did in doc_ids:
            data, name = get_document_pdf(did)
            if data:
                zf.writestr(name, data)
    raw = buf.getvalue()
    return raw if len(raw) > 22 else None


PREVIEW_PROFILE: dict[str, Any] = {
    "name": "Sample Student",
    "email": "sample.student@example.com",
    "mobile": "+91 9876543210",
    "university": "Sample University",
    "collegeName": "Sample College of Engineering",
    "registrationNo": "UNIV/2026/001",
    "session": "2025-26",
    "course": "B.Tech Computer Science",
    "branch": "Computer Science",
    "domain": "Python Full Stack Internship",
    "programName": "Python Full Stack Internship",
}

PREVIEW_LETTER_NO = "XP/2026/INT/PREVIEW"

PREVIEW_INPUTS: dict[str, Any] = {
    "mode": "Offline",
    "internshipStartDate": "2026-01-15",
    "durationWeeks": 4,
    "durationLabel": "4 weeks",
    "stipend": "Unpaid",
    "marksMin": 85,
    "marksMax": 90,
    "certificationDate": _now().strftime("%Y-%m-%d"),
}

PREVIEW_ATTENDANCE_ROWS: list[dict[str, Any]] = [
    {"date": "2026-01-15", "timeIn": "09:00", "timeOut": "13:00", "hoursCompleted": 4},
    {"date": "2026-01-16", "timeIn": "09:30", "timeOut": "13:30", "hoursCompleted": 4},
    {"date": "2026-01-17", "timeIn": "10:00", "timeOut": "14:00", "hoursCompleted": 4},
]


def preview_pdf(sample_key: str) -> bytes | None:
    """Generate a live PDF preview using the same builders as production (mock data)."""
    from app.documents.pdf_attendance_log import build_attendance_log_pdf
    from app.documents.pdf_certificate_template import build_certificate_from_profile
    from app.documents.pdf_id_card import build_id_card_pdf
    from app.documents.pdf_logbook import build_logbook_pdf
    from app.documents.pdf_offer_letter import build_offer_letter_pdf

    key = (sample_key or "").strip()
    profile = PREVIEW_PROFILE
    inputs = PREVIEW_INPUTS
    letter_no = PREVIEW_LETTER_NO

    if key == "offer-letter-technical":
        return build_offer_letter_pdf(profile=profile, inputs=inputs, variant="technical", letter_no=letter_no)
    if key == "offer-letter-non-technical":
        return build_offer_letter_pdf(profile=profile, inputs=inputs, variant="non-technical", letter_no=letter_no)
    if key == "id-card":
        return build_id_card_pdf(profile=profile, letter_no=letter_no, issued_on=_now().strftime("%d/%m/%Y"))
    if key == "logbook":
        return build_logbook_pdf(profile=profile, inputs=inputs)
    if key == "attendance-log":
        return build_attendance_log_pdf(profile=profile, inputs=inputs, attendance_rows=PREVIEW_ATTENDANCE_ROWS)
    if key == "certificate":
        cert_no = letter_no
        verify_url = verify_url_for_cert(cert_no)
        start = str(inputs.get("internshipStartDate") or "")
        weeks = int(inputs.get("durationWeeks") or 4)
        try:
            sdt = datetime.strptime(start[:10], "%Y-%m-%d")
            end = (sdt + timedelta(weeks=weeks)).strftime("%Y-%m-%d")
        except ValueError:
            end = ""
        return build_certificate_from_profile(
            student_name=profile.get("name") or "Sample Student",
            course_title=profile.get("domain") or "Internship Program",
            cert_no=cert_no,
            issue_date_str=str(inputs.get("certificationDate") or _now().strftime("%Y-%m-%d")),
            verify_url=verify_url,
            college_name=profile.get("collegeName") or "",
            registration_no=profile.get("registrationNo") or "",
            session=profile.get("session") or "",
            course=profile.get("course") or "",
            branch=profile.get("branch") or "",
            domain=profile.get("domain") or "",
            mode=str(inputs.get("mode") or "Offline"),
            start_date=start,
            end_date=end,
            marks="87",
            attendance="92",
            duration=f"{weeks} weeks",
            performance_rating="Outstanding",
        )
    return None
