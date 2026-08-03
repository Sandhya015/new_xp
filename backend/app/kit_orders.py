"""Training kit order fulfillment (Rev 2 §1)."""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime
from typing import Any

from bson import Binary, ObjectId
from bson.binary import Binary as BsonBinary

from app.db import (
    get_courses_collection,
    get_orders_collection,
    get_users_collection,
    get_db,
)


def get_kit_orders_collection():
    return get_db()["kit_orders"]


def allocate_kit_order_id() -> str:
    year = datetime.utcnow().year
    coll = get_kit_orders_collection()
    # Sequential-ish count for the year
    n = coll.count_documents({"kitOrderId": {"$regex": f"^KIT-{year}-"}}) + 1
    return f"KIT-{year}-{n:05d}"


def _addr_from_user(u: dict) -> dict:
    return {
        "line1": (u.get("addressLine1") or u.get("address") or "").strip(),
        "line2": (u.get("addressLine2") or u.get("apartment") or "").strip(),
        "city": (u.get("addressCity") or u.get("city") or "").strip(),
        "state": (u.get("addressState") or u.get("state") or "").strip(),
        "pincode": (u.get("addressPincode") or u.get("pincode") or "").strip(),
        "landmark": (u.get("addressLandmark") or "").strip(),
        "phone": (u.get("mobile") or u.get("phone") or "").strip(),
    }


def _addr_from_snapshot(snap: dict) -> dict:
    if not isinstance(snap, dict):
        return {}
    return {
        "line1": (snap.get("line1") or snap.get("addressLine1") or snap.get("address") or "").strip(),
        "line2": (snap.get("line2") or snap.get("addressLine2") or "").strip(),
        "city": (snap.get("city") or snap.get("addressCity") or "").strip(),
        "state": (snap.get("state") or snap.get("addressState") or "").strip(),
        "pincode": (snap.get("pincode") or snap.get("addressPincode") or "").strip(),
        "landmark": (snap.get("landmark") or "").strip(),
        "phone": (snap.get("phone") or snap.get("mobile") or "").strip(),
    }


def _addrs_match(a: dict, b: dict) -> bool:
    keys = ("line1", "city", "state", "pincode")
    for k in keys:
        av = re.sub(r"\s+", " ", (a.get(k) or "").strip().lower())
        bv = re.sub(r"\s+", " ", (b.get(k) or "").strip().lower())
        if av and bv and av != bv:
            return False
    return bool((a.get("line1") or a.get("city")) and (b.get("line1") or b.get("city")))


def ensure_kit_order_for_payment(order: dict) -> dict | None:
    """Create kit_orders row when payment paid and kit included. Idempotent."""
    if not order or not order.get("includeTrainingKit"):
        return None
    status = (order.get("status") or "").lower()
    if status not in ("paid", "captured", "success", "completed"):
        return None
    coll = get_kit_orders_collection()
    oid = str(order.get("_id") or "")
    existing = coll.find_one({"paymentId": oid}) or coll.find_one({"orderId": order.get("orderId")})
    if existing:
        return existing

    course_id = str(order.get("courseId") or "")
    course = {}
    if course_id and ObjectId.is_valid(course_id):
        course = get_courses_collection().find_one({"_id": ObjectId(course_id)}) or {}
    kit = course.get("trainingKit") if isinstance(course.get("trainingKit"), dict) else {}
    kit_name = (kit.get("name") or order.get("kitName") or "Training kit").strip()

    uid = str(order.get("userId") or order.get("studentId") or "")
    user = {}
    if uid and ObjectId.is_valid(uid):
        user = get_users_collection().find_one({"_id": ObjectId(uid)}) or {}

    profile_addr = _addr_from_user(user)
    ship_snap = order.get("shippingAddress") if isinstance(order.get("shippingAddress"), dict) else None
    bill_snap = order.get("billingSnapshot") if isinstance(order.get("billingSnapshot"), dict) else {}
    shipping = _addr_from_snapshot(ship_snap) if ship_snap else _addr_from_snapshot(bill_snap) or profile_addr
    same = bool(order.get("shippingSameAsProfile", True))
    if ship_snap is None and bill_snap:
        same = _addrs_match(shipping, profile_addr) if profile_addr.get("line1") else True

    pricing = order.get("pricing") if isinstance(order.get("pricing"), dict) else {}
    kit_amount = (
        pricing.get("afterCouponKitGross")
        or pricing.get("trainingKitGross")
        or kit.get("priceInr")
        or 0
    )

    now = datetime.utcnow()
    doc = {
        "kitOrderId": allocate_kit_order_id(),
        "paymentId": oid,
        "orderId": order.get("orderId") or "",
        "userId": uid,
        "courseId": course_id,
        "courseTitle": (course.get("title") or order.get("courseTitle") or "").strip(),
        "kitName": kit_name,
        "kitType": (kit.get("kitType") or kit.get("type") or "").strip(),
        "studentName": (user.get("name") or user.get("fullName") or "").strip(),
        "studentEmail": (user.get("email") or "").strip().lower(),
        "studentPhone": (user.get("mobile") or user.get("phone") or "").strip(),
        "shippingAddress": shipping,
        "profileAddress": profile_addr,
        "shippingSameAsProfile": same,
        "status": "pending",
        "trackingNo": "",
        "amount": float(kit_amount or 0),
        "couponCode": (order.get("couponCode") or "").strip(),
        "orderedAt": order.get("createdAt") or now,
        "createdAt": now,
        "updatedAt": now,
    }
    res = coll.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


