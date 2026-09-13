"""Student ID card PDF — template artwork + PIL overlay (pixel-calibrated)."""
from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path
from typing import Any

from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont

from app.documents.pdf_common import pdf_text

_TEMPLATE_W = 512
_TEMPLATE_H = 658

CARD_H = 85.6
_PAGE_W = 210.0
_PAGE_H = 297.0

NAVY = (0, 51, 102)
TEXT = (20, 50, 90)

_ASSETS = Path(__file__).resolve().parent.parent / "static" / "id_card"
_FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# (value_x, text_y, underline_y) — value sits inline on the label row, right of "College:" etc.
_FRONT = {
    "photo": (222, 143, 106, 128),
    "name_box": (155, 332, 290, 28),
    "name_y": 336,
    "fields": [
        (228, 378, 393),  # College
        (228, 407, 422),  # ID No.
        (228, 436, 451),  # Program
        (228, 466, 481),  # Mobile
        (228, 495, 510),  # Email
    ],
}

_BACK_FALLBACK = [
    (255, 172, 172),  # Blood Group
    (280, 221, 221),  # Emergency Contact
    (211, 253, 253),  # Issued On
]


def _detect_back_fields(img: Image.Image) -> list[tuple[int, int, int]]:
    """Detect (value_x, text_y, underline_y) for each back-card field row."""
    px = img.load()
    w, _ = img.size

    peak: tuple[int, int] | None = None
    peaks: list[int] = []
    for uy in range(160, 280):
        nw = sum(1 for x in range(120, min(w - 10, 380)) if sum(px[x, uy]) < 700)
        if nw > 80:
            if peak is None or uy - peak[0] > 25:
                if peak is not None:
                    peaks.append(peak[0])
                peak = (uy, nw)
            elif nw > peak[1]:
                peak = (uy, nw)
        elif peak is not None and uy - peak[0] > 8:
            peaks.append(peak[0])
            peak = None
    if peak is not None:
        peaks.append(peak[0])

    fields: list[tuple[int, int, int]] = []
    for uy in peaks[:3]:
        label_end = 90
        text_y = uy - 10
        for ty in range(uy - 15, uy):
            dark = [
                x
                for x in range(90, min(240, w))
                if px[x, ty][0] < 100 and px[x, ty][1] < 100 and px[x, ty][2] < 140
            ]
            if len(dark) > 8:
                label_end = max(label_end, max(dark))
                text_y = ty
        fields.append((label_end + 10, text_y, uy))

    return fields if len(fields) == 3 else _BACK_FALLBACK


def _load_font(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def _name_font(name: str) -> ImageFont.ImageFont:
    n = len(name)
    if n <= 16:
        size = 24
    elif n <= 22:
        size = 20
    else:
        size = 17
    return _load_font(_FONT_BOLD, size)


def _resolve_photo_path(profile: dict[str, Any]) -> str | None:
    url = (profile.get("profilePhotoUrl") or profile.get("photoUrl") or "").strip()
    if not url:
        return None
    try:
        from flask import current_app

        base = Path(current_app.instance_path)
    except Exception:
        return None
    if url.startswith("/api/"):
        parts = url.strip("/").split("/")
        if len(parts) >= 2:
            candidate = base / parts[-2] / parts[-1]
            if candidate.is_file():
                return str(candidate)
    p = Path(url)
    if p.is_file():
        return str(p)
    return None


_NAME_FILL = (248, 254, 252)


def _line_fill(img: Image.Image, underline_y: int) -> tuple[int, int, int]:
    """Background colour for a field underline (sample above the line, card centre)."""
    px = img.load()
    r = g = b = 0
    n = 0
    for x in range(240, 360, 8):
        yy = max(0, underline_y - 6)
        pr, pg, pb = px[x, yy]
        if pr > 180 and pg > 180 and pb > 180:
            r += pr
            g += pg
            b += pb
            n += 1
    if n:
        return (r // n, g // n, b // n)
    return (255, 255, 255)


def _wipe_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, int, int]) -> None:
    draw.rectangle(box, fill=fill)


def _wipe_field_value(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    *,
    value_x: int,
    text_y: int,
    underline_y: int,
    x1: int = 458,
) -> None:
    """Clear only the value slot to the right of the label (keeps labels intact)."""
    fill = _line_fill(img, underline_y)
    _wipe_box(draw, (value_x, text_y, x1, underline_y + 1), fill)


