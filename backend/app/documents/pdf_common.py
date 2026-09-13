"""Shared PDF helpers for student documents."""
from __future__ import annotations

import io
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

_ASSETS = Path(__file__).resolve().parent.parent / "static" / "certificate"
_PARTS = Path(__file__).resolve().parent.parent / "static" / "document_parts"
_PAGE_PX_H = 1755.0
_PAGE_MM_H = 297.0

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

CONTENT_X0 = 15.0
CONTENT_WIDTH = 180.0
OFFER_HEADER_MM = 318.0 * _PAGE_MM_H / _PAGE_PX_H
CERT_HEADER_MM = 218.0 * _PAGE_MM_H / _PAGE_PX_H
# Fallback footer heights; actual values come from PNG aspect ratio when present.
OFFER_FOOTER_MM = 210.0 * 224 / 1241
CERT_FOOTER_MM = 210.0 * 214 / 1241
CLOSING_SIGNATURE_W = 72.0
SIGNATURE_BLOCK_W = 58.0
SIGNATURE_STAMP_W = 46.0
_SIGNATURE_CROP_RATIO = 0.68
FOOTER_LOGOS_H = 14.0
PAGE_BOTTOM = 287.0

ASSESSMENT_CRITERIA = (
    "Technical Knowledge & Application",
    "Quality of Work & Task Completion",
    "Initiative & Problem-Solving Ability",
    "Communication & Interpersonal Skills",
    "Punctuality, Discipline & Professional Conduct",
)


def page_layout(pdf: FPDF) -> tuple[float, float, float, float]:
    """Return margin, x0, inner width, page width (no outer border)."""
    return 0.0, CONTENT_X0, CONTENT_WIDTH, pdf.w


def _part_path(variant: str, name: str) -> Path:
    return _PARTS / variant / f"{name}.png"


def _image_mm_size(path: Path, *, width_mm: float) -> tuple[float, float]:
    try:
        from PIL import Image

        with Image.open(path) as im:
            w_px, h_px = im.size
            if w_px <= 0:
                return width_mm, width_mm
            height_mm = width_mm * h_px / w_px
            return width_mm, height_mm
    except Exception:
        return width_mm, width_mm * 0.35


def _footer_height_mm(variant: str, page_w_mm: float) -> float:
    path = _part_path(variant, "footer")
    if path.is_file():
        _, h_mm = _image_mm_size(path, width_mm=page_w_mm)
        return h_mm
    return OFFER_FOOTER_MM if variant.startswith("offer") else CERT_FOOTER_MM


def draw_canva_header(pdf: FPDF, *, variant: str) -> float:
    """Official Canva header band from sample PDF (full page width)."""
    w = pdf.w
    header_h = OFFER_HEADER_MM if variant.startswith("offer") else CERT_HEADER_MM
    path = _part_path(variant, "header")
    if path.is_file():
        try:
            pdf.image(str(path), x=0, y=0, w=w, h=header_h)
        except Exception:
            pass
        return header_h + 1.5
    return draw_header(pdf, x0=CONTENT_X0, w=w)


def draw_canva_footer(pdf: FPDF, *, variant: str) -> float:
    """Official Canva footer band (logos + blue wave) from sample PDF."""
    w, page_h = pdf.w, pdf.h
    path = _part_path(variant, "footer")
    footer_h = _footer_height_mm(variant, w) * 0.985
    y = page_h - footer_h - 0.5
    if path.is_file():
        try:
            pdf.image(str(path), x=0, y=y, w=w, h=footer_h)
        except Exception:
            pass
    return y


def footer_top_y(variant: str, page_w_mm: float = 210.0) -> float:
    return _PAGE_MM_H - _footer_height_mm(variant, page_w_mm)


def _signature_asset() -> Path:
    for name in ("signature_stamp.png", "signature_official.png"):
        path = _ASSETS / name
        if path.is_file():
            return path
    return _ASSETS / "signature_stamp.png"


def _signature_image_height() -> float:
    path = _signature_asset()
    if path.is_file():
        _, h_mm = _image_mm_size(path, width_mm=SIGNATURE_STAMP_W)
        return h_mm * _SIGNATURE_CROP_RATIO
    return 12.0


def closing_signature_height(_width_mm: float = CLOSING_SIGNATURE_W) -> float:
    return 6.5 + _signature_image_height() + 13.0