def sync_kit_orders_from_orders(limit: int = 200) -> int:
    """Backfill kit orders from successful payment orders that include kits."""
    created = 0
    q = {
        "includeTrainingKit": True,
        "status": {"$in": ["paid", "captured", "success", "completed"]},
    }
    for o in get_orders_collection().find(q).sort("createdAt", -1).limit(limit):
        before = get_kit_orders_collection().count_documents({"paymentId": str(o["_id"])})
        ensure_kit_order_for_payment(o)
        after = get_kit_orders_collection().count_documents({"paymentId": str(o["_id"])})
        if after > before:
            created += 1
    return created


def serialize_kit_order(doc: dict) -> dict:
    ship = doc.get("shippingAddress") if isinstance(doc.get("shippingAddress"), dict) else {}
    ordered = doc.get("orderedAt") or doc.get("createdAt")
    return {
        "id": str(doc.get("_id") or ""),
        "kitOrderId": doc.get("kitOrderId") or "",
        "paymentId": doc.get("paymentId") or "",
        "orderId": doc.get("orderId") or "",
        "userId": doc.get("userId") or "",
        "courseId": doc.get("courseId") or "",
        "courseTitle": doc.get("courseTitle") or "",
        "kitName": doc.get("kitName") or "",
        "kitType": doc.get("kitType") or "",
        "studentName": doc.get("studentName") or "",
        "studentEmail": doc.get("studentEmail") or "",
        "studentPhone": doc.get("studentPhone") or "",
        "shippingAddress": ship,
        "shippingSummary": ", ".join(
            x for x in [ship.get("city"), ship.get("state"), ship.get("pincode")] if x
        ),
        "shippingSameAsProfile": bool(doc.get("shippingSameAsProfile", True)),
        "status": (doc.get("status") or "pending").lower(),
        "trackingNo": doc.get("trackingNo") or "",
        "amount": float(doc.get("amount") or 0),
        "couponCode": doc.get("couponCode") or "",
        "orderedAt": ordered.isoformat() + "Z" if hasattr(ordered, "isoformat") else str(ordered or ""),
    }


def list_kit_orders(args) -> tuple[list[dict], int]:
    q: dict = {}
    and_parts: list = []
    status = (args.get("status") or "").strip().lower()
    if status and status not in ("all", "*"):
        and_parts.append({"status": status})
    course_id = (args.get("courseId") or "").strip()
    if course_id:
        and_parts.append({"courseId": course_id})
    kit_name = (args.get("kitName") or "").strip()
    if kit_name:
        and_parts.append({"kitName": {"$regex": re.escape(kit_name), "$options": "i"}})
    state = (args.get("state") or "").strip()
    if state:
        and_parts.append({"shippingAddress.state": {"$regex": re.escape(state), "$options": "i"}})
    search = (args.get("search") or "").strip()
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        and_parts.append({
            "$or": [
                {"kitOrderId": rx},
                {"studentName": rx},
                {"studentEmail": rx},
                {"studentPhone": rx},
                {"trackingNo": rx},
                {"orderId": rx},
            ]
        })
    df = (args.get("dateFrom") or "").strip()
    dt = (args.get("dateTo") or "").strip()
    if df or dt:
        created: dict = {}
        if df:
            try:
                created["$gte"] = datetime.strptime(df[:10], "%Y-%m-%d")
            except ValueError:
                pass
        if dt:
            try:
                end = datetime.strptime(dt[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                created["$lte"] = end
            except ValueError:
                pass
        if created:
            and_parts.append({"orderedAt": created})
    if and_parts:
        q = {"$and": and_parts} if len(and_parts) > 1 else and_parts[0]
    try:
        page = max(1, int(args.get("page") or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = min(200, max(1, int(args.get("limit") or 50)))
    except (TypeError, ValueError):
        limit = 50
    coll = get_kit_orders_collection()
    total = coll.count_documents(q)
    cur = coll.find(q).sort("orderedAt", -1).skip((page - 1) * limit).limit(limit)
    return [serialize_kit_order(d) for d in cur], total


def recent_kit_orders(limit: int = 5) -> tuple[list[dict], int]:
    coll = get_kit_orders_collection()
    pending = coll.count_documents({"status": {"$in": ["pending", "packed"]}})
    items = [serialize_kit_order(d) for d in coll.find({}).sort("orderedAt", -1).limit(limit)]
    return items, pending
