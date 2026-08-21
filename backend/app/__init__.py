"""
Flask application factory. Enterprise-grade: config-driven, CORS, blueprints.
Structure per XpertIntern Tech Stack Guide.
"""
import re
from urllib.parse import urlparse

from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException

from app.db import init_db


def create_app(config_class=None):
    from app.config import get_config
    app = Flask(__name__)
    cfg_class = config_class or get_config()
    app.config.from_object(cfg_class())

    uri = app.config.get("MONGODB_URI", "").strip()
    if uri:
        try:
            from app.db import init_db_with_retry
            init_db_with_retry(uri, attempts=3)
            from app.seed import seed_admin_if_missing, seed_crm_dev_users
            seed_admin_if_missing()
            seed_crm_dev_users()
        except Exception as exc:
            # Don't fail app startup if DB is unreachable (e.g. Lambda cold start, network).
            # CORS preflight and health checks can still run; DB routes will return 503.
            import logging
            logging.getLogger(__name__).warning(
                "MongoDB init failed — auth and data routes will return 503 until fixed: %s",
                exc,
            )

    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def _token_revoked_callback(jwt_header, jwt_payload):
        """Reject tokens whose sessionEpoch claim does not match the user document."""
        try:
            from bson import ObjectId
            from app.db import get_users_collection
            from app.auth_session import session_epoch_of

            uid = jwt_payload.get("sub")
            if not uid or not ObjectId.is_valid(str(uid)):
                return True
            claim_se = int(jwt_payload.get("se") or 0)
            user = get_users_collection().find_one(
                {"_id": ObjectId(str(uid))},
                {"sessionEpoch": 1, "accountStatus": 1},
            )
            if not user:
                return True
            status = (user.get("accountStatus") or "active").strip().lower()
            if status in ("deleted", "suspended"):
                return True
            return session_epoch_of(user) != claim_se
        except Exception:
            # Avoid locking all users if DB flickers mid-request
            import logging
            logging.getLogger(__name__).exception("token blocklist check failed")
            return False

    # Parse CORS_ORIGINS: support list or comma-separated string (e.g. from Lambda env)
    _raw = app.config.get("CORS_ORIGINS")
    if isinstance(_raw, str):
        origins = [o.strip() for o in _raw.split(",") if o.strip()]
    elif isinstance(_raw, list):
        origins = _raw
    else:
        origins = []
    if not origins:
        origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Ensure production frontend origins are allowed when not in strict dev
    _extra = ["https://www.xpertintern.com", "https://xpertintern.com", "http://localhost:5173", "http://127.0.0.1:5173"]
    for o in _extra:
        if o not in origins:
            origins.append(o)

    app.config["CORS_ORIGINS_LIST"] = origins

    _vercel_origin_re = re.compile(r"^https://[\w.-]+\.vercel\.app$", re.IGNORECASE)
    _amplify_origin_re = re.compile(r"^https://[\w.-]+\.amplifyapp\.com$", re.IGNORECASE)

    def _cors_origin_allowed(origin: str) -> bool:
        if not origin:
            return False
        if origin in app.config["CORS_ORIGINS_LIST"]:
            return True
        o = origin.strip()
        if _vercel_origin_re.match(o) or _amplify_origin_re.match(o):
            return True
        try:
            host = (urlparse(origin).hostname or "").lower()
            if host.endswith(".vercel.app") or host.endswith(".amplifyapp.com"):
                return True
        except Exception:
            pass
        return False

    cors_origins_for_flask = list(origins)
    cors_origins_for_flask.append(_vercel_origin_re)
    cors_origins_for_flask.append(_amplify_origin_re)

    CORS(
        app,
        origins=cors_origins_for_flask,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    @app.before_request
    def _cors_preflight():
        """Respond to OPTIONS preflight with CORS headers so API Gateway/Lambda always return them."""
        if request.method != "OPTIONS":
            return None
        origin = request.headers.get("Origin")
        allow_origin = origin if origin and _cors_origin_allowed(origin) else ""
        from flask import make_response
        r = make_response("", 204)
        if allow_origin:
            r.headers["Access-Control-Allow-Origin"] = allow_origin
        r.headers["Access-Control-Allow-Credentials"] = "true"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        r.headers["Access-Control-Max-Age"] = "86400"
        return r

    @app.after_request
    def _add_cors_headers(response):
        origin = request.headers.get("Origin")
        if not origin:
            return response
        if _cors_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response

    from app.routes.health import health_bp
    from app.routes.auth import auth_bp
    from app.routes.courses import courses_bp
    from app.routes.enrollments import enrollments_bp
    from app.routes.payments import payments_bp
    from app.routes.certificates import certificates_bp
    from app.routes.admin import admin_bp
    from app.routes.admin_students import admin_students_bp
    from app.routes.contact import contact_bp
    from app.routes.visitor import visitor_bp
    from app.routes.internship import internship_bp
    from app.routes.company import company_bp
    from app.routes.student_routes import student_bp
    from app.routes.reviews import reviews_bp
    from app.routes.settings_public import settings_public_bp
    from app.routes.masters import masters_bp
    from app.routes.partners import partners_bp
    from app.routes.partners_admin import partners_admin_bp
    from app.routes.lead_crm import crm_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(courses_bp, url_prefix="/api/courses")
    app.register_blueprint(enrollments_bp, url_prefix="/api/enrollments")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(certificates_bp, url_prefix="/api/certificates")
    from app.routes.certificates import verify_public_bp
    app.register_blueprint(verify_public_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(admin_students_bp, url_prefix="/api/admin")
    app.register_blueprint(partners_admin_bp, url_prefix="/api/admin")
    app.register_blueprint(partners_bp, url_prefix="/api/partners")
    app.register_blueprint(contact_bp, url_prefix="/api/contact")
    app.register_blueprint(visitor_bp, url_prefix="/api")
    app.register_blueprint(internship_bp, url_prefix="/api/internship")
    app.register_blueprint(company_bp, url_prefix="/api/company")
    app.register_blueprint(student_bp, url_prefix="/api")
    app.register_blueprint(reviews_bp, url_prefix="/api/reviews")
    app.register_blueprint(settings_public_bp, url_prefix="/api/settings")
    app.register_blueprint(masters_bp, url_prefix="/api/masters")
    app.register_blueprint(crm_bp, url_prefix="/api/crm")

    @app.route("/")
    def index():
        return {"service": "xpertintern-api", "version": "0.1.0", "docs": "/api/health"}

    def _cors_headers_for_error(origin: str) -> dict:
        allow_origin = origin if origin and _cors_origin_allowed(origin) else ""
        h = {
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        }
        if allow_origin:
            h["Access-Control-Allow-Origin"] = allow_origin
        return h

    @app.errorhandler(Exception)
    def _handle_error(e):
        """Catch all unhandled exceptions so Lambda returns 500 + JSON (and CORS) instead of 502."""
        import traceback

        if isinstance(e, HTTPException):
            origin = request.headers.get("Origin", "")
            body = {"error": e.name, "description": e.description}
            if app.config.get("DEBUG"):
                body["detail"] = str(e)
            r = make_response(jsonify(body), e.code)
            for k, v in _cors_headers_for_error(origin).items():
                r.headers[k] = v
            return r
        if hasattr(app, "logger"):
            app.logger.exception("Unhandled error: %s", e)
        else:
            traceback.print_exc()
        origin = request.headers.get("Origin", "")
        body = {"error": "An unexpected error occurred. Please try again."}
        if app.config.get("DEBUG"):
            body["detail"] = str(e)
        r = make_response(jsonify(body), 500)
        for k, v in _cors_headers_for_error(origin).items():
            r.headers[k] = v
        return r

    import logging as _logging
    _elog = _logging.getLogger("xpertintern.email")
    if (app.config.get("EMAIL_TRANSPORT") or "smtp").strip().lower() == "ses":
        from app.email_ses import ses_configured

        if ses_configured(app.config):
            _elog.info(
                "Email via SES region=%s from=%s",
                app.config.get("SES_REGION") or "(AWS_REGION)",
                app.config.get("SES_FROM_EMAIL") or app.config.get("MAIL_FROM"),
            )
        else:
            _elog.warning("EMAIL_TRANSPORT=ses but SES_FROM_EMAIL / MAIL_FROM missing — mail disabled")
    elif app.config.get("SMTP_HOST") and app.config.get("SMTP_USER") and app.config.get("SMTP_PASSWORD"):
        from app.notifications import email_send_synchronous, welcome_email_uses_request_thread

        if email_send_synchronous():
            _smtp_mode = "request_thread (EMAIL_SEND_SYNC=1)"
        elif welcome_email_uses_request_thread():
            _smtp_mode = "welcome_in_request_on_Lambda_others_background"
        else:
            _smtp_mode = "background_thread (default)"
        _elog.info(
            "SMTP enabled host=%s port=%s mode=%s",
            app.config.get("SMTP_HOST"),
            app.config.get("SMTP_PORT"),
            _smtp_mode,
        )
    else:
        _elog.warning("No SES or SMTP configured — transactional emails are disabled")

    return app
