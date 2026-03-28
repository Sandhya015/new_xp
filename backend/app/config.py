"""
Environment-based configuration. Never hardcode secrets or stage-specific values.
"""
import os
from typing import List


def _smtp_timeout_seconds() -> int:
    """SMTP socket timeout. On Lambda, keep well under API Gateway's 29s integration limit."""
    raw = os.environ.get("SMTP_TIMEOUT", "").strip()
    if raw.isdigit():
        return max(3, min(int(raw), 60))
    return 10 if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else 30


class Config:
    """Base config."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY", "dev-jwt-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 86400))  # 24h default
    CORS_ORIGINS: List[str] = []
    MONGODB_URI = os.environ.get("MONGODB_URI", "") or os.environ.get("MONGO_URI", "")
    # Razorpay (test/live keys from https://dashboard.razorpay.com/app/keys)
    RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    # Zoho / SMTP (transactional: welcome, enrollment, certificate)
    SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or 587)
    SMTP_USER = os.environ.get("SMTP_USER", "").strip()
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
    MAIL_FROM = os.environ.get("MAIL_FROM", "admin@xpertintern.com").strip()
    MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "XpertIntern").strip()
    # Use implicit SSL (e.g. Zoho port 465). Set SMTP_USE_SSL=1 or use port 465.
    SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "").strip().lower() in ("1", "true", "yes")
    # Per-connection timeout (seconds); default 10 on Lambda to avoid 504 from API Gateway (29s max).
    SMTP_TIMEOUT = _smtp_timeout_seconds()
    # Email: "smtp" (default) or "ses" (Amazon SES in Lambda region — see .env.example)
    EMAIL_TRANSPORT = os.environ.get("EMAIL_TRANSPORT", "smtp").strip().lower()
    SES_FROM_EMAIL = os.environ.get("SES_FROM_EMAIL", "").strip()
    SES_REGION = os.environ.get("SES_REGION", "").strip()


class DevelopmentConfig(Config):
    ENV = "development"
    DEBUG = True
    _origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    CORS_ORIGINS = [o.strip() for o in _origins.split(",") if o.strip()] or ["http://localhost:5173", "http://127.0.0.1:5173"]


class StagingConfig(Config):
    ENV = "staging"
    DEBUG = False
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]


class ProductionConfig(Config):
    ENV = "production"
    DEBUG = False
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]


def get_config() -> type:
    env = os.environ.get("FLASK_ENV", "development")
    return {
        "development": DevelopmentConfig,
        "staging": StagingConfig,
        "production": ProductionConfig,
    }.get(env, DevelopmentConfig)