def signature_block_height(_width_mm: float = SIGNATURE_BLOCK_W) -> float:
    return _signature_image_height() + 13.0


def _draw_signature_image(pdf: FPDF, *, x: float, y: float) -> float:
    path = _signature_asset()
    img_h = _signature_image_height()
    if path.is_file():
        try:
            from PIL import Image

            with Image.open(path) as im:
                crop_h = max(1, int(im.height * _SIGNATURE_CROP_RATIO))
                cropped = im.crop((0, 0, im.width, crop_h))
                buf = io.BytesIO()
                cropped.save(buf, format="PNG")
                buf.seek(0)
                pdf.image(buf, x=x, y=y, w=SIGNATURE_STAMP_W, h=img_h)
        except Exception:
            try:
                pdf.image(str(path), x=x, y=y, w=SIGNATURE_STAMP_W, h=img_h)
            except Exception:
                pass
    return y + img_h


def _draw_signature_name_lines(pdf: FPDF, *, x: float, y: float, width_mm: float, centered: bool) -> float:
    if centered:
        pdf.set_xy(x, y)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.set_text_color(*TEXT_DARK)
        pdf.cell(width_mm, 3.8, pdf_text("Om Raj"), align="C")
        y += 4.0
        pdf.set_xy(x, y)
        pdf.set_font("helvetica", "", 8)
        pdf.set_text_color(*BRAND_BLUE)
        pdf.cell(width_mm, 3.8, pdf_text("Founder & CEO"), align="C")
        y += 4.0
        pdf.set_xy(x, y)
        pdf.set_font("helvetica", "B", 8)
        pdf.set_text_color(*TEXT_DARK)
        pdf.cell(width_mm, 3.8, pdf_text("Xpert Ventures Private Limited"), align="C")
    else:
        pdf.set_xy(x, y)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.set_text_color(*TEXT_DARK)
        pdf.cell(0, 3.8, pdf_text("Om Raj"))
        y += 4.0
        pdf.set_xy(x, y)
        pdf.set_font("helvetica", "", 8.5)
        pdf.cell(0, 3.8, pdf_text("Founder and CEO"))
        y += 4.0
        pdf.set_xy(x, y)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.cell(0, 3.8, pdf_text("Xpert Ventures Private Limited"))
    return y + 3.5


def draw_closing_signature(pdf: FPDF, *, x: float, y: float, width_mm: float = CLOSING_SIGNATURE_W) -> float:
    """Left-aligned closing with official Om Raj signature image + title lines."""
    pdf.set_xy(x, y)
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(0, 5, pdf_text("Yours faithfully,"))
    y += 7.0
    y = _draw_signature_image(pdf, x=x, y=y) + 1.0
    return _draw_signature_name_lines(pdf, x=x, y=y, width_mm=width_mm, centered=False)


def draw_signature_block(pdf: FPDF, *, x: float, y: float, width_mm: float = SIGNATURE_BLOCK_W) -> float:
    """Right-aligned signature block with official Om Raj signature image."""
    stamp_x = x + max(0.0, (width_mm - SIGNATURE_STAMP_W) / 2)
    y = _draw_signature_image(pdf, x=stamp_x, y=y) + 1.0
    return _draw_signature_name_lines(pdf, x=x, y=y, width_mm=width_mm, centered=True)


def pdf_text(s: str) -> str:
    if not s:
        return ""
    s = s.replace("\u2014", "-").replace("\u2013", "-").replace("\u2026", "...")
    s = unicodedata.normalize("NFKD", s)
    return s.encode("latin-1", "replace").decode("latin-1")


def asset(name: str) -> str | None:
    p = _ASSETS / name
    return str(p) if p.is_file() else None


def parse_date(val: Any) -> datetime | None:
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


def format_date(val: Any) -> str:
    dt = parse_date(val)
    if not dt:
        return pdf_text(str(val or "").strip())
    return dt.strftime("%d/%m/%Y")


def format_letter_date(val: Any) -> str:
    dt = parse_date(val)
    if not dt:
        return pdf_text(str(val or "").strip())
    return dt.strftime("%d %B %Y")


def draw_border(pdf: FPDF, m: float, w: float, h: float) -> None:
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(1.0)
    pdf.rect(m, m, w - 2 * m, h - 2 * m, style="D")
    pdf.set_line_width(0.35)
    pdf.rect(m + 1.5, m + 1.5, w - 2 * m - 3, h - 2 * m - 3, style="D")


