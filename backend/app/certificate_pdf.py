"""Certificate PDF — fpdf2 only (no Pillow/native deps; reliable on AWS Lambda)."""

from __future__ import annotations

import unicodedata

from fpdf import FPDF


def _pdf_text(s: str) -> str:
    """Helvetica core font is latin-1; normalize user-facing strings."""
    if not s:
        return ""
    s = s.replace("\u2014", "-").replace("\u2013", "-").replace("\u2026", "...")
    s = unicodedata.normalize("NFKD", s)
    return s.encode("latin-1", "replace").decode("latin-1")


def build_course_certificate_pdf(
    student_name: str,
    course_title: str,
    cert_no: str,
    issue_date_str: str,
) -> bytes:
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_page()
    w, h = pdf.w, pdf.h
    m = 16.0

    # Header wash
    pdf.set_fill_color(241, 245, 249)
    pdf.rect(0, 0, w, 40, style="F")

    # Outer + inner frame
    pdf.set_draw_color(201, 162, 39)
    pdf.set_line_width(0.55)
    pdf.rect(m, m, w - 2 * m, h - 2 * m, style="D")
    pdf.set_draw_color(26, 43, 77)
    pdf.set_line_width(0.35)
    pdf.rect(m + 2.5, m + 2.5, w - 2 * m - 5, h - 2 * m - 5, style="D")

    # Brand block (top center)
    pdf.set_y(11)
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(26, 43, 77)
    pdf.cell(w, 5, "XpertIntern", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(w, 4, "Industry-focused training & internships", align="C", new_x="LMARGIN", new_y="NEXT")

    # Title
    pdf.set_y(48)
    pdf.set_font("helvetica", "B", 26)
    pdf.set_text_color(26, 43, 77)
    pdf.cell(w, 11, "Certificate of Completion", align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(64)
    pdf.set_font("helvetica", "", 11)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(w, 6, "This is to certify that", align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(74)
    pdf.set_font("helvetica", "B", 21)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(w, 10, _pdf_text(student_name or "Student"), align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(88)
    pdf.set_font("helvetica", "", 11)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(w, 6, "has successfully completed the program", align="C", new_x="LMARGIN", new_y="NEXT")

    # Program name (may wrap)
    pdf.set_y(98)
    pdf.set_font("helvetica", "B", 15)
    pdf.set_text_color(26, 43, 77)
    title = _pdf_text((course_title or "Course").strip())[:220]
    inner_w = w - 2 * m - 48
    pdf.set_x(m + 24)
    pdf.multi_cell(inner_w, 8, title, align="C")

    y_after = pdf.get_y() + 8
    pdf.set_y(max(y_after, h - 46))
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    foot = _pdf_text(f"Certificate ID: {cert_no}    |    Issued: {issue_date_str}")
    pdf.cell(w, 6, foot, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(
        w,
        5,
        "Presented in recognition of your achievement. Retain this document for your records.",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.set_draw_color(201, 162, 39)
    pdf.set_line_width(0.5)
    y_line = h - 14
    pdf.line(m + 28, y_line, w - m - 28, y_line)

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out
