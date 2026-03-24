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

from app.db import get_db, get_orders_collection, get_courses_collection, get_enrollments_collection
from app.notifications import schedule_payment_success_email

payments_bp = Blueprint("payments", __name__)


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
    cursor = coll.find({"userId": user_id}).sort("createdAt", -1)
    items = []
    for o in cursor:
        course_id = o.get("courseId")
        course_title = ""
        if course_id and ObjectId.is_valid(str(course_id)):
            try:
                c = courses_coll.find_one({"_id": ObjectId(str(course_id))})
                if c:
                    course_title = c.get("title", "")
            except (InvalidId, TypeError):
                pass
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

    if not course_id or not ObjectId.is_valid(course_id):
        return jsonify({"error": "Valid courseId is required"}), 400

    courses_coll = get_courses_collection()
    course = courses_coll.find_one({"_id": ObjectId(course_id), "active": True})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    try:
        price_rupees = float(course.get("price") or 0)
    except (TypeError, ValueError):
        price_rupees = 0.0

    if price_rupees <= 0:
        return jsonify({
            "error": "This course has no paid amount",
            "detail": "Use free enrollment instead (POST /api/enrollments with courseId).",
            "freeEnrollment": True,
        }), 400

    amount_paise = int(round(price_rupees * 100))
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
        "amount": price_rupees,
        "amountPaise": amount_paise,
        "currency": currency,
        "orderId": razorpay_order_id,
        "receipt": receipt,
        "status": "created",
        "method": "razorpay",
        "createdAt": datetime.utcnow(),
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
        if not enroll.find_one({"userId": user_id, "courseId": str(course_id)}):
            enroll.insert_one({
                "userId": user_id,
                "courseId": str(course_id),
                "orderId": str(order["_id"]),
                "status": "active",
                "createdAt": datetime.utcnow(),
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
