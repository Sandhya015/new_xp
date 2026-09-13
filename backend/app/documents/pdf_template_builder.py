"""PNG template pages -> multi-page A4 PDF (official Canva layouts)."""
from __future__ import annotations

import io
from pathlib import Path

from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont

_FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# A4 mm
PAGE_W = 210.0
PAGE_H = 297.0


def _font(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def _fit(text: str, font: ImageFont.ImageFont, max_w: int, draw: ImageDraw.ImageDraw) -> str:
    t = text
    while t and draw.textlength(t, font=font) > max_w:
        t = t[:-2].rstrip() + "…"
    return t


def _draw_left(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    x: int,
    y: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = (20, 40, 80),
    max_w: int | None = None,
) -> None:
    if not text:
        return
    if max_w:
        text = _fit(text, font, max_w, draw)
    draw.text((x, y), text, font=font, fill=fill)


def _draw_right(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    x_right: int,
    y: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = (20, 40, 80),
) -> None:
    if not text:
        return
    w = draw.textlength(text, font=font)
    draw.text((x_right - w, y), text, font=font, fill=fill)


def _draw_center(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    cx: int,
    y: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = (20, 40, 80),
    max_w: int | None = None,
) -> None:
    if not text:
        return
    if max_w:
        text = _fit(text, font, max_w, draw)
    w = draw.textlength(text, font=font)
    draw.text((cx - w // 2, y), text, font=font, fill=fill)


def _wipe(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, int, int] = (255, 255, 255)) -> None:
    draw.rectangle(box, fill=fill)


def png_to_pdf(images: list[Image.Image]) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    for img in images:
        pdf.add_page()
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="PNG", optimize=True)
        buf.seek(0)
        pdf.image(buf, x=0, y=0, w=PAGE_W, h=PAGE_H)
    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out


def load_template_page(base: Path, name: str) -> Image.Image:
    return Image.open(base / name).convert("RGB")
