"""
Public partner application + partner portal APIs.
Prefix: /api/partners
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.partner_program import (
    append_app_history,
    applications_coll,
    asset_net_revenue,
    can_apply,
    check_status_rate_limit,
    commissions_coll,
    coupons_coll,
    create_application,
    enrich_coupons_with_revenue,
    enrich_links_with_revenue,
    enhanced_partner_stats,
    generate_payout_receipt_pdf,
    get_partner_by_user_id,
    links_coll,
    list_partner_notifications,
    mark_notifications_read,
    partner_stats,
    partner_kit_coll,
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
    verify_recaptcha,
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
from io import BytesIO

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
    site_key = (current_app.config.get("RECAPTCHA_SITE_KEY") or "").strip()
    return jsonify({
        "partnerTypes": PARTNER_TYPES,
        "audienceSizes": AUDIENCE_SIZES,
        "hearAbout": HEAR_ABOUT,
        "termsPath": "/terms",
        "recaptchaSiteKey": site_key,
        "recaptchaEnabled": bool(site_key),
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
    if (data.get("companyWebsite") or "").strip():
        return jsonify({"error": "Submission rejected."}), 400
    if not verify_recaptcha(data.get("recaptchaToken") or "", current_app.config):
        return jsonify({"error": "Security check failed. Please refresh and try again."}), 400
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

    # OTP verify — email required; phone OTP optional until SMS OTP is live
    email_vid = data.get("emailVerificationId") or ""
    phone_vid = data.get("phoneVerificationId") or ""
    if not otp_is_verified(email_vid, email, "email"):
        return jsonify({"error": "Please verify your email with OTP."}), 400
    # Phone is still collected; only enforce phone OTP when a verification id is sent
    if phone_vid and not otp_is_verified(phone_vid, phone, "phone"):
        return jsonify({"error": "Phone OTP verification failed. Leave it blank or verify correctly."}), 400

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
    lim = check_status_rate_limit(email)
    if lim:
        return jsonify({"error": lim}), 429
    doc = applications_coll().find_one({"applicationId": ref, "email": email})
    if not doc:
        return jsonify({"error": "We couldn't find an application with these details."}), 404
    app_out = serialize_application(doc, public=True)
    if doc.get("status") == "needs_more_info":
        secret = (current_app.config.get("SECRET_KEY") or "xpertintern")[:64]
        app_out["replyToken"] = sign_reply_token(ref, secret)
    return jsonify({"application": app_out})


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
    stats = enhanced_partner_stats(str(res["_id"]))
    unread = 0
    try:
        from app.partner_program import partner_notifications_coll
        unread = partner_notifications_coll().count_documents({"partnerId": str(res["_id"]), "read": False})
    except Exception:
        pass
    return jsonify({
        "partner": serialize_partner(res),
        "stats": stats,
        "unreadNotifications": unread,
    })


@partners_bp.route("/me/notifications", methods=["GET"])
@jwt_required()
def partner_notifications():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    items = list_partner_notifications(str(res["_id"]))
    return jsonify({"items": items})


@partners_bp.route("/me/notifications/read", methods=["POST"])
@jwt_required()
def partner_notifications_read():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    data = request.get_json() or {}
    mark_notifications_read(str(res["_id"]), all_ids=bool(data.get("all", True)), ids=data.get("ids") or [])
    return jsonify({"ok": True})


@partners_bp.route("/me/links", methods=["GET"])
@jwt_required()
def partner_my_links():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    pid = str(res["_id"])
    items = [serialize_link(x) for x in links_coll().find({"partnerId": pid}).sort("createdAt", -1)]
    by_slug, _ = asset_net_revenue(pid)
    items = enrich_links_with_revenue(items, by_slug)
    return jsonify({"items": items})


@partners_bp.route("/me/coupons", methods=["GET"])
@jwt_required()
def partner_my_coupons():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    pid = str(res["_id"])
    items = [serialize_coupon(x) for x in coupons_coll().find({"partnerId": pid}).sort("createdAt", -1)]
    _, by_code = asset_net_revenue(pid)
    items = enrich_coupons_with_revenue(items, by_code)
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
    return jsonify({"items": items, "stats": enhanced_partner_stats(pid)})


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


@partners_bp.route("/me/payouts/<payout_id>/receipt", methods=["GET"])
@jwt_required()
def partner_payout_receipt(payout_id):
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    p = payouts_coll().find_one({"payoutId": payout_id, "partnerId": str(res["_id"])})
    if not p:
        return jsonify({"error": "Payout not found"}), 404
    pdf = generate_payout_receipt_pdf(p, res)
    if not pdf:
        return jsonify({"error": "Could not generate receipt"}), 500
    return send_file(
        BytesIO(pdf),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{payout_id}.pdf",
    )


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


@partners_bp.route("/me/password", methods=["POST"])
@jwt_required()
def partner_change_password():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    data = request.get_json() or {}
    current = data.get("currentPassword") or ""
    new_pw = data.get("newPassword") or ""
    if len(new_pw) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    from werkzeug.security import check_password_hash, generate_password_hash
    uid = res.get("userId")
    if not uid or not ObjectId.is_valid(str(uid)):
        return jsonify({"error": "Account not found"}), 404
    users = get_users_collection()
    u = users.find_one({"_id": ObjectId(str(uid))})
    if not u or not check_password_hash(u.get("password") or "", current):
        return jsonify({"error": "Current password is incorrect."}), 400
    users.update_one({"_id": u["_id"]}, {"$set": {"password": generate_password_hash(new_pw), "forcePasswordChange": False}})
    return jsonify({"ok": True, "message": "Password updated."})


@partners_bp.route("/me/support", methods=["POST"])
@jwt_required()
def partner_support_ticket():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    data = request.get_json() or {}
    subject = (data.get("subject") or "").strip()[:200]
    message = (data.get("message") or "").strip()[:4000]
    if not subject or not message:
        return jsonify({"error": "Subject and message are required."}), 400
    try:
        from app.db import get_db as _gdb
        db = _gdb()
        ticket = {
            "source": "partner_portal",
            "partnerId": str(res["_id"]),
            "partnerCode": res.get("partnerCode"),
            "email": res.get("email"),
            "name": res.get("fullName"),
            "subject": subject,
            "message": message,
            "status": "open",
            "createdAt": datetime.utcnow(),
        }
        if db is not None:
            ins = db["tickets"].insert_one(ticket)
            ticket_id = str(ins.inserted_id)
        else:
            ticket_id = ""
    except Exception:
        ticket_id = ""
        current_app.logger.exception("partner support ticket insert failed")
    support = (current_app.config.get("SUPPORT_EMAIL") or current_app.config.get("MAIL_DEFAULT_SENDER") or "partners@xpertintern.com").strip()
    send_email(
        current_app.config,
        support,
        f"[Partner] {subject} — {res.get('partnerCode')}",
        f"<p>From {res.get('fullName')} ({res.get('email')})</p><p>{message}</p>",
        text_body=message,
    )
    return jsonify({"ok": True, "ticketId": ticket_id, "message": "Support request submitted."})


@partners_bp.route("/me/marketing-kit", methods=["GET"])
@jwt_required()
def partner_marketing_kit():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    main_link = links_coll().find_one({"partnerId": str(res["_id"]), "active": True}, sort=[("createdAt", 1)])
    link_url = (main_link or {}).get("url") or ""
    db_items = []
    try:
        for k in partner_kit_coll().find({"active": True}).sort("sortOrder", 1).limit(50):
            db_items.append({
                "id": str(k["_id"]),
                "type": k.get("type") or "asset",
                "title": k.get("title") or "",
                "body": k.get("body") or "",
                "url": k.get("url") or "",
            })
    except Exception:
        pass
    default_items = [
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
        {
            "id": "email-blurb",
            "type": "caption",
            "title": "Email intro",
            "body": f"Hi! I wanted to share XpertIntern's skill programs — great for career readiness. {link_url or 'https://www.xpertintern.com'}",
        },
    ]
    items = db_items if db_items else default_items
    for item in items:
        if item.get("type") == "caption" and link_url and link_url not in (item.get("body") or ""):
            item["body"] = f"{item.get('body') or ''} {link_url}".strip()
    return jsonify({
        "items": items,
        "mainReferralUrl": link_url,
    })


@partners_bp.route("/me/referrals/export", methods=["GET"])
@jwt_required()
def partner_export_referrals():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    import csv
    from io import StringIO
    pid = str(res["_id"])
    users = get_users_collection()
    courses = get_courses_collection()
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "studentName", "studentEmail", "training", "source", "netPaid", "commission", "status"])
    for c in commissions_coll().find({"partnerId": pid}).sort("earnedAt", -1).limit(2000):
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
        if cid and ObjectId.is_valid(str(cid)):
            cr = courses.find_one({"_id": ObjectId(str(cid))}, {"title": 1})
            title = (cr or {}).get("title") or ""
        earned = c.get("earnedAt")
        w.writerow([
            earned.strftime("%Y-%m-%d %H:%M") if hasattr(earned, "strftime") else "",
            student_name,
            student_email,
            title,
            c.get("source") or "",
            float(c.get("netAmount") or 0),
            float(c.get("commissionAmount") or 0),
            c.get("status") or "",
        ])
    from flask import Response
    return Response(buf.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=partner-referrals.csv"})


@partners_bp.route("/me/payouts/statement", methods=["GET"])
@jwt_required()
def partner_payout_statement():
    res = _partner_required()
    if not isinstance(res, dict):
        return res
    import csv
    from io import StringIO
    from flask import Response
    pid = str(res["_id"])
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["payoutId", "date", "amount", "method", "transactionRef", "status", "period"])
    for p in payouts_coll().find({"partnerId": pid}).sort("createdAt", -1).limit(500):
        created = p.get("createdAt")
        w.writerow([
            p.get("payoutId") or "",
            created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else "",
            float(p.get("amount") or 0),
            p.get("method") or "",
            p.get("transactionRef") or "",
            p.get("status") or "",
            p.get("period") or "",
        ])
    code = res.get("partnerCode") or "partner"
    return Response(buf.getvalue(), mimetype="text/csv", headers={"Content-Disposition": f"attachment; filename={code}-payout-statement.csv"})
