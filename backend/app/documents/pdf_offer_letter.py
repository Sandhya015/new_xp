"""Offer letter PDF — Canva header/footer from sample PDF + native body text."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.documents.pdf_common import (
    BRAND_BLUE,
    TEXT_DARK,
    closing_signature_layout,
    draw_canva_footer,
    draw_canva_header,
    draw_closing_signature_area,
    format_letter_date,
    page_layout,
    pdf_text,
)


def _course_line(profile: dict[str, Any]) -> str:
    course = (profile.get("course") or profile.get("programName") or "").strip()
    branch = (profile.get("branch") or "").strip()
    if course and branch:
        return f"{course} - {branch}"
    return course or branch or "-"


def _duration_label(inputs: dict[str, Any]) -> str:
    weeks = inputs.get("durationWeeks") or inputs.get("duration")
    if weeks and str(weeks).isdigit():
        n = int(weeks)
        return f"{n} Week{'s' if n != 1 else ''}"
    return str(weeks or "-")


def _draw_letter_title(pdf: FPDF, *, y: float, w: float, title: str) -> float:
    pdf.set_xy(0, y)
    pdf.set_font("helvetica", "B", 15)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.cell(w, 7, pdf_text(title), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    y_line = y + 8
    pdf.set_draw_color(*BRAND_BLUE)
    pdf.set_line_width(0.5)
    cx = w / 2
    pdf.line(cx - 52, y_line, cx + 52, y_line)
    return y_line + 6


def _draw_ref_date(pdf: FPDF, *, x0: float, inner_w: float, y: float, letter_no: str, date_str: str) -> float:
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(*TEXT_DARK)
    pdf.set_xy(x0, y)
    pdf.cell(inner_w / 2, 5, pdf_text(f"Letter Ref. No.: {letter_no or ''}"))
    pdf.set_xy(x0 + inner_w / 2, y)
    pdf.cell(inner_w / 2, 5, pdf_text(f"Date: {date_str or ''}"), align="R")
    return y + 8


def _draw_recipient(
    pdf: FPDF,
    *,
    x0: float,
    y: float,
    profile: dict[str, Any],
    technical: bool,
    blank: bool,
) -> float:
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(*TEXT_DARK)
    pdf.set_xy(x0, y)
    pdf.cell(0, 5, pdf_text("To,"))
    y += 6
    name = "" if blank else (profile.get("name") or "Student")
    pdf.set_xy(x0, y)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 5, pdf_text(name))
    y += 6
    if technical:
        roll = "" if blank else (profile.get("registrationNo") or profile.get("rollNo") or "-")
        pdf.set_xy(x0, y)
        pdf.set_font("helvetica", "", 9.5)
        pdf.cell(0, 5, pdf_text(f"University Roll Number: {roll}"))
        y += 6
    college = "" if blank else (profile.get("collegeName") or profile.get("university") or "")
    pdf.set_xy(x0, y)
    pdf.cell(0, 5, pdf_text(f"College / Institution: {college}"))
    return y + 8


def _paragraph(
    pdf: FPDF, *, x0: float, inner_w: float, y: float, text: str, size: float = 9.5, max_y: float | None = None
) -> float:
    if max_y is not None and y >= max_y:
        return y
    pdf.set_xy(x0, y)
    pdf.set_font("helvetica", "", size)
    pdf.set_text_color(*TEXT_DARK)
    pdf.multi_cell(inner_w, 4.6, pdf_text(text))
    ny = pdf.get_y() + 2
    return min(ny, max_y) if max_y is not None else ny


def _bullet_line(pdf: FPDF, *, x0: float, y: float, label: str, value: str, max_y: float | None = None) -> float:
    if max_y is not None and y >= max_y:
        return y
    pdf.set_xy(x0, y)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(52, 5, pdf_text(f"{label}:"))
    pdf.set_font("helvetica", "", 9)
    pdf.cell(0, 5, pdf_text(value or "-"))
    return y + 5.5


def _draw_offer_page(
    pdf: FPDF,
    *,
    profile: dict[str, Any],
    inputs: dict[str, Any],
    variant: str,
    letter_no: str,
    date_str: str,
    blank: bool,
) -> None:
    w = pdf.w
    _, x0, inner_w, _ = page_layout(pdf)
    part_variant = "offer_technical" if variant == "technical" else "offer_non_technical"
    sig_y, _, footer_y = closing_signature_layout(part_variant, page_w=w, page_h=pdf.h)
    body_bottom = sig_y - 3
    technical = variant == "technical"

    y = draw_canva_header(pdf, variant=part_variant)
    title = "Internship Offer Letter" if technical else "INTERNSHIP ACCEPTANCE LETTER"
    y = _draw_letter_title(pdf, y=y, w=w, title=title)
    y = _draw_ref_date(pdf, x0=x0, inner_w=inner_w, y=y, letter_no=letter_no if not blank else "", date_str=date_str if not blank else "")
    y = _draw_recipient(pdf, x0=x0, y=y, profile=profile, technical=technical, blank=blank)

    pdf.set_xy(x0, y)
    pdf.set_font("helvetica", "", 9.5)
    pdf.cell(0, 5, pdf_text("Dear Candidate,"))
    y += 7

    if technical:
        y = _paragraph(
            pdf,
            x0=x0,
            inner_w=inner_w,
            y=y,
            max_y=body_bottom,
            text=(
                "We are pleased to accept your application and formally offer you an internship at "
                "XPERT VENTURES PRIVATE LIMITED (XpertIntern). Our internship programmes are designed "
                "in full alignment with NEP-2020, AICTE and UGC Internship Guidelines, and your university's "
                "specific internship framework."
            ),
        )
        pdf.set_xy(x0, y)
        pdf.set_font("helvetica", "B", 9.5)
        pdf.cell(0, 5, pdf_text("Your internship details are as follows:"))
        y += 7

        if blank:
            bullets = [
                ("Programme", ""),
                ("Semester", ""),
                ("Internship Domain", ""),
                ("Internship Duration", ""),
                ("Mode of Internship", ""),
                ("Internship Start Date", ""),
            ]
        else:
            bullets = [
                ("Programme", _course_line(profile)),
                ("Semester", profile.get("semester") or profile.get("session") or "-"),
                ("Internship Domain", profile.get("domain") or inputs.get("domain") or "-"),
                ("Internship Duration", _duration_label(inputs)),
                ("Mode of Internship", inputs.get("mode") or "Offline"),
                ("Internship Start Date", format_letter_date(inputs.get("internshipStartDate") or inputs.get("startDate"))),
            ]
        for label, val in bullets:
            if y >= body_bottom:
                break
            y = _bullet_line(pdf, x0=x0, y=y, label=label, value=str(val), max_y=body_bottom)
        if y < body_bottom:
            y = _bullet_line(
                pdf, x0=x0, y=y, label="Stipend", value="Not Applicable - Academic Programme", max_y=body_bottom
            )
        y += 2
        y = _paragraph(
            pdf,
            x0=x0,
            inner_w=inner_w,
            y=y,
            max_y=body_bottom,
            text=(
                "Please report to us on your start date as per the schedule above and bring this letter along "
                "with the Consent Letter issued by your College. We also request that you inform your College "
                "Internship Nodal Officer (CINO) upon receiving this acceptance letter. During the programme, "
                "you are required to maintain the minimum required attendance and complete all tasks and "
                "assignments given by your mentor."
            ),
        )
        y = _paragraph(
            pdf,
            x0=x0,
            inner_w=inner_w,
            y=y,
            max_y=body_bottom,
            text=(
                "We look forward to a meaningful and enriching internship experience and appreciate your "
                "interest in XpertIntern."
            ),
        )
    else:
        uni = "" if blank else (profile.get("university") or profile.get("collegeName") or "your University")
        y = _paragraph(
            pdf,
            x0=x0,
            inner_w=inner_w,
            y=y,
            max_y=body_bottom,
            text=(
                "We are pleased to accept your application and offer you internship at our organization. "
                f"Our organizations satisfy all the requirements as provided in the Internship Guidelines of "
                f"{uni} for Undergraduate Programmes."
            ),
        )
        y = _paragraph(pdf, x0=x0, inner_w=inner_w, y=y, max_y=body_bottom, text="We appreciate your interest in our organization.")
        y = _paragraph(pdf, x0=x0, inner_w=inner_w, y=y, max_y=body_bottom, text="Thank you.")

    draw_closing_signature_area(pdf, variant=part_variant, x0=x0, inner_w=inner_w)
    draw_canva_footer(pdf, variant=part_variant)


def build_offer_letter_pdf(*, profile: dict[str, Any], inputs: dict[str, Any], variant: str, letter_no: str) -> bytes:
    """3-page PDF: filled letter + blank template copies."""
    date_str = format_letter_date(inputs.get("offerLetterDate") or inputs.get("sendingDate") or datetime.utcnow())
    if not date_str:
        date_str = datetime.utcnow().strftime("%d %B %Y")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.set_margins(0, 0, 0)

    for blank in (False, True, True):
        pdf.add_page()
        _draw_offer_page(
            pdf,
            profile=profile,
            inputs=inputs,
            variant=variant,
            letter_no=letter_no,
            date_str=date_str,
            blank=blank,
        )

    out = pdf.output()
    return bytes(out) if isinstance(out, bytearray) else out
