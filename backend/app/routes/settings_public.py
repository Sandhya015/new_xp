"""Public app settings for training checkout (GST, training kit price, coupons)."""
from __future__ import annotations

import time

from flask import Blueprint, jsonify, request

from app.db import get_app_settings_collection, get_db
from app.support_faq import serialize_faqs_from_doc

settings_public_bp = Blueprint("settings_public", __name__)

_DEFAULT_PUBLIC_FAQS = [
    {"id": "faq_invoice", "question": "How do I download my invoice?", "answer": "Open Payments & Invoices in your dashboard. For completed orders, use Download next to the transaction to get your GST tax invoice PDF (same file emailed after payment).", "sortOrder": 0, "displayOrder": 0, "category": "Payment", "visibility": "both", "active": True},
    {"id": "faq_certificate", "question": "How do I get a certificate?", "answer": "Complete your course requirements, including any completion quiz set by your trainer. When eligible, you can download or receive your certificate from the Certificate section of the course.", "sortOrder": 1, "displayOrder": 1, "category": "Certificate", "visibility": "both", "active": True},
    {"id": "faq_change_course", "question": "Can I change my course after enrolling?", "answer": "Contact support through Raise a Ticket with your enrollment details. Our team will check eligibility and guide you on any transfer or refund policy.", "sortOrder": 2, "displayOrder": 2, "category": "Training", "visibility": "both", "active": True},
]

_PUBLIC_SUPPORT_CONTACT = {
    "email": "contact@xpertintern.com",
    "phone": "7004762654",
    "phoneTel": "+917004762654",
    "hours": "Mon-Sat: 9AM - 6PM",
    "address": "Arfabadd Colony, East Nahar Road, Bajrangpuri, Patna - 800007",
    "whatsappUrl": "https://wa.me/917004762654",
    "social": {
        "facebook": "https://www.facebook.com/people/XpertIntern/61577502832823/",
        "instagram": "https://www.instagram.com/xpertintern",
        "linkedin": "https://www.linkedin.com/company/xpertintern",
        "x": "https://x.com/XperIntern",
        "youtube": "https://www.youtube.com/@XpertIntern",
    },
}

# Simple in-process cache for public FAQs (5 minutes).
_faq_cache: dict[str, tuple[float, list]] = {}
_FAQ_CACHE_TTL = 300.0


def _cached_faqs(audience: str, doc: dict) -> list:
    now = time.time()
    hit = _faq_cache.get(audience)
    updated = doc.get("supportFaqsUpdatedAt")
    stamp = updated.timestamp() if hasattr(updated, "timestamp") else 0.0
    if hit and hit[0] + _FAQ_CACHE_TTL > now and hit[1] is not None:
        # Invalidate if settings updated after cache time stored in meta — store stamp in cache key via tuple
        pass
    cache_key = f"{audience}:{stamp}"
    hit2 = _faq_cache.get(cache_key)
    if hit2 and hit2[0] + _FAQ_CACHE_TTL > now:
        return hit2[1]
    faqs = serialize_faqs_from_doc(doc, audience=audience)
    if not faqs and audience in ("public", "students"):
        faqs = [x for x in _DEFAULT_PUBLIC_FAQS if x.get("visibility") in (audience, "both") or audience == "students"]
        if audience == "public":
            faqs = [x for x in _DEFAULT_PUBLIC_FAQS if x.get("visibility") in ("public", "both")]
    _faq_cache[cache_key] = (now, faqs)
    return faqs


def _serialize_support_faqs_from_doc(doc: dict) -> list:
    return serialize_faqs_from_doc(doc, audience=None)


@settings_public_bp.route("/training-checkout", methods=["GET"])
def training_checkout_settings():
    db = get_db()
    if db is None:
        return jsonify({
            "trainingKitPriceInr": 0,
            "gstPercent": 18,
            "coupons": [],
        })
    coll = get_app_settings_collection()
    doc = coll.find_one({"_id": "global"}) or {}
    coupons = doc.get("coupons") if isinstance(doc.get("coupons"), list) else []
    safe_coupons = []
    for c in coupons[:50]:
        if not isinstance(c, dict):
            continue
        if not c.get("active", True):
            continue
        code = (c.get("code") or "").strip().upper()
        if not code:
            continue
        entry = {"code": code, "label": (c.get("label") or "").strip()}
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
        safe_coupons.append(entry)
    try:
        kit = float(doc.get("trainingKitPriceInr") or 0)
    except (TypeError, ValueError):
        kit = 0.0
    try:
        gst = float(doc.get("gstPercent") or 18)
    except (TypeError, ValueError):
        gst = 18.0
    return jsonify({
        "trainingKitPriceInr": max(0, kit),
        "gstPercent": max(0, gst),
        "coupons": safe_coupons,
    })


@settings_public_bp.route("/support-content", methods=["GET"])
def support_content_public():
    """FAQs + contact. Pass audience=public|students (default students)."""
    audience = (request.args.get("audience") or "students").strip().lower()
    if audience not in ("public", "students"):
        audience = "students"
    db = get_db()
    if db is None:
        faqs = [x for x in _DEFAULT_PUBLIC_FAQS if x.get("visibility") in (audience, "both")]
        return jsonify({"faqs": faqs, "contact": _PUBLIC_SUPPORT_CONTACT})
    coll = get_app_settings_collection()
    doc = coll.find_one({"_id": "global"}) or {}
    faqs = _cached_faqs(audience, doc)
    if not faqs:
        faqs = [x for x in _DEFAULT_PUBLIC_FAQS if x.get("visibility") in (audience, "both")]
    return jsonify({"faqs": faqs, "contact": _PUBLIC_SUPPORT_CONTACT})