def draw_watermark(pdf: FPDF, *, w: float, h: float) -> None:
    wm = asset("watermark.png")
    if not wm:
        return
    try:
        pdf.image(wm, x=(w - 90) / 2, y=(h - 90) / 2 - 8, w=90)
    except Exception:
        pass


def draw_header(pdf: FPDF, *, x0: float, w: float) -> float:
    y = 12.0
    logo = asset("brand_logo.png") or asset("header_logo.png")
    if logo:
        try:
            pdf.image(logo, x=x0, y=y, w=42)
        except Exception:
            pass

    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*TEXT_MUTED)
    line_h = 3.6
    contact_x = x0 + 48
    contact_w = w - contact_x - x0
    for i, line in enumerate(CONTACT_LINES):
        pdf.set_xy(contact_x, y + i * line_h)
        pdf.cell(contact_w, line_h, pdf_text(line), align="R")

    y_rule = y + len(CONTACT_LINES) * line_h + 4
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.8)
    pdf.line(x0, y_rule, w - x0, y_rule)
    return y_rule + 6


def draw_title(pdf: FPDF, *, y: float, w: float, title: str, size: int = 15) -> float:
    pdf.set_xy(0, y)
    pdf.set_font("helvetica", "B", size)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.cell(w, 8, pdf_text(title.upper()), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    y_line = y + 9
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.45)
    cx = w / 2
    pdf.line(cx - 58, y_line, cx + 58, y_line)
    pdf.line(cx - 58, y_line + 1.0, cx + 58, y_line + 1.0)
    return y_line + 6


def draw_footer_logos(pdf: FPDF, *, x: float, w: float, y: float | None = None) -> float:
    logos_y = y if y is not None else PAGE_BOTTOM - FOOTER_LOGOS_H
    logos = asset("footer_logos.png")
    if logos:
        try:
            pdf.image(logos, x=x, y=logos_y, w=w - 2 * x, h=FOOTER_LOGOS_H)
        except Exception:
            pass
    return logos_y


def _table_cell(
    pdf: FPDF,
    w: float,
    h: float,
    text: str,
    *,
    fill: tuple[int, int, int],
    align: str = "L",
    style: str = "",
    size: int = 8,
    new_x: XPos = XPos.RIGHT,
    new_y: YPos = YPos.TOP,
) -> None:
    pdf.set_font("helvetica", style, size)
    pdf.set_fill_color(*fill)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(w, h, pdf_text(text), border=1, fill=True, align=align, new_x=new_x, new_y=new_y)


