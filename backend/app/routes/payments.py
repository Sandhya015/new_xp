"""
Payments: create-order, verify. Razorpay to be wired.
"""
from flask import Blueprint, request, jsonify
payments_bp = Blueprint("payments", __name__)


@payments_bp.route("/create-order", methods=["POST"])
def create_order():
    return jsonify({"message": "Create order — Razorpay not configured yet"}), 501


@payments_bp.route("/verify", methods=["POST"])
def verify():
    return jsonify({"message": "Verify payment — Razorpay not configured yet"}), 501


@payments_bp.route("/invoice/<invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    return jsonify({"id": invoice_id, "message": "Invoice — not implemented"}), 501
