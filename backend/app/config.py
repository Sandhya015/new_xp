"""
Environment-based configuration. Never hardcode secrets or stage-specific values.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List

# Load backend/.env regardless of process cwd (e.g. `python backend/run.py` from repo root).
# Lambda uses injected env vars; optional .env on disk is skipped if missing.
try:
    from dotenv import load_dotenv

    _BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(_BACKEND_ENV, override=False)
except ImportError:
    pass


def _int_mb_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        return default


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
    # Default 7 days (spec P-1); override via JWT_ACCESS_TOKEN_EXPIRES seconds in env.
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 7 * 86400))
    # Session-epoch check: tokens issued before admin password reset are rejected.
    JWT_BLOCKLIST_ENABLED = True
    JWT_BLOCKLIST_TOKEN_CHECKS = ["access"]
    CORS_ORIGINS: List[str] = []
    MONGODB_URI = os.environ.get("MONGODB_URI", "") or os.environ.get("MONGO_URI", "")
    # Razorpay (test/live keys from https://dashboard.razorpay.com/app/keys)
    RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    # Cashfree PG (merchant.cashfree.com → Developers → API Keys)
    CASHFREE_CLIENT_ID = os.environ.get("CASHFREE_CLIENT_ID", "").strip()
    CASHFREE_CLIENT_SECRET = os.environ.get("CASHFREE_CLIENT_SECRET", "").strip()
    CASHFREE_ENV = (os.environ.get("CASHFREE_ENV") or "production").strip().lower()
    CASHFREE_API_VERSION = (os.environ.get("CASHFREE_API_VERSION") or "2023-08-01").strip()
    # Frontend origin used in messaging / fallbacks (may be http://localhost for dev).
    PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "").strip().rstrip("/")
    # HTTPS origin for Cashfree order_meta.return_url only. Cashfree production rejects http://.
    # Override when PUBLIC_APP_URL is http (local): e.g. https://www.xpertintern.com or https://YOUR_APP.ngrok-free.app
    CASHFREE_RETURN_URL_ORIGIN = os.environ.get("CASHFREE_RETURN_URL_ORIGIN", "").strip().rstrip("/")
    # Zoho / SMTP (transactional: welcome, enrollment, certificate)
    SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or 587)
    SMTP_USER = os.environ.get("SMTP_USER", "").strip()
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
    MAIL_FROM = os.environ.get("MAIL_FROM", "admin@xpertintern.com").strip()
    MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "XpertIntern").strip()
    # Replies to transactional mail (welcome, receipts, certificates) — public support mailbox
    MAIL_REPLY_TO = os.environ.get("MAIL_REPLY_TO", "contact@xpertintern.com").strip()
    # Use implicit SSL (e.g. Zoho port 465). Set SMTP_USE_SSL=1 or use port 465.
    SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "").strip().lower() in ("1", "true", "yes")
    # Per-connection timeout (seconds); default 10 on Lambda to avoid 504 from API Gateway (29s max).
    SMTP_TIMEOUT = _smtp_timeout_seconds()
    # Email: "smtp" (default) or "ses" (Amazon SES in Lambda region — see .env.example)
    EMAIL_TRANSPORT = os.environ.get("EMAIL_TRANSPORT", "smtp").strip().lower()
    SES_FROM_EMAIL = os.environ.get("SES_FROM_EMAIL", "").strip()
    SES_REGION = os.environ.get("SES_REGION", "").strip()
    # Only this email may use POST /api/auth/admin/login and receive admin_portal JWTs.
    ADMIN_PANEL_ALLOWED_EMAIL = (os.environ.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()
    # Admin course-media uploads (MP4/MOV/AVI); intro vs lesson can differ per stage.
    MAX_COURSE_INTRO_UPLOAD_MB = _int_mb_env("MAX_COURSE_INTRO_UPLOAD_MB", 80)
    MAX_COURSE_LESSON_UPLOAD_MB = _int_mb_env("MAX_COURSE_LESSON_UPLOAD_MB", 80)
    MAX_COURSE_STUDY_MATERIAL_UPLOAD_MB = _int_mb_env("MAX_COURSE_STUDY_MATERIAL_UPLOAD_MB", 50)
    # Lambda: set to managed bucket (see serverless.yml). Empty = local instance_path/course_uploads.
    COURSE_MEDIA_S3_BUCKET = os.environ.get("COURSE_MEDIA_S3_BUCKET", "").strip()
    COURSE_MEDIA_S3_PREFIX = (os.environ.get("COURSE_MEDIA_S3_PREFIX") or "course-media").strip().strip("/") or "course-media"
    # reCAPTCHA v3 for partner apply (optional — empty secret skips verification in dev)
    RECAPTCHA_SECRET = os.environ.get("RECAPTCHA_SECRET", "").strip()
    RECAPTCHA_SITE_KEY = os.environ.get("RECAPTCHA_SITE_KEY", "").strip()
    SUPPORT_EMAIL = (os.environ.get("SUPPORT_EMAIL") or os.environ.get("MAIL_REPLY_TO") or "partners@xpertintern.com").strip()
    # TeleCMI CHUB — agent id (e.g. 103_1234567) + password from CHUB dashboard (not dashboard email)
    TELECMI_AGENT_ID = os.environ.get("TELECMI_AGENT_ID", "").strip()
    TELECMI_AGENT_PASSWORD = os.environ.get("TELECMI_AGENT_PASSWORD", "").strip()
    TELECMI_AGENT_TOKEN = os.environ.get("TELECMI_AGENT_TOKEN", "").strip()
    TELECMI_APP_ID = os.environ.get("TELECMI_APP_ID", "").strip()
    TELECMI_APP_SECRET = os.environ.get("TELECMI_APP_SECRET", "").strip()


class DevelopmentConfig(Config):
    ENV = "development"
    DEBUG = True
    _origins = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://localhost:5173,https://127.0.0.1:5173",
    )
    CORS_ORIGINS = [o.strip() for o in _origins.split(",") if o.strip()] or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
    ]


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
