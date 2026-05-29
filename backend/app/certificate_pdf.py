"""Internship certificate PDF — XpertIntern official layout (portrait A4, fpdf2)."""

from __future__ import annotations

import io
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import segno
except ImportError:
    segno = None  # type: ignore[assignment,misc]

from fpdf import FPDF

_ASSETS = Path(__file__).resolve().parent / "static" / "certificate"

BRAND_BLUE = (0, 74, 142)
BRAND_BLUE_LIGHT = (232, 240, 248)
TEXT_DARK = (30, 41, 59)
TEXT_MUTED = (71, 85, 105)

CONTACT_LINES = (
    "Arfabad Colony, East Nahar Road, Bajrangpuri, Patna, Bihar - 800007",
    "7004762654",
    "contact@xpertintern.com",
    "www.xpertintern.com",
)

ASSESSMENT_CRITERIA = (
    "Technical Knowledge & Application, Quality of Work & Task Completion, "
    "Initiative & Problem-Solving Ability, Communication & Interpersonal Skills, "
    "Punctuality, Discipline & Professional Conduct"
)

# Reserved bottom area for QR / signature / partner logos (mm)
_FOOTER_LOGOS_H = 11.0
_FOOTER_BLOCK_H = 36.0
_PAGE_BOTTOM = 287.0


def _pdf_text(s: str) -> str:
    if not s:
        return ""
    s = s.replace("\u2014", "-").replace("\u2013", "-").replace("\u2026", "...")
    s = unicodedata.normalize("NFKD", s)
    return s.encode("latin-1", "replace").decode("latin-1")


def _asset(name: str) -> str | None:
    p = _ASSETS / name
    return str(p) if p.is_file() else None


def _qr_png_bytes(data: str, *, scale: int = 4) -> bytes | None:
    if segno is None:
        return None
    buf = io.BytesIO()
    segno.make(data, error="m").save(buf, kind="png", scale=scale, border=1)
    return buf.getvalue()


def _parse_date(val: Any) -> datetime | None:
    if val is None or val == "":
        return None
    if hasattr(val, "strftime"):
        return val
    s = str(val).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _format_long_date(val: Any) -> str:
    dt = _parse_date(val)
    if not dt:
        return _pdf_text(str(val or "").strip())
    return f"{dt.day} {dt.strftime('%B %Y')}"


def _format_cert_date(val: Any) -> str:
    dt = _parse_date(val)
    if not dt:
        return _pdf_text(str(val or "").strip())
    return dt.strftime("%d/%m/%Y")


def _format_pct(val: str) -> str:
    s = str(val or "").strip()
    if not s:
        return "-"
    return s if "%" in s else f"{s}%"


def _compute_duration(start: Any, end: Any, duration: str = "") -> str:
    if duration.strip():
        return _pdf_text(duration.strip())
    sdt, edt = _parse_date(start), _parse_date(end)
    if not sdt or not edt or edt < sdt:
        return "-"
    days = (edt - sdt).days + 1
    weeks = max(1, round(days / 7))
    return f"{weeks} Week{'s' if weeks != 1 else ''}"


def _course_line(course: str, branch: str) -> str:
    course = (course or "").strip()
    branch = (branch or "").strip()
    if course and branch:
        return f"{course} ({branch})"
    return course or branch or "-"


def _verify_display_url(verify_url: str | None) -> str:
    if not verify_url:
        return "www.xpertintern.com/verify"
    u = verify_url.strip()
    for prefix in ("https://", "http://"):
        if u.lower().startswith(prefix):
            u = u[len(prefix) :]
            break
    return u.replace("https://", "").replace("http://", "")


class _CertPDF(FPDF):
    def footer(self):
        pass


def _line_center(
    pdf: FPDF,
    *,
    x0: float,
    inner_w: float,
    y: float,
    text: str,
    size: int = 10,
    style: str = "",
    color: tuple[int, int, int] = TEXT_MUTED,
    h: float = 4.8,
) -> float:
    pdf.set_xy(x0, y)
    pdf.set_font("helvetica", style, size)
    pdf.set_text_color(*color)
    pdf.cell(inner_w, h, _pdf_text(text), align="C")
    return y + h


def _block_center(
    pdf: FPDF,
    *,
    x0: float,
    inner_w: float,
    y: float,
    text: str,
    size: int = 10,
    style: str = "",
    color: tuple[int, int, int] = TEXT_DARK,
    line_h: float = 4.2,
) -> float:
    pdf.set_xy(x0, y)
    pdf.set_font("helvetica", style, size)
    pdf.set_text_color(*color)
    pdf.multi_cell(inner_w, line_h, _pdf_text(text), align="C")
    return pdf.get_y()


def _draw_border(pdf: FPDF, m: float, w: float, h: float) -> None:
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(1.0)
    pdf.rect(m, m, w - 2 * m, h - 2 * m, style="D")
    pdf.set_line_width(0.35)
    pdf.rect(m + 1.5, m + 1.5, w - 2 * m - 3, h - 2 * m - 3, style="D")


