"""
Contact: submit contact form. DB to be wired.
"""
from flask import Blueprint, request, jsonify
contact_bp = Blueprint("contact", __name__)


@contact_bp.route("", methods=["POST"])
def submit():
    # TODO: validate, store in contact_queries collection
    return jsonify({"message": "Contact form — DB not connected yet"}), 501
