"""GST tax invoice HTML (template CSS + populated body) per XpertIntern working documentation."""
from __future__ import annotations

import html
from datetime import datetime
from pathlib import Path
from typing import Any

from app.checkout_pricing import COURSE_SAC, KIT_HSN
from app.inr_words import inr_int_to_words

SUPPLIER_STATE_CODE = "10"
SUPPLIER_LEGAL_NAME = "XPERT VENTURES PRIVATE LIMITED"
SUPPLIER_ADDRESS_HTML = (
    "Advait Colony, Near Vaishali House, Gulzarbagh,<br>\n"
    "Sampatchak, Patna &mdash; 800007, Bihar, India"
)
SUPPLIER_CIN = "U85500BR2026PTC083539"
SUPPLIER_PAN = "AAACX6291M"
SUPPLIER_GSTIN = "10AAACX6291M1Z4"
SUPPLIER_EMAIL = "support@xpertintern.com"
SUPPLIER_WEB = "www.xpertintern.com"


def _css() -> str:
    p = Path(__file__).resolve().parent / "tax_invoice.css"
    return p.read_text(encoding="utf-8")


def fmt_inr(n: float) -> str:
    return f"{n:,.2f}"


def financial_year_key(d: datetime) -> str:
    """India FY Apr-Mar as YYYY-YY e.g. Apr 2026 -> 2026-27."""
    if d.month >= 4:
        y0 = d.year
    else:
        y0 = d.year - 1
    y1 = y0 + 1
    return f"{y0}-{(y1 % 100):02d}"


