"""Resolve training checkout coupons (global settings + per-course) with usage limits."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def _parse_date_start(s: str | None) -> datetime | None:
    if not s or not str(s).strip():
        return None
    raw = str(s).strip()[:10]
    try:
        y, m, d = [int(x) for x in raw.split("-")]
        return datetime(y, m, d, tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _row_active_and_dates_ok(c: dict) -> bool:
    if not c.get("active", True):
        return False
    today_d = datetime.now(timezone.utc).date()
    vf = _parse_date_start(c.get("validFrom"))
    vu = _parse_date_start(c.get("validUntil"))
    if vf and today_d < vf.date():
        return False
    if vu and today_d > vu.date():
        return False
    return True


def _coupon_row_to_pricing_dict(c: dict) -> dict[str, Any]:
    """Shape expected by checkout_pricing.build_order_pricing_breakdown."""
    out: dict[str, Any] = {}
    if c.get("percentOff") is not None:
        try:
            out["percentOff"] = float(c["percentOff"])
        except (TypeError, ValueError):
            pass
    if c.get("rupeesOff") is not None:
        try:
            out["rupeesOff"] = float(c["rupeesOff"])
        except (TypeError, ValueError):
            pass
    if c.get("maxDiscountInr") is not None:
        try:
            out["maxDiscountInr"] = float(c["maxDiscountInr"])
        except (TypeError, ValueError):
            pass
    return out


def _find_row_in_list(rows: list, code: str) -> dict | None:
    cu = (code or "").strip().upper()
    for c in rows:
        if not isinstance(c, dict):
            continue
        if str(c.get("code") or "").strip().upper() != cu:
            continue
        return c
    return None


def _count_redemptions(orders_coll, course_id: str, code: str, *, user_id: str | None = None) -> int:
    q: dict[str, Any] = {
        "courseId": course_id,
        "couponCode": (code or "").strip().upper(),
        "status": "success",
    }
    if user_id:
        q["userId"] = user_id
    return int(orders_coll.count_documents(q))


def count_successful_redemptions_for_course(orders_coll, course_id: str, code: str) -> int:
    """Total successful orders that applied this coupon on this course (all users)."""
    cid = (course_id or "").strip()
    cu = (code or "").strip().upper()
    if not cid or not cu:
        return 0
    return _count_redemptions(orders_coll, cid, cu, user_id=None)


def resolve_checkout_coupon(
    code: str,
    *,
    course: dict,
    settings_doc: dict,
    user_id: str,
    orders_coll,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Returns (coupon dict for pricing engine, None) on success, or (None, error_message).
    Course coupons take precedence over global coupons for the same code.
    """
    cu = (code or "").strip().upper()
    if not cu:
        return None, None

    course_rows = course.get("enrollmentCoupons") if isinstance(course.get("enrollmentCoupons"), list) else []
    global_rows = settings_doc.get("coupons") if isinstance(settings_doc.get("coupons"), list) else []

    row = _find_row_in_list([x for x in course_rows if isinstance(x, dict)], cu)
    if row is None:
        row = _find_row_in_list([x for x in global_rows if isinstance(x, dict)], cu)

    # Partner affiliate coupons (after course/global catalog coupons)
    if row is None:
        try:
            from app.partner_program import partner_coupon_to_pricing
            cid0 = str(course.get("_id") or "")
            pricing_p, err_p = partner_coupon_to_pricing(cu, course_id=cid0)
            if pricing_p:
                return pricing_p, None
            if err_p and "not valid for this training" in (err_p or "").lower():
                return None, err_p
            return None, err_p or "Invalid or expired coupon code."
        except Exception:
            return None, "Invalid or expired coupon code."

    if not _row_active_and_dates_ok(row):
        return None, "Invalid or expired coupon code."

    pricing = _coupon_row_to_pricing_dict(row)
    if not pricing.get("percentOff") and not pricing.get("rupeesOff"):
        return None, "Invalid or expired coupon code."

    try:
        max_uses = int(row["maxUses"]) if row.get("maxUses") is not None and str(row.get("maxUses")).strip() != "" else None
    except (TypeError, ValueError):
        max_uses = None
    try:
        per_user = int(row.get("perUserLimit", 1))
    except (TypeError, ValueError):
        per_user = 1
    if per_user < 1:
        per_user = 1

    cid = str(course.get("_id") or "")
    if not cid:
        return None, "Invalid course."

    if max_uses is not None and max_uses >= 0:
        used = _count_redemptions(orders_coll, cid, cu, user_id=None)
        if used >= max_uses:
            return None, "This coupon has reached its usage limit."

    user_uses = _count_redemptions(orders_coll, cid, cu, user_id=user_id)
    if user_uses >= per_user:
        return None, "You have already used this coupon the maximum number of times."

    return pricing, None


