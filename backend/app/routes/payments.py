"""
Payments: paid course checkout — Razorpay (legacy / optional) or Cashfree PG (when configured).

Create-order is JWT-backed; amounts come from Mongo (never trust the client alone).
GST tax invoices and receipts after successful verification.
"""
from __future__ import annotations

import os
import uuid
from dataclasses import asdict, fields
from datetime import datetime

from typing import Any

import razorpay
from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.checkout_coupon import kit_price_from_course_and_settings, lookup_coupon_pricing_only, resolve_checkout_coupon
from app.checkout_pricing import OrderPricingBreakdown, build_order_pricing_breakdown, breakdown_to_pricing_dict
from app.cashfree_pg import cashfree_base_url, cashfree_create_order, cashfree_fetch_order
from app.db import (
    get_app_settings_collection,
    get_courses_collection,
    get_db,
    get_enrollments_collection,
    get_orders_collection,
    get_users_collection,
)
from app.enrollment_lookup import user_course_enrollment_filter
from app.indian_gst_state_codes import gst_state_code_for_name
from app.invoice_pdf import render_invoice_pdf
from app.notifications import schedule_payment_success_email
from app.tax_invoice import allocate_invoice_serial, render_invoice_html

payments_bp = Blueprint("payments", __name__)


def _razorpay_client():
    key_id = current_app.config.get("RAZORPAY_KEY_ID") or ""
    key_secret = current_app.config.get("RAZORPAY_KEY_SECRET") or ""
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


def _detect_payment_gateway() -> str | None:
    rz_ok = bool(current_app.config.get("RAZORPAY_KEY_ID") and current_app.config.get("RAZORPAY_KEY_SECRET"))
    cf_ok = bool(current_app.config.get("CASHFREE_CLIENT_ID") and current_app.config.get("CASHFREE_CLIENT_SECRET"))
    force = (os.environ.get("PAYMENT_GATEWAY") or "").strip().lower()
    if force == "razorpay":
        return "razorpay" if rz_ok else None
    if force == "cashfree":
        return "cashfree" if cf_ok else None
    if cf_ok:
        return "cashfree"
    if rz_ok:
        return "razorpay"
    return None


