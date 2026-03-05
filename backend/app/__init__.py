"""
Flask application factory. Enterprise-grade: config-driven, CORS, blueprints.
Structure per XpertIntern Tech Stack Guide.
"""
from flask import Flask
from flask_cors import CORS


def create_app(config_class=None):
    from app.config import get_config
    app = Flask(__name__)
    cfg_class = config_class or get_config()
    app.config.from_object(cfg_class())

    CORS(app, origins=app.config.get("CORS_ORIGINS", []), supports_credentials=True)

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
