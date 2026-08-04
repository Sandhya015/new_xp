"""GST tax invoice PDF using fpdf2 (Lambda-safe). Layout mirrors tax_invoice HTML."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.checkout_pricing import COURSE_SAC, KIT_HSN
from app.inr_words import inr_int_to_words
from app.tax_invoice import (
    SUPPLIER_ADDRESS_HTML,
    SUPPLIER_CIN,
    SUPPLIER_EMAIL,
    SUPPLIER_GSTIN,
    SUPPLIER_LEGAL_NAME,
    SUPPLIER_PAN,
    SUPPLIER_STATE_CODE,
    SUPPLIER_WEB,
    display_payment_mode,
    fmt_inr,
)

# Bump when PDF geometry changes so stored order PDFs are regenerated on next download.
# Deploy probe: header layout v2 (Vercel/GitHub pipeline check).
# Re-trigger Vercel deploy with known-good commit author.
# Redeploy check as Sandhya015 (repo owner) after Vercel GitHub app access.
INVOICE_PDF_LAYOUT_VERSION = 2

_LOGO_PATH = Path(__file__).resolve().parent / "static" / "xpertintern_logo.png"

# Plain-text address (HTML uses <br>)
_SUPPLIER_ADDRESS_LINES = [
    ln.strip()
    for ln in SUPPLIER_ADDRESS_HTML.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    .replace("&mdash;", "-")
    .split("\n")
    if ln.strip()
]


def _pdf_safe(text: str) -> str:
    t = (text or "").replace("\u2014", "-").replace("\u2013", "-").replace("\u20b9", "Rs.")
    t = t.replace("\u2212", "-").replace("&middot;", "-").replace("&amp;", "&").replace("·", "-")
    return t.encode("latin-1", "replace").decode("latin-1")


def _logo_path() -> Path | None:
    if _LOGO_PATH.is_file():
        return _LOGO_PATH
    return None


class _InvoicePDF(FPDF):
    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(100, 100, 100)
        self.cell(
            0,
            4,
            _pdf_safe("Thank you for choosing XpertIntern. Your access has been activated - happy learning!"),
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
            align="C",
        )


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
    billing: dict[str, Any] | None = None,
    buyer_gstin: str | None = None,
    payment_gateway_label: str = "Payments",
) -> bytes:
    """Full-layout tax invoice PDF matching the HTML template structure."""
    b = breakdown
    bill = billing if isinstance(billing, dict) else {}
    name = (bill.get("fullName") or bill.get("name") or customer_name or "Customer").strip() or "Customer"
    email = (bill.get("email") or "").strip()
    phone = (bill.get("phone") or "").strip()
    if phone and not phone.startswith("+"):
        phone = f"+91 {phone}"
    street = (bill.get("street") or "").strip()
    apt = (bill.get("apartment") or "").strip()
    city = (bill.get("city") or "").strip()
    state = (bill.get("state") or "").strip()
    pin = (bill.get("pincode") or "").strip()
    st_code = (bill.get("stateCode") or "").strip()
    gstin = (buyer_gstin or bill.get("gstin") or "").strip()

    pdf = _InvoicePDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(12, 12, 12)
    pdf.add_page()

    left = float(pdf.l_margin)
    page_w = float(pdf.w)
    content_w = float(pdf.epw)  # full content width (page minus margins)

    # Brand strip (outside flow)
    pdf.set_fill_color(13, 58, 122)
    pdf.rect(0, 0, page_w, 3, "F")

    # --- Header: left supplier block is the sole Y driver; logo is purely decorative ---
    y0 = 8.0
    logo_w = 38.0
    header_text_w = content_w - logo_w - 6.0  # room for logo / brand mark on the right

    pdf.set_xy(left, y0)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(13, 58, 122)
    pdf.multi_cell(header_text_w, 5.5, _pdf_safe(SUPPLIER_LEGAL_NAME), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_text_color(40, 40, 40)
    pdf.set_font("Helvetica", "", 8)
    for ln in _SUPPLIER_ADDRESS_LINES:
        pdf.set_x(left)
        pdf.multi_cell(header_text_w, 4, _pdf_safe(ln), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    half = header_text_w / 2.0
    for a, b_label in (
        (f"CIN: {SUPPLIER_CIN}", f"PAN: {SUPPLIER_PAN}"),
        (f"GSTIN: {SUPPLIER_GSTIN}", f"State Code: {SUPPLIER_STATE_CODE} - Bihar"),
        (f"Email: {SUPPLIER_EMAIL}", f"Web: {SUPPLIER_WEB}"),
    ):
        y_line = pdf.get_y()
        pdf.set_xy(left, y_line)
        pdf.cell(half, 4, _pdf_safe(a), new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(half, 4, _pdf_safe(b_label), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    header_bottom = float(pdf.get_y())

    # Right brand mark / logo — never change header_bottom or leave Y at the top
    logo = _logo_path()
    brand_drawn = False
    if logo:
        try:
            # Cap height so a tall asset cannot dominate the page
            pdf.image(str(logo), x=left + header_text_w + 4, y=y0, w=logo_w, h=14)
            brand_drawn = True
        except Exception:
            brand_drawn = False
    if not brand_drawn:
        pdf.set_xy(left + header_text_w + 2, y0)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(13, 58, 122)
        pdf.cell(logo_w, 6, "XpertIntern", new_x=XPos.RIGHT, new_y=YPos.TOP, align="R")

    # Resume below BOTH supplier text and any brand mark
    pdf.set_y(max(header_bottom, y0 + 16) + 4)
    pdf.set_x(left)
    pdf.set_text_color(0, 0, 0)

    # Title bar — full content width, always below header
    bar_h = 9.0
    pdf.set_fill_color(13, 58, 122)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 12)
    title_w = content_w * 0.55
    tag_w = content_w - title_w
    pdf.cell(title_w, bar_h, "TAX INVOICE", fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(tag_w, bar_h, _pdf_safe("Original Copy - GST Bill"), fill=True, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # Meta grid (2 cols)
    receipt_lbl = receipt_date.strftime("%d-%b-%Y")
    pay_mode = display_payment_mode(payment_mode)
    meta = [
        ("Invoice Number", invoice_number),
        ("Receipt Date", receipt_lbl),
        ("Place of Supply", place_of_supply or "-"),
        ("Reverse Charge", "No"),
        ("Payment Mode", pay_mode),
        ("Payment ID", payment_id or "-"),
    ]
    pdf.set_font("Helvetica", "", 8)
    col_w = (content_w - 2) / 2.0
    for i in range(0, len(meta), 2):
        left_meta = meta[i]
        right_meta = meta[i + 1] if i + 1 < len(meta) else ("", "")
        x_row = left
        y_row = pdf.get_y()
        pdf.set_fill_color(245, 247, 250)
        pdf.set_xy(x_row, y_row)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(col_w * 0.38, 5.5, _pdf_safe(left_meta[0]), fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(col_w * 0.62, 5.5, _pdf_safe(str(left_meta[1])[:48]), fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_xy(x_row + col_w + 2, y_row)
        if right_meta[0]:
            pdf.set_font("Helvetica", "B", 7)
            pdf.cell(col_w * 0.38, 5.5, _pdf_safe(right_meta[0]), fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(col_w * 0.62, 5.5, _pdf_safe(str(right_meta[1])[:48]), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            pdf.set_xy(left, y_row + 5.5)
        pdf.set_x(left)

    pdf.ln(3)
    # Billed To
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(13, 58, 122)
    pdf.cell(0, 5, "Billed To", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, _pdf_safe(name[:120]), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 8)
    contact = "  /  ".join(p for p in [f"Email: {email}" if email else "", f"Mobile: {phone}" if phone else ""] if p)
    if contact:
        pdf.multi_cell(content_w, 4, _pdf_safe(contact), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if gstin:
        pdf.cell(0, 4, _pdf_safe(f"Buyer GSTIN: {gstin}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if street:
        pdf.multi_cell(content_w, 4, _pdf_safe(street), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if apt:
        pdf.multi_cell(content_w, 4, _pdf_safe(apt), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    loc = ", ".join(p for p in [city, state] if p)
    if pin:
        loc = f"{loc} - {pin}" if loc else pin
    if loc:
        pdf.multi_cell(content_w, 4, _pdf_safe(loc), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if st_code:
        pdf.cell(0, 4, _pdf_safe(f"State Code: {st_code}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(3)
    # Line items table — scale to content width
    headers = ["#", "Description", "HSN/SAC", "Qty", "Rate", "Tax %", "Amount"]
    raw_w = [8, 72, 22, 12, 24, 16, 32]
    scale = content_w / sum(raw_w)
    widths = [round(w * scale, 2) for w in raw_w]
    # Fix float drift on last col
    widths[-1] = content_w - sum(widths[:-1])
    pdf.set_fill_color(13, 58, 122)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 7)
    for i, (h, w) in enumerate(zip(headers, widths)):
        is_last = i == len(headers) - 1
        pdf.cell(
            w,
            6,
            h,
            fill=True,
            align="C" if h != "Description" else "L",
            new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
            new_y=YPos.NEXT if is_last else YPos.TOP,
        )
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 7)

    def _row(cells: list[str], fill: bool = False):
        if fill:
            pdf.set_fill_color(248, 250, 252)
        aligns = ["C", "L", "C", "C", "R", "C", "R"]
        for i, (c, w, a) in enumerate(zip(cells, widths, aligns)):
            is_last = i == len(cells) - 1
            pdf.cell(
                w,
                5.5,
                _pdf_safe(c)[:60],
                fill=fill,
                align=a,
                new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
                new_y=YPos.NEXT if is_last else YPos.TOP,
            )

    title = (course_title or "Training Course").strip()[:80]
    _row(
        [
            "1",
            title,
            COURSE_SAC,
            "1",
            fmt_inr(b.course_taxable_list),
            f"{b.course_gst_rate:.0f}%",
            fmt_inr(b.course_taxable_list),
        ],
        fill=True,
    )
    if b.kit_list_gross > 0:
        _row(
            [
                "2",
                "XpertIntern Internship Training Kit",
                KIT_HSN,
                "1",
                fmt_inr(b.kit_taxable_list),
                f"{b.kit_gst_rate:.0f}%",
                fmt_inr(b.kit_taxable_list),
            ],
        )
    if b.coupon_inclusive_off > 0 and b.coupon_code:
        pdf.set_font("Helvetica", "I", 7)
        disc = (
            f"Coupon {b.coupon_code}: -Rs.{fmt_inr(b.coupon_inclusive_off)} incl. "
            f"(-Rs.{fmt_inr(b.coupon_taxable_discount)} taxable)"
        )
        pdf.cell(
            sum(widths[:6]),
            5,
            _pdf_safe(disc)[:90],
            new_x=XPos.RIGHT,
            new_y=YPos.TOP,
        )
        pdf.cell(
            widths[6],
            5,
            _pdf_safe(f"- {fmt_inr(b.coupon_taxable_discount)}"),
            align="R",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        pdf.set_font("Helvetica", "", 7)

    pdf.ln(3)
    # Amount in words + totals
    words = inr_int_to_words(int(round(b.grand_total_inclusive)))
    left_x = left
    right_x = left + content_w * 0.52
    y_tot = pdf.get_y()
    pdf.set_xy(left_x, y_tot)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(90, 4, "Amount in Words", new_x=XPos.LEFT, new_y=YPos.NEXT)
    pdf.set_x(left_x)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(content_w * 0.48, 4, _pdf_safe(f"Rupees {words} Only"))
    words_bottom = pdf.get_y()

    pdf.set_xy(right_x, y_tot)

    def _tot_line(label: str, val: str, bold: bool = False):
        pdf.set_x(right_x)
        pdf.set_font("Helvetica", "B" if bold else "", 8)
        pdf.cell(48, 5, _pdf_safe(label), new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(32, 5, _pdf_safe(f"Rs. {val}"), align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    _tot_line("Taxable Value (Subtotal)", fmt_inr(b.taxable_subtotal))
    if b.coupon_taxable_discount > 0:
        _tot_line("Coupon Discount (taxable)", f"- {fmt_inr(b.coupon_taxable_discount)}")
    _tot_line("Net Taxable Value", fmt_inr(b.net_taxable))
    if intra_state:
        half_c = b.course_gst_rate / 2.0
        a = round(b.course_gst_amount / 2.0, 2)
        b_rem = round(b.course_gst_amount - a, 2)
        _tot_line(f"CGST ({half_c:.0f}%) Course", fmt_inr(a))
        _tot_line(f"SGST ({half_c:.0f}%) Course", fmt_inr(b_rem))
        if b.kit_list_gross > 0:
            hk = b.kit_gst_rate / 2.0
            ak = round(b.kit_gst_amount / 2.0, 2)
            bk = round(b.kit_gst_amount - ak, 2)
            _tot_line(f"CGST ({hk:.0f}%) Kit", fmt_inr(ak))
            _tot_line(f"SGST ({hk:.0f}%) Kit", fmt_inr(bk))
    else:
        _tot_line(f"IGST {b.course_gst_rate:.0f}% Course", fmt_inr(b.course_gst_amount))
        if b.kit_list_gross > 0:
            _tot_line(f"IGST {b.kit_gst_rate:.0f}% Kit", fmt_inr(b.kit_gst_amount))
    _tot_line("Round Off", fmt_inr(b.round_off))
    pdf.set_fill_color(232, 240, 254)
    pdf.set_x(right_x)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(48, 6, "Grand Total", fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(
        32,
        6,
        _pdf_safe(f"Rs. {fmt_inr(b.grand_total_inclusive)}"),
        fill=True,
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    totals_bottom = pdf.get_y()
    pdf.set_y(max(words_bottom, totals_bottom) + 3)

    # Tax summary
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(13, 58, 122)
    pdf.cell(0, 5, "Tax Summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)
    th = ["HSN/SAC", "Taxable", "CGST", "SGST", "IGST", "Total Tax"]
    raw_tw = [36, 30, 30, 30, 30, 30]
    tw_scale = content_w / sum(raw_tw)
    tw = [round(w * tw_scale, 2) for w in raw_tw]
    tw[-1] = content_w - sum(tw[:-1])
    pdf.set_fill_color(230, 235, 242)
    pdf.set_font("Helvetica", "B", 7)
    for i, (h, w) in enumerate(zip(th, tw)):
        is_last = i == len(th) - 1
        pdf.cell(
            w,
            5,
            h,
            fill=True,
            align="C",
            new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
            new_y=YPos.NEXT if is_last else YPos.TOP,
        )
    pdf.set_font("Helvetica", "", 7)

    def _tax_cells(taxable: float, gst_amt: float, rate: float) -> list[str]:
        if intra_state:
            half = rate / 2.0
            a = round(gst_amt / 2.0, 2)
            bb = round(gst_amt - a, 2)
            return [
                fmt_inr(taxable),
                f"{fmt_inr(a)} @{half:.0f}%",
                f"{fmt_inr(bb)} @{half:.0f}%",
                "-",
                fmt_inr(round(a + bb, 2)),
            ]
        return [fmt_inr(taxable), "-", "-", f"{fmt_inr(gst_amt)} @{rate:.0f}%", fmt_inr(gst_amt)]

    row1 = [f"{COURSE_SAC} (Course)"] + _tax_cells(b.course_taxable_after_coupon, b.course_gst_amount, b.course_gst_rate)
    for i, (c, w) in enumerate(zip(row1, tw)):
        is_last = i == len(row1) - 1
        pdf.cell(
            w,
            5,
            _pdf_safe(c),
            align="R" if w != tw[0] else "L",
            new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
            new_y=YPos.NEXT if is_last else YPos.TOP,
        )
    if b.kit_list_gross > 0:
        row2 = [f"{KIT_HSN} (Kit)"] + _tax_cells(b.kit_taxable_after_coupon, b.kit_gst_amount, b.kit_gst_rate)
        for i, (c, w) in enumerate(zip(row2, tw)):
            is_last = i == len(row2) - 1
            pdf.cell(
                w,
                5,
                _pdf_safe(c),
                align="R" if w != tw[0] else "L",
                new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
                new_y=YPos.NEXT if is_last else YPos.TOP,
            )

    if intra_state:
        a_c = round(b.course_gst_amount / 2.0, 2)
        b_c = round(b.course_gst_amount - a_c, 2)
        a_k = round(b.kit_gst_amount / 2.0, 2) if b.kit_list_gross > 0 else 0.0
        b_k = round(b.kit_gst_amount - a_k, 2) if b.kit_list_gross > 0 else 0.0
        tot_cgst, tot_sgst, tot_igst = fmt_inr(round(a_c + a_k, 2)), fmt_inr(round(b_c + b_k, 2)), "-"
    else:
        tot_cgst, tot_sgst, tot_igst = "-", "-", fmt_inr(round(b.total_gst, 2))
    pdf.set_font("Helvetica", "B", 7)
    tot_row = ["Total", fmt_inr(b.net_taxable), tot_cgst, tot_sgst, tot_igst, fmt_inr(b.total_gst)]
    pdf.set_fill_color(245, 247, 250)
    for i, (c, w) in enumerate(zip(tot_row, tw)):
        is_last = i == len(tot_row) - 1
        pdf.cell(
            w,
            5,
            _pdf_safe(c),
            fill=True,
            align="R" if w != tw[0] else "L",
            new_x=XPos.LMARGIN if is_last else XPos.RIGHT,
            new_y=YPos.NEXT if is_last else YPos.TOP,
        )

    pdf.ln(3)
    # Payment info
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(13, 58, 122)
    pdf.cell(0, 5, "Payment Details", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 8)
    pgw = (payment_gateway_label or "Payments").strip() or "Payments"
    pay_rows = [
        ("Payment Status", "PAID"),
        ("Amount Paid", f"Rs. {fmt_inr(b.grand_total_inclusive)}"),
        ("Payment Gateway", pgw),
        ("Transaction ID", payment_id or "-"),
    ]
    for lab, val in pay_rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(40, 4.5, lab, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "", 8)
        if lab == "Payment Status":
            pdf.set_text_color(21, 128, 61)
        pdf.cell(0, 4.5, _pdf_safe(val), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(0, 0, 0)

    pdf.set_x(left)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 4, "Terms & Conditions", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 6.5)
    terms = [
        "1. Fees once paid are neither refundable nor transferable under any circumstances.",
        "2. Course access and training kit (if opted) are granted to the registered student only.",
        "3. Sharing of course content or credentials is prohibited and may revoke access without refund.",
        "4. Training kit (if opted) ships to the checkout address within 7-10 working days.",
        "5. This is a digitally generated tax invoice and does not require a physical signature.",
        "6. All disputes are subject to Patna jurisdiction only.",
        f"7. Billing queries: {SUPPLIER_EMAIL}.",
    ]
    for t in terms:
        pdf.set_x(left)
        pdf.multi_cell(content_w, 3.2, _pdf_safe(t), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_x(left)
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 7)
    y_decl = pdf.get_y()
    decl_w = content_w * 0.62
    sig_x = left + content_w * 0.68
    pdf.multi_cell(
        decl_w,
        3.5,
        _pdf_safe(
            "Declaration: We hereby certify that the information given on this invoice is true and correct, "
            "and that the amount shown is the actual price of the goods/services supplied."
        ),
        new_x=XPos.RIGHT,
        new_y=YPos.TOP,
    )
    pdf.set_xy(sig_x, y_decl)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(content_w * 0.32, 4, _pdf_safe(f"For {SUPPLIER_LEGAL_NAME}"), new_x=XPos.LEFT, new_y=YPos.NEXT, align="C")
    pdf.set_x(sig_x)
    pdf.ln(8)
    pdf.set_x(sig_x)
    pdf.cell(content_w * 0.32, 4, "Authorised Signatory", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    out = pdf.output(dest="S")
    if isinstance(out, bytes):
        return out
    if isinstance(out, bytearray):
        return bytes(out)
    return out.encode("latin-1")
