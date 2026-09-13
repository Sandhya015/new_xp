"""Daily Training Logbook PDF — Canva header/footer from sample PDF."""
from __future__ import annotations

from typing import Any

from fpdf import FPDF

from app.documents.pdf_common import (
    TEXT_DARK,
    draw_canva_footer,
    draw_canva_header,
    draw_form_row_split,
    draw_labeled_box,
    draw_signature_grid,
    draw_student_details_table,
    draw_title,
    footer_top_y,
    page_layout,
    pdf_text,
)


def build_logbook_pdf(*, profile: dict[str, Any], inputs: dict[str, Any]) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)
    pdf.add_page()
    w = pdf.w
    _, x0, inner_w, _ = page_layout(pdf)
    variant = "offer_technical"
    footer_y = footer_top_y(variant, w)

    y = draw_canva_header(pdf, variant=variant)
    y = draw_title(pdf, y=y, w=w, title="Daily Training Logbook")
    y = draw_student_details_table(pdf, x=x0, y=y, w=inner_w, profile=profile, inputs=inputs)

    y = draw_form_row_split(
        pdf,
        x=x0,
        y=y,
        w=inner_w,
        left_label="Day of Training",
        left_value="",
        right_label="Date",
        right_value="",
        row_h=7.0,
    )
    y += 1

    y = draw_labeled_box(pdf, x=x0, y=y, w=inner_w, label="Activities / Topics Covered", box_h=22)
    y = draw_labeled_box(pdf, x=x0, y=y, w=inner_w, label="Skills and Learning Outcomes", box_h=16)
    y = draw_labeled_box(pdf, x=x0, y=y, w=inner_w, label="Tools / Software / Equipment Used", box_h=14)
    y = draw_labeled_box(pdf, x=x0, y=y, w=inner_w, label="Challenges Faced or Student Reflection", box_h=14)

    sig_y = min(y + 2, footer_y - 36)
    y = draw_signature_grid(
        pdf,
        x=x0,
        y=sig_y,
        w=inner_w,
        left="Student Signature",
        right="Supervisor Remarks and Signature",
        box_h=14,
    )
    pdf.set_xy(x0, y + 1)
    pdf.set_font("helvetica", "I", 7)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(
        inner_w,
        4,
        pdf_text("Note: Complete one page for each day of training and obtain the supervisor's verification."),
    )
    draw_canva_footer(pdf, variant=variant)

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out
