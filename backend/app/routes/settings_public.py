"""Public app settings for training checkout (GST, training kit price, coupons)."""
from __future__ import annotations

from flask import Blueprint, jsonify

from app.db import get_app_settings_collection, get_db

settings_public_bp = Blueprint("settings_public", __name__)

_DEFAULT_PUBLIC_FAQS = [
    {"id": "faq_invoice", "question": "How do I download my invoice?", "answer": "Open Payments & Invoices in your dashboard. For completed orders, use Download next to the transaction to get your GST tax invoice PDF (same file emailed after payment).", "sortOrder": 0},
    {"id": "faq_certificate", "question": "How do I get a certificate?", "answer": "Complete your course requirements, including any completion quiz set by your trainer. When eligible, you can download or receive your certificate from the Certificate section of the course.", "sortOrder": 1},
    {"id": "faq_change_course", "question": "Can I change my course after enrolling?", "answer": "Contact support through Raise a Ticket with your enrollment details. Our team will check eligibility and guide you on any transfer or refund policy.", "sortOrder": 2},
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


def _serialize_support_faqs_from_doc(doc: dict) -> list:
    raw = doc.get("supportFaqs")
    faqs = raw if isinstance(raw, list) else []
    safe = []
    for i, x in enumerate(faqs[:80]):
        if not isinstance(x, dict):
            continue
        q = str(x.get("question") or "").strip()
        if not q:
            continue
        safe.append({
            "id": str(x.get("id") or f"faq_{i}"),
            "question": q[:500],
            "answer": str(x.get("answer") or "").strip()[:20000],
            "sortOrder": int(x.get("sortOrder") if x.get("sortOrder") is not None else i),
        })
    safe.sort(key=lambda z: z["sortOrder"])
    return safe


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
    """Student Help & Support: FAQs (CMS) + contact block (S-6)."""
    db = get_db()
    if db is None:
        return jsonify({"faqs": _DEFAULT_PUBLIC_FAQS, "contact": _PUBLIC_SUPPORT_CONTACT})
    coll = get_app_settings_collection()
    doc = coll.find_one({"_id": "global"}) or {}
    faqs = _serialize_support_faqs_from_doc(doc)
    if not faqs:
        faqs = list(_DEFAULT_PUBLIC_FAQS)
    return jsonify({"faqs": faqs, "contact": _PUBLIC_SUPPORT_CONTACT})
