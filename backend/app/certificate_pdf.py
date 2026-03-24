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

    # Double border (navy + gold)
    pdf.set_draw_color(26, 43, 77)
    pdf.rect(12, 12, w - 24, h - 24, style="D")
    pdf.set_draw_color(201, 162, 39)
    pdf.rect(14, 14, w - 28, h - 28, style="D")

    def row(y: float, text: str, size: int, style: str = "", tr: int = 26, tg: int = 43, tb: int = 77) -> None:
        pdf.set_xy(0, y)
        pdf.set_font("helvetica", style, size)
        pdf.set_text_color(tr, tg, tb)
        pdf.cell(w, 10, text, align="C", new_x="LMARGIN", new_y="NEXT")

    row(h - 45, "Certificate of Completion", 28, "B")
    pdf.set_text_color(74, 85, 104)
    row(pdf.get_y() + 2, "This is to certify that", 12, "")
    pdf.set_text_color(26, 43, 77)
    row(pdf.get_y() + 4, _pdf_text(student_name or "Student"), 22, "B")
    pdf.set_text_color(74, 85, 104)
    row(pdf.get_y() + 4, "has successfully completed the program", 12, "")
    title = _pdf_text((course_title or "Course")[:80])
    pdf.set_text_color(26, 43, 77)
    row(pdf.get_y() + 6, title, 16, "B")
    pdf.set_text_color(113, 128, 150)
    row(pdf.get_y() + 8, _pdf_text(f"Certificate ID: {cert_no}  |  Issued: {issue_date_str}"), 10, "")
    pdf.set_text_color(45, 55, 72)
    row(28, "XpertIntern - Industry-focused training & internships", 11, "I")

    return pdf.output()

