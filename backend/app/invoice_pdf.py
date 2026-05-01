"""Compact tax invoice PDF (GST summary) using fpdf2 — for email attachment when HTML print-to-PDF is unavailable."""
from __future__ import annotations

from datetime import datetime

from fpdf import FPDF

from app.checkout_pricing import COURSE_SAC, KIT_HSN
from app.tax_invoice import SUPPLIER_GSTIN, SUPPLIER_LEGAL_NAME, display_payment_mode, fmt_inr


def _pdf_safe(text: str) -> str:
    t = (text or "").replace("\u2014", "-").replace("\u2013", "-").replace("\u20b9", "Rs.")
    return t.encode("latin-1", "replace").decode("latin-1")


def render_invoice_pdf(
    *,
    invoice_number: str,
    receipt_date: datetime,
    customer_name: str,
    place_of_supply: str,
    payment_mode: str,
    payment_id: str,
    course_title: str,
    breakdown,
    intra_state: bool,
) -> bytes:
    """Plain-layout PDF with key totals (mirrors invoice grand total)."""
    b = breakdown
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(14, 14, 14)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, "TAX INVOICE", ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, _pdf_safe(SUPPLIER_LEGAL_NAME), ln=1)
    pdf.cell(0, 5, _pdf_safe(f"GSTIN: {SUPPLIER_GSTIN}  |  Place of Supply: {place_of_supply}"), ln=1)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Invoice details", ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, _pdf_safe(f"Invoice No: {invoice_number}"), ln=1)
    pdf.cell(0, 5, f"Receipt Date: {receipt_date.strftime('%d-%b-%Y')}", ln=1)
    pdf.cell(0, 5, _pdf_safe(f"Payment: {display_payment_mode(payment_mode)}  |  ID: {payment_id}"), ln=1)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Billed to", ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, _pdf_safe(customer_name[:500]))
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Line items (taxable value / GST)", ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, _pdf_safe(f"1. {course_title[:120]} - SAC {COURSE_SAC} @ {b.course_gst_rate:.0f}%"), ln=1)
    pdf.cell(
        0,
        5,
        f"   Taxable: Rs.{fmt_inr(b.course_taxable_after_coupon)}  GST: Rs.{fmt_inr(b.course_gst_amount)}",
        ln=1,
    )
    if b.kit_list_gross > 0:
        pdf.cell(0, 5, _pdf_safe(f"2. Training Kit - HSN {KIT_HSN} @ {b.kit_gst_rate:.0f}%"), ln=1)
        pdf.cell(
            0,
            5,
            f"   Taxable: Rs.{fmt_inr(b.kit_taxable_after_coupon)}  GST: Rs.{fmt_inr(b.kit_gst_amount)}",
            ln=1,
        )
    if b.coupon_code:
        pdf.cell(
            0,
            5,
            _pdf_safe(
                f"Coupon {b.coupon_code}: -Rs.{fmt_inr(b.coupon_inclusive_off)} (incl.) / -Rs.{fmt_inr(b.coupon_taxable_discount)} (taxable)",
            ),
            ln=1,
        )
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(40, 6, "Net taxable:", align="L")
    pdf.cell(40, 6, f"Rs.{fmt_inr(b.net_taxable)}", ln=1)
    pdf.cell(40, 6, "Total GST:", align="L")
    pdf.cell(40, 6, f"Rs.{fmt_inr(b.total_gst)}", ln=1)
    pdf.cell(40, 6, "Inter-state (IGST):" if not intra_state else "Intra-state (CGST+SGST):", align="L")
    pdf.cell(40, 6, "As per tax summary", ln=1)
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(40, 8, "Grand Total:", align="L")
    pdf.cell(40, 8, f"Rs.{fmt_inr(b.grand_total_inclusive)}", ln=1)
    pdf.set_font("Helvetica", "", 8)
    pdf.ln(4)
    pdf.multi_cell(
        0,
        4,
        "For the full formatted tax invoice with HSN/SAC breakdown, open the HTML invoice from your dashboard "
        "or refer to the attached HTML file if provided.",
    )
    out = pdf.output(dest="S")
    if isinstance(out, bytes):
        return out
    if isinstance(out, bytearray):
        return bytes(out)
    return out.encode("latin-1")
