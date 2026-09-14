"""Internship Attendance Log PDF — Canva header/footer from sample PDF."""
from __future__ import annotations

from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.documents.pdf_common import (
    BRAND_BLUE,
    BRAND_BLUE_LIGHT,
    TEXT_DARK,
    closing_signature_layout,
    draw_canva_footer,
    draw_canva_header,
    draw_closing_signature_area,
    draw_section_bar,
    draw_student_details_table,
    draw_title,
    format_date,
    page_layout,
    pdf_text,
)

_ATT_HEADERS = ["Sl. No.", "Date", "Time In", "Time Out", "Total Hours", "Signature of the Supervisor", "Remarks"]
_COL_W = [10, 24, 22, 22, 22, 38, 38]
_ATT_NOTE = "*Note: Attendance must be verified daily by the authorized supervisor."
_MAX_ATT_ROWS = 11
_ROW_H = 5.6
_HEAD_H = 6.5
_NOTE_H = 4.5
_NOTE_GAP = 3.0


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

    sig_y, _, footer_top = closing_signature_layout(variant, page_w=w, page_h=pdf.h)
    note_y = sig_y - _NOTE_GAP - _NOTE_H
    max_table_bottom = note_y - _NOTE_GAP

    y = draw_canva_header(pdf, variant=variant)
    y = draw_title(pdf, y=y, w=w, title="Internship Attendance Log")
    y = draw_student_details_table(pdf, x=x0, y=y, w=inner_w, profile=profile, inputs=inputs)

    y = draw_section_bar(pdf, x=x0, y=y, w=inner_w, label="ATTENDANCE LOG")
    table_body_start = y
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
            _HEAD_H,
            pdf_text(label),
            border=1,
            fill=True,
            align="C",
            new_x=XPos.LMARGIN if last else XPos.RIGHT,
            new_y=YPos.NEXT if last else YPos.TOP,
        )
    y += _HEAD_H

    rows = list(attendance_rows or [])
    while len(rows) < _MAX_ATT_ROWS:
        rows.append({})

    available_body_h = max(_ROW_H, max_table_bottom - y)
    row_count = min(_MAX_ATT_ROWS, max(1, int(available_body_h // _ROW_H)))
    row_h = min(_ROW_H, available_body_h / row_count) if row_count else _ROW_H

    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*TEXT_DARK)
    for idx in range(row_count):
        row = rows[idx] if idx < len(rows) else {}
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

    table_bottom = table_body_start + _HEAD_H + row_count * row_h
    note_y = min(max(table_bottom + _NOTE_GAP, table_bottom + 2.0), sig_y - _NOTE_GAP - _NOTE_H)
    pdf.set_xy(x0, note_y)
    pdf.set_font("helvetica", "I", 7)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(inner_w, _NOTE_H, pdf_text(_ATT_NOTE), border=0)

    draw_closing_signature_area(pdf, variant=variant, x0=x0, inner_w=inner_w)
    draw_canva_footer(pdf, variant=variant)

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out
