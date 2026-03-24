"""Simple certificate PDF (ReportLab) — Lambda-friendly pure Python."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def build_course_certificate_pdf(
    student_name: str,
    course_title: str,
    cert_no: str,
    issue_date_str: str,
) -> bytes:
    page = landscape(A4)
    w, h = page
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=page)

    c.setFillColor(colors.HexColor("#1a2b4d"))
    c.rect(12 * mm, 12 * mm, w - 24 * mm, h - 24 * mm, fill=0, stroke=1)

    c.setFillColor(colors.HexColor("#c9a227"))
    c.rect(14 * mm, 14 * mm, w - 28 * mm, h - 28 * mm, fill=0, stroke=1)

    c.setFillColor(colors.HexColor("#1a2b4d"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(w / 2, h - 35 * mm, "Certificate of Completion")

    c.setFont("Helvetica", 12)
    c.setFillColor(colors.HexColor("#4a5568"))
    c.drawCentredString(w / 2, h - 48 * mm, "This is to certify that")

    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(colors.HexColor("#1a2b4d"))
    c.drawCentredString(w / 2, h - 62 * mm, student_name or "Student")

    c.setFont("Helvetica", 12)
    c.setFillColor(colors.HexColor("#4a5568"))
    c.drawCentredString(w / 2, h - 74 * mm, "has successfully completed the program")

    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(colors.HexColor("#1a2b4d"))
    title = (course_title or "Course")[:80]
    c.drawCentredString(w / 2, h - 88 * mm, title)

    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#718096"))
    c.drawCentredString(w / 2, h - 102 * mm, f"Certificate ID: {cert_no}  |  Issued: {issue_date_str}")

    c.setFont("Helvetica-Oblique", 11)
    c.setFillColor(colors.HexColor("#2d3748"))
    c.drawCentredString(w / 2, 28 * mm, "XpertIntern — Industry-focused training & internships")

    c.showPage()
    c.save()
    return buf.getvalue()
