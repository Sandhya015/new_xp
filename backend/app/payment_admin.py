"""
Admin payments helpers (CFRD §§5–10): filters, enrichment, invoice PDF, bulk ZIP.
"""
from __future__ import annotations

import base64
import csv
import io
import logging
import re
import threading
import time
import zipfile
from datetime import datetime, timedelta
from typing import Any

from bson import Binary, ObjectId

from app.checkout_coupon import kit_price_from_course_and_settings, lookup_coupon_pricing_only
from app.checkout_pricing import OrderPricingBreakdown, build_order_pricing_breakdown
from app.db import (
    get_app_settings_collection,
    get_bulk_invoice_jobs_collection,
    get_courses_collection,
    get_db,
    get_orders_collection,
    get_users_collection,
)
from app.indian_gst_state_codes import gst_state_code_for_name
from app.invoice_pdf import INVOICE_PDF_LAYOUT_VERSION, render_invoice_pdf
from app.tax_invoice import allocate_invoice_serial, render_invoice_html

logger = logging.getLogger(__name__)

_SUMMARY_CACHE: dict[str, tuple[float, dict]] = {}
_SUMMARY_TTL_SEC = 60.0
BULK_THRESHOLD = 500
BULK_CONCURRENT_LIMIT = 3

OFFICIAL_FROM_EMAIL = "admin@xpertintern.com"
ACCOUNTS_BCC = OFFICIAL_FROM_EMAIL