def _draw_header(pdf: FPDF, *, x0: float, w: float) -> float:
    y = 13.0
    logo = _asset("brand_logo.png") or _asset("header_logo.png")
    if logo:
        try:
            pdf.image(logo, x=x0, y=y - 1, w=38)
        except Exception:
            pass

    pdf.set_font("helvetica", "", 6.5)
    pdf.set_text_color(*TEXT_MUTED)
    line_h = 3.3
    for i, line in enumerate(CONTACT_LINES):
        pdf.set_xy(x0, y + i * line_h)
        pdf.cell(w - 2 * x0, line_h, _pdf_text(line), align="R")

    y_rule = y + len(CONTACT_LINES) * line_h + 3
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.7)
    pdf.line(x0, y_rule, w - x0, y_rule)
    return y_rule + 5


def _draw_title(pdf: FPDF, *, y: float, w: float) -> float:
    return _line_center(
        pdf,
        x0=0,
        inner_w=w,
        y=y,
        text="CERTIFICATE OF COMPLETION",
        size=17,
        style="B",
        color=BRAND_BLUE,
        h=9,
    ) + 2


def _draw_body_paragraph(
    pdf: FPDF,
    *,
    x0: float,
    inner_w: float,
    y: float,
    student_name: str,
    college_name: str,
    registration_no: str,
    session: str,
    course_line: str,
) -> float:
    y = _line_center(pdf, x0=x0, inner_w=inner_w, y=y, text="This is to certify that", size=9)
    y += 1
    y = _line_center(
        pdf, x0=x0, inner_w=inner_w, y=y,
        text=student_name or "Student", size=12, style="B", color=TEXT_DARK, h=6,
    )
    y = _line_center(pdf, x0=x0, inner_w=inner_w, y=y, text="of", size=9)
    y = _block_center(
        pdf, x0=x0, inner_w=inner_w, y=y,
        text=college_name or "-", size=10, style="B", color=TEXT_DARK, line_h=4.0,
    )
    y += 0.5
    reg = registration_no.strip() or "-"
    y = _line_center(
        pdf, x0=x0, inner_w=inner_w, y=y,
        text=f"bearing University Registration/Enrolment No. {reg}",
        size=8.5, h=4.5,
    )
    if session.strip():
        y = _line_center(
            pdf, x0=x0, inner_w=inner_w, y=y,
            text=f"Session {session.strip()}, enrolled in",
            size=8.5, h=4.5,
        )
    else:
        y = _line_center(pdf, x0=x0, inner_w=inner_w, y=y, text="enrolled in", size=8.5, h=4.5)
    y = _block_center(
        pdf, x0=x0, inner_w=inner_w, y=y,
        text=course_line, size=9.5, style="B", color=TEXT_DARK, line_h=4.0,
    )
    y = _line_center(
        pdf, x0=x0, inner_w=inner_w, y=y,
        text="has successfully completed his/her Internship with our organisation.",
        size=8.5, h=4.5,
    )
    return y + 2


