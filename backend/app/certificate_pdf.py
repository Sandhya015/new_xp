"""Internship certificate PDF — Canva page-1 template + minimal PIL overlays."""

from __future__ import annotations

import io
import re
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import segno
except ImportError:
    segno = None  # type: ignore[assignment,misc]

from PIL import Image, ImageDraw, ImageFont

from app.documents.pdf_common import BRAND_BLUE, pdf_text
from app.documents.pdf_template_builder import load_template_page, png_to_pdf

_TEMPLATE_DIR = Path(__file__).resolve().parent / "static" / "certificate_pages"

_FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_FONT_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

_TEXT = (20, 40, 80)
_WHITE = (255, 255, 255)

# page-1.png (1241×1755). Segment borders: y≈506, 570, 635, 700.
_NAME_LINE = (200, 418, 1040, 436)
_NAME_Y = 422

_INST_LINE = (200, 443, 1040, 461)
_INST_Y = 449

_REG_LINE = (140, 528, 960, 548)
_REG_Y = 536

_SESSION_LINE = (140, 658, 960, 678)
_SESSION_Y = 666

# Internship table value column (labels remain from template art).
_TABLE_VALUE_CELLS = (
    (620, 703, 1095, 764),
    (620, 768, 1095, 829),
    (620, 833, 1095, 894),
    (620, 898, 1095, 923),
    (620, 924, 1095, 937),
    (620, 938, 1095, 942),
)

# Assessment table on this template has two criteria rows.
_ASSESS_CELLS = (
    (620, 1033, 1095, 1093),
    (620, 1094, 1095, 1160),
)

_QR_BOX = (50, 1165, 300, 1225)
_CERT_VAL_BOX = (520, 1188, 780, 1204)
_DATE_VAL_BOX = (520, 1256, 780, 1270)
_VERIFY_BOX = (445, 1270, 775, 1294)
_VERIFY_Y = 1272


def _qr_png_bytes(data: str, *, scale: int = 5) -> bytes | None:
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
        return pdf_text(str(val or "").strip())
    return f"{dt.day} {dt.strftime('%b %Y')}"


def _format_cert_date(val: Any) -> str:
    dt = _parse_date(val)
    if not dt:
        return pdf_text(str(val or "").strip())
    return dt.strftime("%d/%m/%Y")


def _format_pct(val: str) -> str:
    s = str(val or "").strip()
    if not s:
        return "-"
    return s if "%" in s else f"{s}%"


def _compute_duration(start: Any, end: Any, duration: str = "") -> str:
    if duration.strip():
        d = duration.strip()
        return pdf_text(d[0].upper() + d[1:] if d else d)
    sdt, edt = _parse_date(start), _parse_date(end)
    if not sdt or not edt or edt < sdt:
        return "-"
    days = (edt - sdt).days + 1
    weeks = max(1, round(days / 7))
    word = "Week" if weeks == 1 else "Weeks"
    return f"{weeks} {word}"