def kit_price_from_course_and_settings(course: dict, settings_doc: dict) -> float:
    """Inclusive kit price (12% GST line); course-linked kit overrides global fallback."""
    tk = course.get("trainingKit") if isinstance(course.get("trainingKit"), dict) else {}
    if tk.get("enabled"):
        try:
            p = float(tk.get("priceInr") or 0)
            return max(0.0, p)
        except (TypeError, ValueError):
            pass
    try:
        return max(0.0, float(settings_doc.get("trainingKitPriceInr") or 0))
    except (TypeError, ValueError):
        return 0.0


def public_training_kit_payload(course: dict, settings_doc: dict) -> dict | None:
    """Prefer rich course kit; else fall back to global kit price for legacy catalogs."""
    tk = course.get("trainingKit") if isinstance(course.get("trainingKit"), dict) else {}
    if tk.get("enabled"):
        try:
            price = max(0.0, float(tk.get("priceInr") or 0))
        except (TypeError, ValueError):
            price = 0.0
        if price > 0:
            return {
                "name": str(tk.get("name") or "Training kit").strip(),
                "shortDescription": str(tk.get("shortDescription") or "").strip(),
                "thumbnailUrl": str(tk.get("thumbnailUrl") or "").strip(),
                "priceInr": price,
            }
    try:
        gk = max(0.0, float(settings_doc.get("trainingKitPriceInr") or 0))
    except (TypeError, ValueError):
        gk = 0.0
    if gk > 0:
        return {
            "name": "Training kit",
            "shortDescription": "",
            "thumbnailUrl": "",
            "priceInr": gk,
        }
    return None


def sanitize_coupons_for_public(rows: list) -> list[dict[str, Any]]:
    """Strip internal fields; only codes safe for apply on client."""
    safe: list[dict[str, Any]] = []
    for c in rows[:80]:
        if not isinstance(c, dict) or not c.get("active", True):
            continue
        if not _row_active_and_dates_ok(c):
            continue
        code = (c.get("code") or "").strip().upper()
        if not code:
            continue
        entry: dict[str, Any] = {"code": code, "label": (c.get("label") or "").strip()}
        if c.get("percentOff") is not None:
            try:
                entry["percentOff"] = float(c.get("percentOff"))
            except (TypeError, ValueError):
                continue
        elif c.get("rupeesOff") is not None:
            try:
                entry["rupeesOff"] = float(c.get("rupeesOff"))
            except (TypeError, ValueError):
                continue
        else:
            continue
        if c.get("maxDiscountInr") is not None:
            try:
                entry["maxDiscountInr"] = float(c.get("maxDiscountInr"))
            except (TypeError, ValueError):
                pass
        safe.append(entry)
    return safe


def merged_public_coupons(course: dict, settings_doc: dict) -> list[dict[str, Any]]:
    """Course-specific coupons first; global fills in codes not on course."""
    course_rows = course.get("enrollmentCoupons") if isinstance(course.get("enrollmentCoupons"), list) else []
    global_rows = settings_doc.get("coupons") if isinstance(settings_doc.get("coupons"), list) else []
    a = sanitize_coupons_for_public(course_rows)
    b = sanitize_coupons_for_public(global_rows)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for src in (a, b):
        for x in src:
            code = str(x.get("code") or "").upper()
            if code in seen:
                continue
            seen.add(code)
            out.append(x)
    return out


def lookup_coupon_pricing_only(code: str, *, course: dict, settings_doc: dict) -> dict[str, Any] | None:
    """Resolve coupon row for invoice recompute (no usage cap check)."""
    cu = (code or "").strip().upper()
    if not cu:
        return None
    course_rows = course.get("enrollmentCoupons") if isinstance(course.get("enrollmentCoupons"), list) else []
    global_rows = settings_doc.get("coupons") if isinstance(settings_doc.get("coupons"), list) else []
    row = _find_row_in_list([x for x in course_rows if isinstance(x, dict)], cu)
    if row is None:
        row = _find_row_in_list([x for x in global_rows if isinstance(x, dict)], cu)
    if row is None:
        try:
            from app.partner_program import partner_coupon_to_pricing
            pricing_p, _ = partner_coupon_to_pricing(cu, course_id=str(course.get("_id") or ""))
            return pricing_p
        except Exception:
            return None
    if not _row_active_and_dates_ok(row):
        return None
    pricing = _coupon_row_to_pricing_dict(row)
    if not pricing.get("percentOff") and not pricing.get("rupeesOff"):
        return None
    return pricing


def public_checkout_block(course: dict, settings_doc: Optional[dict]) -> dict[str, Any]:
    doc = settings_doc or {}
    try:
        gst = float(doc.get("gstPercent") or 18)
    except (TypeError, ValueError):
        gst = 18.0
    return {
        "gstPercent": max(0.0, gst),
        "trainingKit": public_training_kit_payload(course, doc),
        "coupons": merged_public_coupons(course, doc),
    }