def parse_dt_arg(raw: str | None, *, end_of_day: bool = False) -> datetime | None:
    s = (raw or "").strip()
    if not s:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        dt = datetime.strptime(s, "%Y-%m-%d")
        if end_of_day:
            return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        return dt
    if re.fullmatch(r"\d{2}-\d{2}-\d{4}", s):
        dt = datetime.strptime(s, "%d-%m-%Y")
        if end_of_day:
            return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        return dt
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(s[:26], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", ""))
    except ValueError:
        return None


def collect_payment_filter_params(src: Any) -> dict[str, Any]:
    """Normalize filter params from request.args or a JSON body dict."""
    def g(key: str, default: str = "") -> str:
        if hasattr(src, "get"):
            v = src.get(key, default)
        else:
            return default
        if v is None:
            return default
        return str(v).strip()

    page = 1
    limit = 50
    try:
        page = max(1, int(g("page") or "1"))
    except ValueError:
        page = 1
    try:
        limit = min(200, max(1, int(g("limit") or "50")))
    except ValueError:
        limit = 50

    amount_min = None
    amount_max = None
    try:
        if g("amountMin"):
            amount_min = float(g("amountMin"))
    except ValueError:
        pass
    try:
        if g("amountMax"):
            amount_max = float(g("amountMax"))
    except ValueError:
        pass

    course_ids = []
    if hasattr(src, "getlist"):
        course_ids = [x for x in src.getlist("courseIds") if x]
    if g("courseIds"):
        course_ids.extend([x.strip() for x in g("courseIds").split(",") if x.strip()])
    if g("courseId"):
        course_ids.append(g("courseId"))

    unis = []
    if hasattr(src, "getlist"):
        unis = [x for x in src.getlist("universities") if x]
    if g("universities"):
        unis.extend([x.strip() for x in g("universities").split(",") if x.strip()])
    uni = g("university")
    if uni:
        unis.append(uni)

    return {
        "search": g("search"),
        "status": g("status"),
        "paymentMode": g("paymentMode") or g("method"),
        "dateFrom": g("dateFrom"),
        "dateTo": g("dateTo"),
        "courseId": course_ids[0] if len(course_ids) == 1 else "",
        "courseIds": list(dict.fromkeys(course_ids)),
        "courseTitle": g("courseTitle"),
        "university": unis[0] if len(unis) == 1 else ",".join(unis) if unis else "",
        "universities": list(dict.fromkeys(unis)),
        "amountMin": amount_min,
        "amountMax": amount_max,
        "coupon": g("coupon"),
        "page": page,
        "limit": limit,
    }


def _gateway_ref(order: dict) -> str:
    return (
        order.get("transactionId")
        or order.get("razorpayPaymentId")
        or order.get("gatewayRef")
        or order.get("cashfreeCfOrderId")
        or ""
    )


def _payment_mode(order: dict) -> str:
    return (
        order.get("lastPaymentMethod")
        or order.get("paymentMode")
        or order.get("method")
        or ""
    )


def build_orders_mongo_query(flt: dict[str, Any], *, user_ids_for_university: list[str] | None = None) -> dict:
    """Build Mongo match for orders. University filter needs pre-resolved user ids."""
    and_parts: list[dict] = []

    status = (flt.get("status") or "").strip().lower()
    if status and status not in ("all", "*"):
        if status == "pending":
            and_parts.append({"status": {"$in": ["created", "pending", "attempted"]}})
        else:
            and_parts.append({"status": status})

    mode = (flt.get("paymentMode") or "").strip()
    if mode and mode.lower() not in ("all", "*"):
        and_parts.append({
            "$or": [
                {"lastPaymentMethod": {"$regex": f"^{re.escape(mode)}$", "$options": "i"}},
                {"method": {"$regex": f"^{re.escape(mode)}$", "$options": "i"}},
                {"paymentMode": {"$regex": f"^{re.escape(mode)}$", "$options": "i"}},
            ]
        })

    df = parse_dt_arg(flt.get("dateFrom"))
    dt = parse_dt_arg(flt.get("dateTo"), end_of_day=True)
    if df or dt:
        created: dict = {}
        if df:
            created["$gte"] = df
        if dt:
            created["$lte"] = dt
        and_parts.append({"createdAt": created})

    course_id = (flt.get("courseId") or "").strip()
    course_ids_raw = flt.get("courseIds")
    course_ids: list[str] = []
    if isinstance(course_ids_raw, list):
        course_ids = [str(x).strip() for x in course_ids_raw if str(x).strip()]
    elif isinstance(course_ids_raw, str) and course_ids_raw.strip():
        course_ids = [x.strip() for x in course_ids_raw.split(",") if x.strip()]
    if course_id:
        course_ids.append(course_id)
    course_ids = list(dict.fromkeys(course_ids))
    if len(course_ids) == 1:
        and_parts.append({"courseId": course_ids[0]})
    elif len(course_ids) > 1:
        and_parts.append({"courseId": {"$in": course_ids}})

    # Optional free-text title match when courseTitleSearch is set
    title_q = (flt.get("courseTitle") or "").strip()
    if title_q and not course_ids:
        cids = []
        for c in get_courses_collection().find(
            {"title": {"$regex": re.escape(title_q), "$options": "i"}},
            {"_id": 1},
        ).limit(100):
            cids.append(str(c["_id"]))
        if cids:
            and_parts.append({"courseId": {"$in": cids}})
        else:
            and_parts.append({"courseId": "__none__"})


    amin, amax = flt.get("amountMin"), flt.get("amountMax")
    if amin is not None or amax is not None:
        amt: dict = {}
        if amin is not None:
            amt["$gte"] = amin
        if amax is not None:
            amt["$lte"] = amax
        and_parts.append({"amount": amt})

    coupon = (flt.get("coupon") or "").strip()
    if coupon:
        cl = coupon.lower()
        if cl in ("yes", "1", "true"):
            and_parts.append({"couponCode": {"$exists": True, "$nin": [None, ""]}})
        elif cl in ("no", "0", "false"):
            and_parts.append({"$or": [
                {"couponCode": {"$exists": False}},
                {"couponCode": None},
                {"couponCode": ""},
            ]})
        else:
            and_parts.append({"couponCode": {"$regex": f"^{re.escape(coupon)}$", "$options": "i"}})

    if user_ids_for_university is not None:
        and_parts.append({"userId": {"$in": user_ids_for_university}})

    search = (flt.get("search") or "").strip()
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        search_or = [
            {"orderId": rx},
            {"receipt": rx},
            {"transactionId": rx},
            {"razorpayPaymentId": rx},
            {"gatewayRef": rx},
            {"cashfreeCfOrderId": rx},
            {"invoiceNumber": rx},
        ]
        # Match students by name/email/phone
        users = get_users_collection()
        uid_hits = []
        for u in users.find(
            {
                "role": "student",
                "$or": [
                    {"name": rx},
                    {"fullName": rx},
                    {"email": rx},
                    {"mobile": rx},
                    {"phone": rx},
                ],
            },
            {"_id": 1},
        ).limit(200):
            uid_hits.append(str(u["_id"]))
        if uid_hits:
            search_or.append({"userId": {"$in": uid_hits}})
            search_or.append({"studentId": {"$in": uid_hits}})
        # Match course titles
        title_hits = []
        for c in get_courses_collection().find({"title": rx}, {"_id": 1}).limit(50):
            title_hits.append(str(c["_id"]))
        if title_hits:
            search_or.append({"courseId": {"$in": title_hits}})
        and_parts.append({"$or": search_or})

    if not and_parts:
        return {}
    if len(and_parts) == 1:
        return and_parts[0]
    return {"$and": and_parts}


def resolve_university_user_ids(university: str | list | None) -> list[str] | None:
    if isinstance(university, list):
        unis = [str(u).strip() for u in university if str(u).strip()]
    else:
        raw = (university or "").strip()
        if not raw:
            return None
        unis = [x.strip() for x in raw.split(",") if x.strip()]
    if not unis:
        return None
    ors = []
    for uni in unis:
        rx = {"$regex": re.escape(uni), "$options": "i"}
        ors.append({"university": rx})
        ors.append({"collegeName": rx})
    ids = []
    for u in get_users_collection().find(
        {"role": "student", "$or": ors},
        {"_id": 1},
    ).limit(8000):
        ids.append(str(u["_id"]))
    return ids


def filter_cache_key(flt: dict) -> str:
    keys = (
        "search", "status", "paymentMode", "dateFrom", "dateTo", "courseId", "courseIds",
        "university", "universities", "amountMin", "amountMax", "coupon",
    )
    return "|".join(f"{k}={flt.get(k)!s}" for k in keys)


def _fmt_created(val) -> str:
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M")
    return str(val or "")


def enrich_payment_row(o: dict, users_by_id: dict, courses_by_id: dict) -> dict:
    uid = str(o.get("userId") or o.get("studentId") or "")
    cid = str(o.get("courseId") or "")
    u = users_by_id.get(uid) or {}
    c = courses_by_id.get(cid) or {}
    return {
        "id": str(o["_id"]),
        "orderId": o.get("orderId") or o.get("receipt") or "",
        "studentId": uid,
        "studentName": (u.get("name") or u.get("fullName") or "").strip(),
        "studentEmail": (u.get("email") or "").strip(),
        "studentPhone": (u.get("mobile") or u.get("phone") or "").strip(),
        "university": (u.get("university") or u.get("collegeName") or "").strip(),
        "courseId": cid,
        "courseTitle": (c.get("title") or o.get("courseTitle") or "").strip(),
        "couponCode": (o.get("couponCode") or (o.get("pricing") or {}).get("couponCode") or "").strip(),
        "paymentMode": _payment_mode(o),
        "amount": o.get("amount", 0),
        "status": o.get("status", "pending"),
        "createdAt": _fmt_created(o.get("createdAt")),
        "gatewayRef": _gateway_ref(o),
        "invoiceNumber": o.get("invoiceNumber") or "",
        "invoiceVersion": int(o.get("invoiceVersion") or 1),
        "method": o.get("method") or "",
        "refundAmount": o.get("refundAmount"),
        "refundReason": o.get("refundReason") or "",
    }


def load_user_course_maps(orders: list[dict]) -> tuple[dict, dict]:
    uids = set()
    cids = set()
    for o in orders:
        uid = str(o.get("userId") or o.get("studentId") or "")
        cid = str(o.get("courseId") or "")
        if uid and ObjectId.is_valid(uid):
            uids.add(ObjectId(uid))
        if cid and ObjectId.is_valid(cid):
            cids.add(ObjectId(cid))
    users_by_id: dict = {}
    courses_by_id: dict = {}
    if uids:
        for u in get_users_collection().find({"_id": {"$in": list(uids)}}):
            users_by_id[str(u["_id"])] = u
    if cids:
        for c in get_courses_collection().find({"_id": {"$in": list(cids)}}):
            courses_by_id[str(c["_id"])] = c
    return users_by_id, courses_by_id


def list_payments(flt: dict) -> tuple[list[dict], int]:
    unis = flt.get("universities") if flt.get("universities") else flt.get("university")
    uni_ids = resolve_university_user_ids(unis)
    if uni_ids is not None and len(uni_ids) == 0:
        return [], 0
    q = build_orders_mongo_query(flt, user_ids_for_university=uni_ids)
    coll = get_orders_collection()
    total = coll.count_documents(q)
    page = int(flt.get("page") or 1)
    limit = int(flt.get("limit") or 50)
    skip = (page - 1) * limit
    cursor = coll.find(q).sort("createdAt", -1).skip(skip).limit(limit)
    rows = list(cursor)
    users_by_id, courses_by_id = load_user_course_maps(rows)
    items = [enrich_payment_row(o, users_by_id, courses_by_id) for o in rows]
    return items, total


def compute_payments_summary(flt: dict, *, include_pct: bool = True) -> dict:
    empty = {
        "totalRevenue": 0.0,
        "successfulCount": 0,
        "failedCount": 0,
        "pendingCount": 0,
        "refundsSum": 0.0,
        "refundsCount": 0,
        "percentChange": None,
    }
    try:
        cache_k = filter_cache_key(flt)
        now = time.time()
        hit = _SUMMARY_CACHE.get(cache_k)
        if hit and now - hit[0] < _SUMMARY_TTL_SEC:
            return dict(hit[1])

        uni_ids = resolve_university_user_ids(flt.get("universities") or flt.get("university") or "")
        if uni_ids is not None and len(uni_ids) == 0:
            _SUMMARY_CACHE[cache_k] = (now, empty)
            return dict(empty)

        base_q = build_orders_mongo_query(flt, user_ids_for_university=uni_ids)
        coll = get_orders_collection()
        pending_cutoff = datetime.utcnow() - timedelta(minutes=15)

        def _and(extra: dict) -> dict:
            if not base_q:
                return extra
            return {"$and": [base_q, extra]}

        # Revenue: successful payment amounts (refunds excluded — status success only)
        rev_match = _and({"status": "success"})
        # Sum amount coercing number/string via $toDouble when possible
        pipeline = [
            {"$match": rev_match},
            {"$group": {
                "_id": None,
                "total": {
                    "$sum": {
                        "$convert": {
                            "input": {"$ifNull": ["$amount", 0]},
                            "to": "double",
                            "onError": 0,
                            "onNull": 0,
                        }
                    }
                },
                "count": {"$sum": 1},
            }},
        ]
        rev_rows = list(coll.aggregate(pipeline))
        total_revenue = float(rev_rows[0]["total"]) if rev_rows else 0.0
        successful_count = int(rev_rows[0]["count"]) if rev_rows else 0

        failed_count = coll.count_documents(_and({"status": {"$in": ["failed", "cancelled"]}}))
        pending_count = coll.count_documents(_and({
            "status": {"$in": ["created", "pending", "attempted"]},
            "createdAt": {"$lte": pending_cutoff},
        }))

        ref_pipe = [
            {"$match": _and({"status": "refunded"})},
            {"$group": {
                "_id": None,
                "total": {
                    "$sum": {
                        "$convert": {
                            "input": {
                                "$ifNull": [
                                    "$refundAmount",
                                    {"$ifNull": ["$amount", 0]},
                                ]
                            },
                            "to": "double",
                            "onError": 0,
                            "onNull": 0,
                        }
                    }
                },
                "count": {"$sum": 1},
            }},
        ]
        ref_rows = list(coll.aggregate(ref_pipe))
        refunds_sum = float(ref_rows[0]["total"]) if ref_rows else 0.0
        refunds_count = int(ref_rows[0]["count"]) if ref_rows else 0

        percent_change = None
        if include_pct:
            try:
                percent_change = _percent_change_vs_previous(flt, total_revenue)
            except Exception:
                percent_change = None

        out = {
            "totalRevenue": total_revenue,
            "successfulCount": successful_count,
            "failedCount": failed_count,
            "pendingCount": pending_count,
            "refundsSum": refunds_sum,
            "refundsCount": refunds_count,
            "percentChange": percent_change,
        }
        _SUMMARY_CACHE[cache_k] = (now, out)
        if len(_SUMMARY_CACHE) > 200:
            oldest = sorted(_SUMMARY_CACHE.items(), key=lambda x: x[1][0])[:50]
            for k, _ in oldest:
                _SUMMARY_CACHE.pop(k, None)
        return dict(out)
    except Exception:
        return dict(empty)


def _percent_change_vs_previous(flt: dict, current_revenue: float) -> float | None:
    df = parse_dt_arg(flt.get("dateFrom"))
    dt = parse_dt_arg(flt.get("dateTo"), end_of_day=True)
    if not df or not dt:
        # default: last 30 days vs previous 30
        dt = datetime.utcnow()
        df = dt - timedelta(days=30)
    span = dt - df
    if span.total_seconds() <= 0:
        return None
    prev_to = df - timedelta(microseconds=1)
    prev_from = prev_to - span
    prev_flt = dict(flt)
    prev_flt["dateFrom"] = prev_from.strftime("%Y-%m-%d %H:%M:%S")
    prev_flt["dateTo"] = prev_to.strftime("%Y-%m-%d %H:%M:%S")
    uni_ids = resolve_university_user_ids(prev_flt.get("university") or "")
    q = build_orders_mongo_query(prev_flt, user_ids_for_university=uni_ids)
    if uni_ids is not None and len(uni_ids) == 0:
        prev_rev = 0.0
    else:
        match = {"$and": [q, {"status": "success"}]} if q else {"status": "success"}
        pipe = [
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount", 0]}}}},
        ]
        rows = list(get_orders_collection().aggregate(pipe))
        prev_rev = float(rows[0]["total"]) if rows else 0.0
    if prev_rev == 0:
        return 100.0 if current_revenue > 0 else 0.0
    return round(((current_revenue - prev_rev) / prev_rev) * 100.0, 2)


def _breakdown_from_order(order: dict) -> OrderPricingBreakdown | None:
    from dataclasses import fields

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
    return {**bill, "stateCode": code or (bill.get("stateCode") or "")}


def _gateway_label(order: dict) -> str:
    m = (order.get("method") or "").strip().lower()
    if m == "cashfree":
        return "Cashfree"
    if m == "razorpay":
        return "Razorpay"
    return (m or "Payments").title()


def invoice_filename(order: dict, receipt_dt: datetime | None = None) -> str:
    txn = (order.get("orderId") or order.get("receipt") or str(order.get("_id", "TXN")))[:40]
    txn = re.sub(r"[^\w\-]+", "_", txn)
    dt = receipt_dt or order.get("invoiceReceiptAt") or order.get("verifiedAt") or order.get("createdAt") or datetime.utcnow()
    if not isinstance(dt, datetime):
        dt = datetime.utcnow()
    return f"Invoice_{txn}_{dt.strftime('%Y-%m-%d')}.pdf"


def get_stored_invoice_pdf(order: dict) -> bytes | None:
    raw = order.get("invoicePdf")
    if isinstance(raw, (bytes, bytearray, Binary)):
        data = bytes(raw)
        if data[:4] == b"%PDF":
            return data
    b64 = order.get("invoicePdfB64")
    if isinstance(b64, str) and b64.strip():
        try:
            data = base64.b64decode(b64)
            if data[:4] == b"%PDF":
                return data
        except Exception:
            return None
    return None


def generate_and_store_invoice_pdf(
    order: dict,
    *,
    force: bool = False,
    bump_version: bool = False,
) -> tuple[bytes, dict]:
    """
    Generate PDF for a successful order, store on the document, return (pdf_bytes, updated_order_fields).
    """
    coll = get_orders_collection()
    if not force:
        existing = get_stored_invoice_pdf(order)
        # Re-render when layout version changes so old broken PDFs are not re-served
        if (
            existing
            and order.get("invoiceNumber")
            and int(order.get("invoicePdfLayoutVersion") or 0) == INVOICE_PDF_LAYOUT_VERSION
        ):
            return existing, {}

    db = get_db()
    if db is None:
        raise RuntimeError("Database not configured")

    course_id = order.get("courseId")
    if not course_id or not ObjectId.is_valid(str(course_id)):
        raise ValueError("Order missing course")
    course = get_courses_collection().find_one({"_id": ObjectId(str(course_id))})
    if not course:
        raise ValueError("Course not found")
    settings_doc = get_app_settings_collection().find_one({"_id": "global"}) or {}

    bd = _breakdown_from_order(order) or _recompute_breakdown(order, course, settings_doc)
    rec_ts = order.get("invoiceReceiptAt") or order.get("verifiedAt") or order.get("createdAt") or datetime.utcnow()
    if not isinstance(rec_ts, datetime):
        rec_ts = datetime.utcnow()

    inv_no = order.get("invoiceNumber") or ""
    if not inv_no:
        inv_no = allocate_invoice_serial(db, rec_ts)

    bill = _billing_for_invoice(order)
    code = (bill.get("stateCode") or "").strip()
    intra = code == "10" and code != ""
    place = f"{code} - {bill.get('state', '').strip()}" if code else (bill.get("state") or "").strip()
    pay_id = _gateway_ref(order) or (order.get("orderId") or "")
    pay_mode = _payment_mode(order)
    title = str(course.get("title") or "Training")

    pdf_bytes = render_invoice_pdf(
        invoice_number=inv_no,
        receipt_date=rec_ts,
        customer_name=(bill.get("fullName") or bill.get("name") or "")[:200],
        place_of_supply=place,
        payment_mode=pay_mode,
        payment_id=pay_id,
        course_title=title,
        breakdown=bd,
        intra_state=intra,
        billing=bill,
        buyer_gstin=(bill.get("gstin") or "").strip() or None,
        payment_gateway_label=_gateway_label(order),
    )

    html_doc = render_invoice_html(
        breakdown=bd,
        course_title=title,
        invoice_number=inv_no,
        receipt_date=rec_ts,
        place_of_supply_label=place,
        payment_mode=pay_mode,
        payment_id=pay_id,
        billing=bill,
        buyer_gstin=(bill.get("gstin") or "").strip() or None,
        intra_state=intra,
        payment_gateway_label=_gateway_label(order),
    )

    ver = int(order.get("invoiceVersion") or 1)
    if bump_version:
        ver = ver + 1

    from dataclasses import asdict

    update = {
        "invoiceNumber": inv_no,
        "invoiceGeneratedAt": datetime.utcnow(),
        "invoicePdfGeneratedAt": datetime.utcnow(),
        "invoiceBreakdown": asdict(bd),
        "invoiceHtml": html_doc,
        "invoicePdf": Binary(pdf_bytes),
        "invoiceVersion": ver,
        "invoicePdfLayoutVersion": INVOICE_PDF_LAYOUT_VERSION,
    }
    coll.update_one({"_id": order["_id"]}, {"$set": update})
    return pdf_bytes, update


def build_bulk_zip(orders: list[dict]) -> bytes:
    buf = io.BytesIO()
    manifest_rows: list[dict] = []
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for o in orders:
            try:
                pdf, upd = generate_and_store_invoice_pdf(o, force=False)
                if upd:
                    o.update(upd)
                fn = invoice_filename(o)
                # avoid collisions
                base = fn
                n = 1
                names = set(zf.namelist())
                while fn in names:
                    fn = base.replace(".pdf", f"_{n}.pdf")
                    n += 1
                zf.writestr(fn, pdf)
                manifest_rows.append({
                    "orderId": o.get("orderId") or "",
                    "invoiceNumber": o.get("invoiceNumber") or "",
                    "amount": o.get("amount") or 0,
                    "status": o.get("status") or "",
                    "filename": fn,
                    "ok": "yes",
                })
            except Exception as e:
                logger.exception("bulk invoice failed for %s", o.get("_id"))
                manifest_rows.append({
                    "orderId": o.get("orderId") or "",
                    "invoiceNumber": o.get("invoiceNumber") or "",
                    "amount": o.get("amount") or 0,
                    "status": o.get("status") or "",
                    "filename": "",
                    "ok": f"error: {e}",
                })
        csv_buf = io.StringIO()
        writer = csv.DictWriter(
            csv_buf,
            fieldnames=["orderId", "invoiceNumber", "amount", "status", "filename", "ok"],
        )
        writer.writeheader()
        writer.writerows(manifest_rows)
        zf.writestr("manifest.csv", csv_buf.getvalue())
    return buf.getvalue()


def count_active_bulk_jobs(admin_email: str) -> int:
    return get_bulk_invoice_jobs_collection().count_documents({
        "adminEmail": (admin_email or "").strip().lower(),
        "status": {"$in": ["queued", "processing"]},
    })


def create_bulk_job(
    *,
    admin_email: str,
    admin_id: str,
    order_ids: list[ObjectId],
    filters: dict,
    app,
) -> dict:
    coll = get_bulk_invoice_jobs_collection()
    doc = {
        "adminEmail": (admin_email or "").strip().lower(),
        "adminId": admin_id,
        "status": "queued",
        "orderIds": [str(i) for i in order_ids],
        "count": len(order_ids),
        "filters": filters,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "error": "",
        "note": "ZIP will be prepared asynchronously. You will receive an email when ready (or with status note).",
    }
    res = coll.insert_one(doc)
    doc["_id"] = res.inserted_id
    _spawn_bulk_job(app, str(res.inserted_id))
    return doc


def _spawn_bulk_job(app, job_id: str) -> None:
    def run():
        with app.app_context():
            _process_bulk_job(job_id)

    t = threading.Thread(target=run, daemon=True, name=f"bulk-invoice-{job_id[:8]}")
    t.start()


def _process_bulk_job(job_id: str) -> None:
    from flask import current_app
    from app.email_smtp import send_email

    coll = get_bulk_invoice_jobs_collection()
    if not ObjectId.is_valid(job_id):
        return
    job = coll.find_one({"_id": ObjectId(job_id)})
    if not job:
        return
    coll.update_one({"_id": job["_id"]}, {"$set": {"status": "processing", "updatedAt": datetime.utcnow()}})
    try:
        oids = [ObjectId(x) for x in job.get("orderIds") or [] if ObjectId.is_valid(str(x))]
        orders = list(get_orders_collection().find({"_id": {"$in": oids}, "status": "success"}))
        zip_bytes = build_bulk_zip(orders)
        # Store as Binary (may be large — Lambda memory limit applies)
        coll.update_one(
            {"_id": job["_id"]},
            {"$set": {
                "status": "completed",
                "updatedAt": datetime.utcnow(),
                "zipSize": len(zip_bytes),
                "completedAt": datetime.utcnow(),
                # Avoid storing huge ZIP in Mongo on tiny instances; keep size note only
                "note": (
                    f"Bulk invoice job completed for {len(orders)} orders "
                    f"({len(zip_bytes)} bytes). Re-request with filters or contact support for retrieval "
                    "if email delivery is unavailable on this environment."
                ),
            }},
        )
        admin_email = (job.get("adminEmail") or "").strip()
        if admin_email:
            cfg = current_app.config
            send_email(
                cfg,
                admin_email,
                f"Bulk invoice ZIP ready — {len(orders)} invoices | XpertIntern",
                (
                    f"<p>Your bulk invoice job <strong>{job_id}</strong> finished.</p>"
                    f"<p>Orders processed: <strong>{len(orders)}</strong>. ZIP size: {len(zip_bytes)} bytes.</p>"
                    "<p>For very large exports, download via admin tools or contact engineering if the "
                    "ZIP was not attached (size limits).</p>"
                    "<p>— XpertIntern Admin</p>"
                ),
                attachments=[
                    (f"invoices_bulk_{job_id[:8]}.zip", zip_bytes, "application/zip")
                ] if len(zip_bytes) < 8_000_000 else None,
            )
    except Exception as e:
        logger.exception("bulk job %s failed", job_id)
        coll.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed", "error": str(e)[:500], "updatedAt": datetime.utcnow()}},
        )
        admin_email = (job.get("adminEmail") or "").strip()
        if admin_email:
            try:
                from flask import current_app
                from app.email_smtp import send_email
                send_email(
                    current_app.config,
                    admin_email,
                    "Bulk invoice job failed | XpertIntern",
                    f"<p>Bulk invoice job {job_id} failed: {e}</p>",
                )
            except Exception:
                pass
