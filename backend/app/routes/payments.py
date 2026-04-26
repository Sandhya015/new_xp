"""
Payments: Razorpay Orders API — create-order (JWT), verify signature (JWT), list my orders.
Amount is always taken from the course document (never trust client-supplied amounts).
"""
from __future__ import annotations

import uuid
from datetime import datetime

import razorpay
from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import (
    get_app_settings_collection,
    get_db,
    get_orders_collection,
    get_courses_collection,
    get_enrollments_collection,
)
from app.enrollment_lookup import user_course_enrollment_filter
from app.notifications import schedule_payment_success_email

payments_bp = Blueprint("payments", __name__)


def _gst_factor(gst_percent: float) -> float:
    return 1.0 + max(0.0, float(gst_percent)) / 100.0


def _split_gross_inr(gross: float, gst_percent: float) -> tuple:
    """Given tax-inclusive gross, return (taxable_base, gst_amount, gross)."""
    g = max(0.0, float(gross))
    if g <= 0:
        return 0.0, 0.0, 0.0
    f = _gst_factor(gst_percent)
    base = round(g / f, 2)
    gst_amt = round(g - base, 2)
    return base, gst_amt, g


def _find_coupon(settings_doc: dict, code: str):
    coupons = settings_doc.get("coupons") if isinstance(settings_doc.get("coupons"), list) else []
    cu = (code or "").strip().upper()
    for c in coupons:
        if not isinstance(c, dict) or not c.get("active", True):
            continue
        if str(c.get("code") or "").strip().upper() == cu:
            return c
    return None


def _razorpay_client():
    key_id = current_app.config.get("RAZORPAY_KEY_ID") or ""
    key_secret = current_app.config.get("RAZORPAY_KEY_SECRET") or ""
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


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
        items.append({
            "id": str(o["_id"]),
            "transactionId": o.get("transactionId", o.get("razorpayPaymentId", o.get("orderId", str(o["_id"])))),
            "courseId": course_id,
            "courseTitle": course_title,
            "amount": o.get("amount", 0),
            "status": o.get("status", "pending"),
            "method": o.get("method", ""),
            "createdAt": o.get("createdAt").strftime("%Y-%m-%dT%H:%M:%S") if o.get("createdAt") else "",
        })
    return jsonify({"items": items})


@payments_bp.route("/create-order", methods=["POST"])
@jwt_required()
def create_order():
    """
    Create a Razorpay order for an active course. Price comes from DB only (INR, rupees).
    Returns keyId + order details for Razorpay Checkout on the client.
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    client = _razorpay_client()
    if client is None:
        return jsonify({
            "error": "Payment gateway not configured",
            "detail": "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.",
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
    try:
        gst_percent = float(settings_doc.get("gstPercent") or 18)
    except (TypeError, ValueError):
        gst_percent = 18.0
    try:
        kit_price = max(0.0, float(settings_doc.get("trainingKitPriceInr") or 0))
    except (TypeError, ValueError):
        kit_price = 0.0

    matched_coupon = None
    discounted_gross = course_gross
    if coupon_code:
        c = _find_coupon(settings_doc, coupon_code)
        if not c:
            return jsonify({"error": "Invalid or expired coupon code."}), 400
        matched_coupon = coupon_code
        if c.get("percentOff") is not None:
            try:
                pct = float(c.get("percentOff"))
                discounted_gross = course_gross * max(0.0, 1.0 - pct / 100.0)
            except (TypeError, ValueError):
                discounted_gross = course_gross
        elif c.get("rupeesOff") is not None:
            try:
                off = float(c.get("rupeesOff"))
                discounted_gross = max(0.0, course_gross - off)
            except (TypeError, ValueError):
                discounted_gross = course_gross

    kit_component = kit_price if include_kit else 0.0
    total_gross = round(discounted_gross + kit_component, 2)

    base_course, gst_course, _ = _split_gross_inr(course_gross, gst_percent)
    base_disc, gst_disc, _ = _split_gross_inr(discounted_gross, gst_percent)
    if kit_component > 0:
        base_kit, gst_kit, _ = _split_gross_inr(kit_component, gst_percent)
    else:
        base_kit, gst_kit = 0.0, 0.0

    pricing = {
        "courseListGross": round(course_gross, 2),
        "courseBaseInr": base_course,
        "courseGstInr": gst_course,
        "couponCode": matched_coupon or "",
        "afterCouponGross": round(discounted_gross, 2),
        "afterCouponBaseInr": base_disc,
        "afterCouponGstInr": gst_disc,
        "trainingKitGross": round(kit_component, 2),
        "trainingKitBaseInr": base_kit,
        "trainingKitGstInr": gst_kit,
        "totalGrossInr": total_gross,
        "totalBaseInr": round(base_disc + base_kit, 2),
        "totalGstInr": round(gst_disc + gst_kit, 2),
        "gstPercent": gst_percent,
    }

    amount_paise = int(round(total_gross * 100))
    if amount_paise < 100:
        return jsonify({"error": "Amount too small for Razorpay (minimum ₹1)"}), 400

    receipt = f"xpi_{uuid.uuid4().hex[:32]}"
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
    coll = get_orders_collection()
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
        "enrollmentSnapshot": enrollment_snapshot,
        "billingSnapshot": billing_snapshot,
        "includeTrainingKit": include_kit,
    }
    result = coll.insert_one(doc)

    key_id = current_app.config.get("RAZORPAY_KEY_ID", "")
    return jsonify({
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
    Verify Razorpay payment signature, mark order success, create enrollment if needed.
    Body: razorpay_order_id, razorpay_payment_id, razorpay_signature
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    client = _razorpay_client()
    if client is None:
        return jsonify({"error": "Payment gateway not configured"}), 503

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
        return jsonify({"ok": True, "message": "Payment already verified", "enrollmentCreated": True})

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

    coll.update_one(
        {"_id": order["_id"]},
        {"$set": {
            "status": "success",
            "razorpayPaymentId": razorpay_payment_id,
            "transactionId": razorpay_payment_id,
            "verifiedAt": datetime.utcnow(),
        }},
    )

    course_id = order.get("courseId")
    enrollment_created = False
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

    pay_ref = razorpay_payment_id
    amt = order.get("amount", 0)
    cid_str = str(course_id) if course_id and ObjectId.is_valid(str(course_id)) else None
    schedule_payment_success_email(
        current_app._get_current_object(),
        user_id,
        cid_str,
        amt,
        pay_ref,
        enrollment_created,
    )

    return jsonify({
        "ok": True,
        "message": "Payment verified",
        "enrollmentCreated": enrollment_created,
    }), 200


@payments_bp.route("/invoice/<invoice_id>", methods=["GET"])
@jwt_required()
def get_invoice(invoice_id):
    return jsonify({"id": invoice_id, "message": "Invoice PDF — not implemented"}), 501
