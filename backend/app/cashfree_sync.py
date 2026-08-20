"""Sync Cashfree PAID orders that were never verified (enrollment + invoice repair)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId
from flask import current_app

from app.cashfree_pg import cashfree_base_url, cashfree_fetch_order
from app.db import get_courses_collection, get_enrollments_collection, get_orders_collection


def resolve_enrollment_batch(order: dict, course_id: str) -> str:
    snap = order.get("enrollmentSnapshot") if isinstance(order.get("enrollmentSnapshot"), dict) else {}
    for key in ("batch", "batchName"):
        val = (snap.get(key) or order.get(key) or "").strip() if isinstance(snap.get(key) or order.get(key), str) else ""
        if val:
            return val
    if course_id and ObjectId.is_valid(course_id):
        c = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"batches": 1})
        batches = c.get("batches") if c and isinstance(c.get("batches"), list) else []
        if batches:
            first = batches[0]
            if isinstance(first, dict):
                return str(first.get("name") or "").strip()
            return str(first).strip()
    return ""


def _cashfree_cfg() -> tuple[str, str, str, str] | None:
    cfg = current_app.config
    cid = (cfg.get("CASHFREE_CLIENT_ID") or "").strip()
    secret = (cfg.get("CASHFREE_CLIENT_SECRET") or "").strip()
    if not cid or not secret:
        return None
    base = cashfree_base_url(cfg.get("CASHFREE_ENV", "production"))
    ver = cfg.get("CASHFREE_API_VERSION", "2023-08-01")
    return cid, secret, base, ver


def sync_cashfree_order(order: dict, *, user_id: str | None = None) -> dict[str, Any]:
    """
    If Cashfree reports PAID, finalize order (success + enrollment + invoice).
    Safe/idempotent when order is already success.
    """
    from app.routes.payments import _ensure_enrollment_for_successful_order, _finalize_successful_charge

    if str(order.get("method") or "").lower() != "cashfree":
        return {"ok": False, "error": "not_cashfree", "orderId": order.get("orderId")}

    merchant_id = (order.get("orderId") or "").strip()
    if not merchant_id:
        return {"ok": False, "error": "missing_merchant_order_id"}

    if str(order.get("status") or "").lower() == "success":
        uid = str(user_id or order.get("userId") or "")
        repaired = _ensure_enrollment_for_successful_order(uid, order) if uid else False
        return {
            "ok": True,
            "alreadySuccess": True,
            "merchantOrderId": merchant_id,
            "enrollmentRepaired": repaired,
        }

    cfg = _cashfree_cfg()
    if not cfg:
        return {"ok": False, "error": "cashfree_not_configured", "merchantOrderId": merchant_id}
    cid, secret, base, ver = cfg

    cf_ord, ferr = cashfree_fetch_order(
        base_url=base,
        api_version=ver,
        client_id=cid,
        client_secret=secret,
        merchant_order_id=merchant_id,
    )
    if ferr or not isinstance(cf_ord, dict):
        return {"ok": False, "error": ferr or "cashfree_fetch_failed", "merchantOrderId": merchant_id}

    st_cf = str(cf_ord.get("order_status") or "").upper()
    if st_cf != "PAID":
        return {
            "ok": False,
            "cashfreeStatus": st_cf or "UNKNOWN",
            "merchantOrderId": merchant_id,
            "message": "not_paid_yet",
        }

    uid = str(user_id or order.get("userId") or "")
    if not uid:
        return {"ok": False, "error": "missing_user_id", "merchantOrderId": merchant_id}

    pay_ref = str(cf_ord.get("cf_order_id") or merchant_id)
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

    coll = get_orders_collection()
    enrollment_created, refreshed = _finalize_successful_charge(
        coll,
        order,
        user_id=uid,
        gateway_payment_ref=pay_ref,
        payment_method="cashfree",
        receipt_ts=receipt_ts,
    )
    enrollment_created = enrollment_created or _ensure_enrollment_for_successful_order(uid, refreshed)
    return {
        "ok": True,
        "merchantOrderId": merchant_id,
        "enrollmentCreated": enrollment_created,
        "invoiceNumber": refreshed.get("invoiceNumber") or "",
        "courseId": str(refreshed.get("courseId") or ""),
    }


def sync_pending_cashfree_for_user(user_id: str, *, limit: int = 5) -> dict[str, Any]:
    coll = get_orders_collection()
    pending = list(
        coll.find({"userId": user_id, "status": "created", "method": "cashfree"})
        .sort("createdAt", -1)
        .limit(max(1, min(limit, 20)))
    )
    results = []
    synced = 0
    for o in pending:
        r = sync_cashfree_order(o, user_id=user_id)
        results.append(r)
        if r.get("ok") and not r.get("alreadySuccess"):
            synced += 1
    return {"checked": len(pending), "finalized": synced, "results": results}


def sync_all_pending_cashfree_orders(*, limit: int = 200) -> dict[str, Any]:
    coll = get_orders_collection()
    pending = list(
        coll.find({"status": "created", "method": "cashfree"})
        .sort("createdAt", -1)
        .limit(max(1, min(limit, 500)))
    )
    finalized = 0
    still_pending = 0
    errors = 0
    items: list[dict[str, Any]] = []
    for o in pending:
        r = sync_cashfree_order(o)
        items.append(r)
        if r.get("ok") and not r.get("alreadySuccess"):
            finalized += 1
        elif r.get("message") == "not_paid_yet":
            still_pending += 1
        elif not r.get("ok"):
            errors += 1
    return {
        "ok": True,
        "checked": len(pending),
        "finalized": finalized,
        "stillPendingOnCashfree": still_pending,
        "errors": errors,
        "items": items[:50],
    }


def handle_cashfree_webhook(payload: dict[str, Any]) -> dict[str, Any]:
    """Process Cashfree payment webhook (PAYMENT_SUCCESS / order PAID)."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    order_block = data.get("order") if isinstance(data.get("order"), dict) else {}
    merchant_id = (
        (order_block.get("order_id") or data.get("order_id") or payload.get("order_id") or "")
        .strip()
    )
    if not merchant_id:
        return {"ok": False, "error": "missing_order_id"}

    coll = get_orders_collection()
    order = coll.find_one({"orderId": merchant_id})
    if not order:
        return {"ok": False, "error": "order_not_found", "merchantOrderId": merchant_id}

    return sync_cashfree_order(order)
