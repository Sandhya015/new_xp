"""Certificate PDF — delegates to native FPDF builder (single page, selectable text)."""
from __future__ import annotations

from app.certificate_pdf import build_course_certificate_pdf


def build_certificate_from_profile(
    *,
    student_name: str,
    course_title: str,
    cert_no: str,
    issue_date_str: str,
    verify_url: str | None = None,
    college_name: str = "",
    registration_no: str = "",
    session: str = "",
    course: str = "",
    branch: str = "",
    domain: str = "",
    mode: str = "",
    start_date: str = "",
    end_date: str = "",
    marks: str = "",
    attendance: str = "",
    duration: str = "",
    performance_rating: str = "Good",
) -> bytes:
    """Render a one-page internship certificate with selectable PDF text."""
    return build_course_certificate_pdf(
        student_name=student_name,
        course_title=course_title,
        cert_no=cert_no,
        issue_date_str=issue_date_str,
        verify_url=verify_url,
        college_name=college_name,
        registration_no=registration_no,
        session=session,
        course=course,
        branch=branch,
        domain=domain,
        mode=mode,
        start_date=start_date,
        end_date=end_date,
        marks=marks,
        attendance=attendance,
        duration=duration,
        performance_rating=performance_rating,
    )


def build_certificate_template_pdf(*args, **kwargs) -> bytes:  # noqa: ANN002, ANN003
    return build_certificate_from_profile(*args, **kwargs)
