"""Emit CRM lead events from orders and user profiles."""
from __future__ import annotations

import logging
from typing import Any

from bson import ObjectId

from app.db import get_courses_collection, get_users_collection
from app.lead_crm import ingest_lead_event

logger = logging.getLogger(__name__)


def _user_contact(user_id: Any) -> tuple[str | None, str | None, str | None]:
    if not user_id or not ObjectId.is_valid(str(user_id)):
        return None, None, None
    u = get_users_collection().find_one({"_id": ObjectId(str(user_id))}, {"email": 1, "mobile": 1, "name": 1, "fullName": 1})
    if not u:
        return None, None, None
    name = (u.get("fullName") or u.get("name") or "").strip() or None
    return u.get("mobile"), u.get("email"), name


def _course_meta(course_id: Any) -> dict[str, Any]:
    if not course_id or not ObjectId.is_valid(str(course_id)):
        return {}
    c = get_courses_collection().find_one({"_id": ObjectId(str(course_id))}, {"title": 1})
    if not c:
        return {"courseId": str(course_id)}
    return {"courseId": str(course_id), "courseTitle": c.get("title")}


def emit_payment_lead_event(order: dict, event_type: str) -> None:
    """Best-effort CRM event from a payment order document."""
    try:
        mobile, email, name = _user_contact(order.get("userId"))
        if not mobile and not email:
            bill = order.get("billingSnapshot") if isinstance(order.get("billingSnapshot"), dict) else {}
            mobile = bill.get("mobile") or bill.get("phone")
            email = bill.get("email")
            name = name or bill.get("fullName") or bill.get("name")
        payload = {
            "orderId": str(order.get("_id")),
            "merchantOrderId": order.get("orderId"),
            "amount": order.get("amount"),
            "amountPaise": order.get("amountPaise"),
            "status": order.get("status"),
            **_course_meta(order.get("courseId")),
        }
        ingest_lead_event(
            event_type=event_type,
            source="payment_recovery" if event_type != "payment.successful" else "converted",
            mobile=mobile,
            email=email,
            full_name=name,
            payload=payload,
            idempotency_key=f"{event_type}:{order.get('_id')}",
        )
    except Exception:
        logger.exception("CRM payment lead event failed order=%s type=%s", order.get("_id"), event_type)
