"""Internship Attendance Log PDF — Canva header/footer from sample PDF."""
from __future__ import annotations

from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.documents.pdf_common import (
    BRAND_BLUE,
    BRAND_BLUE_LIGHT,
    CLOSING_SIGNATURE_W,
    TEXT_DARK,
    closing_signature_height,
    draw_canva_footer,
    draw_canva_header,
    draw_closing_signature,
    draw_section_bar,
    draw_student_details_table,
    draw_title,
    footer_top_y,
    format_date,
    page_layout,
    pdf_text,
)

_ATT_HEADERS = ["Sl. No.", "Date", "Time In", "Time Out", "Total Hours", "Signature of the Supervisor", "Remarks"]
_COL_W = [10, 24, 22, 22, 22, 38, 38]


def build_attendance_log_pdf(
    *,
    profile: dict[str, Any],
    inputs: dict[str, Any],
    attendance_rows: list[dict[str, Any]],
) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_page()
    w = pdf.w
    _, x0, inner_w, _ = page_layout(pdf)
    variant = "offer_technical"
    footer_y = footer_top_y(variant, w)
    sig_h = closing_signature_height(CLOSING_SIGNATURE_W)
    sig_y = footer_y - sig_h - 4

    y = draw_canva_header(pdf, variant=variant)
    y = draw_title(pdf, y=y, w=w, title="Internship Attendance Log")
    y = draw_student_details_table(pdf, x=x0, y=y, w=inner_w, profile=profile, inputs=inputs)

    y = draw_section_bar(pdf, x=x0, y=y, w=inner_w, label="ATTENDANCE LOG")
    head_h = 6.5
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.25)
    pdf.set_fill_color(*BRAND_BLUE_LIGHT)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.set_font("helvetica", "B", 7)
    pdf.set_xy(x0, y)
    for i, label in enumerate(_ATT_HEADERS):
        last = i == len(_ATT_HEADERS) - 1
        pdf.cell(
            _COL_W[i],
            head_h,
            pdf_text(label),
            border=1,
            fill=True,
            align="C",
            new_x=XPos.LMARGIN if last else XPos.RIGHT,
            new_y=YPos.NEXT if last else YPos.TOP,
        )
    y += head_h

    row_count = 12
    if not attendance_rows:
        attendance_rows = [{} for _ in range(row_count)]
    else:
        while len(attendance_rows) < row_count:
            attendance_rows.append({})

    row_h = 5.8
    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*TEXT_DARK)
    for idx in range(row_count):
        row = attendance_rows[idx] if idx < len(attendance_rows) else {}
        vals = [
            str(idx + 1),
            format_date(row.get("date") or row.get("sessionDate")) if row.get("date") or row.get("sessionDate") else "",
            row.get("timeIn") or "",
            row.get("timeOut") or "",
            str(row.get("hoursCompleted") or row.get("hours") or ""),
            "",
            "",
        ]
        pdf.set_xy(x0, y)
        pdf.set_fill_color(255, 255, 255)
        for i, val in enumerate(vals):
            last = i == len(vals) - 1
            pdf.cell(
                _COL_W[i],
                row_h,
                pdf_text(str(val)[:24]),
                border=1,
                align="C" if i == 0 else "L",
                new_x=XPos.LMARGIN if last else XPos.RIGHT,
                new_y=YPos.NEXT if last else YPos.TOP,
            )
        y += row_h

    note_y = min(y + 1, sig_y - 8)
    pdf.set_xy(x0, note_y)
    pdf.set_font("helvetica", "I", 7)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(inner_w, 4, pdf_text("*Note: Attendance must be verified daily by the authorized supervisor."))
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(x0, sig_y - 2, inner_w, footer_y - sig_y + 3, style="F")
    draw_closing_signature(pdf, x=x0, y=sig_y, width_mm=CLOSING_SIGNATURE_W)
    draw_canva_footer(pdf, variant=variant)

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out