def allocate_invoice_serial(db, receipt_dt: datetime) -> str:
    """Atomic per-FY counter: XPI/2026-27/000001"""
    from pymongo import ReturnDocument

    fy = financial_year_key(receipt_dt)
    coll = db["invoice_sequences"]
    doc = coll.find_one_and_update(
        {"_id": fy},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    n = max(1, int(doc.get("seq") or 1))
    return f"XPI/{fy}/{n:06d}"


def display_payment_mode(raw: str | None) -> str:
    m = (raw or "").strip().lower()
    mapping = {
        "upi": "UPI",
        "card": "Card",
        "netbanking": "Netbanking",
        "wallet": "Wallet",
        "emi": "EMI",
        "paylater": "Pay Later",
    }
    return mapping.get(m, (raw or "Online").strip().title() or "Online")


def split_tax_for_row(
    taxable: float,
    gst_amt: float,
    total_rate_pct: float,
    intra_state: bool,
) -> tuple[str, str, str, float]:
    """
    Return (cgst_cell_html, sgst_cell_html, igst_cell_html, total_tax_for_row).
    intra: CGST+SGST half rates each; inter: full IGST.
    """
    if gst_amt <= 0 and taxable <= 0:
        return ("&mdash;", "&mdash;", "&mdash;", 0.0)
    if intra_state:
        half = total_rate_pct / 2.0
        a = round(gst_amt / 2.0, 2)
        b = round(gst_amt - a, 2)
        return (
            f"{fmt_inr(a)} @ {half:.0f}%",
            f"{fmt_inr(b)} @ {half:.0f}%",
            "&mdash;",
            round(a + b, 2),
        )
    return (
        "&mdash;",
        "&mdash;",
        f"{fmt_inr(gst_amt)} @ {total_rate_pct:.0f}%",
        gst_amt,
    )


def render_invoice_html(
    *,
    breakdown: OrderPricingBreakdown,
    course_title: str,
    invoice_number: str,
    receipt_date: datetime,
    place_of_supply_label: str,
    payment_mode: str,
    payment_id: str,
    billing: dict[str, Any],
    buyer_gstin: str | None,
    intra_state: bool,
    payment_gateway_label: str = "Razorpay",
) -> str:
    b = breakdown
    cn = html.escape((billing.get("fullName") or billing.get("name") or "").strip() or "Customer")
    em = html.escape((billing.get("email") or "").strip())
    ph = html.escape((billing.get("phone") or "").strip())
    city = html.escape((billing.get("city") or "").strip())
    st_name = (billing.get("state") or "").strip()
    st_name_e = html.escape(st_name)
    pin = html.escape((billing.get("pincode") or "").strip())
    line1 = html.escape((billing.get("street") or "").strip())
    apt = (billing.get("apartment") or "").strip()
    line2 = f"{html.escape(apt)}<br>\n" if apt else ""

    mobile_disp = ph
    if ph:
        mobile_disp = ph if ph.startswith("+") else f"+91 {ph}"

    st_code_buyer = html.escape((billing.get("stateCode") or "").strip())

    receipt_lbl = receipt_date.strftime("%d-%b-%Y")

    course_title_e = html.escape(course_title.strip() or "Training Course")
    inv_e = html.escape(invoice_number)
    pay_mode_e = html.escape(display_payment_mode(payment_mode))
    pay_id_e = html.escape(payment_id)
    pos_e = html.escape(place_of_supply_label)
    pgw_e = html.escape((payment_gateway_label or "Payments").strip() or "Payments")

    # Line items: rate column = taxable (pre-discount list) per sample
    course_rate_taxable = b.course_taxable_list
    kit_rate_taxable = b.kit_taxable_list if b.kit_list_gross > 0 else 0.0

    rows_html = f"""
      <tr>
        <td>1</td>
        <td>
          <div class="item-title">{course_title_e}</div>
          <div class="item-sub">Commercial Training &middot; Online Cohort Access</div>
        </td>
        <td class="center">{COURSE_SAC}</td>
        <td class="center">1</td>
        <td class="num">{fmt_inr(course_rate_taxable)}</td>
        <td class="center">{b.course_gst_rate:.0f}%</td>
        <td class="num">{fmt_inr(course_rate_taxable)}</td>
      </tr>"""
    if b.kit_list_gross > 0:
        rows_html += f"""
      <tr>
        <td>2</td>
        <td>
          <div class="item-title">XpertIntern Internship Training Kit</div>
          <div class="item-sub">Printed Workbook + Assignments + Reference Material</div>
        </td>
        <td class="center">{KIT_HSN}</td>
        <td class="center">1</td>
        <td class="num">{fmt_inr(kit_rate_taxable)}</td>
        <td class="center">{b.kit_gst_rate:.0f}%</td>
        <td class="num">{fmt_inr(kit_rate_taxable)}</td>
      </tr>"""
    if b.coupon_inclusive_off > 0 and b.coupon_code:
        disc_cell = (
            f'Coupon Discount applied: <b>{html.escape(b.coupon_code)}</b> '
            f"(&minus; &#8377;{fmt_inr(b.coupon_inclusive_off)} on inclusive total, "
            f"allocated to Course &amp; Kit as applicable)"
        )
        rows_html += f"""
      <tr class="discount-row">
        <td colspan="6">{disc_cell}</td>
        <td class="num">&minus; {fmt_inr(b.coupon_taxable_discount)}</td>
      </tr>"""

    cgst_c, sgst_c, igst_c, tot_c = split_tax_for_row(
        b.course_taxable_after_coupon,
        b.course_gst_amount,
        b.course_gst_rate,
        intra_state,
    )
    cgst_k, sgst_k, igst_k, tot_k = (
        split_tax_for_row(
            b.kit_taxable_after_coupon,
            b.kit_gst_amount,
            b.kit_gst_rate,
            intra_state,
        )
        if b.kit_list_gross > 0
        else ("&mdash;", "&mdash;", "&mdash;", 0.0)
    )

    total_cgst_col = "&mdash;"
    total_sgst_col = "&mdash;"
    total_igst_col = "&mdash;"
    if intra_state:
        a_c = round(b.course_gst_amount / 2.0, 2)
        b_c = round(b.course_gst_amount - a_c, 2)
        a_k = round(b.kit_gst_amount / 2.0, 2) if b.kit_list_gross > 0 else 0.0
        b_k = round(b.kit_gst_amount - a_k, 2) if b.kit_list_gross > 0 else 0.0
        total_cgst_col = fmt_inr(round(a_c + a_k, 2))
        total_sgst_col = fmt_inr(round(b_c + b_k, 2))
    else:
        total_igst_col = fmt_inr(round(b.total_gst, 2))

    grand_int = int(round(b.grand_total_inclusive))
    words = inr_int_to_words(grand_int)

    extra_totals_lines = ""
    if intra_state:
        half_c = b.course_gst_rate / 2.0
        a = round(b.course_gst_amount / 2.0, 2)
        b_rem = round(b.course_gst_amount - a, 2)
        extra_totals_lines += f"""
      <div class="line"><span>CGST ({half_c:.0f}%) on Course (&#8377;{fmt_inr(b.course_taxable_after_coupon)})</span><b>&#8377; {fmt_inr(a)}</b></div>
      <div class="line"><span>SGST ({half_c:.0f}%) on Course (&#8377;{fmt_inr(b.course_taxable_after_coupon)})</span><b>&#8377; {fmt_inr(b_rem)}</b></div>"""
        if b.kit_list_gross > 0:
            hk = b.kit_gst_rate / 2.0
            ak = round(b.kit_gst_amount / 2.0, 2)
            bk = round(b.kit_gst_amount - ak, 2)
            extra_totals_lines += f"""
      <div class="line"><span>CGST ({hk:.0f}%) on Kit (&#8377;{fmt_inr(b.kit_taxable_after_coupon)})</span><b>&#8377; {fmt_inr(ak)}</b></div>
      <div class="line"><span>SGST ({hk:.0f}%) on Kit (&#8377;{fmt_inr(b.kit_taxable_after_coupon)})</span><b>&#8377; {fmt_inr(bk)}</b></div>"""
    else:
        extra_totals_lines += f"""
      <div class="line"><span>IGST {b.course_gst_rate:.0f}% on Course (&#8377;{fmt_inr(b.course_taxable_after_coupon)})</span><b>&#8377; {fmt_inr(b.course_gst_amount)}</b></div>"""
        if b.kit_list_gross > 0:
            extra_totals_lines += f"""
      <div class="line"><span>IGST {b.kit_gst_rate:.0f}% on Kit (&#8377;{fmt_inr(b.kit_taxable_after_coupon)})</span><b>&#8377; {fmt_inr(b.kit_gst_amount)}</b></div>"""

    gstin_row = ""
    if buyer_gstin and buyer_gstin.strip():
        gstin_row = f'<div class="detail-line"><b>Buyer GSTIN:</b> {html.escape(buyer_gstin.strip())}</div>'

    logo_block = (
        '<div class="logo-block">'
        '<span style="font-size:15px;font-weight:700;color:#0d3a7a;">XpertIntern</span>'
        "</div>"
    )

    tax_rows_html = f"""
        <tr>
          <td>{COURSE_SAC} (Course)</td>
          <td class="num">{fmt_inr(b.course_taxable_after_coupon)}</td>
          <td class="num">{cgst_c}</td>
          <td class="num">{sgst_c}</td>
          <td class="num">{igst_c}</td>
          <td class="num">{fmt_inr(tot_c)}</td>
        </tr>"""
    if b.kit_list_gross > 0:
        tax_rows_html += f"""
        <tr>
          <td>{KIT_HSN} (Training Kit)</td>
          <td class="num">{fmt_inr(b.kit_taxable_after_coupon)}</td>
          <td class="num">{cgst_k}</td>
          <td class="num">{sgst_k}</td>
          <td class="num">{igst_k}</td>
          <td class="num">{fmt_inr(tot_k)}</td>
        </tr>"""
    tax_rows_html += f"""
        <tr class="total-row">
          <td>Total</td>
          <td class="num">{fmt_inr(b.net_taxable)}</td>
          <td class="num">{total_cgst_col}</td>
          <td class="num">{total_sgst_col}</td>
          <td class="num">{total_igst_col}</td>
          <td class="num">{fmt_inr(b.total_gst)}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tax Invoice - XpertIntern</title>
<style>
{_css()}
</style>
</head>
<body>
<div class="invoice">
  <div class="brand-strip"></div>

  <div class="header">
    <div class="company-info">
      <h1>{SUPPLIER_LEGAL_NAME}</h1>
      <div class="addr">
        {SUPPLIER_ADDRESS_HTML}
      </div>
      <div class="meta-row">
        <span><b>CIN:</b> {SUPPLIER_CIN}</span>
        <span><b>PAN:</b> {SUPPLIER_PAN}</span>
      </div>
      <div class="meta-row">
        <span><b>GSTIN:</b> {SUPPLIER_GSTIN}</span>
        <span><b>State Code:</b> {SUPPLIER_STATE_CODE} - Bihar</span>
      </div>
      <div class="meta-row">
        <span><b>Email:</b> {SUPPLIER_EMAIL}</span>
        <span><b>Web:</b> {SUPPLIER_WEB}</span>
      </div>
    </div>
    {logo_block}
  </div>

  <div class="title-bar">
    <h2>TAX INVOICE</h2>
    <div class="copy-tag">Original Copy &middot; GST Bill</div>
  </div>

  <div class="meta-grid">
    <div class="row"><div class="label">Invoice Number</div><div class="value">{inv_e}</div></div>
    <div class="row"><div class="label">Receipt Date</div><div class="value">{receipt_lbl}</div></div>
    <div class="row"><div class="label">Place of Supply</div><div class="value">{pos_e}</div></div>
    <div class="row"><div class="label">Reverse Charge</div><div class="value">No</div></div>
    <div class="row"><div class="label">Payment Mode</div><div class="value">{pay_mode_e}</div></div>
    <div class="row"><div class="label">Payment ID</div><div class="value">{pay_id_e}</div></div>
  </div>

  <div class="bill-section">
    <h3>Billed To</h3>
    <div class="name">{cn}</div>
    <div class="detail-line"><b>Email:</b> {em} &nbsp;&middot;&nbsp; <b>Mobile:</b> {mobile_disp}</div>
    {gstin_row}
    <div class="detail-line">{line1}</div>
    {line2}
    <div class="detail-line">{city}, {st_name_e} &mdash; {pin}</div>
    <div class="detail-line"><b>State Code:</b> {st_code_buyer}</div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:34px">#</th>
        <th>Description of Service / Goods</th>
        <th class="center" style="width:70px">HSN/SAC</th>
        <th class="center" style="width:42px">Qty</th>
        <th class="num" style="width:84px">Rate (&#8377;)</th>
        <th class="center" style="width:56px">Tax %</th>
        <th class="num" style="width:96px">Amount (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
{rows_html}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="amount-words">
      <div class="lbl">Amount in Words</div>
      <div class="val">Rupees {words} Only</div>
    </div>
    <div class="totals">
      <div class="line"><span>Taxable Value (Subtotal)</span><b>&#8377; {fmt_inr(b.taxable_subtotal)}</b></div>
      <div class="line discount"><span>Coupon Discount (taxable)</span><b>&minus; &#8377; {fmt_inr(b.coupon_taxable_discount)}</b></div>
      <div class="line"><span>Net Taxable Value</span><b>&#8377; {fmt_inr(b.net_taxable)}</b></div>
{extra_totals_lines}
      <div class="line"><span>Round Off</span><b>&#8377; {fmt_inr(b.round_off)}</b></div>
      <div class="line grand"><span>Grand Total</span><b>&#8377; {fmt_inr(b.grand_total_inclusive)}</b></div>
    </div>
  </div>

  <div class="tax-summary">
    <h3>Tax Summary</h3>
    <table>
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th class="num">Taxable Value (&#8377;)</th>
          <th class="num">CGST</th>
          <th class="num">SGST</th>
          <th class="num">IGST</th>
          <th class="num">Total Tax (&#8377;)</th>
        </tr>
      </thead>
      <tbody>
{tax_rows_html}
      </tbody>
    </table>
  </div>

  <div class="payment-info">
    <div class="row"><div class="label">Payment Status</div><div class="value" style="color:#15803d">PAID</div></div>
    <div class="row"><div class="label">Amount Paid</div><div class="value">&#8377; {fmt_inr(b.grand_total_inclusive)}</div></div>
    <div class="row"><div class="label">Payment Gateway</div><div class="value">{pgw_e}</div></div>
    <div class="row"><div class="label">Transaction ID</div><div class="value">{pay_id_e}</div></div>
  </div>

  <div class="terms">
    <h3>Terms &amp; Conditions</h3>
    <ol>
      <li>Fees once paid are <b>neither refundable nor transferable</b> under any circumstances.</li>
      <li>Course access, learning material and training kit (if opted) are granted to the registered student only and are non-transferable.</li>
      <li>Sharing of course content, login credentials, or recorded sessions is strictly prohibited and may lead to revocation of access without refund.</li>
      <li>Training kit (if opted) will be dispatched to the shipping address provided at checkout within 7-10 working days.</li>
      <li>This is a digitally generated tax invoice and does not require a physical signature.</li>
      <li>All disputes are subject to <b>Patna jurisdiction</b> only.</li>
      <li>For any billing or invoice queries, write to <b>{SUPPLIER_EMAIL}</b>.</li>
    </ol>
  </div>

  <div class="sign-area">
    <div class="left">
      <b>Declaration:</b> We hereby certify that the information given on this invoice is true and correct, and that the amount shown is the actual price of the goods/services supplied.
    </div>
    <div class="right">
      <div class="for-co">For <b>{SUPPLIER_LEGAL_NAME}</b></div>
      <div class="sigline">Authorised Signatory</div>
    </div>
  </div>

  <div class="footer-note">
    Thank you for choosing <b>XpertIntern</b>. Your access has been activated &mdash; happy learning!
  </div>
</div>
</body>
</html>
"""
