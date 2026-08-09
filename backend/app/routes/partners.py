"""
Public partner application + partner portal APIs.
Prefix: /api/partners
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.partner_program import (
    append_app_history,
    applications_coll,
    attach_attribution_to_order_doc,
    can_apply,
    commissions_coll,
    coupons_coll,
    create_application,
    get_partner_by_user_id,
    links_coll,
    partner_stats,
    payouts_coll,
    partners_coll,
    record_click,
    send_partner_otp,
    serialize_application,
    serialize_coupon,
    serialize_link,
    serialize_partner,
    sign_reply_token,
    verify_partner_otp,
    verify_reply_token,
    otp_is_verified,
    PARTNER_TYPES,
    AUDIENCE_SIZES,
    HEAR_ABOUT,
    mask_student_name,
    _mask_email,
)
from app.activity_log import client_ip, client_user_agent
from app.email_smtp import send_email
from app.db import get_db, get_users_collection, get_orders_collection, get_courses_collection

partners_bp = Blueprint("partners", __name__)


def _partner_required():
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    claims = get_jwt() or {}
    if (claims.get("role") or "") != "partner":
        return jsonify({"error": "Partner access required"}), 403
    uid = str(get_jwt_identity() or "")
    partner = get_partner_by_user_id(uid)
    if not partner:
        return jsonify({"error": "Partner profile not found"}), 404
    if (partner.get("status") or "") == "suspended":
        return jsonify({"error": "Your account is suspended. Please contact support."}), 403
    return partner


# ── Meta / public form helpers ──────────────────────────────────────────────

@partners_bp.route("/meta", methods=["GET"])
def partners_meta():
    return jsonify({
        "partnerTypes": PARTNER_TYPES,
        "audienceSizes": AUDIENCE_SIZES,
        "hearAbout": HEAR_ABOUT,
        "termsPath": "/terms",
    })


@partners_bp.route("/otp/send", methods=["POST"])
def partners_otp_send():
    data = request.get_json() or {}
    channel = (data.get("channel") or "email").strip().lower()
    target = data.get("target") or data.get("email") or data.get("phone") or ""
    if channel not in ("email", "phone"):
        return jsonify({"error": "Invalid channel"}), 400
    vid, err = send_partner_otp(channel=channel, target=target, config=current_app.config)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"verificationId": vid, "message": "OTP sent"})


@partners_bp.route("/otp/verify", methods=["POST"])
def partners_otp_verify():
    data = request.get_json() or {}
    ok, err = verify_partner_otp(
        verification_id=data.get("verificationId") or "",
        otp=data.get("otp") or "",
        config=current_app.config,
    )
    if not ok:
        return jsonify({"error": err or "Verification failed"}), 400
    return jsonify({"ok": True})


@partners_bp.route("/apply", methods=["POST"])
def partners_apply():
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    data = request.get_json() or {}
    # Required fields
    name = (data.get("fullName") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = data.get("phone") or ""
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    partner_type = (data.get("partnerType") or "").strip()
    promote = (data.get("promotePlan") or "").strip()
    if not name or not email or not phone or not city or not state or not partner_type:
        return jsonify({"error": "Please fill all required fields."}), 400
    if len(promote) < 50:
        return jsonify({"error": "Promotion plan must be at least 50 characters."}), 400
    if not data.get("agreedTerms"):
        return jsonify({"error": "You must agree to the Partner Terms & Conditions."}), 400

    # OTP verify
    email_vid = data.get("emailVerificationId") or ""
    phone_vid = data.get("phoneVerificationId") or ""
    if not otp_is_verified(email_vid, email, "email"):
        return jsonify({"error": "Please verify your email with OTP."}), 400
    if not otp_is_verified(phone_vid, phone, "phone"):
        return jsonify({"error": "Please verify your phone with OTP."}), 400

    ip = client_ip(request)
    block = can_apply(email=email, phone=phone, ip=ip)
    if block:
        return jsonify({"error": block}), 400

    doc = create_application(data, ip=ip, user_agent=client_user_agent(request))
    ref = doc["applicationId"]

    # Emails
    cfg = current_app.config
    status_url = f"{(cfg.get('PUBLIC_APP_URL') or '').rstrip('/')}/apply-partner/status"
    send_email(
        cfg,
        email,
        f"We received your XpertIntern Partner application — {ref}",
        (
            f"<p>Thanks {name}!</p>"
            f"<p>We received your application. Reference number: <strong>{ref}</strong>.</p>"
            f"<p>Our team will review it within 3 working days.</p>"
            f"<p><a href=\"{status_url}\">Track your application status</a></p>"
        ),
        text_body=f"Thanks {name}! Reference: {ref}. Track status at {status_url}",
    )
    # Notify admins loosely via configured support email if present
    support = (cfg.get("SUPPORT_EMAIL") or cfg.get("MAIL_DEFAULT_SENDER") or "").strip()
    if support:
        send_email(
            cfg,
            support,
            f"New partner application {ref}",
            f"<p>New affiliate application from {name} ({email}). Ref: {ref}</p>",
            text_body=f"New application {ref} from {email}",
        )

    return jsonify({
        "applicationId": ref,
        "message": f"Thanks {name}! We received your application.",
        "statusUrl": "/apply-partner/status",
    }), 201


@partners_bp.route("/status", methods=["POST"])
def partners_status():
    data = request.get_json() or {}
    ref = (data.get("applicationId") or data.get("reference") or "").strip().upper()
    email = (data.get("email") or "").strip().lower()
    if not ref or not email:
        return jsonify({"error": "Reference number and email are required."}), 400
    doc = applications_coll().find_one({"applicationId": ref, "email": email})
    if not doc:
        return jsonify({"error": "We couldn't find an application with these details."}), 404
    return jsonify({"application": serialize_application(doc, public=True)})


@partners_bp.route("/reply", methods=["POST"])
def partners_reply():
    """Secure reply to Needs More Info (token in body)."""
    data = request.get_json() or {}
    token = data.get("token") or ""
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Reply message is required."}), 400
    secret = (current_app.config.get("SECRET_KEY") or "xpertintern")[:64]
    app_id = verify_reply_token(token, secret)
    if not app_id:
        return jsonify({"error": "This reply link is invalid or has expired."}), 400
    doc = applications_coll().find_one({"applicationId": app_id})
    if not doc:
        return jsonify({"error": "Application not found."}), 404
    append_app_history(doc["_id"], "applicant_reply", "applicant", message)
    applications_coll().update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "under_review", "applicantReply": message, "updatedAt": datetime.utcnow()}},
    )
    return jsonify({"ok": True, "message": "Reply submitted. Thank you."})


@partners_bp.route("/track-click", methods=["POST"])
def partners_track_click():
    data = request.get_json() or {}
    slug = data.get("ref") or data.get("slug") or ""
    link = record_click(
        slug=slug,
        ip=client_ip(request),
        user_agent=client_user_agent(request),
        source=data.get("source") or "",
    )
    if not link:
        return jsonify({"ok": False}), 200
    return jsonify({"ok": True, "slug": link.get("slug")})


# ── Partner portal ──────────────────────────────────────────────────────────

@partners_bp.route("/me", methods=["GET"])
@jwt_required()
def partner_me():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    stats = partner_stats(str(res["_id"]))
    return jsonify({"partner": serialize_partner(res), "stats": stats})


@partners_bp.route("/me/links", methods=["GET"])
@jwt_required()
def partner_my_links():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    items = [serialize_link(x) for x in links_coll().find({"partnerId": str(res["_id"])}).sort("createdAt", -1)]
    return jsonify({"items": items})


@partners_bp.route("/me/coupons", methods=["GET"])
@jwt_required()
def partner_my_coupons():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    items = [serialize_coupon(x) for x in coupons_coll().find({"partnerId": str(res["_id"])}).sort("createdAt", -1)]
    return jsonify({"items": items})


@partners_bp.route("/me/referrals", methods=["GET"])
@jwt_required()
def partner_my_referrals():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    pid = str(res["_id"])
    items = []
    users = get_users_collection()
    courses = get_courses_collection()
    for c in commissions_coll().find({"partnerId": pid}).sort("earnedAt", -1).limit(200):
        student_name = "Student"
        student_email = ""
        uid = c.get("userId") or ""
        if uid and ObjectId.is_valid(uid):
            u = users.find_one({"_id": ObjectId(uid)}, {"name": 1, "fullName": 1, "email": 1})
            if u:
                student_name = mask_student_name(u.get("name") or u.get("fullName") or "Student")
                student_email = _mask_email(u.get("email") or "")
        title = ""
        cid = c.get("courseId") or ""
        if cid and ObjectId.is_valid(cid):
            cr = courses.find_one({"_id": ObjectId(cid)}, {"title": 1})
            title = (cr or {}).get("title") or ""
        earned = c.get("earnedAt")
        items.append({
            "id": str(c.get("_id")),
            "date": earned.strftime("%Y-%m-%d %H:%M") if hasattr(earned, "strftime") else "",
            "studentName": student_name,
            "studentEmail": student_email,
            "training": title,
            "source": c.get("source") or "",
            "couponCode": c.get("couponCode") or "",
            "linkSlug": c.get("linkSlug") or "",
            "amount": float(c.get("netAmount") or 0),
            "commission": float(c.get("commissionAmount") or 0),
            "commissionStatus": c.get("status") or "",
            "status": "successful",
        })
    return jsonify({"items": items, "stats": partner_stats(pid)})


@partners_bp.route("/me/payouts", methods=["GET"])
@jwt_required()
def partner_my_payouts():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    pid = str(res["_id"])
    items = []
    for p in payouts_coll().find({"partnerId": pid}).sort("createdAt", -1).limit(100):
        created = p.get("createdAt")
        items.append({
            "payoutId": p.get("payoutId") or "",
            "amount": float(p.get("amount") or 0),
            "method": p.get("method") or "",
            "transactionRef": p.get("transactionRef") or "",
            "status": p.get("status") or "",
            "period": p.get("period") or "",
            "date": created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else "",
        })
    return jsonify({"items": items, "stats": partner_stats(pid)})


@partners_bp.route("/me/profile", methods=["PUT", "PATCH"])
@jwt_required()
def partner_update_profile():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    data = request.get_json() or {}
    allowed = {}
    for k in ("fullName", "city", "state", "organisationName"):
        if k in data:
            allowed[k] = str(data.get(k) or "").strip()[:200]
    if "phone" in data:
        from app.partner_program import normalize_phone
        allowed["phone"] = normalize_phone(data.get("phone") or "")
    # Bank/UPI require approval
    bank_change = {}
    if any(k in data for k in ("pan", "upiId", "accountHolder", "accountNumber", "ifsc", "bankName")):
        bank_change = {
            "pan": (data.get("pan") or res.get("pan") or "").strip(),
            "upiId": (data.get("upiId") or res.get("upiId") or "").strip(),
            "bank": {
                "accountHolder": (data.get("accountHolder") or (res.get("bank") or {}).get("accountHolder") or "").strip(),
                "accountNumber": (data.get("accountNumber") or (res.get("bank") or {}).get("accountNumber") or "").strip(),
                "ifsc": (data.get("ifsc") or (res.get("bank") or {}).get("ifsc") or "").strip(),
                "bankName": (data.get("bankName") or (res.get("bank") or {}).get("bankName") or "").strip(),
            },
            "requestedAt": datetime.utcnow(),
        }
        allowed["bankPendingApproval"] = bank_change
    if allowed:
        allowed["updatedAt"] = datetime.utcnow()
        partners_coll().update_one({"_id": res["_id"]}, {"$set": allowed})
    updated = partners_coll().find_one({"_id": res["_id"]})
    return jsonify({"partner": serialize_partner(updated)})


@partners_bp.route("/me/marketing-kit", methods=["GET"])
@jwt_required()
def partner_marketing_kit():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    # Static starter kit entries; admin can expand later via DB
    main_link = links_coll().find_one({"partnerId": str(res["_id"]), "active": True}, sort=[("createdAt", 1)])
    link_url = (main_link or {}).get("url") or ""
    return jsonify({
        "items": [
            {
                "id": "caption-1",
                "type": "caption",
                "title": "WhatsApp / Instagram caption",
                "body": (
                    f"Looking to upskill with industry-ready training? "
                    f"Join XpertIntern — practical programs with certificates. "
                    f"Apply here: {link_url or 'https://www.xpertintern.com'}"
                ),
            },
            {
                "id": "howto",
                "type": "guide",
                "title": "How to promote XpertIntern",
                "body": "Share your unique link or coupon. Commission is tracked automatically when students enroll successfully.",
            },
        ],
        "mainReferralUrl": link_url,
    })
