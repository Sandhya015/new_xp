from flask import Blueprint, jsonify

from app.services.course_media_storage import uses_s3

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health():
    """
    Public health check. `courseMediaStorage` helps admins understand why uploads
    may preview locally but not on the deployed site (local disk vs shared S3).
    """
    payload = {"status": "ok", "service": "xpertintern-api"}
    try:
        payload["courseMediaStorage"] = "s3" if uses_s3() else "local"
    except Exception:
        payload["courseMediaStorage"] = "unknown"
    return jsonify(payload)
