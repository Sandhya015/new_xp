"""
Payments: create-order, verify, list my orders. Razorpay to be wired.
"""
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import get_db, get_orders_collection, get_courses_collection

payments_bp = Blueprint("payments", __name__)


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
        if course_id:
            c = courses_coll.find_one({"_id": ObjectId(course_id)})
            if c:
                course_title = c.get("title", "")
        items.append({
            "id": str(o["_id"]),
            "transactionId": o.get("transactionId", o.get("orderId", str(o["_id"]))),
            "courseId": course_id,
            "courseTitle": course_title,
            "amount": o.get("amount", 0),
            "status": o.get("status", "pending"),
            "method": o.get("method", ""),
            "createdAt": o.get("createdAt").strftime("%Y-%m-%dT%H:%M:%S") if o.get("createdAt") else "",
        })
    return jsonify({"items": items})


@payments_bp.route("/create-order", methods=["POST"])
def create_order():
    return jsonify({"message": "Create order — Razorpay not configured yet"}), 501


@payments_bp.route("/verify", methods=["POST"])
def verify():
    return jsonify({"message": "Verify payment — Razorpay not configured yet"}), 501


@payments_bp.route("/invoice/<invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    return jsonify({"id": invoice_id, "message": "Invoice — not implemented"}), 501
