"""
Admin APIs for affiliate / partners.
Mounted under /api/admin via partners_admin_bp.
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.activity_log import client_ip, log_admin_action
from app.db import get_db, get_courses_collection, get_users_collection
from app.email_smtp import send_email
from app.partner_program import (
    REJECT_REASONS,
    append_app_history,
    applications_coll,
    auto_reject_stale_info_requests,
    commissions_coll,
    coupons_coll,
    create_partner_coupon,
    create_partner_from_fields,
    create_referral_link,
    enhanced_partner_stats,
    links_coll,
    partners_coll,
    partner_activity_coll,
    partner_stats,
    payouts_coll,
    process_payouts,
    push_partner_notification,
    release_eligible_commissions,
    serialize_application,
    serialize_coupon,
    serialize_link,
    serialize_partner,
    sign_reply_token,
    cancel_commission_for_order,
)

partners_admin_bp = Blueprint("partners_admin", __name__)


def _admin_err():
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    claims = get_jwt() or {}
    role = (claims.get("role") or "").strip().lower()
    if role != "admin" and not claims.get("admin_portal"):
        # fall back: many admin tokens have role admin
        if role != "admin":
            return jsonify({"error": "Admin required"}), 403
    return None


def _actor():
    claims = get_jwt() or {}
    return {
        "id": str(get_jwt_identity() or ""),
        "email": (claims.get("email") or "").strip().lower(),
    }


@partners_admin_bp.route("/partners/applications", methods=["GET"])
@jwt_required()
def admin_list_applications():
    err = _admin_err()
    if err:
        return err
    status = (request.args.get("status") or "").strip().lower()
    ptype = (request.args.get("partnerType") or "").strip()
    state = (request.args.get("state") or "").strip()
    search = (request.args.get("search") or "").strip()
    date_from = (request.args.get("from") or "").strip()
    date_to = (request.args.get("to") or "").strip()
    q: dict = {}
    if status:
        q["status"] = status
    if ptype:
        q["partnerType"] = ptype
    if state:
        q["state"] = {"$regex": state, "$options": "i"}
    if search:
        q["$or"] = [
            {"applicationId": {"$regex": search, "$options": "i"}},
            {"fullName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    # date filters (YYYY-MM-DD)
    if date_from or date_to:
        created: dict = {}
        try:
            if date_from:
                created["$gte"] = datetime.strptime(date_from[:10], "%Y-%m-%d")
            if date_to:
                created["$lte"] = datetime.strptime(date_to[:10], "%Y-%m-%d") + __import__("datetime").timedelta(days=1)
            if created:
                q["createdAt"] = created
        except ValueError:
            pass
    items = [serialize_application(d) for d in applications_coll().find(q).sort("createdAt", -1).limit(500)]
    pending = applications_coll().count_documents({"status": {"$in": ["submitted", "under_review", "needs_more_info"]}})
    return jsonify({"items": items, "pendingCount": pending})


@partners_admin_bp.route("/partners/applications/export", methods=["GET"])
@jwt_required()
def admin_export_applications():
    err = _admin_err()
    if err:
        return err
    import csv
    from io import StringIO
    status = (request.args.get("status") or "").strip().lower()
    q = {"status": status} if status else {}
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["applicationId", "fullName", "email", "phone", "partnerType", "city", "state", "status", "createdAt"])
    for d in applications_coll().find(q).sort("createdAt", -1).limit(2000):
        created = d.get("createdAt")
        w.writerow([
            d.get("applicationId") or "",
            d.get("fullName") or "",
            d.get("email") or "",
            d.get("phone") or "",
            d.get("partnerType") or "",
            d.get("city") or "",
            d.get("state") or "",
            d.get("status") or "",
            created.isoformat() if hasattr(created, "isoformat") else "",
        ])
    from flask import Response
    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=partner-applications.csv"},
    )


@partners_admin_bp.route("/partners/applications/bulk-reject", methods=["POST"])
@jwt_required()
def admin_bulk_reject_applications():
    err = _admin_err()
    if err:
        return err
    data = request.get_json() or {}
    ids = data.get("ids") or []
    reason = (data.get("reason") or "Other").strip()
    n = 0
    for aid in ids:
        doc = applications_coll().find_one({"_id": ObjectId(aid)}) if ObjectId.is_valid(str(aid)) else None
        if not doc or doc.get("status") in ("approved", "rejected"):
            continue
        applications_coll().update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": "rejected", "rejectReason": reason, "rejectedAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}},
        )
        append_app_history(doc["_id"], "rejected", "admin", f"Bulk: {reason}")
        n += 1
    return jsonify({"ok": True, "rejected": n})


@partners_admin_bp.route("/partners/applications/<app_id>", methods=["GET"])
@jwt_required()
def admin_get_application(app_id):
    err = _admin_err()
    if err:
        return err
    doc = None
    if ObjectId.is_valid(app_id):
        doc = applications_coll().find_one({"_id": ObjectId(app_id)})
    if not doc:
        doc = applications_coll().find_one({"applicationId": app_id.upper()})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    # Auto under review when opened
    if doc.get("status") == "submitted":
        applications_coll().update_one({"_id": doc["_id"]}, {"$set": {"status": "under_review", "updatedAt": datetime.utcnow()}})
        append_app_history(doc["_id"], "under_review", "admin", "Opened by admin")
        doc = applications_coll().find_one({"_id": doc["_id"]})
        send_email(
            current_app.config,
            doc.get("email") or "",
            "Your XpertIntern Partner application is being reviewed",
            f"<p>Hi {doc.get('fullName')},</p><p>Your application {doc.get('applicationId')} is under review.</p>",
            text_body=f"Application {doc.get('applicationId')} is under review.",
        )
    return jsonify({"application": serialize_application(doc)})


@partners_admin_bp.route("/partners/applications/<app_id>/approve", methods=["POST"])
@jwt_required()
def admin_approve_application(app_id):
    err = _admin_err()
    if err:
        return err
    doc = applications_coll().find_one({"_id": ObjectId(app_id)}) if ObjectId.is_valid(app_id) else None
    if not doc:
        doc = applications_coll().find_one({"applicationId": app_id.upper()})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    if doc.get("status") == "approved":
        return jsonify({"error": "Already approved"}), 400
    data = request.get_json() or {}
    try:
        commission = float(data.get("commissionPercent") or 10)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid commission %"}), 400
    if commission < 0 or commission > 100:
        return jsonify({"error": "Commission must be 0–100"}), 400

    fields = {
        "fullName": doc.get("fullName"),
        "email": doc.get("email"),
        "phone": doc.get("phone"),
        "partnerType": data.get("partnerType") or doc.get("partnerType"),
        "organisationName": doc.get("organisationName"),
        "city": doc.get("city"),
        "state": doc.get("state"),
        "country": doc.get("country"),
        "websiteUrl": doc.get("websiteUrl"),
        "instagram": doc.get("instagram"),
        "youtube": doc.get("youtube"),
        "linkedin": doc.get("linkedin"),
        "notes": data.get("internalNotes") or "",
    }
    try:
        partner, _temp = create_partner_from_fields(
            fields,
            config=current_app.config,
            commission_percent=commission,
            source="application",
            application_id=doc.get("applicationId"),
            welcome_message=(data.get("welcomeMessage") or "").strip(),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    applications_coll().update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "approved",
                "partnerId": partner["_id"],
                "partnerCode": partner.get("partnerCode"),
                "approvedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "commissionPercent": commission,
            }
        },
    )
    append_app_history(doc["_id"], "approved", "admin", f"Partner {partner.get('partnerCode')}")
    actor = _actor()
    log_admin_action(
        action="partner_approved",
        entity_type="partner",
        entity_id=str(partner["_id"]),
        meta={"applicationId": doc.get("applicationId"), "partnerCode": partner.get("partnerCode")},
        request=request,
        actor_id=actor["id"],
        actor_email=actor["email"],
    )
    return jsonify({"partner": serialize_partner(partner), "message": "Partner approved and account created."})


@partners_admin_bp.route("/partners/applications/<app_id>/reject", methods=["POST"])
@jwt_required()
def admin_reject_application(app_id):
    err = _admin_err()
    if err:
        return err
    doc = applications_coll().find_one({"_id": ObjectId(app_id)}) if ObjectId.is_valid(app_id) else None
    if not doc:
        doc = applications_coll().find_one({"applicationId": app_id.upper()})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    reason = (data.get("reason") or "Other").strip()
    share = bool(data.get("shareReason"))
    message = (data.get("message") or "").strip() or "Thank you for your interest. We are unable to proceed at this time."
    applications_coll().update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "rejected",
                "rejectReason": reason,
                "rejectReasonShared": reason if share else "",
                "rejectedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
            }
        },
    )
    append_app_history(doc["_id"], "rejected", "admin", reason)
    body_extra = f"<p>Reason: {reason}</p>" if share else ""
    send_email(
        current_app.config,
        doc.get("email") or "",
        "Update on your XpertIntern Partner application",
        f"<p>Hi {doc.get('fullName')},</p><p>{message}</p>{body_extra}<p>You may re-apply after 90 days.</p>",
        text_body=message,
    )
    return jsonify({"ok": True})


@partners_admin_bp.route("/partners/applications/<app_id>/request-info", methods=["POST"])
@jwt_required()
def admin_request_info(app_id):
    err = _admin_err()
    if err:
        return err
    doc = applications_coll().find_one({"_id": ObjectId(app_id)}) if ObjectId.is_valid(app_id) else None
    if not doc:
        doc = applications_coll().find_one({"applicationId": app_id.upper()})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "Question is required"}), 400
    secret = (current_app.config.get("SECRET_KEY") or "xpertintern")[:64]
    token = sign_reply_token(doc.get("applicationId") or "", secret)
    base = (current_app.config.get("PUBLIC_APP_URL") or "").rstrip("/")
    reply_url = f"{base}/apply-partner/reply?token={token}"
    applications_coll().update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "needs_more_info",
                "adminQuestion": question,
                "infoRequestedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
            }
        },
    )
    append_app_history(doc["_id"], "needs_more_info", "admin", question)
    send_email(
        current_app.config,
        doc.get("email") or "",
        "We need a bit more information for your partner application",
        (
            f"<p>Hi {doc.get('fullName')},</p>"
            f"<p>{question}</p>"
            f"<p><a href=\"{reply_url}\">Reply securely here</a> (link valid 14 days).</p>"
        ),
        text_body=f"{question}\n\nReply: {reply_url}",
    )
    return jsonify({"ok": True, "replyUrl": reply_url})


@partners_admin_bp.route("/partners", methods=["GET"])
@jwt_required()
def admin_list_partners():
    err = _admin_err()
    if err:
        return err
    status = (request.args.get("status") or "").strip().lower()
    search = (request.args.get("search") or "").strip()
    q: dict = {"status": {"$ne": "deleted"}}
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"partnerCode": {"$regex": search, "$options": "i"}},
            {"fullName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    items = [serialize_partner(p) for p in partners_coll().find(q).sort("createdAt", -1).limit(300)]
    return jsonify({"items": items})


@partners_admin_bp.route("/partners", methods=["POST"])
@jwt_required()
def admin_create_partner():
    err = _admin_err()
    if err:
        return err
    data = request.get_json() or {}
    if not (data.get("fullName") and data.get("email") and data.get("phone")):
        return jsonify({"error": "Name, email and phone are required"}), 400
    try:
        commission = float(data.get("commissionPercent") or 10)
        partner, _ = create_partner_from_fields(
            data,
            config=current_app.config,
            commission_percent=commission,
            source="manual",
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    actor = _actor()
    log_admin_action(
        action="partner_created",
        entity_type="partner",
        entity_id=str(partner["_id"]),
        meta={"partnerCode": partner.get("partnerCode")},
        request=request,
        actor_id=actor["id"],
        actor_email=actor["email"],
    )
    return jsonify({"partner": serialize_partner(partner)}), 201


@partners_admin_bp.route("/partners/<partner_id>", methods=["GET"])
@jwt_required()
def admin_get_partner(partner_id):
    err = _admin_err()
    if err:
        return err
    if not ObjectId.is_valid(partner_id):
        return jsonify({"error": "Invalid id"}), 400
    p = partners_coll().find_one({"_id": ObjectId(partner_id)})
    if not p:
        return jsonify({"error": "Not found"}), 404
    links = [serialize_link(x) for x in links_coll().find({"partnerId": partner_id}).sort("createdAt", -1)]
    coupons = [serialize_coupon(x) for x in coupons_coll().find({"partnerId": partner_id}).sort("createdAt", -1)]
    activity = []
    try:
        for a in partner_activity_coll().find({"partnerId": partner_id}).sort("createdAt", -1).limit(100):
            created = a.get("createdAt")
            activity.append({
                "action": a.get("action") or "",
                "meta": a.get("meta") or {},
                "createdAt": created.strftime("%Y-%m-%d %H:%M") if hasattr(created, "strftime") else "",
            })
    except Exception:
        pass
    payouts = []
    for po in payouts_coll().find({"partnerId": partner_id}).sort("createdAt", -1).limit(50):
        created = po.get("createdAt")
        payouts.append({
            "payoutId": po.get("payoutId") or "",
            "amount": float(po.get("amount") or 0),
            "method": po.get("method") or "",
            "transactionRef": po.get("transactionRef") or "",
            "status": po.get("status") or "",
            "date": created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else "",
        })
    return jsonify({
        "partner": serialize_partner(p),
        "stats": enhanced_partner_stats(partner_id),
        "links": links,
        "coupons": coupons,
        "activity": activity,
        "payouts": payouts,
        "referrals": _admin_partner_referrals(partner_id),
    })


def _admin_partner_referrals(partner_id: str) -> list:
    """Full student attribution rows for admin partner detail (unmasked)."""
    items = []
    users = get_users_collection()
    courses = get_courses_collection()
    links = {str(l.get("slug") or "").upper(): l for l in links_coll().find({"partnerId": partner_id})}
    coupons = {str(c.get("code") or "").upper(): c for c in coupons_coll().find({"partnerId": partner_id})}
    for c in commissions_coll().find({"partnerId": partner_id}).sort("earnedAt", -1).limit(500):
        student_name = "Student"
        student_email = ""
        student_phone = ""
        college = ""
        university = ""
        uid = c.get("userId") or ""
        if uid and ObjectId.is_valid(str(uid)):
            u = users.find_one({"_id": ObjectId(str(uid))}, {
                "name": 1, "fullName": 1, "email": 1, "phone": 1,
                "collegeName": 1, "university": 1,
            })
            if u:
                student_name = (u.get("name") or u.get("fullName") or "Student").strip()
                student_email = u.get("email") or ""
                student_phone = u.get("phone") or ""
                college = u.get("collegeName") or ""
                university = u.get("university") or ""
        title = ""
        cid = c.get("courseId") or ""
        if cid and ObjectId.is_valid(str(cid)):
            cr = courses.find_one({"_id": ObjectId(str(cid))}, {"title": 1})
            title = (cr or {}).get("title") or ""
        earned = c.get("earnedAt")
        source = (c.get("source") or "").strip().lower()
        coupon_code = (c.get("couponCode") or "").strip().upper()
        link_slug = (c.get("linkSlug") or "").strip().upper()
        source_label = "Referral link"
        source_detail = ""
        if source == "coupon" or coupon_code:
            source_label = "Coupon"
            cp = coupons.get(coupon_code) or {}
            source_detail = coupon_code or str(c.get("couponCode") or "")
        elif link_slug:
            lk = links.get(link_slug) or {}
            source_detail = lk.get("label") or link_slug
        status_raw = (c.get("status") or "").lower()
        if status_raw in ("earned", "eligible", "processing", "paid"):
            pay_status = "Successful"
        elif status_raw == "cancelled":
            pay_status = "Cancelled"
        else:
            pay_status = "Payment created"
        items.append({
            "id": str(c.get("_id")),
            "date": earned.strftime("%d %b %Y, %I:%M %p") if hasattr(earned, "strftime") else "",
            "studentName": student_name,
            "studentEmail": student_email,
            "studentPhone": student_phone,
            "college": college,
            "university": university,
            "training": title,
            "source": source_label,
            "sourceDetail": source_detail,
            "amount": float(c.get("netAmount") or 0),
            "commission": float(c.get("commissionAmount") or 0),
            "commissionStatus": c.get("status") or "",
            "status": pay_status,
        })
    return items


@partners_admin_bp.route("/partners/<partner_id>", methods=["PUT", "PATCH"])
@jwt_required()
def admin_update_partner(partner_id):
    err = _admin_err()
    if err:
        return err
    if not ObjectId.is_valid(partner_id):
        return jsonify({"error": "Invalid id"}), 400
    data = request.get_json() or {}
    patch = {}
    for k in ("fullName", "partnerType", "organisationName", "city", "state", "notes", "status", "pan", "upiId", "phone"):
        if k in data:
            patch[k] = data.get(k)
    if "commissionPercent" in data:
        patch["commissionPercent"] = float(data.get("commissionPercent") or 0)
    if "notes" in data:
        patch["notes"] = str(data.get("notes") or "")[:2000]
    if data.get("approveBank") and isinstance(data.get("bankPendingApproval") or partners_coll().find_one({"_id": ObjectId(partner_id)}, {"bankPendingApproval": 1}), dict):
        p = partners_coll().find_one({"_id": ObjectId(partner_id)})
        pending = p.get("bankPendingApproval") if p else None
        if pending:
            patch["bank"] = pending.get("bank") or p.get("bank")
            patch["pan"] = pending.get("pan") or p.get("pan")
            patch["upiId"] = pending.get("upiId") or p.get("upiId")
            patch["bankPendingApproval"] = None
    prev = partners_coll().find_one({"_id": ObjectId(partner_id)})
    if patch:
        patch["updatedAt"] = datetime.utcnow()
        partners_coll().update_one({"_id": ObjectId(partner_id)}, {"$set": patch})
    p = partners_coll().find_one({"_id": ObjectId(partner_id)})
    # Suspension notification
    if patch.get("status") == "suspended" and (prev or {}).get("status") != "suspended" and p:
        send_email(
            current_app.config,
            p.get("email") or "",
            "Your XpertIntern Partner account has been suspended",
            f"<p>Hi {p.get('fullName')},</p><p>Your partner account has been suspended. Contact partners@xpertintern.com if you believe this is an error.</p>",
            text_body="Your partner account has been suspended.",
        )
        push_partner_notification(partner_id, "Account suspended", "Contact support for assistance.")
    return jsonify({"partner": serialize_partner(p)})


@partners_admin_bp.route("/partners/<partner_id>/links", methods=["POST"])
@jwt_required()
def admin_create_link(partner_id):
    err = _admin_err()
    if err:
        return err
    if not ObjectId.is_valid(partner_id):
        return jsonify({"error": "Invalid id"}), 400
    p = partners_coll().find_one({"_id": ObjectId(partner_id)})
    if not p:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    if data.get("trainingId") and ObjectId.is_valid(str(data["trainingId"])):
        cr = get_courses_collection().find_one({"_id": ObjectId(str(data["trainingId"]))}, {"title": 1})
        if cr:
            data["trainingTitle"] = cr.get("title") or ""
    try:
        link = create_referral_link(p, data, config=current_app.config)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    # notify partner
    send_email(
        current_app.config,
        p.get("email") or "",
        "Your XpertIntern referral link is ready",
        f"<p>Hi {p.get('fullName')},</p><p>New link: <a href=\"{link.get('url')}\">{link.get('url')}</a></p>",
        text_body=f"New referral link: {link.get('url')}",
    )
    return jsonify({"link": serialize_link(link)}), 201


@partners_admin_bp.route("/partners/<partner_id>/coupons", methods=["POST"])
@jwt_required()
def admin_create_coupon(partner_id):
    err = _admin_err()
    if err:
        return err
    if not ObjectId.is_valid(partner_id):
        return jsonify({"error": "Invalid id"}), 400
    p = partners_coll().find_one({"_id": ObjectId(partner_id)})
    if not p:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json() or {}
    try:
        coupon = create_partner_coupon(p, data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    send_email(
        current_app.config,
        p.get("email") or "",
        f"Your coupon code {coupon.get('code')} is ready",
        f"<p>Hi {p.get('fullName')},</p><p>Share coupon <strong>{coupon.get('code')}</strong> with students.</p>",
        text_body=f"Coupon: {coupon.get('code')}",
    )
    return jsonify({"coupon": serialize_coupon(coupon)}), 201


@partners_admin_bp.route("/partners/payouts/eligible", methods=["GET"])
@jwt_required()
def admin_payouts_eligible():
    err = _admin_err()
    if err:
        return err
    release_eligible_commissions()
    pipeline = [
        {"$match": {"status": "eligible"}},
        {"$group": {"_id": "$partnerId", "amount": {"$sum": "$commissionAmount"}, "count": {"$sum": 1}}},
        {"$match": {"amount": {"$gte": 500}}},
    ]
    rows = list(commissions_coll().aggregate(pipeline))
    items = []
    for r in rows:
        pid = r["_id"]
        p = partners_coll().find_one({"_id": ObjectId(pid)}) if ObjectId.is_valid(str(pid)) else None
        if not p:
            continue
        items.append({
            "partnerId": pid,
            "partnerCode": p.get("partnerCode"),
            "fullName": p.get("fullName"),
            "email": p.get("email"),
            "amount": round(float(r["amount"]), 2),
            "commissionCount": r["count"],
            "upiId": p.get("upiId") or "",
            "bank": p.get("bank") or {},
        })
    return jsonify({"items": items})


@partners_admin_bp.route("/partners/payouts/process", methods=["POST"])
@jwt_required()
def admin_payouts_process():
    err = _admin_err()
    if err:
        return err
    data = request.get_json() or {}
    ids = data.get("partnerIds") or []
    uti = (data.get("transactionRef") or data.get("utr") or "").strip()
    if not ids or not uti:
        return jsonify({"error": "partnerIds and transactionRef are required"}), 400
    actor = _actor()
    results = process_payouts(
        partner_ids=ids,
        admin_email=actor["email"],
        uti_ref=uti,
        method=(data.get("method") or "upi"),
        config=current_app.config,
    )
    log_admin_action(
        action="partner_payout_processed",
        entity_type="partner_payout",
        entity_id="",
        meta={"count": len(results), "utr": uti},
        request=request,
        actor_id=actor["id"],
        actor_email=actor["email"],
    )
    return jsonify({"processed": len(results), "payouts": [{"payoutId": p["payoutId"], "amount": p["amount"], "partnerCode": p.get("partnerCode")} for p in results]})


@partners_admin_bp.route("/partners/meta", methods=["GET"])
@jwt_required()
def admin_partners_meta():
    err = _admin_err()
    if err:
        return err
    # Opportunistic maintenance: auto-reject stale info requests
    try:
        auto_reject_stale_info_requests()
    except Exception:
        current_app.logger.exception("auto_reject_stale failed")
    trainings = [{"id": str(c["_id"]), "title": c.get("title") or ""} for c in get_courses_collection().find({"active": True}).sort("title", 1)]
    pending = applications_coll().count_documents({"status": {"$in": ["submitted", "under_review", "needs_more_info"]}})
    return jsonify({"trainings": trainings, "rejectReasons": REJECT_REASONS, "pendingApplications": pending})


@partners_admin_bp.route("/partners/jobs/auto-reject", methods=["POST"])
@jwt_required()
def admin_run_auto_reject():
    err = _admin_err()
    if err:
        return err
    n = auto_reject_stale_info_requests()
    return jsonify({"rejected": n})


@partners_admin_bp.route("/partners/applications/<app_id>/notes", methods=["POST"])
@jwt_required()
def admin_app_notes(app_id):
    err = _admin_err()
    if err:
        return err
    doc = applications_coll().find_one({"_id": ObjectId(app_id)}) if ObjectId.is_valid(app_id) else applications_coll().find_one({"applicationId": app_id.upper()})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    note = ((request.get_json() or {}).get("note") or "").strip()
    if not note:
        return jsonify({"error": "Note required"}), 400
    append_app_history(doc["_id"], "admin_note", "admin", note)
    applications_coll().update_one({"_id": doc["_id"]}, {"$set": {"internalNotes": note, "updatedAt": datetime.utcnow()}})
    return jsonify({"ok": True})
