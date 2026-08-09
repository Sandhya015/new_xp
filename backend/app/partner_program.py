"""
Affiliate / Partner program — applications, partners, referral links, coupons,
tracking, commissions, and payouts.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import string
from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from werkzeug.security import generate_password_hash

from app.db import get_db

logger = logging.getLogger(__name__)

HOLD_DAYS = 15
MIN_PAYOUT_INR = 500
REF_COOKIE = "xpi_ref"
REF_COOKIE_DAYS = 30
APP_PREFIX = "APP"
PARTNER_PREFIX = "XPR"

PARTNER_TYPES = [
    "College",
    "Coaching Institute",
    "Influencer",
    "YouTuber",
    "Student Community",
    "Individual",
    "Other",
]

AUDIENCE_SIZES = ["Under 1k", "1k–10k", "10k–50k", "50k–1L", "1L+"]
HEAR_ABOUT = ["Google", "Instagram", "YouTube", "Friend", "Other"]
REJECT_REASONS = [
    "Incomplete information",
    "Not aligned with our audience",
    "Duplicate",
    "Suspicious",
    "Other",
    "No response",
]

# Lightweight disposable domain blocklist (expand as needed)
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
    "trashmail.com", "yopmail.com", "sharklasers.com", "getnada.com",
    "temp-mail.org", "throwaway.email", "fakeinbox.com",
}


def coll(name: str):
    db = get_db()
    if db is None:
        raise RuntimeError("Database not configured")
    return db[name]


def partners_coll():
    return coll("partners")


def applications_coll():
    return coll("partner_applications")


def links_coll():
    return coll("partner_referral_links")


def coupons_coll():
    return coll("partner_coupons")


def clicks_coll():
    return coll("partner_clicks")


def commissions_coll():
    return coll("partner_commissions")


def payouts_coll():
    return coll("partner_payouts")


def otp_coll():
    return coll("partner_otps")


def is_disposable_email(email: str) -> bool:
    domain = (email or "").strip().lower().split("@")[-1]
    return domain in DISPOSABLE_EMAIL_DOMAINS


def _next_seq(kind: str, year: int) -> int:
    """Atomic yearly counters for APP / XPR / PO ids."""
    from pymongo import ReturnDocument

    db = get_db()
    if db is None:
        return 1
    key = f"{kind}-{year}"
    res = db["counters"].find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int((res or {}).get("seq") or 1)


def allocate_application_ref() -> str:
    year = datetime.utcnow().year
    n = _next_seq("APP", year)
    return f"{APP_PREFIX}-{year}-{n:05d}"


def allocate_partner_code() -> str:
    year = datetime.utcnow().year
    n = _next_seq("XPR", year)
    return f"{PARTNER_PREFIX}-{year}-{n:04d}"


def allocate_payout_id() -> str:
    year = datetime.utcnow().year
    n = _next_seq("PO", year)
    return f"PO-{year}-{n:05d}"


def gen_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def gen_slug(n: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits[-10:] if len(digits) >= 10 else digits


def pub_url(config, path: str = "") -> str:
    base = (config.get("PUBLIC_APP_URL") or "").strip().rstrip("/")
    if not base:
        base = "https://www.xpertintern.com"
    if not path:
        return base
    return f"{base}{path if path.startswith('/') else '/' + path}"


def partner_login_url(config) -> str:
    return pub_url(config, "/partner/login")


# ── OTP for public application ──────────────────────────────────────────────

def send_partner_otp(*, channel: str, target: str, config) -> tuple[str | None, str | None]:
    """channel: email | phone. Returns (verification_id, error)."""
    from app.registration_otp import generate_otp_code, generate_verification_id, hash_otp, otp_expiry_utc
    from app.email_smtp import send_email

    target = (target or "").strip().lower() if channel == "email" else normalize_phone(target)
    if not target:
        return None, "Missing target"
    if channel == "email" and is_disposable_email(target):
        return None, "Disposable email addresses are not allowed"

    vid = generate_verification_id()
    code = generate_otp_code()
    secret = (config.get("SECRET_KEY") or "xpertintern")[:64]
    doc = {
        "verificationId": vid,
        "channel": channel,
        "target": target,
        "otpHash": hash_otp(vid, code, secret),
        "expiresAt": otp_expiry_utc(),
        "attempts": 0,
        "verified": False,
        "createdAt": datetime.utcnow(),
    }
    otp_coll().insert_one(doc)

    if channel == "email":
        from app.email_smtp import smtp_configured
        if not smtp_configured(config) and (config.get("EMAIL_TRANSPORT") or "").lower() != "ses":
            # Dev/fallback: store plain for logs only in non-prod
            logger.info("Partner OTP for %s = %s (email not configured)", target, code)
        send_email(
            config,
            target,
            "Your XpertIntern Partner verification code",
            f"<p>Your verification code is <strong>{code}</strong>.</p><p>Valid for 10 minutes.</p>",
            text_body=f"Your verification code is {code}. Valid for 10 minutes.",
        )
    else:
        # Phone OTP: deliver as email log / WhatsApp if available; always accept when verified server-side
        try:
            from app.whatsapp_otp import send_whatsapp_otp
            send_whatsapp_otp(config, target, code)
        except Exception:
            logger.info("Partner phone OTP for %s = %s (WhatsApp failed/unavailable)", target, code)

    return vid, None


def verify_partner_otp(*, verification_id: str, otp: str, config) -> tuple[bool, str | None]:
    from app.registration_otp import verify_otp_constant_time, MAX_WRONG_OTP_ATTEMPTS

    doc = otp_coll().find_one({"verificationId": verification_id})
    if not doc:
        return False, "Invalid verification session"
    if doc.get("verified"):
        return True, None
    if doc.get("expiresAt") and datetime.utcnow() > doc["expiresAt"]:
        return False, "OTP expired"
    if int(doc.get("attempts") or 0) >= MAX_WRONG_OTP_ATTEMPTS:
        return False, "Too many wrong attempts"
    secret = (config.get("SECRET_KEY") or "xpertintern")[:64]
    ok = verify_otp_constant_time(verification_id, (otp or "").strip(), secret, doc.get("otpHash") or "")
    if not ok:
        otp_coll().update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        return False, "Incorrect OTP"
    otp_coll().update_one({"_id": doc["_id"]}, {"$set": {"verified": True, "verifiedAt": datetime.utcnow()}})
    return True, None


def otp_is_verified(verification_id: str, target: str, channel: str) -> bool:
    t = (target or "").strip().lower() if channel == "email" else normalize_phone(target)
    doc = otp_coll().find_one({"verificationId": verification_id, "verified": True})
    if not doc:
        return False
    return (doc.get("target") or "") == t and (doc.get("channel") or "") == channel


# ── Applications ────────────────────────────────────────────────────────────

def can_apply(*, email: str, phone: str, ip: str) -> str | None:
    email = (email or "").strip().lower()
    phone = normalize_phone(phone)
    now = datetime.utcnow()

    if is_disposable_email(email):
        return "Disposable email addresses are not allowed."

    # IP rate: 5 / day
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    ip_count = applications_coll().count_documents({"ip": ip, "createdAt": {"$gte": day_start}})
    if ip and ip_count >= 5:
        return "Too many applications from this network today. Please try again tomorrow."

    # Email active application in last 30 days
    since = now - timedelta(days=30)
    active = applications_coll().find_one({
        "email": email,
        "createdAt": {"$gte": since},
        "status": {"$in": ["submitted", "under_review", "needs_more_info", "approved"]},
    })
    if active:
        if active.get("status") == "approved":
            return "This email is already linked to a partner account."
        return "You already have an application under review."

    # 90-day re-apply block after reject
    reject_since = now - timedelta(days=90)
    rejected = applications_coll().find_one({
        "$or": [{"email": email}, {"phone": phone}],
        "status": "rejected",
        "rejectedAt": {"$gte": reject_since},
    })
    if rejected:
        return "You applied recently. Please try again after 90 days."

    # Phone used by approved partner
    if phone and partners_coll().find_one({"phone": phone, "status": {"$ne": "deleted"}}):
        return "This phone number is already registered to a partner."

    return None


def create_application(data: dict, *, ip: str, user_agent: str) -> dict:
    ref = allocate_application_ref()
    now = datetime.utcnow()
    doc = {
        "applicationId": ref,
        "status": "submitted",
        "fullName": (data.get("fullName") or "").strip(),
        "email": (data.get("email") or "").strip().lower(),
        "phone": normalize_phone(data.get("phone") or ""),
        "city": (data.get("city") or "").strip(),
        "state": (data.get("state") or "").strip(),
        "country": (data.get("country") or "India").strip(),
        "partnerType": (data.get("partnerType") or "").strip(),
        "organisationName": (data.get("organisationName") or "").strip(),
        "websiteUrl": (data.get("websiteUrl") or "").strip(),
        "instagram": (data.get("instagram") or "").strip(),
        "youtube": (data.get("youtube") or "").strip(),
        "linkedin": (data.get("linkedin") or "").strip(),
        "audienceSize": (data.get("audienceSize") or "").strip(),
        "priorAffiliateExperience": bool(data.get("priorAffiliateExperience")),
        "promotePlan": (data.get("promotePlan") or "").strip(),
        "whyPartner": (data.get("whyPartner") or "").strip()[:300],
        "referredBy": (data.get("referredBy") or "").strip(),
        "heardAbout": (data.get("heardAbout") or "").strip(),
        "ip": ip or "",
        "userAgent": (user_agent or "")[:400],
        "internalNotes": "",
        "history": [{
            "at": now,
            "action": "submitted",
            "by": "applicant",
            "note": "Application submitted",
        }],
        "createdAt": now,
        "updatedAt": now,
        "partnerId": None,
        "partnerCode": "",
    }
    applications_coll().insert_one(doc)
    return doc


def append_app_history(app_id: ObjectId, action: str, by: str, note: str = "") -> None:
    applications_coll().update_one(
        {"_id": app_id},
        {
            "$push": {"history": {"at": datetime.utcnow(), "action": action, "by": by, "note": note[:2000]}},
            "$set": {"updatedAt": datetime.utcnow()},
        },
    )


def serialize_application(doc: dict, *, public: bool = False) -> dict:
    created = doc.get("createdAt")
    out = {
        "id": str(doc.get("_id", "")),
        "applicationId": doc.get("applicationId") or "",
        "status": doc.get("status") or "",
        "fullName": doc.get("fullName") or "",
        "email": doc.get("email") or "" if not public else _mask_email(doc.get("email") or ""),
        "phone": doc.get("phone") or "" if not public else _mask_phone(doc.get("phone") or ""),
        "city": doc.get("city") or "",
        "state": doc.get("state") or "",
        "country": doc.get("country") or "",
        "partnerType": doc.get("partnerType") or "",
        "organisationName": doc.get("organisationName") or "",
        "websiteUrl": doc.get("websiteUrl") or "",
        "instagram": doc.get("instagram") or "",
        "youtube": doc.get("youtube") or "",
        "linkedin": doc.get("linkedin") or "",
        "audienceSize": doc.get("audienceSize") or "",
        "priorAffiliateExperience": bool(doc.get("priorAffiliateExperience")),
        "promotePlan": doc.get("promotePlan") or "",
        "whyPartner": doc.get("whyPartner") or "",
        "referredBy": doc.get("referredBy") or "",
        "heardAbout": doc.get("heardAbout") or "",
        "createdAt": created.strftime("%Y-%m-%d %H:%M UTC") if hasattr(created, "strftime") else str(created or ""),
        "partnerCode": doc.get("partnerCode") or "",
        "adminQuestion": doc.get("adminQuestion") or "",
        "rejectReasonShared": doc.get("rejectReasonShared") or "",
        "expectedTurnaroundDays": 3,
    }
    if not public:
        out.update({
            "email": doc.get("email") or "",
            "phone": doc.get("phone") or "",
            "ip": doc.get("ip") or "",
            "userAgent": doc.get("userAgent") or "",
            "internalNotes": doc.get("internalNotes") or "",
            "history": [
                {
                    "at": h.get("at").strftime("%Y-%m-%d %H:%M UTC") if hasattr(h.get("at"), "strftime") else str(h.get("at") or ""),
                    "action": h.get("action") or "",
                    "by": h.get("by") or "",
                    "note": h.get("note") or "",
                }
                for h in (doc.get("history") or [])
            ],
            "partnerId": str(doc.get("partnerId") or "") if doc.get("partnerId") else "",
        })
    return out


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[0]}{local[1]}***@{domain}"


def _mask_phone(phone: str) -> str:
    p = re.sub(r"\D", "", phone)
    if len(p) < 4:
        return "***"
    return f"{p[:2]}******{p[-2:]}"


def mask_student_name(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "Student"
    first = parts[0]
    if len(parts) == 1:
        return first[:3] + "***" if len(first) > 3 else first
    return f"{first} {parts[-1][0]}***"


# ── Partner account ─────────────────────────────────────────────────────────

def create_partner_from_fields(
    fields: dict,
    *,
    config,
    commission_percent: float,
    source: str = "application",
    application_id: str | None = None,
    welcome_message: str = "",
) -> tuple[dict, str]:
    """Create user + partner. Returns (partner_doc, temp_password)."""
    from app.db import get_users_collection
    from app.email_smtp import send_email

    email = (fields.get("email") or "").strip().lower()
    temp = gen_temp_password()
    code = allocate_partner_code()
    now = datetime.utcnow()

    users = get_users_collection()
    existing = users.find_one({"email": email})
    if existing:
        # Reuse existing non-admin account only if not already partner-bound
        if (existing.get("role") or "") == "admin":
            raise ValueError("Cannot convert admin email to partner")
        users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "role": "partner",
                    "password": generate_password_hash(temp, method="pbkdf2:sha256"),
                    "forcePasswordChange": True,
                    "name": fields.get("fullName") or existing.get("name") or "",
                    "mobile": fields.get("phone") or existing.get("mobile") or "",
                    "updatedAt": now,
                    "partnerCode": code,
                    "accountStatus": "active",
                }
            },
        )
        user_id = existing["_id"]
    else:
        res = users.insert_one({
            "email": email,
            "password": generate_password_hash(temp, method="pbkdf2:sha256"),
            "role": "partner",
            "name": fields.get("fullName") or "",
            "mobile": fields.get("phone") or "",
            "forcePasswordChange": True,
            "accountStatus": "active",
            "partnerCode": code,
            "createdAt": now,
            "updatedAt": now,
        })
        user_id = res.inserted_id

    partner = {
        "partnerCode": code,
        "userId": str(user_id),
        "fullName": fields.get("fullName") or "",
        "email": email,
        "phone": normalize_phone(fields.get("phone") or ""),
        "partnerType": fields.get("partnerType") or "Individual",
        "organisationName": fields.get("organisationName") or "",
        "city": fields.get("city") or "",
        "state": fields.get("state") or "",
        "country": fields.get("country") or "India",
        "commissionPercent": float(commission_percent),
        "pan": fields.get("pan") or "",
        "bank": {
            "accountHolder": (fields.get("bank") or {}).get("accountHolder") or fields.get("accountHolder") or "",
            "accountNumber": (fields.get("bank") or {}).get("accountNumber") or fields.get("accountNumber") or "",
            "ifsc": (fields.get("bank") or {}).get("ifsc") or fields.get("ifsc") or "",
            "bankName": (fields.get("bank") or {}).get("bankName") or fields.get("bankName") or "",
        },
        "upiId": fields.get("upiId") or "",
        "bankPendingApproval": None,
        "status": "active",
        "notes": fields.get("notes") or "",
        "applicationId": application_id,
        "source": source,
        "websiteUrl": fields.get("websiteUrl") or "",
        "instagram": fields.get("instagram") or "",
        "youtube": fields.get("youtube") or "",
        "linkedin": fields.get("linkedin") or "",
        "createdAt": now,
        "updatedAt": now,
        "totalClicks": 0,
        "totalSignups": 0,
        "totalSuccessful": 0,
        "totalEarnings": 0.0,
        "totalPaid": 0.0,
    }
    res = partners_coll().insert_one(partner)
    partner["_id"] = res.inserted_id
    users.update_one({"_id": user_id}, {"$set": {"partnerMongoId": str(res.inserted_id)}})

    login_url = partner_login_url(config)
    msg = welcome_message or "Welcome to the XpertIntern Partner Program."
    send_email(
        config,
        email,
        "Welcome to XpertIntern Partner Program!",
        (
            f"<p>Congratulations {partner['fullName']}!</p>"
            f"<p>{msg}</p>"
            f"<p><strong>Partner ID:</strong> {code}</p>"
            f"<p><strong>Login:</strong> <a href=\"{login_url}\">{login_url}</a></p>"
            f"<p><strong>Temporary password:</strong> {temp}</p>"
            f"<p>You will be asked to change your password on first login.</p>"
            f"<p><strong>Quick start:</strong> 1) Log in 2) Copy your referral links from My Links "
            f"3) Share coupons from My Coupons 4) Track earnings on Overview.</p>"
        ),
        text_body=(
            f"Welcome! Partner ID: {code}\nLogin: {login_url}\nTemporary password: {temp}\n"
            "Change password on first login."
        ),
    )
    return partner, temp


def serialize_partner(doc: dict) -> dict:
    created = doc.get("createdAt")
    return {
        "id": str(doc.get("_id", "")),
        "partnerCode": doc.get("partnerCode") or "",
        "userId": doc.get("userId") or "",
        "fullName": doc.get("fullName") or "",
        "email": doc.get("email") or "",
        "phone": doc.get("phone") or "",
        "partnerType": doc.get("partnerType") or "",
        "organisationName": doc.get("organisationName") or "",
        "city": doc.get("city") or "",
        "state": doc.get("state") or "",
        "country": doc.get("country") or "",
        "commissionPercent": float(doc.get("commissionPercent") or 0),
        "pan": doc.get("pan") or "",
        "bank": doc.get("bank") or {},
        "upiId": doc.get("upiId") or "",
        "bankPendingApproval": doc.get("bankPendingApproval"),
        "status": doc.get("status") or "active",
        "notes": doc.get("notes") or "",
        "applicationId": doc.get("applicationId") or "",
        "source": doc.get("source") or "",
        "createdAt": created.strftime("%Y-%m-%d %H:%M UTC") if hasattr(created, "strftime") else str(created or ""),
        "totalClicks": int(doc.get("totalClicks") or 0),
        "totalSignups": int(doc.get("totalSignups") or 0),
        "totalSuccessful": int(doc.get("totalSuccessful") or 0),
        "totalEarnings": float(doc.get("totalEarnings") or 0),
        "totalPaid": float(doc.get("totalPaid") or 0),
    }


def get_partner_by_user_id(user_id: str) -> dict | None:
    if not user_id:
        return None
    return partners_coll().find_one({"userId": str(user_id), "status": {"$ne": "deleted"}})


def get_partner_by_code(code: str) -> dict | None:
    return partners_coll().find_one({
        "partnerCode": (code or "").strip().upper(),
        "status": "active",
    })


# ── Referral links ──────────────────────────────────────────────────────────

def create_referral_link(partner: dict, data: dict, *, config) -> dict:
    slug = (data.get("customSlug") or "").strip().upper() or gen_slug(8)
    slug = re.sub(r"[^A-Z0-9\-]", "", slug)[:32] or gen_slug(8)
    full_slug = f"{partner['partnerCode']}-{slug}"
    if links_coll().find_one({"slug": full_slug}):
        full_slug = f"{partner['partnerCode']}-{gen_slug(8)}"

    link_type = (data.get("linkType") or "site_wide").strip().lower()
    if link_type not in ("site_wide", "training"):
        link_type = "site_wide"
    training_id = (data.get("trainingId") or "").strip()
    if link_type == "training" and not training_id:
        raise ValueError("Training is required for training-specific links")

    override = data.get("commissionOverride")
    now = datetime.utcnow()
    base = pub_url(config, "/")
    if link_type == "training" and training_id:
        path = f"/training/{training_id}?ref={full_slug}"
        url = pub_url(config, path)
    else:
        url = f"{base}?ref={full_slug}"

    doc = {
        "partnerId": str(partner["_id"]),
        "partnerCode": partner.get("partnerCode") or "",
        "label": (data.get("label") or "").strip() or "Referral link",
        "linkType": link_type,
        "trainingId": training_id,
        "trainingTitle": (data.get("trainingTitle") or "").strip(),
        "slug": full_slug,
        "url": url,
        "commissionOverride": float(override) if override not in (None, "") else None,
        "validFrom": data.get("validFrom") or None,
        "validTill": data.get("validTill") or None,
        "active": bool(data.get("active", True)),
        "clicks": 0,
        "uniqueVisitors": 0,
        "signups": 0,
        "paymentsCreated": 0,
        "paymentsSuccess": 0,
        "earnings": 0.0,
        "createdAt": now,
        "updatedAt": now,
    }
    res = links_coll().insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


def serialize_link(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id", "")),
        "partnerId": doc.get("partnerId") or "",
        "partnerCode": doc.get("partnerCode") or "",
        "label": doc.get("label") or "",
        "linkType": doc.get("linkType") or "",
        "trainingId": doc.get("trainingId") or "",
        "trainingTitle": doc.get("trainingTitle") or "",
        "slug": doc.get("slug") or "",
        "url": doc.get("url") or "",
        "commissionOverride": doc.get("commissionOverride"),
        "validFrom": doc.get("validFrom") or "",
        "validTill": doc.get("validTill") or "",
        "active": bool(doc.get("active", True)),
        "clicks": int(doc.get("clicks") or 0),
        "uniqueVisitors": int(doc.get("uniqueVisitors") or 0),
        "signups": int(doc.get("signups") or 0),
        "paymentsCreated": int(doc.get("paymentsCreated") or 0),
        "paymentsSuccess": int(doc.get("paymentsSuccess") or 0),
        "earnings": float(doc.get("earnings") or 0),
        "createdAt": doc.get("createdAt").strftime("%Y-%m-%d") if hasattr(doc.get("createdAt"), "strftime") else "",
    }


def resolve_active_link(slug: str) -> dict | None:
    slug = (slug or "").strip().upper()
    if not slug:
        return None
    link = links_coll().find_one({"slug": slug, "active": True})
    if not link:
        return None
    # validity window if set
    today = datetime.utcnow().strftime("%Y-%m-%d")
    vf = str(link.get("validFrom") or "")[:10]
    vt = str(link.get("validTill") or "")[:10]
    if vf and today < vf:
        return None
    if vt and today > vt:
        return None
    partner = partners_coll().find_one({"_id": ObjectId(link["partnerId"])}) if ObjectId.is_valid(str(link.get("partnerId"))) else None
    if not partner or partner.get("status") != "active":
        return None
    return link


def record_click(*, slug: str, ip: str, user_agent: str, source: str = "") -> dict | None:
    link = resolve_active_link(slug)
    if not link:
        return None
    now = datetime.utcnow()
    day = now.strftime("%Y-%m-%d")
    ua = (user_agent or "")[:400]
    unique_key = hashlib.sha256(f"{ip}|{ua}|{day}|{link['_id']}".encode()).hexdigest()[:32]
    is_new_unique = not clicks_coll().find_one({"uniqueKey": unique_key})
    clicks_coll().insert_one({
        "linkId": str(link["_id"]),
        "partnerId": link.get("partnerId"),
        "slug": link.get("slug"),
        "ip": ip or "",
        "userAgent": ua,
        "source": source or "",
        "uniqueKey": unique_key,
        "createdAt": now,
    })
    inc = {"clicks": 1}
    if is_new_unique:
        inc["uniqueVisitors"] = 1
    links_coll().update_one({"_id": link["_id"]}, {"$inc": inc, "$set": {"updatedAt": now}})
    partners_coll().update_one(
        {"_id": ObjectId(link["partnerId"])} if ObjectId.is_valid(str(link.get("partnerId"))) else {"partnerCode": "___"},
        {"$inc": {"totalClicks": 1}},
    )
    return link


# ── Partner coupons ─────────────────────────────────────────────────────────

def create_partner_coupon(partner: dict, data: dict) -> dict:
    code = re.sub(r"[^A-Z0-9]", "", (data.get("code") or "").upper())
    if not code or len(code) < 3:
        raise ValueError("Coupon code must be at least 3 characters")
    if coupons_coll().find_one({"code": code}):
        raise ValueError("Coupon code already exists")

    dtype = (data.get("discountType") or "percent").strip().lower()
    if dtype not in ("flat", "percent"):
        dtype = "percent"
    now = datetime.utcnow()
    doc = {
        "partnerId": str(partner["_id"]),
        "partnerCode": partner.get("partnerCode") or "",
        "code": code,
        "discountType": dtype,
        "discountValue": float(data.get("discountValue") or 0),
        "minOrderValue": float(data.get("minOrderValue") or 0) or None,
        "maxDiscountCap": float(data.get("maxDiscountCap") or 0) or None,
        "trainingScope": (data.get("trainingScope") or "all").strip(),  # all | selected | one
        "trainingIds": data.get("trainingIds") or [],
        "commissionOverride": float(data["commissionOverride"]) if data.get("commissionOverride") not in (None, "") else None,
        "validFrom": data.get("validFrom") or None,
        "validTill": data.get("validTill") or None,
        "usageLimitTotal": int(data["usageLimitTotal"]) if data.get("usageLimitTotal") not in (None, "") else None,
        "usageLimitPerStudent": int(data.get("usageLimitPerStudent") or 1),
        "active": bool(data.get("active", True)),
        "appliedCount": 0,
        "successCount": 0,
        "totalDiscount": 0.0,
        "earnings": 0.0,
        "createdAt": now,
        "updatedAt": now,
    }
    res = coupons_coll().insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


def serialize_coupon(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id", "")),
        "partnerId": doc.get("partnerId") or "",
        "partnerCode": doc.get("partnerCode") or "",
        "code": doc.get("code") or "",
        "discountType": doc.get("discountType") or "",
        "discountValue": float(doc.get("discountValue") or 0),
        "minOrderValue": doc.get("minOrderValue"),
        "maxDiscountCap": doc.get("maxDiscountCap"),
        "trainingScope": doc.get("trainingScope") or "all",
        "trainingIds": doc.get("trainingIds") or [],
        "commissionOverride": doc.get("commissionOverride"),
        "validFrom": doc.get("validFrom") or "",
        "validTill": doc.get("validTill") or "",
        "usageLimitTotal": doc.get("usageLimitTotal"),
        "usageLimitPerStudent": doc.get("usageLimitPerStudent"),
        "active": bool(doc.get("active", True)),
        "appliedCount": int(doc.get("appliedCount") or 0),
        "successCount": int(doc.get("successCount") or 0),
        "totalDiscount": float(doc.get("totalDiscount") or 0),
        "earnings": float(doc.get("earnings") or 0),
        "createdAt": doc.get("createdAt").strftime("%Y-%m-%d") if hasattr(doc.get("createdAt"), "strftime") else "",
    }


def get_partner_coupon_by_code(code: str) -> dict | None:
    code = re.sub(r"[^A-Z0-9]", "", (code or "").upper())
    if not code:
        return None
    c = coupons_coll().find_one({"code": code, "active": True})
    if not c:
        return None
    today = datetime.utcnow().strftime("%Y-%m-%d")
    vf = str(c.get("validFrom") or "")[:10]
    vt = str(c.get("validTill") or "")[:10]
    if vf and today < vf:
        return None
    if vt and today > vt:
        return None
    limit = c.get("usageLimitTotal")
    if limit is not None and int(c.get("successCount") or 0) >= int(limit):
        return None
    partner = partners_coll().find_one({"_id": ObjectId(c["partnerId"])}) if ObjectId.is_valid(str(c.get("partnerId"))) else None
    if not partner or partner.get("status") != "active":
        return None
    return c


# ── Attribution on orders ───────────────────────────────────────────────────

def attach_attribution_to_order_doc(doc: dict, *, ref_slug: str = "", coupon_code: str = "") -> dict:
    """Add partnerAttribution fields onto order insert doc."""
    coupon = get_partner_coupon_by_code(coupon_code) if coupon_code else None
    link = resolve_active_link(ref_slug) if ref_slug and not coupon else None
    # Coupon overrides link
    if coupon:
        partner = partners_coll().find_one({"_id": ObjectId(coupon["partnerId"])}) if ObjectId.is_valid(str(coupon.get("partnerId"))) else None
        if partner:
            pct = coupon.get("commissionOverride")
            if pct is None:
                pct = partner.get("commissionPercent") or 0
            doc["partnerAttribution"] = {
                "partnerId": str(partner["_id"]),
                "partnerCode": partner.get("partnerCode"),
                "source": "coupon",
                "couponCode": coupon.get("code"),
                "linkSlug": "",
                "linkId": "",
                "commissionPercent": float(pct),
                "status": "created",
            }
            return doc
    if link:
        partner = partners_coll().find_one({"_id": ObjectId(link["partnerId"])}) if ObjectId.is_valid(str(link.get("partnerId"))) else None
        if partner:
            pct = link.get("commissionOverride")
            if pct is None:
                pct = partner.get("commissionPercent") or 0
            doc["partnerAttribution"] = {
                "partnerId": str(partner["_id"]),
                "partnerCode": partner.get("partnerCode"),
                "source": "referral_link",
                "couponCode": "",
                "linkSlug": link.get("slug"),
                "linkId": str(link["_id"]),
                "commissionPercent": float(pct),
                "status": "created",
            }
            # payments created counter
            links_coll().update_one({"_id": link["_id"]}, {"$inc": {"paymentsCreated": 1}})
    return doc


def on_payment_success_attribution(order: dict) -> None:
    """Create commission when payment succeeds."""
    attr = order.get("partnerAttribution") or {}
    partner_id = attr.get("partnerId")
    if not partner_id or not ObjectId.is_valid(partner_id):
        # try coupon code on order
        cc = (order.get("couponCode") or "").strip()
        if cc:
            coupon = get_partner_coupon_by_code(cc)
            if coupon:
                order = dict(order)
                order = attach_attribution_to_order_doc(order, coupon_code=cc)
                attr = order.get("partnerAttribution") or {}
                partner_id = attr.get("partnerId")
                # persist on order
                from app.db import get_orders_collection
                get_orders_collection().update_one(
                    {"_id": order["_id"]},
                    {"$set": {"partnerAttribution": attr}},
                )
        if not partner_id or not ObjectId.is_valid(partner_id):
            return

    # Net paid amount
    amount = float(order.get("amount") or 0)
    pricing = order.get("pricing") or {}
    if pricing.get("grandTotalInclusive") is not None:
        try:
            amount = float(pricing["grandTotalInclusive"])
        except (TypeError, ValueError):
            pass
    pct = float(attr.get("commissionPercent") or 0)
    commission = round(amount * pct / 100.0, 2)
    now = datetime.utcnow()
    eligible_at = now + timedelta(days=HOLD_DAYS)

    # Update order attribution status
    from app.db import get_orders_collection
    get_orders_collection().update_one(
        {"_id": order["_id"]},
        {"$set": {
            "partnerAttribution.status": "successful",
            "partnerAttribution.commissionAmount": commission,
            "partnerAttribution.netAmount": amount,
        }},
    )

    commissions_coll().insert_one({
        "partnerId": partner_id,
        "partnerCode": attr.get("partnerCode") or "",
        "orderId": str(order.get("_id")),
        "merchantOrderId": order.get("orderId") or order.get("receipt") or "",
        "userId": order.get("userId") or "",
        "courseId": str(order.get("courseId") or ""),
        "netAmount": amount,
        "commissionPercent": pct,
        "commissionAmount": commission,
        "source": attr.get("source") or "",
        "couponCode": attr.get("couponCode") or "",
        "linkSlug": attr.get("linkSlug") or "",
        "status": "earned",  # hold → eligible
        "earnedAt": now,
        "eligibleAt": eligible_at,
        "paidAt": None,
        "payoutId": None,
        "createdAt": now,
    })

    # counters
    partners_coll().update_one(
        {"_id": ObjectId(partner_id)},
        {"$inc": {"totalSuccessful": 1, "totalEarnings": commission}},
    )
    if attr.get("linkId") and ObjectId.is_valid(str(attr["linkId"])):
        links_coll().update_one(
            {"_id": ObjectId(str(attr["linkId"]))},
            {"$inc": {"paymentsSuccess": 1, "earnings": commission}},
        )
    if attr.get("couponCode"):
        coupons_coll().update_one(
            {"code": attr["couponCode"]},
            {"$inc": {"successCount": 1, "earnings": commission, "appliedCount": 1}},
        )


def release_eligible_commissions() -> int:
    """Mark earned commissions past hold as eligible. Returns count."""
    now = datetime.utcnow()
    res = commissions_coll().update_many(
        {"status": "earned", "eligibleAt": {"$lte": now}},
        {"$set": {"status": "eligible", "updatedAt": now}},
    )
    return int(res.modified_count or 0)


def cancel_commission_for_order(order_id: str) -> None:
    commissions_coll().update_many(
        {"orderId": str(order_id), "status": {"$in": ["earned", "eligible"]}},
        {"$set": {"status": "cancelled", "cancelledAt": datetime.utcnow()}},
    )


def partner_stats(partner_id: str) -> dict:
    release_eligible_commissions()
    pid = partner_id
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_clicks = 0
    for lk in links_coll().find({"partnerId": pid}):
        total_clicks += int(lk.get("clicks") or 0)

    earned_all = list(commissions_coll().find({"partnerId": pid, "status": {"$in": ["earned", "eligible", "processing", "paid"]}}))
    total_earnings = sum(float(c.get("commissionAmount") or 0) for c in earned_all)
    pending = sum(
        float(c.get("commissionAmount") or 0)
        for c in commissions_coll().find({"partnerId": pid, "status": "eligible"})
    )
    hold = sum(
        float(c.get("commissionAmount") or 0)
        for c in commissions_coll().find({"partnerId": pid, "status": "earned"})
    )
    paid = sum(
        float(c.get("commissionAmount") or 0)
        for c in commissions_coll().find({"partnerId": pid, "status": "paid"})
    )
    successful = commissions_coll().count_documents({"partnerId": pid, "status": {"$in": ["earned", "eligible", "processing", "paid"]}})
    month_earn = sum(
        float(c.get("commissionAmount") or 0)
        for c in commissions_coll().find({
            "partnerId": pid,
            "status": {"$in": ["earned", "eligible", "processing", "paid"]},
            "earnedAt": {"$gte": month_start},
        })
    )
    month_success = commissions_coll().count_documents({
        "partnerId": pid,
        "status": {"$in": ["earned", "eligible", "processing", "paid"]},
        "earnedAt": {"$gte": month_start},
    })

    return {
        "totalClicks": total_clicks,
        "successfulReferrals": successful,
        "totalEarnings": round(total_earnings, 2),
        "pendingPayout": round(pending, 2),
        "holdAmount": round(hold, 2),
        "paidOut": round(paid, 2),
        "thisMonthEarnings": round(month_earn, 2),
        "thisMonthSuccessful": month_success,
        "minPayout": MIN_PAYOUT_INR,
        "holdDays": HOLD_DAYS,
    }


def process_payouts(
    *,
    partner_ids: list[str],
    admin_email: str,
    uti_ref: str,
    method: str = "upi",
    config,
) -> list[dict]:
    release_eligible_commissions()
    results = []
    from app.email_smtp import send_email

    for pid in partner_ids:
        if not ObjectId.is_valid(pid):
            continue
        partner = partners_coll().find_one({"_id": ObjectId(pid)})
        if not partner:
            continue
        eligible = list(commissions_coll().find({"partnerId": pid, "status": "eligible"}))
        amount = round(sum(float(c.get("commissionAmount") or 0) for c in eligible), 2)
        if amount < MIN_PAYOUT_INR:
            continue
        po_id = allocate_payout_id()
        now = datetime.utcnow()
        cids = [c["_id"] for c in eligible]
        commissions_coll().update_many(
            {"_id": {"$in": cids}},
            {"$set": {"status": "paid", "paidAt": now, "payoutId": po_id}},
        )
        payout = {
            "payoutId": po_id,
            "partnerId": pid,
            "partnerCode": partner.get("partnerCode"),
            "amount": amount,
            "method": method,
            "transactionRef": uti_ref,
            "commissionIds": [str(x) for x in cids],
            "status": "paid",
            "processedBy": admin_email,
            "createdAt": now,
            "period": now.strftime("%Y-%m"),
        }
        payouts_coll().insert_one(payout)
        partners_coll().update_one(
            {"_id": ObjectId(pid)},
            {"$inc": {"totalPaid": amount}},
        )
        send_email(
            config,
            partner.get("email") or "",
            f"Payout of ₹{amount:.2f} processed",
            (
                f"<p>Hi {partner.get('fullName')},</p>"
                f"<p>Your payout of <strong>₹{amount:.2f}</strong> has been processed.</p>"
                f"<p>Payout ID: {po_id}<br/>Transaction ref: {uti_ref}<br/>Method: {method}</p>"
            ),
            text_body=f"Payout {po_id} of INR {amount:.2f} processed. Ref: {uti_ref}",
        )
        results.append(payout)
    return results


def sign_reply_token(application_id: str, secret: str) -> str:
    exp = int((datetime.utcnow() + timedelta(days=14)).timestamp())
    payload = f"{application_id}:{exp}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{payload}:{sig}"


def verify_reply_token(token: str, secret: str) -> str | None:
    try:
        app_id, exp_s, sig = token.rsplit(":", 2)
        exp = int(exp_s)
        if datetime.utcnow().timestamp() > exp:
            return None
        payload = f"{app_id}:{exp_s}"
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]
        if not hmac.compare_digest(expected, sig):
            return None
        return app_id
    except Exception:
        return None
