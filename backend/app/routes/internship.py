from flask import Blueprint, jsonify
internship_bp = Blueprint("internship", __name__)


@internship_bp.route("", methods=["GET"])
def status():
    return jsonify({"status": "coming_soon", "message": "Internship program is under development."})