def _draw_kv_table(
    pdf: FPDF,
    *,
    x0: float,
    inner_w: float,
    y: float,
    rows: list[tuple[str, str]],
    label_w: float = 88.0,
) -> float:
    row_h = 6.8
    val_w = inner_w - label_w
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    for label, value in rows:
        val = _pdf_text(value or "-")
        pdf.set_xy(x0, y)
        pdf.set_font("helvetica", "", 8)
        pdf.set_fill_color(*BRAND_BLUE_LIGHT)
        pdf.set_text_color(*TEXT_DARK)
        pdf.cell(label_w, row_h, f"  {label}", border=1, fill=True)
        pdf.set_fill_color(255, 255, 255)
        if len(val) > 42:
            pdf.set_font("helvetica", "", 7)
        pdf.cell(val_w, row_h, f"  {val[:120]}", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")
        y += row_h
    return y + 2


def _draw_assessment_table(
    pdf: FPDF,
    *,
    x0: float,
    inner_w: float,
    y: float,
    rating: str,
) -> float:
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.set_xy(x0, y)
    pdf.cell(inner_w, 5, "Internship Performance Assessment", new_x="LMARGIN", new_y="NEXT")
    y += 6

    head_h = 6.0
    body_h = 16.0
    crit_w = inner_w * 0.78
    rate_w = inner_w - crit_w

    pdf.set_fill_color(*BRAND_BLUE)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_xy(x0, y)
    pdf.cell(crit_w, head_h, "  Assessment Criteria", border=1, fill=True)
    pdf.cell(rate_w, head_h, "  Rating", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")

    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(x0, y + head_h, inner_w, body_h, style="D")

    pdf.set_font("helvetica", "", 6.8)
    pdf.set_text_color(*TEXT_DARK)
    pdf.set_xy(x0 + 1.5, y + head_h + 1.2)
    pdf.multi_cell(crit_w - 3, 3.2, _pdf_text(ASSESSMENT_CRITERIA), border=0)

    pdf.set_font("helvetica", "", 8.5)
    pdf.set_xy(x0 + crit_w, y + head_h + body_h / 2 - 3)
    pdf.cell(rate_w, 6, f"  {_pdf_text(rating or 'Good')}", align="L")

    return y + head_h + body_h + 2


def _draw_footer_block(
    pdf: FPDF,
    *,
    x0: float,
    w: float,
    y: float,
    cert_no: str,
    issue_date_str: str,
    verify_url: str | None,
) -> None:
    qr_size = 22.0
    qr_x = x0
    qr_y = y

    if verify_url:
        qr_png = _qr_png_bytes(verify_url)
        if qr_png:
            try:
                pdf.image(qr_png, x=qr_x, y=qr_y, w=qr_size, h=qr_size)
            except Exception:
                pass

    tx = qr_x + qr_size + 3
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(*TEXT_DARK)
    pdf.set_xy(tx, qr_y)
    pdf.cell(98, 3.8, _pdf_text(f"Certificate Number: {cert_no}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(tx)
    pdf.cell(98, 3.8, _pdf_text(f"Date of Certification: {_format_cert_date(issue_date_str)}"))
    pdf.set_xy(tx, qr_y + 9)
    pdf.set_font("helvetica", "", 6.8)
    pdf.set_text_color(*TEXT_MUTED)
    pdf.multi_cell(
        98,
        3.2,
        _pdf_text(f"Online Certificate Verification Available on: {_verify_display_url(verify_url)}"),
    )

    sig = _asset("signature_block.png")
    sig_w = 58.0
    sig_x = w - x0 - sig_w
    if sig:
        try:
            pdf.image(sig, x=sig_x, y=y - 1, w=sig_w)
        except Exception:
            pdf.set_font("helvetica", "I", 8)
            pdf.set_text_color(*TEXT_DARK)
            pdf.set_xy(sig_x, y + 4)
            pdf.multi_cell(sig_w, 3.8, "Raushan Kumar\nFounder & CEO\nXpert Ventures Private Limited", align="C")


def _draw_footer_logos(pdf: FPDF, *, x0: float, w: float, y: float) -> None:
    logos = _asset("footer_logos.png")
    if logos:
        try:
            pdf.image(logos, x=x0, y=y, w=w - 2 * x0, h=_FOOTER_LOGOS_H)
        except Exception:
            pass


def build_course_certificate_pdf(
    student_name: str,
    course_title: str,
    cert_no: str,
    issue_date_str: str,
    *,
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
    """Render the official XpertIntern internship certificate (portrait A4)."""
    pdf = _CertPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_page()
    w, h = pdf.w, pdf.h
    m = 10.0
    x0 = m + 4
    inner_w = w - 2 * x0

    logos_y = _PAGE_BOTTOM - _FOOTER_LOGOS_H
    footer_y = logos_y - _FOOTER_BLOCK_H - 2

    _draw_border(pdf, m, w, h)

    y = _draw_header(pdf, x0=x0, w=w)
    y = _draw_title(pdf, y=y, w=w)

    prog = domain or course_title or course or "Internship"
    course_line = _course_line(course or course_title, branch)
    y = _draw_body_paragraph(
        pdf,
        x0=x0,
        inner_w=inner_w,
        y=y,
        student_name=student_name,
        college_name=college_name,
        registration_no=registration_no,
        session=session,
        course_line=course_line,
    )

    start_long = _format_long_date(start_date)
    end_long = _format_long_date(end_date)
    if start_long and end_long:
        date_range = f"From {start_long} to {end_long}"
    elif start_long or end_long:
        date_range = start_long or end_long
    else:
        date_range = _format_long_date(issue_date_str) if issue_date_str else "-"

    detail_rows = [
        ("Internship Domain", prog),
        ("Internship Duration", _compute_duration(start_date, end_date, duration)),
        ("Internship Start and End Date", date_range),
        ("Mode of Internship", mode or "Online"),
        ("Overall Attendance Percentage", _format_pct(attendance)),
        ("Overall Marks Percentage", _format_pct(marks)),
    ]
    y = _draw_kv_table(pdf, x0=x0, inner_w=inner_w, y=y, rows=detail_rows)
    y = _draw_assessment_table(pdf, x0=x0, inner_w=inner_w, y=y, rating=performance_rating)

    # If content runs long, nudge footer down only within the reserved band
    if y + 4 > footer_y:
        footer_y = min(y + 4, logos_y - _FOOTER_BLOCK_H)

    _draw_footer_block(
        pdf,
        x0=x0,
        w=w,
        y=footer_y,
        cert_no=cert_no,
        issue_date_str=issue_date_str,
        verify_url=verify_url,
    )
    _draw_footer_logos(pdf, x0=x0, w=w, y=logos_y)

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out