def _draw_centered_name(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    y: int,
    font: ImageFont.ImageFont,
    canvas_w: int,
) -> None:
    val = pdf_text(text).strip()
    if not val:
        return
    bbox = draw.textbbox((0, 0), val, font=font)
    tw = bbox[2] - bbox[0]
    x = max(8, (canvas_w - tw) // 2)
    draw.text((x, y), val, font=font, fill=NAVY)


def _draw_field(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    x: int,
    y: int,
    font: ImageFont.ImageFont,
    max_chars: int = 44,
) -> None:
    val = pdf_text(str(text or "").strip()[:max_chars])
    if not val:
        return
    draw.text((x, y), val, font=font, fill=TEXT)


def _paste_photo(img: Image.Image, profile: dict[str, Any]) -> None:
    path = _resolve_photo_path(profile)
    if not path:
        return
    try:
        photo = Image.open(path).convert("RGB")
    except Exception:
        return
    px, py, pw, ph = _FRONT["photo"]
    wipe = ImageDraw.Draw(img)
    _wipe_box(wipe, (px, py, px + pw, py + ph), (220, 220, 220))
    photo = photo.resize((pw, ph), Image.Resampling.LANCZOS)
    img.paste(photo, (px, py))


def _trim_card_border(img: Image.Image) -> Image.Image:
    """Crop dark rounded-corner margin outside the white card face."""
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r > 240 and g > 240 and b > 240:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx <= minx or maxy <= miny:
        return rgb
    return rgb.crop((minx, miny, maxx + 1, maxy + 1))


def _render_front(profile: dict[str, Any], letter_no: str) -> Image.Image:
    img = Image.open(_ASSETS / "front_template.png").convert("RGB")
    draw = ImageDraw.Draw(img)

    nx, ny, nw, nh = _FRONT["name_box"]
    _wipe_box(draw, (nx, ny, nx + nw, ny + nh), _NAME_FILL)

    for value_x, text_y, underline_y in _FRONT["fields"]:
        _wipe_field_value(img, draw, value_x=value_x, text_y=text_y, underline_y=underline_y)

    _paste_photo(img, profile)
    draw = ImageDraw.Draw(img)

    name = (profile.get("name") or "STUDENT NAME").upper()
    name_font = _name_font(name)
    _draw_centered_name(draw, name, y=_FRONT["name_y"], font=name_font, canvas_w=_TEMPLATE_W)

    field_font = _load_font(_FONT_REG, 13)
    email_font = _load_font(_FONT_REG, 11)

    values = [
        profile.get("collegeName") or profile.get("college") or "—",
        letter_no,
        profile.get("domain") or profile.get("course") or profile.get("programName") or "—",
        profile.get("mobile") or "—",
        profile.get("email") or "—",
    ]
    for (value_x, text_y, _), val in zip(_FRONT["fields"], values):
        font = email_font if "@" in str(val) and len(str(val)) > 26 else field_font
        _draw_field(draw, val, x=value_x, y=text_y, font=font)

    return _trim_card_border(img)


def _render_back(profile: dict[str, Any], issued_on: str) -> Image.Image:
    img = Image.open(_ASSETS / "back_template.png").convert("RGB")
    fields = list(_detect_back_fields(img))
    if len(fields) == 3:
        vx, ty, uy = fields[2]
        fields[2] = (vx, ty + 5, uy)
    draw = ImageDraw.Draw(img)
    field_font = _load_font(_FONT_REG, 13)

    values = [
        profile.get("bloodGroup") or profile.get("blood_group") or "—",
        profile.get("emergencyContact") or profile.get("emergency_contact") or "—",
        issued_on,
    ]
    for (value_x, text_y, _), val in zip(fields, values):
        rendered = pdf_text(str(val or "").strip()[:44])
        if rendered and rendered not in {"-", "\u2014"}:
            draw.text((value_x, text_y), rendered, font=field_font, fill=NAVY)

    return _trim_card_border(img)


def _pil_to_png_buffer(img: Image.Image) -> io.BytesIO:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _card_origin(card_w: float) -> tuple[float, float]:
    return (_PAGE_W - card_w) / 2, (_PAGE_H - CARD_H) / 2


def _images_to_pdf(front: Image.Image, back: Image.Image) -> bytes:
    fw, fh = front.size
    card_w = CARD_H * (fw / fh)
    cx, cy = _card_origin(card_w)

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)

    pdf.add_page()
    pdf.image(_pil_to_png_buffer(front), x=cx, y=cy, w=card_w, h=CARD_H)

    pdf.add_page()
    pdf.image(_pil_to_png_buffer(back), x=cx, y=cy, w=card_w, h=CARD_H)

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out


def build_id_card_pdf(*, profile: dict[str, Any], letter_no: str, issued_on: str | None = None) -> bytes:
    issued = issued_on or datetime.utcnow().strftime("%d/%m/%Y")
    front = _render_front(profile, letter_no)
    back = _render_back(profile, issued)
    return _images_to_pdf(front, back)