def _clean_field(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    text = text.replace("\r", " ").replace("\n", " ").strip()
    for marker in (
        "has successfully completed",
        "Has successfully completed",
        "has successfully completed his/her internship",
    ):
        if marker.lower() in text.lower():
            idx = text.lower().index(marker.lower())
            text = text[:idx].strip().rstrip(",")
    while "  " in text:
        text = text.replace("  ", " ")
    return text


def _course_line(course: str, branch: str) -> str:
    course = _clean_field(course)
    branch = _clean_field(branch)
    if course and branch:
        line = f"{course} - {branch}"
    else:
        line = course or branch or "-"
    if line != "-" and not line.endswith(","):
        line = f"{line},"
    return line


def _verify_display_url(verify_url: str | None) -> str:
    if not verify_url:
        return "www.xpertintern.com/verify"
    u = verify_url.strip()
    for prefix in ("https://", "http://"):
        if u.lower().startswith(prefix):
            u = u[len(prefix) :]
            break
    return u.replace("https://", "").replace("http://", "")


def _load_font(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def _wipe_box(img: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    patch = Image.new("RGB", (max(1, x1 - x0), max(1, y1 - y0)), _WHITE)
    img.paste(patch, (x0, y0))


def _fit_text(text: str, font: ImageFont.ImageFont, max_w: int, draw: ImageDraw.ImageDraw) -> str:
    t = pdf_text(text)
    while t and draw.textlength(t, font=font) > max_w:
        t = t[:-2].rstrip() + "…"
    return t


def _draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    y: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = _TEXT,
    x0: int = 140,
    x1: int = 1100,
) -> None:
    t = pdf_text(text)
    if not t:
        return
    cx = (x0 + x1) // 2
    w = draw.textlength(t, font=font)
    draw.text((cx - w / 2, y), t, font=font, fill=fill)


def _draw_centered_in_box(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    *,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = _TEXT,
) -> None:
    x0, y0, x1, y1 = box
    t = _fit_text(text, font, x1 - x0 - 6, draw)
    if not t:
        return
    cx = (x0 + x1) // 2
    try:
        bbox = draw.textbbox((0, 0), t, font=font)
        th = bbox[3] - bbox[1]
    except Exception:
        th = 14
    y = y0 + max(1, (y1 - y0 - th) // 2)
    w = draw.textlength(t, font=font)
    draw.text((cx - w / 2, y), t, font=font, fill=fill)


def _draw_left_in_box(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    *,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = _TEXT,
) -> None:
    x0, y0, x1, y1 = box
    t = _fit_text(text, font, x1 - x0 - 4, draw)
    if not t:
        return
    try:
        bbox = draw.textbbox((0, 0), t, font=font)
        th = bbox[3] - bbox[1]
    except Exception:
        th = 14
    y = y0 + max(1, (y1 - y0 - th) // 2)
    draw.text((x0 + 2, y), t, font=font, fill=fill)


def _paste_qr(img: Image.Image, verify_url: str | None) -> None:
    if not verify_url:
        return
    qr_png = _qr_png_bytes(verify_url)
    if not qr_png:
        return
    qr = Image.open(io.BytesIO(qr_png)).convert("RGB")
    x0, y0, x1, y1 = _QR_BOX
    size = min(x1 - x0, y1 - y0)
    qr = qr.resize((size, size), Image.Resampling.LANCZOS)
    img.paste(qr, (x0, y0))


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
    """Render certificate on the official Canva page-1 artwork with dynamic overlays."""
    img = load_template_page(_TEMPLATE_DIR, "page-1.png")
    draw = ImageDraw.Draw(img)

    name_font = _load_font(_FONT_SERIF_BOLD, 22)
    bold_font = _load_font(_FONT_BOLD, 15)
    body_font = _load_font(_FONT_REG, 14)
    table_font = _load_font(_FONT_REG, 13)
    assess_font = _load_font(_FONT_REG, 12)
    footer_font = _load_font(_FONT_BOLD, 14)
    verify_font = _load_font(_FONT_REG, 11)

    name = _clean_field(student_name) or "Student"
    college = _clean_field(college_name) or "-"
    reg = _clean_field(registration_no) or "-"
    session_fmt = re.sub(r"\s*-\s*", " - ", _clean_field(session)) if _clean_field(session) else ""
    course_line = _course_line(course or course_title, branch)

    _wipe_box(img, _NAME_LINE)
    _draw_centered(draw, f"Mr./Ms. {name},", y=_NAME_Y, font=name_font)

    _wipe_box(img, _INST_LINE)
    _draw_centered(draw, f"{college},", y=_INST_Y, font=bold_font)

    _wipe_box(img, _REG_LINE)
    _draw_centered(
        draw,
        f"bearing University Registration/Enrolment No. {reg}",
        y=_REG_Y,
        font=body_font,
    )

    _wipe_box(img, _SESSION_LINE)
    if session_fmt:
        session_line = f"Session {session_fmt}, enrolled in {course_line}"
    else:
        session_line = f"enrolled in {course_line}"
    _draw_centered(draw, session_line, y=_SESSION_Y, font=body_font)

    prog = _clean_field(domain or course_title or course) or "Internship"
    start_long = _format_long_date(start_date)
    end_long = _format_long_date(end_date)
    if start_long and end_long:
        date_range = f"From {start_long} to {end_long}"
    elif start_long or end_long:
        date_range = start_long or end_long
    else:
        date_range = _format_long_date(issue_date_str) if issue_date_str else "-"

    table_values = [
        prog,
        _compute_duration(start_date, end_date, duration),
        date_range,
        mode or "Offline",
        _format_pct(attendance),
        _format_pct(marks),
    ]
    for cell, value in zip(_TABLE_VALUE_CELLS, table_values, strict=True):
        _wipe_box(img, cell)
        _draw_centered_in_box(draw, value, cell, font=table_font)

    rating = pdf_text(performance_rating or "Good")
    for cell in _ASSESS_CELLS:
        _wipe_box(img, cell)
        _draw_centered_in_box(draw, rating, cell, font=assess_font)

    _wipe_box(img, _QR_BOX)
    _paste_qr(img, verify_url)

    _wipe_box(img, _CERT_VAL_BOX)
    _draw_left_in_box(draw, cert_no, _CERT_VAL_BOX, font=footer_font, fill=BRAND_BLUE)

    _wipe_box(img, _DATE_VAL_BOX)
    _draw_left_in_box(
        draw,
        _format_cert_date(issue_date_str),
        _DATE_VAL_BOX,
        font=footer_font,
        fill=BRAND_BLUE,
    )

    _wipe_box(img, _VERIFY_BOX)
    verify_line = f"Online Certificate Verification Available on: {_verify_display_url(verify_url)}"
    _draw_left_in_box(draw, verify_line, _VERIFY_BOX, font=verify_font, fill=(71, 85, 105))

    return png_to_pdf([img])
