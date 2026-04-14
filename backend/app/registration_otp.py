"""Email OTP for student registration — timing, hashing, limits (client spec v2.1)."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Any, Mapping

OTP_LENGTH = 6
OTP_EXPIRY_SECONDS = 600  # 10 minutes
RESEND_COOLDOWN_SECONDS = 30
MAX_WRONG_OTP_ATTEMPTS = 3
MAX_RESENDS = 3
LOCKOUT_MINUTES = 15


def generate_verification_id() -> str:
    return secrets.token_urlsafe(24)


def generate_otp_code() -> str:
    return f"{secrets.randbelow(900_000) + 100_000}"


def hash_otp(verification_id: str, otp: str, secret: str) -> str:
    msg = f"{verification_id}:{otp}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_otp_constant_time(verification_id: str, otp: str, secret: str, otp_hash: str) -> bool:
    expected = hash_otp(verification_id, otp, secret)
    return hmac.compare_digest(expected, otp_hash)


def utcnow() -> datetime:
    return datetime.utcnow()


def otp_expiry_utc() -> datetime:
    return utcnow() + timedelta(seconds=OTP_EXPIRY_SECONDS)


def lockout_until_utc() -> datetime:
    return utcnow() + timedelta(minutes=LOCKOUT_MINUTES)


def smtp_or_ses_configured(config: Mapping[str, Any]) -> bool:
    if (config.get("EMAIL_TRANSPORT") or "smtp").strip().lower() == "ses":
        return bool((config.get("SES_FROM_EMAIL") or "").strip())
    from app.email_smtp import smtp_configured

    return smtp_configured(config)
