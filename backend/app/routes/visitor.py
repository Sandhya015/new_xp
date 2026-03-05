"""
Visitor / track: lead tracking (pages visited, course viewed, etc.). DB to be wired.
"""
from flask import Blueprint, request, jsonify
visitor_bp = Blueprint("visitor", __name__)


@visitor_bp.route("/track", methods=["POST"])
def track():
    # TODO: store in visitors collection
    return jsonify({"ok": True}), 200
