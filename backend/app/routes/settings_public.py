"""Public app settings for training checkout (GST, training kit price, coupons)."""
from __future__ import annotations

from flask import Blueprint, jsonify

from app.db import get_app_settings_collection, get_db

settings_public_bp = Blueprint("settings_public", __name__)


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
