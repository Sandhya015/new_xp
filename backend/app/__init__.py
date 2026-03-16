"""
Flask application factory. Enterprise-grade: config-driven, CORS, blueprints.
Structure per XpertIntern Tech Stack Guide.
"""
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
        init_db(uri)
        from app.seed import seed_admin_if_missing
        seed_admin_if_missing()

    JWTManager(app)

    origins = app.config.get("CORS_ORIGINS") or ["http://localhost:5173", "http://127.0.0.1:5173"]
    CORS(
        app,
        origins=origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type"],
    )

    @app.after_request
    def _add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin and origin in origins and "Access-Control-Allow-Origin" not in response.headers:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
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

    @app.route("/")
    def index():
        return {"service": "xpertintern-api", "version": "0.1.0", "docs": "/api/health"}

    return app