def _public_app_base_url() -> str:
    cfg = getattr(current_app, "config", {})
    explicit = str(cfg.get("PUBLIC_APP_URL") or os.environ.get("PUBLIC_APP_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    raw = cfg.get("CORS_ORIGINS") or []
    if isinstance(raw, str):
        origins = [o.strip() for o in raw.split(",") if o.strip()]
    else:
        origins = [str(o).strip() for o in raw if str(o).strip()]
    candidates: list[str] = []
    for o in origins:
        s = o.rstrip("/")
        if s.startswith("http://") or s.startswith("https://"):
            candidates.append(s)
    if not candidates:
        return ""
    # Prefer https over http and real deploy origins over localhost (serverless default CORS lists localhost first).
    def sort_key(u: str) -> tuple[int, int, str]:
        lo = u.lower()
        https_rank = 0 if lo.startswith("https://") else 1
        local_rank = (
            1
            if "localhost" in lo or "127.0.0.1" in lo or "::1" in lo or "[::1]" in lo
            else 0
        )
        return (https_rank, local_rank, u)

    candidates.sort(key=sort_key)
    return candidates[0]


def _cashfree_return_base_url(cfg) -> str:
    """Public origin exclusively for Cashfree return_url — prefer HTTPS override for local HTTP dev."""
    ov = str(cfg.config.get("CASHFREE_RETURN_URL_ORIGIN") or os.environ.get("CASHFREE_RETURN_URL_ORIGIN") or "").strip().rstrip(
        "/",
    )
    if ov:
        return ov
    return _public_app_base_url()


def _cashfree_return_url_https_error(pub: str, cf_env_raw: str) -> str | None:
    """Cashfree production rejects http:// return URLs."""
    if not pub:
        return None
    cf_env = str(cf_env_raw or "production").strip().lower()
    if cf_env == "sandbox":
        return None
    if pub.lower().startswith("http://"):
        return (
            "Cashfree production requires order_meta.return_url to use HTTPS (not http://). "
            "On deployed API: set PUBLIC_APP_URL=https://YOUR_LIVE_SITE "
            "(or CASHFREE_RETURN_URL_ORIGIN) in Lambda/environment, redeploy backend, retry. "
            "If PUBLIC_APP_URL was omitted, backend may fall back to CORS — ensure an https:// production origin leads the list "
            'or always set PUBLIC_APP_URL. Local dev: see docs/local-cashfree-testing.md and `npm run dev:https`.'
        )
    return None


def _digits10_phone(raw: str) -> str:
    d = "".join(c for c in (raw or "") if c.isdigit())
    tail = d[-10:]
    return tail if len(tail) == 10 else ""


def _customer_for_cf(
    user_id: str,
    enrollment_snapshot: dict,
    billing_snapshot: dict,
) -> tuple[str, str, str, str]:
    es = enrollment_snapshot if isinstance(enrollment_snapshot, dict) else {}
    bs = billing_snapshot if isinstance(billing_snapshot, dict) else {}
    name = str(bs.get("fullName") or bs.get("name") or "").strip()
    email = str(bs.get("email") or "").strip()
    phone = _digits10_phone(str(bs.get("phone") or bs.get("mobile") or "").strip())

    mongo_uid = ""
    doc = None
    if ObjectId.is_valid(str(user_id)):
        doc = get_users_collection().find_one({"_id": ObjectId(str(user_id))})
        if doc:
            mongo_uid = str(doc.get("_id"))
            if not name:
                name = str(doc.get("name") or "").strip()
            if not email:
                email = str(doc.get("email") or "").strip()
            if not phone:
                phone = _digits10_phone(str(doc.get("mobile") or ""))
    if not email:
        email = str(es.get("email") or "").strip()
    cid = mongo_uid[:50] if mongo_uid else str(user_id)[:50]
    if not phone:
        phone = "9999999999"
    if not email:
        email = "customer@noreply.invalid"
    if not name:
        name = "Customer"
    return cid, name[:100], email[:100], phone


def _gateway_label(order: dict) -> str:
    return "Cashfree" if str(order.get("method") or "").lower() == "cashfree" else "Razorpay"


def _finalize_successful_charge(
    coll,
    order_before: dict,
    *,
    user_id: str,
    gateway_payment_ref: str,
    payment_method: str | None,
    receipt_ts: datetime | None,
) -> tuple[bool, dict]:
    """
    Persist success, optionally create enrollment, generate invoice/email.
    `gateway_payment_ref` is stored as transactionId / legacy razorpayPaymentId for receipts.
    """
    oid = order_before["_id"]
    rs = receipt_ts or datetime.utcnow()
    enrollment_created = False
    coll.update_one(
        {"_id": oid},
        {"$set": {
            "status": "success",
            "razorpayPaymentId": gateway_payment_ref,
            "transactionId": gateway_payment_ref,
            "verifiedAt": datetime.utcnow(),
            "invoiceReceiptAt": rs,
            "lastPaymentMethod": (payment_method or "").strip(),
        }},
    )
    order = coll.find_one({"_id": oid}) or order_before
    order["status"] = "success"
    order["razorpayPaymentId"] = gateway_payment_ref
    order["lastPaymentMethod"] = payment_method or ""
    order["invoiceReceiptAt"] = rs

    course_id = order.get("courseId")
    if course_id and ObjectId.is_valid(str(course_id)):
        enroll = get_enrollments_collection()
        if not enroll.find_one(user_course_enrollment_filter(user_id, str(course_id))):
            snap = order.get("enrollmentSnapshot") if isinstance(order.get("enrollmentSnapshot"), dict) else {}
            bill = order.get("billingSnapshot") if isinstance(order.get("billingSnapshot"), dict) else {}
            enroll.insert_one({
                "userId": user_id,
                "courseId": str(course_id),
                "orderId": str(order["_id"]),
                "status": "active",
                "createdAt": datetime.utcnow(),
                "certificateProfile": snap,
                "billingAddress": bill,
            })
            enrollment_created = True

    _build_and_store_invoice_if_needed(
        current_app._get_current_object(),
        coll,
        order,
        razorpay_payment_id=gateway_payment_ref,
        payment_method=payment_method or "",
        receipt_ts=rs,
        enrollment_created=enrollment_created,
    )
    refreshed = coll.find_one({"_id": oid}) or order
    return enrollment_created, refreshed


def _breakdown_from_order_doc(order: dict) -> OrderPricingBreakdown | None:
    raw = order.get("invoiceBreakdown")
    if not isinstance(raw, dict):
        return None
    try:
        keys = {f.name for f in fields(OrderPricingBreakdown)}
        return OrderPricingBreakdown(**{k: raw[k] for k in keys if k in raw})
    except (TypeError, ValueError):
        return None


def _recompute_breakdown(order: dict, course: dict, settings_doc: dict) -> OrderPricingBreakdown:
    try:
        course_gross = float(course.get("price") or 0)
    except (TypeError, ValueError):
        course_gross = 0.0
    kit_price = kit_price_from_course_and_settings(course, settings_doc)
    coupon_code = (order.get("couponCode") or (order.get("pricing") or {}).get("couponCode") or "").strip()
    coupon = lookup_coupon_pricing_only(coupon_code, course=course, settings_doc=settings_doc) if coupon_code else None
    return build_order_pricing_breakdown(
        course_gross=course_gross,
        kit_gross_if_included=kit_price,
        include_kit=bool(order.get("includeTrainingKit")),
        coupon=coupon,
        coupon_code=coupon_code,
    )


def _billing_for_invoice(order: dict) -> dict:
    bill = order.get("billingSnapshot") if isinstance(order.get("billingSnapshot"), dict) else {}
    st_name = (bill.get("state") or "").strip()
    code = gst_state_code_for_name(st_name)
    out = {**bill, "stateCode": code or (bill.get("stateCode") or "")}
    return out


def _build_and_store_invoice_if_needed(
    app,
    coll,
    order: dict,
    *,
    razorpay_payment_id: str,
    payment_method: str | None,
    receipt_ts: datetime | None,
    enrollment_created: bool = False,
) -> None:
    if order.get("invoiceNumber"):
        return
    if order.get("status") != "success":
        return
    db = get_db()
    if db is None:
        return
    courses_coll = get_courses_collection()
    settings_coll = get_app_settings_collection()
    course_id = order.get("courseId")
    if not course_id or not ObjectId.is_valid(str(course_id)):
        return
    course = courses_coll.find_one({"_id": ObjectId(str(course_id))})
    if not course:
        return
    settings_doc = settings_coll.find_one({"_id": "global"}) or {}

    bd = _breakdown_from_order_doc(order) or _recompute_breakdown(order, course, settings_doc)
    try:
        paid = float(order.get("amount") or 0)
    except (TypeError, ValueError):
        paid = 0.0
    if abs(bd.grand_total_inclusive - paid) > 0.02:
        app.logger.warning(
            "invoice breakdown vs paid mismatch order=%s calc=%s paid=%s",
            order.get("_id"),
            bd.grand_total_inclusive,
            paid,
        )

    rec_ts = receipt_ts or datetime.utcnow()
    inv_no = allocate_invoice_serial(db, rec_ts)
    coll.update_one(
        {"_id": order["_id"]},
        {"$set": {
            "invoiceNumber": inv_no,
            "invoiceGeneratedAt": datetime.utcnow(),
            "invoiceBreakdown": asdict(bd),
        }},
    )
    order["invoiceNumber"] = inv_no
    order["invoiceBreakdown"] = asdict(bd)

    bill = _billing_for_invoice(order)
    code = (bill.get("stateCode") or "").strip()
    intra = code == "10" and code != ""
    place = f"{code} - {bill.get('state', '').strip()}" if code else (bill.get("state") or "").strip()

    inv_no = order.get("invoiceNumber") or ""
    html_doc = render_invoice_html(
        breakdown=bd,
        course_title=str(course.get("title") or "Training"),
        invoice_number=inv_no,
        receipt_date=rec_ts,
        place_of_supply_label=place,
        payment_mode=payment_method or "",
        payment_id=razorpay_payment_id,
        billing=bill,
        buyer_gstin=(bill.get("gstin") or "").strip() or None,
        intra_state=intra,
        payment_gateway_label=_gateway_label(order),
    )
    pdf_bytes = render_invoice_pdf(
        invoice_number=inv_no,
        receipt_date=rec_ts,
        customer_name=(bill.get("fullName") or "")[:200],
        place_of_supply=place,
        payment_mode=payment_method or "",
        payment_id=razorpay_payment_id,
        course_title=str(course.get("title") or ""),
        breakdown=bd,
        intra_state=intra,
    )
    safe_fn = inv_no.replace("/", "-")
    coll.update_one(
        {"_id": order["_id"]},
        {"$set": {
            "invoiceHtml": html_doc,
            "invoicePdfGeneratedAt": datetime.utcnow(),
            "lastPaymentMethod": (payment_method or "").strip(),
        }},
    )

    user_id = str(order.get("userId") or "")
    cid_str = str(course_id) if course_id and ObjectId.is_valid(str(course_id)) else None
    schedule_payment_success_email(
        app,
        user_id,
        cid_str,
        bd.grand_total_inclusive,
        razorpay_payment_id,
        enrollment_created,
        invoice_number=inv_no,
        pdf_bytes=pdf_bytes,
        pdf_filename=f"Tax-Invoice-{safe_fn}.pdf",
        html_invoice_bytes=html_doc.encode("utf-8"),
        html_filename=f"Tax-Invoice-{safe_fn}.html",
    )


@payments_bp.route("/my", methods=["GET"])
@jwt_required()
def list_my_orders():
    """List payment/order history for current student (SD-WF-15)."""
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    user_id = get_jwt_identity()
    coll = get_orders_collection()
    courses_coll = get_courses_collection()
    orders_rows = list(coll.find({"userId": user_id}).sort("createdAt", -1))
    oids = []
    for o in orders_rows:
        course_id = o.get("courseId")
        if course_id and ObjectId.is_valid(str(course_id)):
            try:
                oids.append(ObjectId(str(course_id)))
            except (InvalidId, TypeError):
                pass
    titles = {}
    if oids:
        for c in courses_coll.find({"_id": {"$in": oids}}):
            titles[str(c["_id"])] = c.get("title", "")
    items = []
    for o in orders_rows:
        course_id = o.get("courseId")
        course_title = titles.get(str(course_id), "") if course_id else ""
        st = str(o.get("status", "pending") or "").lower()
        method = str(o.get("method") or "").lower()
        items.append({
            "id": str(o["_id"]),
            "gateway": "cashfree" if method == "cashfree" else "razorpay",
            "transactionId": o.get("transactionId", o.get("razorpayPaymentId", o.get("orderId", str(o["_id"])))),
            "courseId": str(course_id) if course_id else "",
            "courseTitle": course_title,
            "amount": o.get("amount", 0),
            "amountPaise": o.get("amountPaise"),
            "razorpayOrderId": o.get("orderId") or "",
            "status": st,
            "method": o.get("method", o.get("lastPaymentMethod", "")),
            "createdAt": o.get("createdAt").strftime("%Y-%m-%dT%H:%M:%S") if o.get("createdAt") else "",
            "invoiceNumber": o.get("invoiceNumber") or "",
        })
    return jsonify({"items": items})


@payments_bp.route("/last-billing", methods=["GET"])
@jwt_required()
def last_billing_snapshot():
    """Most recent successful order billing address (P-10)."""
    db = get_db()
    if db is None:
        return jsonify({"billingSnapshot": None}), 503
    user_id = get_jwt_identity()
    o = get_orders_collection().find_one(
        {"userId": user_id, "status": "success"},
        sort=[("createdAt", -1)],
    )
    if not o or not isinstance(o.get("billingSnapshot"), dict):
        return jsonify({"billingSnapshot": None})
    return jsonify({"billingSnapshot": o.get("billingSnapshot")})

@payments_bp.route("/resume-checkout", methods=["POST"])
@jwt_required()
def resume_checkout():
    """Resume payment: Razorpay (existing order id) or new Cashfree session for pending order."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    oid = (data.get("internalOrderId") or data.get("orderId") or "").strip()
    if not oid or not ObjectId.is_valid(oid):
        return jsonify({"error": "Valid internalOrderId is required"}), 400
    coll = get_orders_collection()
    order = coll.find_one({"_id": ObjectId(oid), "userId": user_id})
    if not order:
        return jsonify({"error": "Order not found"}), 404
    st = str(order.get("status") or "").lower()
    if st not in ("created", "pending"):
        return jsonify({"error": "This order is not awaiting payment", "status": st}), 400
    amount_paise = order.get("amountPaise")
    try:
        ap = int(amount_paise) if amount_paise is not None else 0
    except (TypeError, ValueError):
        ap = 0
    if ap < 100:
        return jsonify({"error": "Invalid order amount"}), 400
    course_id = order.get("courseId")
    title = ""
    if course_id and ObjectId.is_valid(str(course_id)):
        c = get_courses_collection().find_one({"_id": ObjectId(str(course_id))})
        if c:
            title = str(c.get("title") or "")
    gw = _detect_payment_gateway()
    meth = str(order.get("method") or "").lower()
    want_cf = gw == "cashfree" or meth == "cashfree"

    if want_cf:
        cfg = current_app._get_current_object()
        cid = cfg.config.get("CASHFREE_CLIENT_ID", "").strip()
        csecret = cfg.config.get("CASHFREE_CLIENT_SECRET", "").strip()
        if not cid or not csecret:
            return jsonify({"error": "Cashfree credentials not configured on server"}), 503
        pub = _cashfree_return_base_url(cfg)
        if not pub:
            return jsonify({
                "error": "Missing public app URL",
                "detail": "Set PUBLIC_APP_URL or CASHFREE_RETURN_URL_ORIGIN (HTTPS for production Cashfree).",
            }), 503
        cf_ev = cfg.config.get("CASHFREE_ENV", "production")
        cf_https_err = _cashfree_return_url_https_error(pub, cf_ev)
        if cf_https_err:
            return jsonify({"error": cf_https_err}), 503
        base_url = cashfree_base_url(cf_ev)
        api_ver = cfg.config.get("CASHFREE_API_VERSION", "2023-08-01")
        try:
            total_gross = float(order.get("amount") or 0)
        except (TypeError, ValueError):
            total_gross = 0.0
        enrollment_snapshot = order.get("enrollmentSnapshot") if isinstance(order.get("enrollmentSnapshot"), dict) else {}
        billing_snapshot = order.get("billingSnapshot") if isinstance(order.get("billingSnapshot"), dict) else {}
        c_id, name, email, phone = _customer_for_cf(user_id, enrollment_snapshot, billing_snapshot)
        merchant_order_id = f"xpi_cf_{uuid.uuid4().hex[:28]}"
        return_url = f"{pub}/payments/cashfree-complete"
        cf_body, cerr = cashfree_create_order(
            base_url=base_url,
            api_version=api_ver,
            client_id=cid,
            client_secret=csecret,
            merchant_order_id=merchant_order_id,
            order_amount_rupees=total_gross,
            order_currency=(order.get("currency") or "INR").strip().upper() or "INR",
            customer_id=c_id,
            customer_email=email,
            customer_phone=phone,
            customer_name=name,
            return_url=return_url,
            order_note=str(title or "Course enrollment")[:200],
        )
        if cerr or not isinstance(cf_body, dict):
            return jsonify({"error": cerr or "Could not create Cashfree order"}), 502
        session_id = str(cf_body.get("payment_session_id") or "").strip()
        cf_oid = str(cf_body.get("cf_order_id") or "").strip()
        if not session_id:
            return jsonify({"error": "Cashfree did not return a payment_session_id"}), 502
        cf_env_flag = cfg.config.get("CASHFREE_ENV", "production").strip().lower()
        cashfree_env_js = "sandbox" if cf_env_flag == "sandbox" else "production"
        coll.update_one(
            {"_id": order["_id"]},
            {"$set": {
                "orderId": merchant_order_id,
                "cashfreeCfOrderId": cf_oid,
                "cashfreePaymentSessionId": session_id,
                "method": "cashfree",
            }},
        )
        return jsonify({
            "gateway": "cashfree",
            "internalOrderId": oid,
            "paymentSessionId": session_id,
            "merchantOrderId": merchant_order_id,
            "cashfreeEnv": cashfree_env_js,
            "amount": ap,
            "currency": (order.get("currency") or "INR").strip().upper() or "INR",
            "courseTitle": title,
        }), 200

    rz_existing = (order.get("orderId") or "").strip()
    if not rz_existing:
        return jsonify({"error": "Missing payment session"}), 400
    key_id = current_app.config.get("RAZORPAY_KEY_ID", "")
    return jsonify({
        "gateway": "razorpay",
        "internalOrderId": oid,
        "keyId": key_id,
        "orderId": rz_existing,
        "amount": ap,
        "currency": (order.get("currency") or "INR").strip().upper() or "INR",
        "courseTitle": title,
    }), 200


@payments_bp.route("/create-order", methods=["POST"])
@jwt_required()
def create_order():
    """
    Create a payable checkout session server-side.

    Preferred gateway when credentials exist: Cashfree PG (hosted checkout).
    Otherwise Razorpay (legacy). Controlled by PAYMENT_GATEWAY or auto-discovery.

    Course amount is computed only from DB + coupons + kit (never client totals alone).
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    gw = _detect_payment_gateway()
    if gw is None:
        return jsonify({
            "error": "Payment gateway not configured",
            "detail": "Set Cashfree (CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET) or Razorpay (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET), or PAYMENT_GATEWAY explicitly.",
        }), 503

    user_id = get_jwt_identity()
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    currency = (data.get("currency") or "INR").strip().upper() or "INR"
    coupon_code = (data.get("couponCode") or "").strip().upper()
    include_kit = bool(data.get("includeTrainingKit"))
    enrollment_snapshot = data.get("enrollmentSnapshot") if isinstance(data.get("enrollmentSnapshot"), dict) else {}
    billing_snapshot = data.get("billingSnapshot") if isinstance(data.get("billingSnapshot"), dict) else {}

    if not course_id or not ObjectId.is_valid(course_id):
        return jsonify({"error": "Valid courseId is required"}), 400

    courses_coll = get_courses_collection()
    course = courses_coll.find_one({
        "_id": ObjectId(course_id),
        "$or": [{"active": True}, {"active": {"$exists": False}}],
    })
    if not course:
        return jsonify({"error": "Course not found"}), 404

    try:
        course_gross = float(course.get("price") or 0)
    except (TypeError, ValueError):
        course_gross = 0.0

    if course_gross <= 0:
        return jsonify({
            "error": "This course has no paid amount",
            "detail": "Use free enrollment instead (POST /api/enrollments with courseId).",
            "freeEnrollment": True,
        }), 400

    settings_coll = get_app_settings_collection()
    settings_doc = settings_coll.find_one({"_id": "global"}) or {}
    kit_price = kit_price_from_course_and_settings(course, settings_doc)

    orders_coll = get_orders_collection()
    matched_coupon = None
    if coupon_code:
        matched_coupon, cerr = resolve_checkout_coupon(
            coupon_code,
            course=course,
            settings_doc=settings_doc,
            user_id=str(user_id),
            orders_coll=orders_coll,
        )
        if cerr:
            return jsonify({"error": cerr}), 400

    bd = build_order_pricing_breakdown(
        course_gross=course_gross,
        kit_gross_if_included=kit_price,
        include_kit=include_kit,
        coupon=matched_coupon,
        coupon_code=coupon_code,
    )
    total_gross = bd.grand_total_inclusive
    pricing = breakdown_to_pricing_dict(bd)

    amount_paise = int(round(total_gross * 100))
    if amount_paise < 100:
        return jsonify({"error": "Amount too small to charge (minimum ₹1)"}), 400

    receipt = f"xpi_{uuid.uuid4().hex[:32]}"
    coll = orders_coll
    cfg = current_app._get_current_object()

    if gw == "cashfree":
        cid = cfg.config.get("CASHFREE_CLIENT_ID", "").strip()
        csecret = cfg.config.get("CASHFREE_CLIENT_SECRET", "").strip()
        pub = _cashfree_return_base_url(cfg)
        if not pub:
            return jsonify({
                "error": "Missing public origin for Cashfree",
                "detail": (
                    "Set PUBLIC_APP_URL (HTTPS in production), or CASHFREE_RETURN_URL_ORIGIN for return_url "
                    "only when testing locally with http PUBLIC_APP_URL."
                ),
            }), 503
        cf_ev = cfg.config.get("CASHFREE_ENV", "production")
        cf_https_err = _cashfree_return_url_https_error(pub, cf_ev)
        if cf_https_err:
            return jsonify({"error": cf_https_err}), 503
        base_url = cashfree_base_url(cf_ev)
        api_ver = cfg.config.get("CASHFREE_API_VERSION", "2023-08-01")
        c_oid, cust_name, cust_email, cust_phone = _customer_for_cf(user_id, enrollment_snapshot, billing_snapshot)
        return_url = f"{pub}/payments/cashfree-complete"
        cf_body, cerr = cashfree_create_order(
            base_url=base_url,
            api_version=api_ver,
            client_id=cid,
            client_secret=csecret,
            merchant_order_id=receipt,
            order_amount_rupees=total_gross,
            order_currency=currency,
            customer_id=c_oid,
            customer_email=cust_email,
            customer_phone=cust_phone,
            customer_name=cust_name,
            return_url=return_url,
            order_note=str(course.get("title") or "")[:200],
        )
        if cerr or not isinstance(cf_body, dict):
            current_app.logger.error("Cashfree create order failed: %s", cerr)
            return jsonify({"error": cerr or "Could not create Cashfree order"}), 502
        session_id = str(cf_body.get("payment_session_id") or "").strip()
        cf_oid = str(cf_body.get("cf_order_id") or "").strip()
        if not session_id:
            return jsonify({"error": "Cashfree did not return a payment_session_id"}), 502
        cf_env_flag = cfg.config.get("CASHFREE_ENV", "production").strip().lower()
        cashfree_env_js = "sandbox" if cf_env_flag == "sandbox" else "production"

        doc = {
            "userId": user_id,
            "courseId": course_id,
            "amount": total_gross,
            "amountPaise": amount_paise,
            "currency": currency,
            "orderId": receipt,
            "receipt": receipt,
            "status": "created",
            "method": "cashfree",
            "cashfreeCfOrderId": cf_oid,
            "cashfreePaymentSessionId": session_id,
            "createdAt": datetime.utcnow(),
            "pricing": pricing,
            "invoiceBreakdown": asdict(bd),
            "couponCode": pricing.get("couponCode") or "",
            "enrollmentSnapshot": enrollment_snapshot,
            "billingSnapshot": billing_snapshot,
            "includeTrainingKit": include_kit,
        }
        result = coll.insert_one(doc)
        return jsonify({
            "gateway": "cashfree",
            "internalOrderId": str(result.inserted_id),
            "paymentSessionId": session_id,
            "merchantOrderId": receipt,
            "cashfreeEnv": cashfree_env_js,
            "amount": amount_paise,
            "currency": currency,
            "courseTitle": course.get("title", ""),
            "pricing": pricing,
        }), 201

    client = _razorpay_client()
    if client is None:
        return jsonify({
            "error": "Payment gateway not configured",
            "detail": "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.",
        }), 503
    try:
        rz_order = client.order.create({
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
            "notes": {
                "courseId": course_id,
                "userId": str(user_id),
                "courseTitle": (course.get("title") or "")[:200],
            },
        })
    except razorpay.errors.BadRequestError as e:
        return jsonify({"error": "Could not create payment order", "detail": str(e)}), 400
    except Exception as e:
        current_app.logger.exception("Razorpay order create failed")
        return jsonify({"error": "Could not create payment order", "detail": str(e)}), 502

    razorpay_order_id = rz_order.get("id")
    doc = {
        "userId": user_id,
        "courseId": course_id,
        "amount": total_gross,
        "amountPaise": amount_paise,
        "currency": currency,
        "orderId": razorpay_order_id,
        "receipt": receipt,
        "status": "created",
        "method": "razorpay",
        "createdAt": datetime.utcnow(),
        "pricing": pricing,
        "invoiceBreakdown": asdict(bd),
        "couponCode": pricing.get("couponCode") or "",
        "enrollmentSnapshot": enrollment_snapshot,
        "billingSnapshot": billing_snapshot,
        "includeTrainingKit": include_kit,
    }
    result = coll.insert_one(doc)

    key_id = cfg.config.get("RAZORPAY_KEY_ID", "")
    return jsonify({
        "gateway": "razorpay",
        "internalOrderId": str(result.inserted_id),
        "keyId": key_id,
        "orderId": razorpay_order_id,
        "amount": amount_paise,
        "currency": currency,
        "courseTitle": course.get("title", ""),
        "pricing": pricing,
    }), 201


@payments_bp.route("/verify", methods=["POST"])
@jwt_required()
def verify():
    """
    Verify Razorpay payment signature, mark order success, create enrollment if needed,
    issue GST tax invoice and email.
    Body: razorpay_order_id, razorpay_payment_id, razorpay_signature
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    client = _razorpay_client()
    if client is None:
        return jsonify({"error": "Razorpay gateway not configured"}), 503

    user_id = get_jwt_identity()
    data = request.get_json() or {}
    razorpay_order_id = (data.get("razorpay_order_id") or data.get("orderId") or "").strip()
    razorpay_payment_id = (data.get("razorpay_payment_id") or data.get("paymentId") or "").strip()
    razorpay_signature = (data.get("razorpay_signature") or data.get("signature") or "").strip()

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return jsonify({"error": "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required"}), 400

    coll = get_orders_collection()
    order = coll.find_one({"orderId": razorpay_order_id, "userId": user_id})
    if not order:
        return jsonify({"error": "Order not found for this user"}), 404

    if order.get("status") == "success":
        pay_ref = order.get("razorpayPaymentId") or razorpay_payment_id
        _build_and_store_invoice_if_needed(
            current_app._get_current_object(),
            coll,
            order,
            razorpay_payment_id=pay_ref,
            payment_method=order.get("lastPaymentMethod"),
            receipt_ts=order.get("invoiceReceiptAt") or order.get("verifiedAt"),
            enrollment_created=False,
        )
        refreshed = coll.find_one({"_id": order["_id"]}) or order
        return jsonify({
            "ok": True,
            "message": "Payment already verified",
            "enrollmentCreated": False,
            "invoiceNumber": refreshed.get("invoiceNumber") or "",
            "courseId": str(refreshed.get("courseId") or ""),
        }), 200

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        return jsonify({"error": "Invalid payment signature"}), 400
    except Exception as e:
        current_app.logger.exception("Razorpay verify failed")
        return jsonify({"error": "Verification failed", "detail": str(e)}), 400

    payment_method = ""
    receipt_ts = datetime.utcnow()
    try:
        pay_entity = client.payment.fetch(razorpay_payment_id)
        payment_method = str(pay_entity.get("method") or "")
        raw_ca = pay_entity.get("created_at")
        if raw_ca is not None:
            receipt_ts = datetime.utcfromtimestamp(int(raw_ca))
    except Exception:
        current_app.logger.exception("Could not fetch Razorpay payment for invoice metadata")

    enrollment_created, refreshed = _finalize_successful_charge(
        coll,
        order,
        user_id=user_id,
        gateway_payment_ref=razorpay_payment_id,
        payment_method=payment_method,
        receipt_ts=receipt_ts,
    )

    return jsonify({
        "ok": True,
        "message": "Payment verified",
        "enrollmentCreated": enrollment_created,
        "invoiceNumber": refreshed.get("invoiceNumber") or "",
        "courseId": str(refreshed.get("courseId") or ""),
    }), 200


@payments_bp.route("/cashfree/verify", methods=["POST"])
@jwt_required()
def verify_cashfree():
    """
    After Cashfree redirects or SDK completes, fetch order server-side (JWT) and
    confirm PAID status before enrolling / invoicing.

    Body: merchantOrderId (same as Mongo order.orderId for Cashfree flow).
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    cid = current_app.config.get("CASHFREE_CLIENT_ID", "").strip()
    csecret = current_app.config.get("CASHFREE_CLIENT_SECRET", "").strip()
    if not cid or not csecret:
        return jsonify({"error": "Cashfree not configured"}), 503

    user_id = get_jwt_identity()
    data = request.get_json() or {}
    merchant_order_id = (data.get("merchantOrderId") or data.get("order_id") or data.get("orderId") or "").strip()
    if not merchant_order_id:
        return jsonify({"error": "merchantOrderId is required"}), 400

    coll = get_orders_collection()
    order = coll.find_one({"orderId": merchant_order_id, "userId": user_id})
    if not order:
        return jsonify({"error": "Order not found for this user"}), 404

    if str(order.get("method") or "").lower() != "cashfree":
        return jsonify({"error": "This order is not a Cashfree checkout"}), 400

    if order.get("status") == "success":
        refreshed = coll.find_one({"_id": order["_id"]}) or order
        pay_ref = str(refreshed.get("razorpayPaymentId") or refreshed.get("transactionId") or "")
        _build_and_store_invoice_if_needed(
            current_app._get_current_object(),
            coll,
            refreshed,
            razorpay_payment_id=pay_ref,
            payment_method=refreshed.get("lastPaymentMethod"),
            receipt_ts=refreshed.get("invoiceReceiptAt") or refreshed.get("verifiedAt"),
            enrollment_created=False,
        )
        refreshed = coll.find_one({"_id": order["_id"]}) or refreshed
        return jsonify({
            "ok": True,
            "message": "Payment already verified",
            "orderStatus": "PAID",
            "enrollmentCreated": False,
            "invoiceNumber": refreshed.get("invoiceNumber") or "",
            "courseId": str(refreshed.get("courseId") or ""),
        }), 200

    base_url = cashfree_base_url(current_app.config.get("CASHFREE_ENV", "production"))
    api_ver = current_app.config.get("CASHFREE_API_VERSION", "2023-08-01")
    cf_ord, ferr = cashfree_fetch_order(
        base_url=base_url,
        api_version=api_ver,
        client_id=cid,
        client_secret=csecret,
        merchant_order_id=merchant_order_id,
    )
    if ferr or not isinstance(cf_ord, dict):
        return jsonify({"error": ferr or "Could not fetch Cashfree order"}), 502

    st_cf = str(cf_ord.get("order_status") or "").upper()
    if st_cf != "PAID":
        return jsonify({
            "ok": False,
            "orderStatus": st_cf or "UNKNOWN",
            "message": "Payment not completed yet. Try again in a moment or check your SMS/email receipt.",
        }), 409

    try:
        remote_amt = float(cf_ord.get("order_amount") or 0)
        local_amt = float(order.get("amount") or 0)
        if abs(remote_amt - local_amt) > 0.05:
            current_app.logger.warning(
                "Cashfree amount mismatch mongo=%s cashfree=%s order=%s",
                local_amt,
                remote_amt,
                order.get("_id"),
            )
    except (TypeError, ValueError):
        pass

    pay_ref = str(cf_ord.get("cf_order_id") or merchant_order_id)
    receipt_ts = datetime.utcnow()
    ts_raw = cf_ord.get("created_at")
    if isinstance(ts_raw, str) and ts_raw.strip():
        try:
            iso = ts_raw.replace("Z", "+00:00")
            receipt_ts = datetime.fromisoformat(iso)
            if receipt_ts.tzinfo is not None:
                receipt_ts = receipt_ts.replace(tzinfo=None)
        except (TypeError, ValueError):
            pass

    enrollment_created, refreshed = _finalize_successful_charge(
        coll,
        order,
        user_id=user_id,
        gateway_payment_ref=pay_ref,
        payment_method="cashfree",
        receipt_ts=receipt_ts,
    )

    return jsonify({
        "ok": True,
        "message": "Payment verified",
        "orderStatus": "PAID",
        "enrollmentCreated": enrollment_created,
        "invoiceNumber": refreshed.get("invoiceNumber") or "",
        "courseId": str(refreshed.get("courseId") or ""),
    }), 200


@payments_bp.route("/invoice/<order_id>", methods=["GET"])
@jwt_required()
def get_invoice(order_id):
    """Download tax invoice PDF or HTML for a paid order (must belong to current user)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not order_id or not ObjectId.is_valid(order_id.strip()):
        return jsonify({"error": "Invalid order id"}), 400
    user_id = get_jwt_identity()
    coll = get_orders_collection()
    order = coll.find_one({"_id": ObjectId(order_id.strip()), "userId": user_id})
    if not order:
        return jsonify({"error": "Order not found"}), 404
    if order.get("status") != "success":
        return jsonify({"error": "Invoice available only for successful payments"}), 400

    fmt = (request.args.get("format") or "pdf").strip().lower()
    courses_coll = get_courses_collection()
    settings_coll = get_app_settings_collection()
    course_id = order.get("courseId")
    if not course_id or not ObjectId.is_valid(str(course_id)):
        return jsonify({"error": "Course missing"}), 400
    course = courses_coll.find_one({"_id": ObjectId(str(course_id))})
    if not course:
        return jsonify({"error": "Course not found"}), 404
    settings_doc = settings_coll.find_one({"_id": "global"}) or {}

    bd = _breakdown_from_order_doc(order) or _recompute_breakdown(order, course, settings_doc)
    rec_ts = order.get("invoiceReceiptAt") or order.get("verifiedAt") or datetime.utcnow()
    if isinstance(rec_ts, datetime):
        rec_dt = rec_ts
    else:
        rec_dt = datetime.utcnow()

    if not order.get("invoiceNumber"):
        inv_no = allocate_invoice_serial(db, rec_dt)
        coll.update_one(
            {"_id": order["_id"]},
            {"$set": {"invoiceNumber": inv_no, "invoiceBreakdown": asdict(bd), "invoiceGeneratedAt": datetime.utcnow()}},
        )
        order["invoiceNumber"] = inv_no
    inv_no = order.get("invoiceNumber") or ""

    bill = _billing_for_invoice(order)
    code = (bill.get("stateCode") or "").strip()
    intra = code == "10" and code != ""
    place = f"{code} - {bill.get('state', '').strip()}" if code else (bill.get("state") or "").strip()
    pay_id = str(order.get("razorpayPaymentId") or order.get("transactionId") or "")
    pay_method = str(order.get("lastPaymentMethod") or "")

    if fmt == "html":
        html_doc = order.get("invoiceHtml")
        if not isinstance(html_doc, str) or not html_doc.strip():
            html_doc = render_invoice_html(
                breakdown=bd,
                course_title=str(course.get("title") or "Training"),
                invoice_number=inv_no,
                receipt_date=rec_dt,
                place_of_supply_label=place,
                payment_mode=pay_method,
                payment_id=pay_id,
                billing=bill,
                buyer_gstin=(bill.get("gstin") or "").strip() or None,
                intra_state=intra,
                payment_gateway_label=_gateway_label(order),
            )
        return Response(html_doc, mimetype="text/html; charset=utf-8")

    pdf_bytes = render_invoice_pdf(
        invoice_number=inv_no,
        receipt_date=rec_dt,
        customer_name=(bill.get("fullName") or "")[:200],
        place_of_supply=place,
        payment_mode=pay_method,
        payment_id=pay_id,
        course_title=str(course.get("title") or ""),
        breakdown=bd,
        intra_state=intra,
    )
    fn = f"Tax-Invoice-{inv_no.replace('/', '-')}.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )
