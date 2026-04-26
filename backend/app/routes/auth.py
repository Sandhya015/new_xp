"""
Auth: register (student/company), login, me, refresh. JWT + MongoDB.
Uses werkzeug for password hashing (pure Python, no bcrypt native lib on Lambda).
"""
import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import quote
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash

from app.company_registration_validate import (
    normalized_company_to_user_payload,
    validate_company_registration,
)
from app.db import (
    get_company_registration_lockouts_collection,
    get_company_registration_verifications_collection,
    get_db,
    get_notifications_collection,
    get_password_reset_attempts_collection,
    get_password_reset_tokens_collection,
    get_registration_lockouts_collection,
    get_registration_verifications_collection,
    get_users_collection,
)
from app.email_smtp import send_company_registration_otp, send_password_reset_email, send_registration_otp
from app.whatsapp_otp import normalize_mobile_e164_in, send_whatsapp_otp, whatsapp_configured
from app.email_templates import public_app_url
from app.notifications import schedule_welcome_email
from app.registration_otp import (
    MAX_RESENDS,
    MAX_WRONG_OTP_ATTEMPTS,
    RESEND_COOLDOWN_SECONDS,
    generate_otp_code,
    generate_verification_id,
    hash_otp,
    lockout_until_utc,
    otp_expiry_utc,
    smtp_or_ses_configured,
    utcnow,
    verify_otp_constant_time,
)
from app.registration_validate import normalized_to_user_doc, validate_student_registration

auth_bp = Blueprint("auth", __name__)

# Werkzeug method (pbkdf2:sha256) — no native deps, works on Lambda
_PASSWORD_METHOD = "pbkdf2:sha256"

_PASSWORD_RESET_EXPIRY = timedelta(hours=1)
_MAX_FORGOT_ATTEMPTS_PER_HOUR = 5
_FORGOT_GENERIC_MESSAGE = (
    "If an account exists for that email, you will receive password reset instructions shortly."
)


def _hash_password_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _hash_password(password: str) -> str:
    return generate_password_hash(password, method=_PASSWORD_METHOD)


def _check_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    # Werkzeug (pbkdf2:sha256) — used for all new passwords
    if hashed.startswith("pbkdf2:") or hashed.startswith("scrypt:"):
        return check_password_hash(hashed, password)
    # Legacy bcrypt ($2b$/$2a$) — only if bcrypt is installed (e.g. local dev)
    if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
        try:
            import bcrypt
            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False
    # Fallback: treat as werkzeug
    return check_password_hash(hashed, password)


def _user_to_response(user: dict) -> dict:
    """Return safe user object for frontend (no password)."""
    out = {
        "id": str(user["_id"]),
        "name": user.get("name") or user.get("fullName") or "",
        "email": user.get("email", ""),
        "role": user.get("role", "student"),
        "companyName": user.get("companyName"),
        "hrName": user.get("hrName"),
    }
    if user.get("role") == "student":
        out["university"] = user.get("university") or ""
        out["course"] = user.get("course") or ""
        out["semester"] = user.get("semester") or ""
        out["stream"] = user.get("stream") or ""
        out["collegeName"] = user.get("collegeName") or ""
        m = user.get("mobile")
        if m:
            out["mobile"] = str(m)
    return out


def _validate_email(email: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def _validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    return True, ""


# ----- routes -----
def _registration_lockout_active(email: str):
    """Return lockedUntil datetime if email is locked; else None and clear stale lockout."""
    col = get_registration_lockouts_collection()
    doc = col.find_one({"email": email})
    if not doc:
        return None
    until = doc.get("lockedUntil")
    if until and until > utcnow():
        return until
    col.delete_one({"email": email})
    return None


def _set_registration_lockout(email: str) -> None:
    get_registration_lockouts_collection().update_one(
        {"email": email},
        {"$set": {"email": email, "lockedUntil": lockout_until_utc()}},
        upsert=True,
    )


def _company_registration_lockout_active(email: str):
    col = get_company_registration_lockouts_collection()
    doc = col.find_one({"email": email})
    if not doc:
        return None
    until = doc.get("lockedUntil")
    if until and until > utcnow():
        return until
    col.delete_one({"email": email})
    return None


def _set_company_registration_lockout(email: str) -> None:
    get_company_registration_lockouts_collection().update_one(
        {"email": email},
        {"$set": {"email": email, "lockedUntil": lockout_until_utc()}},
        upsert=True,
    )


def _notify_admins_company_pending_review(company_name: str, company_email: str) -> None:
    """In-app notification for admins (best-effort)."""
    try:
        coll = get_notifications_collection()
        users = get_users_collection()
        now = datetime.utcnow()
        msg = f"{company_name} ({company_email}) completed verification and is pending approval."
        for admin in users.find({"role": "admin"}):
            coll.insert_one({
                "userId": str(admin["_id"]),
                "type": "admin",
                "title": "New company registration",
                "message": msg,
                "read": False,
                "link": "/admin/companies?tab=pending",
                "createdAt": now,
            })
    except Exception:
        current_app.logger.exception("Failed to notify admins of new company registration")


@auth_bp.route("/register", methods=["POST"])
def register():
    """Student: validate, send OTP to email + WhatsApp (best-effort), return verificationId (no JWT)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    role = (data.get("role") or "student").strip().lower()
    if role == "company":
        return jsonify({
            "error": "Company sign-up uses email verification first. Use the Company tab on the register page.",
            "code": "use_company_register_endpoint",
        }), 400

    name = (data.get("name") or data.get("fullName") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not _validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    ok, msg = _validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400
    if data.get("confirmPassword") and data["confirmPassword"] != password:
        return jsonify({"error": "Passwords do not match"}), 400

    users = get_users_collection()
    if users.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists"}), 409

    if not data.get("acceptTerms"):
        return jsonify({
            "error": "You must accept the Terms & Conditions.",
            "fields": {"acceptTerms": "You must accept the Terms & Conditions."},
        }), 400

    lock_until = _registration_lockout_active(email)
    if lock_until:
        return jsonify({
            "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
            "lockedUntil": lock_until.isoformat() + "Z",
        }), 429

    field_errors, normalized = validate_student_registration(data)
    if field_errors:
        first = next(iter(field_errors.values()))
        return jsonify({"error": first, "fields": field_errors}), 400

    cfg = current_app.config
    if not smtp_or_ses_configured(cfg):
        current_app.logger.error("Student registration OTP skipped: email transport not configured")
        return jsonify({
            "error": "Email verification is temporarily unavailable. Please try again later.",
        }), 503

    assert normalized is not None
    user_payload = normalized_to_user_doc(normalized, _hash_password(normalized["password"]))
    otp = generate_otp_code()
    verification_id = generate_verification_id()
    secret = (cfg.get("SECRET_KEY") or "") or "dev-secret-change-in-production"
    otp_hash = hash_otp(verification_id, otp, secret)

    ver_col = get_registration_verifications_collection()
    ver_col.delete_many({"email": normalized["email"]})

    ver_col.insert_one({
        "verificationId": verification_id,
        "email": normalized["email"],
        "mobileE164": normalize_mobile_e164_in(normalized.get("mobile", "")) if isinstance(normalized, dict) else None,
        "otpHash": otp_hash,
        "expiresAt": otp_expiry_utc(),
        "wrongAttempts": 0,
        "resendCount": 0,
        "lastOtpSentAt": utcnow(),
        "userPayload": user_payload,
        "createdAt": datetime.utcnow(),
    })

    sent = send_registration_otp(cfg, normalized["fullName"], normalized["email"], otp)
    if not sent:
        ver_col.delete_one({"verificationId": verification_id})
        return jsonify({"error": "Could not send verification email. Please try again later."}), 503

    wa_sent = False
    try:
        if whatsapp_configured():
            m = normalize_mobile_e164_in(normalized.get("mobile", ""))
            if m:
                wa_sent = bool(send_whatsapp_otp(m, otp))
    except Exception:
        wa_sent = False

    return jsonify({
        "message": "OTP sent",
        "verificationId": verification_id,
        "expiresInSeconds": 600,
        "whatsappSent": wa_sent,
    }), 200


@auth_bp.route("/company/register", methods=["POST"])
def company_register():
    """Start company registration: validate fields, send OTP to company email (SMS/WhatsApp: future)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    channel = (data.get("otpChannel") or "email").strip().lower()
    if channel != "email":
        return jsonify({
            "error": "SMS and WhatsApp OTP are not enabled yet. Please choose Email.",
            "code": "otp_channel_unavailable",
        }), 400

    field_errors, normalized = validate_company_registration(data)
    if field_errors:
        return jsonify({"error": next(iter(field_errors.values())), "fields": field_errors}), 400

    assert normalized is not None
    email = normalized["email"]
    users = get_users_collection()
    if users.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists"}), 409

    lock_until = _company_registration_lockout_active(email)
    if lock_until:
        return jsonify({
            "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
            "lockedUntil": lock_until.isoformat() + "Z",
        }), 429

    cfg = current_app.config
    if not smtp_or_ses_configured(cfg):
        return jsonify({"error": "Email verification is temporarily unavailable. Please try again later."}), 503

    user_payload = normalized_company_to_user_payload(normalized, _hash_password(normalized["password"]))
    otp = generate_otp_code()
    verification_id = generate_verification_id()
    secret = (cfg.get("SECRET_KEY") or "") or "dev-secret-change-in-production"
    otp_hash = hash_otp(verification_id, otp, secret)

    ver_col = get_company_registration_verifications_collection()
    ver_col.delete_many({"email": email})

    ver_col.insert_one({
        "verificationId": verification_id,
        "email": email,
        "otpHash": otp_hash,
        "expiresAt": otp_expiry_utc(),
        "wrongAttempts": 0,
        "resendCount": 0,
        "lastOtpSentAt": utcnow(),
        "otpChannel": channel,
        "userPayload": user_payload,
        "createdAt": datetime.utcnow(),
    })

    sent = send_company_registration_otp(cfg, normalized["companyName"], email, otp)
    if not sent:
        ver_col.delete_one({"verificationId": verification_id})
        return jsonify({"error": "Could not send verification email. Please try again later."}), 503

    return jsonify({
        "message": "OTP sent",
        "verificationId": verification_id,
        "expiresInSeconds": 600,
    }), 200


@auth_bp.route("/company/register/verify-otp", methods=["POST"])
def company_register_verify_otp():
    """After OTP: create company user (pending admin). No JWT — company cannot log in until approved."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    verification_id = (data.get("verificationId") or "").strip()
    otp = (re.sub(r"\D", "", str(data.get("otp") or "")))[:6]
    if not verification_id or len(otp) != 6:
        return jsonify({"error": "verificationId and a 6-digit OTP are required."}), 400

    ver_col = get_company_registration_verifications_collection()
    doc = ver_col.find_one({"verificationId": verification_id})
    if not doc:
        return jsonify({"error": "Invalid or expired verification session. Please start registration again."}), 400

    lock_email = doc.get("email", "")
    lock_until = _company_registration_lockout_active(lock_email)
    if lock_until:
        return jsonify({
            "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
            "lockedUntil": lock_until.isoformat() + "Z",
        }), 429

    if doc.get("expiresAt") and doc["expiresAt"] < utcnow():
        return jsonify({"error": "OTP has expired.", "code": "otp_expired"}), 400

    secret = (current_app.config.get("SECRET_KEY") or "") or "dev-secret-change-in-production"
    if not verify_otp_constant_time(verification_id, otp, secret, doc.get("otpHash") or ""):
        wrong = int(doc.get("wrongAttempts") or 0) + 1
        remaining = max(0, MAX_WRONG_OTP_ATTEMPTS - wrong)
        if wrong >= MAX_WRONG_OTP_ATTEMPTS:
            ver_col.delete_one({"verificationId": verification_id})
            _set_company_registration_lockout(lock_email)
            return jsonify({
                "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
                "attemptsRemaining": 0,
            }), 400
        ver_col.update_one({"verificationId": verification_id}, {"$set": {"wrongAttempts": wrong}})
        return jsonify({
            "error": "Incorrect OTP. Please check and try again.",
            "attemptsRemaining": remaining,
        }), 400

    users = get_users_collection()
    payload = doc.get("userPayload") or {}
    email = (payload.get("email") or "").strip().lower()
    if users.find_one({"email": email}):
        ver_col.delete_one({"verificationId": verification_id})
        return jsonify({"error": "An account with this email already exists"}), 409

    company_name = payload.get("companyName") or payload.get("name") or "Company"
    insert_doc = {**payload, "createdAt": datetime.utcnow()}
    result = users.insert_one(insert_doc)
    ver_col.delete_one({"verificationId": verification_id})
    get_company_registration_lockouts_collection().delete_one({"email": email})

    _notify_admins_company_pending_review(str(company_name), email)

    return jsonify({
        "message": "Registration submitted! You will receive an email once your account is approved.",
    }), 201


@auth_bp.route("/company/register/resend-otp", methods=["POST"])
def company_register_resend_otp():
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    verification_id = (data.get("verificationId") or "").strip()
    if not verification_id:
        return jsonify({"error": "verificationId is required."}), 400

    ver_col = get_company_registration_verifications_collection()
    doc = ver_col.find_one({"verificationId": verification_id})
    if not doc:
        return jsonify({"error": "Invalid or expired verification session. Please start registration again."}), 400

    email = doc.get("email", "")
    lock_until = _company_registration_lockout_active(email)
    if lock_until:
        return jsonify({
            "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
            "lockedUntil": lock_until.isoformat() + "Z",
        }), 429

    if int(doc.get("resendCount") or 0) >= MAX_RESENDS:
        return jsonify({"error": "Maximum resend attempts reached. Please start registration again."}), 400

    last_sent = doc.get("lastOtpSentAt")
    if last_sent:
        delta = (utcnow() - last_sent).total_seconds()
        if delta < RESEND_COOLDOWN_SECONDS:
            retry = int(RESEND_COOLDOWN_SECONDS - delta) + 1
            return jsonify({
                "error": f"Please wait {retry}s before requesting another code.",
                "retryAfterSeconds": retry,
            }), 429

    cfg = current_app.config
    if not smtp_or_ses_configured(cfg):
        return jsonify({"error": "Email verification is temporarily unavailable."}), 503

    otp = generate_otp_code()
    secret = (cfg.get("SECRET_KEY") or "") or "dev-secret-change-in-production"
    otp_hash = hash_otp(verification_id, otp, secret)
    new_resend = int(doc.get("resendCount") or 0) + 1

    payload = doc.get("userPayload") or {}
    name = payload.get("companyName") or payload.get("name") or "Company"

    ver_col.update_one(
        {"verificationId": verification_id},
        {
            "$set": {
                "otpHash": otp_hash,
                "expiresAt": otp_expiry_utc(),
                "wrongAttempts": 0,
                "resendCount": new_resend,
                "lastOtpSentAt": utcnow(),
            },
        },
    )

    sent = send_company_registration_otp(cfg, str(name), str(email), otp)
    if not sent:
        return jsonify({"error": "Could not send verification email. Please try again later."}), 503

    return jsonify({"message": "OTP sent", "verificationId": verification_id}), 200


@auth_bp.route("/register/verify-otp", methods=["POST"])
def register_verify_otp():
    """Complete student registration after email OTP."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    verification_id = (data.get("verificationId") or "").strip()
    otp = (re.sub(r"\D", "", str(data.get("otp") or "")))[:6]
    if not verification_id or len(otp) != 6:
        return jsonify({"error": "verificationId and a 6-digit OTP are required."}), 400

    ver_col = get_registration_verifications_collection()
    doc = ver_col.find_one({"verificationId": verification_id})
    if not doc:
        return jsonify({"error": "Invalid or expired verification session. Please start registration again."}), 400

    lock_check_email = doc.get("email", "")
    lock_until = _registration_lockout_active(lock_check_email)
    if lock_until:
        return jsonify({
            "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
            "lockedUntil": lock_until.isoformat() + "Z",
        }), 429

    if doc.get("expiresAt") and doc["expiresAt"] < utcnow():
        return jsonify({"error": "OTP has expired.", "code": "otp_expired"}), 400

    secret = (current_app.config.get("SECRET_KEY") or "") or "dev-secret-change-in-production"
    if not verify_otp_constant_time(verification_id, otp, secret, doc.get("otpHash") or ""):
        wrong = int(doc.get("wrongAttempts") or 0) + 1
        remaining = max(0, MAX_WRONG_OTP_ATTEMPTS - wrong)
        if wrong >= MAX_WRONG_OTP_ATTEMPTS:
            ver_col.delete_one({"verificationId": verification_id})
            _set_registration_lockout(lock_check_email)
            return jsonify({
                "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
                "attemptsRemaining": 0,
            }), 400
        ver_col.update_one({"verificationId": verification_id}, {"$set": {"wrongAttempts": wrong}})
        return jsonify({
            "error": "Incorrect OTP. Please check and try again.",
            "attemptsRemaining": remaining,
        }), 400

    users = get_users_collection()
    payload = doc.get("userPayload") or {}
    email = (payload.get("email") or "").strip().lower()
    if users.find_one({"email": email}):
        ver_col.delete_one({"verificationId": verification_id})
        return jsonify({"error": "An account with this email already exists"}), 409

    insert_doc = {**payload, "createdAt": datetime.utcnow()}
    result = users.insert_one(insert_doc)
    ver_col.delete_one({"verificationId": verification_id})
    get_registration_lockouts_collection().delete_one({"email": email})

    user = {**insert_doc, "_id": result.inserted_id}
    user.pop("password", None)
    display_name = user.get("name") or user.get("fullName") or "there"

    if os.environ.get("REGISTER_SKIP_WELCOME_EMAIL", "").strip().lower() not in ("1", "true", "yes"):
        schedule_welcome_email(current_app._get_current_object(), display_name, email)

    token = create_access_token(
        identity=str(result.inserted_id),
        additional_claims={"email": email, "role": "student"},
    )
    return jsonify({
        "message": "Account created successfully! Welcome to XpertIntern.",
        "token": token,
        "user": _user_to_response(user),
    }), 201


@auth_bp.route("/register/resend-otp", methods=["POST"])
def register_resend_otp():
    """Send a new OTP for the same verification session (max 3 resends, 30s cooldown). Email required; WhatsApp best-effort."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    verification_id = (data.get("verificationId") or "").strip()
    if not verification_id:
        return jsonify({"error": "verificationId is required."}), 400

    ver_col = get_registration_verifications_collection()
    doc = ver_col.find_one({"verificationId": verification_id})
    if not doc:
        return jsonify({"error": "Invalid or expired verification session. Please start registration again."}), 400

    email = doc.get("email", "")
    lock_until = _registration_lockout_active(email)
    if lock_until:
        return jsonify({
            "error": "Too many incorrect attempts. Please wait 15 minutes and try again.",
            "lockedUntil": lock_until.isoformat() + "Z",
        }), 429

    if int(doc.get("resendCount") or 0) >= MAX_RESENDS:
        return jsonify({"error": "Maximum resend attempts reached. Please start registration again."}), 400

    last_sent = doc.get("lastOtpSentAt")
    if last_sent:
        delta = (utcnow() - last_sent).total_seconds()
        if delta < RESEND_COOLDOWN_SECONDS:
            retry = int(RESEND_COOLDOWN_SECONDS - delta) + 1
            return jsonify({
                "error": f"Please wait {retry}s before requesting another code.",
                "retryAfterSeconds": retry,
            }), 429

    cfg = current_app.config
    if not smtp_or_ses_configured(cfg):
        return jsonify({"error": "Email verification is temporarily unavailable."}), 503

    otp = generate_otp_code()
    secret = (cfg.get("SECRET_KEY") or "") or "dev-secret-change-in-production"
    otp_hash = hash_otp(verification_id, otp, secret)
    new_resend = int(doc.get("resendCount") or 0) + 1

    payload = doc.get("userPayload") or {}
    name = payload.get("fullName") or payload.get("name") or "there"

    ver_col.update_one(
        {"verificationId": verification_id},
        {
            "$set": {
                "otpHash": otp_hash,
                "expiresAt": otp_expiry_utc(),
                "wrongAttempts": 0,
                "resendCount": new_resend,
                "lastOtpSentAt": utcnow(),
            },
        },
    )

    sent = send_registration_otp(cfg, str(name), str(email), otp)
    if not sent:
        return jsonify({"error": "Could not send verification email. Please try again later."}), 503

    wa_sent = False
    try:
        if whatsapp_configured():
            m = doc.get("mobileE164") or normalize_mobile_e164_in((payload.get("mobile") or ""))
            if m:
                wa_sent = bool(send_whatsapp_otp(str(m), otp))
    except Exception:
        wa_sent = False

    return jsonify({"message": "OTP sent", "verificationId": verification_id, "whatsappSent": wa_sent}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """
    Request a password reset email. Same response whether or not the email exists (enumeration-safe).
    Rate-limited per email when an account exists.
    """
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email or not _validate_email(email):
        return jsonify({"error": "Please enter a valid email address."}), 400

    users = get_users_collection()
    user = users.find_one({"email": email})

    if not user:
        return jsonify({"message": _FORGOT_GENERIC_MESSAGE}), 200

    att_col = get_password_reset_attempts_collection()
    hour_ago = utcnow() - timedelta(hours=1)
    recent = att_col.count_documents({"email": email, "createdAt": {"$gte": hour_ago}})
    if recent >= _MAX_FORGOT_ATTEMPTS_PER_HOUR:
        current_app.logger.warning("Forgot-password rate limit for %s", email)
        return jsonify({"message": _FORGOT_GENERIC_MESSAGE}), 200

    cfg = current_app.config
    if not smtp_or_ses_configured(cfg):
        # Same body as success to avoid revealing whether the email is registered.
        current_app.logger.error("Forgot-password: email transport not configured (reset email not sent)")
        return jsonify({"message": _FORGOT_GENERIC_MESSAGE}), 200

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_password_reset_token(raw_token)
    expires_at = utcnow() + _PASSWORD_RESET_EXPIRY

    tok_col = get_password_reset_tokens_collection()
    tok_col.delete_many({"email": email, "used": {"$ne": True}})

    insert_res = tok_col.insert_one({
        "tokenHash": token_hash,
        "email": email,
        "expiresAt": expires_at,
        "used": False,
        "createdAt": datetime.utcnow(),
    })

    base = public_app_url().rstrip("/")
    reset_url = f"{base}/reset-password?token={quote(raw_token, safe='')}"

    display_name = (
        user.get("name")
        or user.get("fullName")
        or user.get("companyName")
        or email.split("@", 1)[0]
    )

    sent = send_password_reset_email(cfg, str(display_name), email, reset_url)
    if not sent:
        tok_col.delete_one({"_id": insert_res.inserted_id})
        current_app.logger.error("Forgot-password: send_password_reset_email failed for %s", email)
        return jsonify({"message": _FORGOT_GENERIC_MESSAGE}), 200

    att_col.insert_one({"email": email, "createdAt": datetime.utcnow()})
    return jsonify({"message": _FORGOT_GENERIC_MESSAGE}), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Complete password reset using token from email link (single use, 1 hour)."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    raw_token = (data.get("token") or "").strip()
    new_pw = (data.get("newPassword") or data.get("new_password") or "").strip()
    confirm = (data.get("confirmPassword") or data.get("confirm_password") or "").strip()

    if len(raw_token) < 24:
        return jsonify({"error": "This reset link is invalid or has expired. Please request a new one."}), 400
    if not new_pw:
        return jsonify({"error": "New password is required"}), 400
    if new_pw != confirm:
        return jsonify({"error": "Passwords do not match"}), 400
    ok, msg = _validate_password(new_pw)
    if not ok:
        return jsonify({"error": msg}), 400

    token_hash = _hash_password_reset_token(raw_token)
    tok_col = get_password_reset_tokens_collection()
    doc = tok_col.find_one_and_update(
        {
            "tokenHash": token_hash,
            "used": False,
            "expiresAt": {"$gt": utcnow()},
        },
        {"$set": {"used": True, "usedAt": datetime.utcnow()}},
    )
    if not doc:
        return jsonify({"error": "This reset link is invalid or has expired. Please request a new one."}), 400

    email = (doc.get("email") or "").strip().lower()
    users = get_users_collection()
    user = users.find_one({"email": email})
    if not user:
        tok_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "This reset link is invalid or has expired. Please request a new one."}), 400

    users.update_one({"_id": user["_id"]}, {"$set": {"password": _hash_password(new_pw)}})
    tok_col.delete_one({"_id": doc["_id"]})
    tok_col.delete_many({"email": email, "used": {"$ne": True}})
    return jsonify({"message": "Your password has been updated. You can sign in with your new password."}), 200


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login with email and password. Returns JWT and user."""
    try:
        db = get_db()
        if db is None:
            return jsonify({"error": "Database not configured"}), 503

        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        users = get_users_collection()
        user = users.find_one({"email": email})
        if not user or not _check_password(password, user.get("password", "")):
            return jsonify({"error": "Invalid email or password"}), 401

        if user.get("role") == "admin":
            return jsonify({
                "error": "Admin accounts must sign in via the Admin portal.",
                "code": "admin_use_admin_portal",
            }), 403

        if user.get("role") == "company":
            st = user.get("status")
            if st == "pending":
                return jsonify({
                    "error": "Your company registration is pending admin approval. We will email you when you can sign in.",
                    "code": "company_pending_approval",
                }), 403
            if st == "rejected":
                return jsonify({
                    "error": "Your company application was not approved. Check your email for details.",
                    "code": "company_rejected",
                }), 403

        token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={"email": user["email"], "role": user.get("role", "student")},
        )
        return jsonify({
            "token": token,
            "user": _user_to_response(user),
        })
    except Exception as e:
        current_app.logger.exception("Login error")
        err_msg = "Login failed. Please try again."
        if current_app.config.get("DEBUG"):
            err_msg = str(e)
        return jsonify({"error": err_msg}), 500


@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    """Dedicated admin panel sign-in: only ADMIN_PANEL_ALLOWED_EMAIL, role admin, correct password."""
    try:
        db = get_db()
        if db is None:
            return jsonify({"error": "Database not configured"}), 503

        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        allowed = (current_app.config.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        if email != allowed:
            return jsonify({"error": "Invalid admin credentials."}), 401

        users = get_users_collection()
        user = users.find_one({"email": email})
        if not user or not _check_password(password, user.get("password", "")):
            return jsonify({"error": "Invalid admin credentials."}), 401

        if user.get("role") != "admin":
            return jsonify({"error": "Invalid admin credentials."}), 401

        token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={
                "email": user["email"],
                "role": "admin",
                "admin_portal": True,
            },
        )
        return jsonify({"token": token, "user": _user_to_response(user)})
    except Exception as e:
        current_app.logger.exception("Admin login error")
        err_msg = "Login failed. Please try again."
        if current_app.config.get("DEBUG"):
            err_msg = str(e)
        return jsonify({"error": err_msg}), 500


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return current user from JWT."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    from bson import ObjectId
    user_id = get_jwt_identity()
    try:
        users = get_users_collection()
        user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return jsonify({"error": "Invalid token"}), 401
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(_user_to_response(user))


@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    """Update current user profile (SD-WF-17)."""
    from bson import ObjectId
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    users = get_users_collection()
    allowed = {
        "name", "fullName", "mobile", "university", "universityOther", "collegeName", "semester",
        "course", "courseOther", "stream", "branch", "branchOther", "subject", "subjectOther",
        "collegeRegNo", "linkedin", "dateOfBirth", "gender",
        "alternateContact", "cgpa", "percentage",
    }
    updates = {k: (data.get(k) if data.get(k) is not None else None) for k in allowed if k in data}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    if "name" in updates and updates["name"]:
        updates["fullName"] = updates["name"]
    users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    user = users.find_one({"_id": ObjectId(user_id)})
    return jsonify(_user_to_response(user))


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Change password (SD-WF-18). Requires current password."""
    from bson import ObjectId
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    current = (data.get("currentPassword") or data.get("current_password") or "").strip()
    new_pw = (data.get("newPassword") or data.get("new_password") or "").strip()
    if not current:
        return jsonify({"error": "Current password is required"}), 400
    if not new_pw:
        return jsonify({"error": "New password is required"}), 400
    ok, msg = _validate_password(new_pw)
    if not ok:
        return jsonify({"error": msg}), 400
    users = get_users_collection()
    user = users.find_one({"_id": ObjectId(user_id)})
    if not user or not _check_password(current, user.get("password", "")):
        return jsonify({"error": "Current password is incorrect"}), 401
    users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": _hash_password(new_pw)}},
    )
    return jsonify({"message": "Password updated successfully"})


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required()
def refresh():
    """Issue a new access token (same identity)."""
    identity = get_jwt_identity()
    claims = get_jwt()
    extra = {"email": claims.get("email"), "role": claims.get("role", "student")}
    if claims.get("admin_portal") is True:
        extra["admin_portal"] = True
    token = create_access_token(identity=identity, additional_claims=extra)
    return jsonify({"token": token})
