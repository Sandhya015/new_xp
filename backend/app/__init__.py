"""
Flask application factory. Enterprise-grade: config-driven, CORS, blueprints.
Structure per XpertIntern Tech Stack Guide.
"""
import re
from urllib.parse import urlparse

from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from app.db import init_db


def create_app(config_class=None):
    from app.config import get_config
    app = Flask(__name__)
    cfg_class = config_class or get_config()
    app.config.from_object(cfg_class())

    uri = app.config.get("MONGODB_URI", "").strip()
    if uri:
        try:
            init_db(uri)
            from app.seed import seed_admin_if_missing
            seed_admin_if_missing()
        except Exception:
            # Don't fail app startup if DB is unreachable (e.g. Lambda cold start, network).
            # CORS preflight and health checks can still run; DB routes will return 503.
            pass

    JWTManager(app)

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

    def _cors_origin_allowed(origin: str) -> bool:
        if not origin:
            return False
        if origin in app.config["CORS_ORIGINS_LIST"]:
            return True
        if _vercel_origin_re.match(origin.strip()):
            return True
        try:
            if (urlparse(origin).hostname or "").endswith(".vercel.app"):
                return True
        except Exception:
            pass
        return False

    cors_origins_for_flask = list(origins)
    cors_origins_for_flask.append(_vercel_origin_re)

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
    from app.routes.contact import contact_bp
    from app.routes.visitor import visitor_bp
    from app.routes.internship import internship_bp
    from app.routes.company import company_bp
    from app.routes.student_routes import student_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(courses_bp, url_prefix="/api/courses")
    app.register_blueprint(enrollments_bp, url_prefix="/api/enrollments")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(certificates_bp, url_prefix="/api/certificates")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(contact_bp, url_prefix="/api/contact")
    app.register_blueprint(visitor_bp, url_prefix="/api")
    app.register_blueprint(internship_bp, url_prefix="/api/internship")
    app.register_blueprint(company_bp, url_prefix="/api/company")
    app.register_blueprint(student_bp, url_prefix="/api")

    @app.route("/")
    def index():
        return {"service": "xpertintern-api", "version": "0.1.0", "docs": "/api/health"}

    @app.errorhandler(Exception)
    def _handle_error(e):
        """Catch all unhandled exceptions so Lambda returns 500 + JSON (and CORS) instead of 502."""
        from flask import make_response
        import traceback
        if hasattr(app, "logger"):
            app.logger.exception("Unhandled error: %s", e)
        else:
            traceback.print_exc()
        origin = request.headers.get("Origin", "")
        allow_origin = origin if origin in app.config.get("CORS_ORIGINS_LIST", []) else ""
        body = {"error": "An unexpected error occurred. Please try again."}
        if app.config.get("DEBUG"):
            body["detail"] = str(e)
        r = make_response(body, 500)
        r.headers["Content-Type"] = "application/json"
        if allow_origin:
            r.headers["Access-Control-Allow-Origin"] = allow_origin
        r.headers["Access-Control-Allow-Credentials"] = "true"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
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
        from app.notifications import email_send_synchronous
        _elog.info(
            "SMTP enabled host=%s port=%s mode=%s",
            app.config.get("SMTP_HOST"),
            app.config.get("SMTP_PORT"),
            "request_thread (EMAIL_SEND_SYNC=1)" if email_send_synchronous() else "background_thread (default)",
        )
    else:
        _elog.warning("No SES or SMTP configured — transactional emails are disabled")

    return app