def draw_kv_table_row(
    pdf: FPDF,
    *,
    x: float,
    y: float,
    inner_w: float,
    label: str,
    value: str,
    label_w: float | None = None,
    row_h: float = 7.0,
) -> float:
    lw = label_w or inner_w * 0.46
    vw = inner_w - lw
    pdf.set_xy(x, y)
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    _table_cell(pdf, lw, row_h, f"  {label}", fill=BRAND_BLUE_LIGHT, new_x=XPos.RIGHT, new_y=YPos.TOP)
    val = pdf_text(value or "-")
    if len(val) > 44:
        _table_cell(pdf, vw, row_h, f"  {val[:120]}", fill=(255, 255, 255), size=7, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    else:
        _table_cell(pdf, vw, row_h, f"  {val}", fill=(255, 255, 255), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return y + row_h


def draw_kv_table(
    pdf: FPDF,
    *,
    x: float,
    y: float,
    inner_w: float,
    rows: list[tuple[str, str]],
    label_w: float | None = None,
    row_h: float = 7.0,
) -> float:
    for label, value in rows:
        y = draw_kv_table_row(
            pdf, x=x, y=y, inner_w=inner_w, label=label, value=value, label_w=label_w, row_h=row_h
        )
    return y + 1


def draw_section_bar(pdf: FPDF, *, x: float, y: float, w: float, label: str, h: float = 6.5) -> float:
    pdf.set_fill_color(*BRAND_BLUE)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("helvetica", "B", 8.5)
    pdf.set_xy(x, y)
    pdf.cell(w, h, pdf_text(label), align="C", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return y + h


def draw_form_row_full(
    pdf: FPDF, *, x: float, y: float, w: float, label: str, value: str, row_h: float = 7.0
) -> float:
    return draw_kv_table_row(pdf, x=x, y=y, inner_w=w, label=label, value=value, row_h=row_h)


def draw_form_row_split(
    pdf: FPDF,
    *,
    x: float,
    y: float,
    w: float,
    left_label: str,
    left_value: str,
    right_label: str,
    right_value: str,
    row_h: float = 7.0,
) -> float:
    half = w / 2
    label_w = half * 0.42
    val_w = half - label_w
    pdf.set_xy(x, y)
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    _table_cell(pdf, label_w, row_h, f"  {left_label}", fill=BRAND_BLUE_LIGHT, new_x=XPos.RIGHT, new_y=YPos.TOP)
    _table_cell(pdf, val_w, row_h, f"  {left_value or '-'}", fill=(255, 255, 255), new_x=XPos.RIGHT, new_y=YPos.TOP)
    rx = x + half
    pdf.set_xy(rx, y)
    _table_cell(pdf, label_w, row_h, f"  {right_label}", fill=BRAND_BLUE_LIGHT, new_x=XPos.RIGHT, new_y=YPos.TOP)
    _table_cell(pdf, val_w, row_h, f"  {right_value or '-'}", fill=(255, 255, 255), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return y + row_h


def draw_student_details_table(
    pdf: FPDF,
    *,
    x: float,
    y: float,
    w: float,
    profile: dict[str, Any],
    inputs: dict[str, Any],
) -> float:
    y = draw_section_bar(pdf, x=x, y=y, w=w, label="STUDENT DETAILS")
    duration = inputs.get("durationLabel") or (
        f"{inputs.get('durationWeeks')} Weeks" if inputs.get("durationWeeks") else "-"
    )
    for label, value in (
        ("Name of the Student", profile.get("name") or ""),
        ("University Name", profile.get("university") or ""),
        ("College Name", profile.get("collegeName") or ""),
    ):
        y = draw_form_row_full(pdf, x=x, y=y, w=w, label=label, value=str(value or ""))

    split_rows = [
        ("University Roll Number", profile.get("registrationNo") or "", "Session", profile.get("session") or ""),
        ("Course / Programme", profile.get("course") or "", "Department / Branch / Subject", profile.get("branch") or ""),
        ("Internship Domain", profile.get("domain") or "", "Internship Starting Date", format_date(inputs.get("internshipStartDate"))),
        ("Internship Duration", duration, "Internship Mode", inputs.get("mode") or "Offline"),
        ("Mobile Number", profile.get("mobile") or "", "Email Address", profile.get("email") or ""),
    ]
    for ll, lv, rl, rv in split_rows:
        y = draw_form_row_split(
            pdf, x=x, y=y, w=w, left_label=ll, left_value=str(lv or ""), right_label=rl, right_value=str(rv or "")
        )
    return y + 2


def draw_labeled_box(
    pdf: FPDF,
    *,
    x: float,
    y: float,
    w: float,
    label: str,
    box_h: float,
    header_h: float = 6.0,
) -> float:
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    pdf.set_fill_color(*BRAND_BLUE_LIGHT)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.set_font("helvetica", "B", 7.5)
    pdf.set_xy(x, y)
    pdf.cell(w, header_h, pdf_text(f"  {label}"), border="LTR", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_fill_color(255, 255, 255)
    pdf.set_xy(x, y + header_h)
    pdf.cell(w, box_h, "", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return y + header_h + box_h + 1.5


def draw_signature_grid(pdf: FPDF, *, x: float, y: float, w: float, left: str, right: str, box_h: float = 18.0) -> float:
    half = w / 2
    header_h = 6.0
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    for label, bx in ((left, x), (right, x + half)):
        pdf.set_fill_color(*BRAND_BLUE_LIGHT)
        pdf.set_text_color(*BRAND_BLUE)
        pdf.set_font("helvetica", "B", 7.5)
        pdf.set_xy(bx, y)
        pdf.cell(half, header_h, pdf_text(f"  {label}"), border="LTR", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_fill_color(255, 255, 255)
        pdf.set_xy(bx, y + header_h)
        pdf.cell(half, box_h, "", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return y + header_h + box_h


def draw_signature_footer(pdf: FPDF, *, w: float, y: float) -> None:
    sig_w = SIGNATURE_BLOCK_W
    sig_x = w - CONTENT_X0 - sig_w
    draw_signature_block(pdf, x=sig_x, y=y - 2, width_mm=sig_w)
