"""
Admin: dashboard, course CRUD, students, leads, payments, companies, internships, certificates. Admin JWT required.
"""
import base64
import os
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from werkzeug.utils import secure_filename
from bson import ObjectId
from io import BytesIO

from flask import Blueprint, current_app, request, jsonify, send_file, Response
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.routes.enrollments import _serialize_curriculum_quiz_attempts, _serialize_submission
from app.services.course_media_storage import (
    course_media_object_exists,
    parse_stored_course_media_url,
    save_uploaded_file,
)
from app.certificate_pdf import build_course_certificate_pdf
from app.certificate_quiz_pass import apply_quiz_pass_certificate
from app.certificate_storage import delete_certificate_pdf, save_certificate_pdf
from app.certificate_verification import (
    allocate_certificate_number,
    certificate_admin_detail_fields,
    certificate_pdf_bytes,
    find_certificate_by_no,
    log_certificate_audit,
    normalize_cert_no,
    parse_certificate_admin_fields,
)
from app.certificate_bulk import (
    active_bulk_progress,
    build_csv_template,
    build_errors_xlsx,
    build_xlsx_template,
    create_bulk_certificate_job,
    get_bulk_job,
    list_bulk_jobs,
    parse_upload_file,
    process_bulk_cert_job,
    retry_certificate_pdf,
    validate_bulk_rows,
    _serialize_job,
)
from app.services.curriculum import normalize_curriculum
from app.services.enrollment_excel import (
    assignment_submissions_submitted_count,
    build_enrollment_workbook_bytes,
    export_row_for_enrollment,
    merged_student_fields_for_admin,
    norm_approve_certificate_cell,
    parse_workbook_rows,
    row_email,
    row_enrollment_id,
)
from app.enrollment_lookup import course_id_enrollment_filter
from app.db import (
    get_db,
    get_users_collection,
    get_contacts_collection,
    get_orders_collection,
    get_courses_collection,
    get_enrollments_collection,
    get_course_reviews_collection,
    get_applications_collection,
    get_internships_collection,
    get_certificates_collection,
    get_followups_collection,
    get_support_tickets_collection,
    get_app_settings_collection,
    get_activity_logs_collection,
    get_bulk_invoice_jobs_collection,
)

from app.activity_log import log_admin_action, serialize_activity_log
from app.attendance_util import class_link_session_key, norm_attendance_status, parse_class_link_date
from app.email_smtp import send_support_ticket_staff_reply, send_support_ticket_status_update, send_payment_success_email
from app.course_legacy import migrate_legacy_course_fields
from app.course_publish_notify import (
    newly_published_curriculum_topic_titles,
    newly_published_flat_assignments,
    newly_published_flat_quizzes,
    notify_enrolled_content_published,
)
from app.checkout_coupon import count_successful_redemptions_for_course
from app.payment_admin import (
    BULK_THRESHOLD,
    BULK_CONCURRENT_LIMIT,
    collect_payment_filter_params,
    compute_payments_summary,
    count_active_bulk_jobs,
    create_bulk_job,
    build_bulk_zip,
    enrich_payment_row,
    generate_and_store_invoice_pdf,
    get_stored_invoice_pdf,
    invoice_filename,
    list_payments,
    load_user_course_maps,
    resolve_university_user_ids,
    build_orders_mongo_query,
)

admin_bp = Blueprint("admin", __name__)


def _slugify_title(title: str) -> str:
    s = (title or "").lower().strip()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return (s[:80] or "training")


def _unique_course_slug(coll, base: str) -> str:
    slug = (base or "training").strip("-")[:80] or "training"
    candidate = slug
    n = 2
    while coll.find_one({"slug": candidate}):
        candidate = f"{slug}-{n}"[:80]
        n += 1
    return candidate


def _coerce_str_list(val):
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if str(x).strip()]
    if isinstance(val, str):
        return [ln.strip() for ln in val.replace("\r\n", "\n").split("\n") if ln.strip()]
    return []


def _sum_order_amounts(orders_coll, match: dict) -> float:
    """Aggregate sum(amount) without loading every document (avoids large full scans in Python)."""
    pipeline = [
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount", 0]}}}},
    ]
    rows = list(orders_coll.aggregate(pipeline))
    if not rows or rows[0].get("total") is None:
        return 0.0
    return float(rows[0]["total"])


def _admin_panel_allowed_email() -> str:
    return (current_app.config.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()


def _admin_required():
    """After @jwt_required(): admin role, admin-portal token, and allowed email only."""
    claims = get_jwt()
    if claims.get("role") != "admin" or claims.get("admin_portal") is not True:
        return jsonify({"error": "Admin access required", "code": "admin_portal_required"}), 403
    email = (claims.get("email") or "").strip().lower()
    if email != _admin_panel_allowed_email():
        return jsonify({"error": "Admin panel access denied"}), 403
    return None


def _admin_actor() -> dict:
    """Current admin identity for activity logs."""
    claims = get_jwt() or {}
    uid = get_jwt_identity()
    email = (claims.get("email") or "").strip().lower()
    name = ""
    if uid and ObjectId.is_valid(str(uid)):
        u = get_users_collection().find_one({"_id": ObjectId(str(uid))}, {"name": 1, "fullName": 1, "email": 1})
        if u:
            name = (u.get("name") or u.get("fullName") or "").strip()
            if not email:
                email = (u.get("email") or "").strip().lower()
    return {
        "actor_id": str(uid) if uid else "",
        "actor_email": email,
        "actor_name": name or email,
    }


def _log_admin(action: str, entity_type: str, entity_id: str | None = None, *, old_value=None, new_value=None, meta=None):
    actor = _admin_actor()
    log_admin_action(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        meta=meta,
        request=request,
        actor_id=actor["actor_id"],
        actor_email=actor["actor_email"],
        actor_name=actor["actor_name"],
    )


def _user_to_row(u):
    acct = (u.get("accountStatus") or "active").strip().lower()
    if u.get("deleted") is True or acct == "deleted":
        status_label = "Deleted"
    elif acct == "suspended":
        status_label = "Suspended"
    else:
        status_label = "Active"
    return {
        "id": str(u["_id"]),
        "name": u.get("name") or u.get("fullName") or "",
        "email": u.get("email", ""),
        "mobile": u.get("mobile") or "",
        "university": u.get("university") or "",
        "collegeName": u.get("collegeName") or "",
        "course": u.get("course") or "",
        "branch": u.get("branch") or u.get("stream") or u.get("subject") or "",
        "semester": u.get("semester") or "",
        "registered": u.get("createdAt").strftime("%Y-%m-%d") if u.get("createdAt") else "",
        "status": status_label,
        "accountStatus": acct if acct in ("active", "suspended", "deleted") else "active",
        "emailVerified": bool(u.get("emailVerified") or u.get("isEmailVerified")),
    }


def _lead_to_row(c):
    return {
        "id": str(c["_id"]),
        "name": c.get("name", ""),
        "mobile": c.get("phone") or c.get("mobile") or "",
        "email": c.get("email", ""),
        "university": c.get("university") or "",
        "course": c.get("course") or "",
        "queryType": c.get("queryFor", "General"),
        "submitted": c.get("createdAt").strftime("%Y-%m-%d") if c.get("createdAt") else "",
        "status": (c.get("status") or "new").replace("_", " ").title(),
        "assignedTo": c.get("assignedTo") or "—",
    }


def _course_to_item(c):
    deleted = bool(c.get("deleted"))
    active = bool(c.get("active", True)) and not deleted
    return {
        "id": str(c["_id"]),
        "title": c.get("title", ""),
        "description": c.get("description", ""),
        "shortDescription": c.get("shortDescription", "") or "",
        "category": c.get("category", "technical"),
        "duration": c.get("duration", ""),
        "mode": c.get("mode", "Online"),
        "universities": c.get("universities", ""),
        "price": c.get("price", 0),
        "tag": c.get("tag", ""),
        "active": active,
        "deleted": deleted,
        "deletedAt": c.get("deletedAt").isoformat() + "Z" if hasattr(c.get("deletedAt"), "isoformat") else (c.get("deletedAt") or None),
        "slug": c.get("slug", "") or "",
        "featuredImageUrl": c.get("featuredImageUrl", "") or "",
    }


def _course_to_detail(c):
    """Full course for manage/edit: includes batches, curriculum, classLinks, etc."""
    out = _course_to_item(c)
    out["slug"] = c.get("slug", "") or ""
    out["shortDescription"] = c.get("shortDescription", "")
    out["fullDescription"] = c.get("fullDescription", "")
    out["trainerName"] = c.get("trainerName", "")
    out["difficulty"] = c.get("difficulty", "") or "all"
    out["featuredImageUrl"] = c.get("featuredImageUrl", "") or ""
    out["introVideoUrl"] = c.get("introVideoUrl", "") or ""
    out["originalPrice"] = int(c.get("originalPrice") or 0)
    out["whatYouWillLearn"] = c.get("whatYouWillLearn") if isinstance(c.get("whatYouWillLearn"), list) else []
    out["targetAudience"] = c.get("targetAudience", "") or ""
    out["materialsIncluded"] = c.get("materialsIncluded") if isinstance(c.get("materialsIncluded"), list) else []
    out["instructions"] = c.get("instructions", "") or ""
    out["trainingTags"] = c.get("trainingTags") if isinstance(c.get("trainingTags"), list) else []
    out["listingVisibility"] = c.get("listingVisibility", "") or "public"
    out["scheduledPublishAt"] = c.get("scheduledPublishAt")
    out["marketingCategories"] = c.get("marketingCategories") if isinstance(c.get("marketingCategories"), list) else []
    out["authorId"] = c.get("authorId", "") or ""
    out["authorName"] = c.get("authorName", "") or ""
    out["durationValue"] = c.get("durationValue", "")
    out["durationUnit"] = c.get("durationUnit", "weeks")
    out["courses"] = c.get("courses", [])
    out["streams"] = c.get("streams", [])
    out["subjects"] = c.get("subjects") if isinstance(c.get("subjects"), list) else []
    out["trainingStartDate"] = (c.get("trainingStartDate") or "") or ""
    out["trainingEndDate"] = (c.get("trainingEndDate") or "") or ""
    tmx = c.get("trainingMaxSeats")
    out["trainingMaxSeats"] = None
    if tmx is not None and str(tmx).strip() != "":
        try:
            out["trainingMaxSeats"] = int(tmx)
        except (TypeError, ValueError):
            out["trainingMaxSeats"] = None
    out["batches"] = c.get("batches", [])
    out["curriculum"] = c.get("curriculum", [])
    out["classLinks"] = c.get("classLinks", [])
    out["studyMaterials"] = c.get("studyMaterials", [])
    out["assignments"] = c.get("assignments", [])
    out["quizzes"] = c.get("quizzes", [])
    out["announcements"] = c.get("announcements", [])
    out["completionQuizTitle"] = (c.get("completionQuizTitle") or "") or ""
    out["trainingKit"] = c.get("trainingKit") if isinstance(c.get("trainingKit"), dict) else {}
    out["enrollmentCoupons"] = c.get("enrollmentCoupons") if isinstance(c.get("enrollmentCoupons"), list) else []
    return out


@admin_bp.route("/courses", methods=["GET", "POST"])
@jwt_required()
def courses():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    if request.method == "GET":
        include_deleted = (request.args.get("includeDeleted") or "").strip().lower() in ("1", "true", "yes")
        status_f = (request.args.get("status") or "").strip().lower()
        search = request.args.get("search", "").strip()
        category = (request.args.get("category") or "").strip()
        university = (request.args.get("university") or "").strip()
        and_parts: list = []
        if include_deleted:
            and_parts.append({"deleted": True})
        else:
            and_parts.append({"$or": [{"deleted": {"$exists": False}}, {"deleted": False}]})
            if status_f == "active":
                and_parts.append({"active": True})
            elif status_f in ("inactive", "draft"):
                and_parts.append({"active": False})
        if search:
            and_parts.append(
                {
                    "$or": [
                        {"title": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}},
                    ]
                }
            )
        if category:
            and_parts.append({"category": {"$regex": f"^{re.escape(category)}$", "$options": "i"}})
        if university:
            and_parts.append({"universities": {"$regex": re.escape(university), "$options": "i"}})
        q = {"$and": and_parts} if len(and_parts) > 1 else (and_parts[0] if and_parts else {})
        cursor = coll.find(q).sort("createdAt", -1)
        items = [_course_to_item(c) for c in cursor]
        return jsonify({"items": items})
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    description = (data.get("description") or data.get("fullDesc") or "").strip()
    price = data.get("price") if data.get("price") is not None else data.get("fee")
    price = int(price or 0)
    mode_val = data.get("mode")
    if isinstance(mode_val, list):
        mode_str = ",".join(str(m) for m in mode_val) if mode_val else "Online"
    else:
        mode_str = (mode_val or "Online").strip()
    universities_val = data.get("universities")
    if isinstance(universities_val, list):
        universities_str = ",".join(str(u) for u in universities_val) if universities_val else ""
    else:
        universities_str = (universities_val or "").strip()
    duration_val = data.get("duration") or ""
    if data.get("durationValue"):
        duration_val = f"{data.get('durationValue')} {data.get('durationUnit', 'weeks')}"
    slug_input = (data.get("slug") or "").strip().lower()
    slug_base = _slugify_title(slug_input) if slug_input else _slugify_title(title)
    slug = _unique_course_slug(coll, slug_base)
    original_price = data.get("originalPrice")
    try:
        original_price = int(original_price) if original_price is not None else 0
    except (TypeError, ValueError):
        original_price = 0
    doc = {
        "title": title,
        "description": description,
        "slug": slug,
        "category": (data.get("category") or "technical").strip().lower(),
        "duration": duration_val.strip(),
        "mode": mode_str,
        "universities": universities_str,
        "price": price,
        "tag": (data.get("tag") or "").strip(),
        "active": data.get("active", True),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "difficulty": (data.get("difficulty") or "all").strip() or "all",
        "featuredImageUrl": (data.get("featuredImageUrl") or "").strip(),
        "introVideoUrl": (data.get("introVideoUrl") or "").strip(),
        "originalPrice": original_price,
        "whatYouWillLearn": _coerce_str_list(data.get("whatYouWillLearn")),
        "targetAudience": (data.get("targetAudience") or "").strip(),
        "materialsIncluded": _coerce_str_list(data.get("materialsIncluded")),
        "instructions": (data.get("instructions") or "").strip(),
        "trainingTags": _coerce_str_list(data.get("trainingTags")),
    }
    lv = (data.get("listingVisibility") or "public").strip().lower()
    if lv not in ("public", "unlisted"):
        lv = "public"
    doc["listingVisibility"] = lv
    sched = (data.get("scheduledPublishAt") or "").strip()
    if sched:
        doc["scheduledPublishAt"] = sched
    uid = get_jwt_identity()
    doc["authorId"] = str(uid) if uid else ""
    doc["authorName"] = ""
    if uid and ObjectId.is_valid(str(uid)):
        u = get_users_collection().find_one({"_id": ObjectId(uid)})
        if u:
            doc["authorName"] = (u.get("name") or u.get("fullName") or "").strip()
    if data.get("shortDescription") is not None:
        doc["shortDescription"] = (data.get("shortDescription") or "").strip()
    if data.get("fullDescription") is not None:
        doc["fullDescription"] = (data.get("fullDescription") or "").strip()
    if data.get("trainerName"):
        doc["trainerName"] = (data.get("trainerName") or "").strip()
    if data.get("durationValue") is not None:
        doc["durationValue"] = str(data.get("durationValue", "")).strip()
    if data.get("durationUnit"):
        doc["durationUnit"] = (data.get("durationUnit") or "weeks").strip()
    if isinstance(data.get("courses"), list):
        doc["courses"] = data["courses"]
    if isinstance(data.get("streams"), list):
        doc["streams"] = data["streams"]
    if isinstance(data.get("subjects"), list):
        doc["subjects"] = [str(x).strip() for x in data["subjects"] if str(x).strip()]
    if isinstance(data.get("batches"), list):
        doc["batches"] = data["batches"]
    ts = (data.get("trainingStartDate") or "").strip()
    if ts:
        doc["trainingStartDate"] = ts
    te = (data.get("trainingEndDate") or "").strip()
    if te:
        doc["trainingEndDate"] = te
    tms = data.get("trainingMaxSeats")
    if tms is not None and str(tms).strip() != "":
        try:
            doc["trainingMaxSeats"] = max(0, int(tms))
        except (TypeError, ValueError):
            pass
    if "curriculum" in data:
        norm, terr = normalize_curriculum(data.get("curriculum"))
        if terr:
            return jsonify({"error": terr}), 400
        doc["curriculum"] = norm
    for _field in ("featuredImageUrl", "introVideoUrl"):
        _u = (doc.get(_field) or "").strip()
        if _u:
            _bad = _hosted_course_media_missing_response(_u)
            if _bad:
                return _bad
    result = coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    if "trainingKit" in data and isinstance(data.get("trainingKit"), dict):
        coll.update_one({"_id": doc["_id"]}, {"$set": {"trainingKit": data["trainingKit"]}})
        doc["trainingKit"] = data["trainingKit"]
    if "enrollmentCoupons" in data and isinstance(data.get("enrollmentCoupons"), list):
        coll.update_one({"_id": doc["_id"]}, {"$set": {"enrollmentCoupons": data["enrollmentCoupons"]}})
        doc["enrollmentCoupons"] = data["enrollmentCoupons"]
    _log_admin("course.create", "course", str(doc["_id"]), new_value={"title": title, "active": doc.get("active")})
    return jsonify(_course_to_item(doc)), 201


@admin_bp.route("/activity-logs", methods=["GET"])
@jwt_required()
def activity_logs():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": [], "total": 0}), 503
    q: dict = {}
    entity_type = (request.args.get("entityType") or "").strip()
    entity_id = (request.args.get("entityId") or "").strip()
    actor_email = (request.args.get("actorEmail") or "").strip().lower()
    action = (request.args.get("action") or "").strip()
    if entity_type:
        q["entityType"] = entity_type
    if entity_id:
        q["entityId"] = entity_id
    if actor_email:
        q["actorEmail"] = actor_email
    if action:
        q["action"] = {"$regex": f"^{re.escape(action)}", "$options": "i"}
    try:
        page = max(1, int(request.args.get("page") or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = min(100, max(1, int(request.args.get("limit") or 50)))
    except (TypeError, ValueError):
        limit = 50
    coll = get_activity_logs_collection()
    total = coll.count_documents(q)
    cursor = coll.find(q).sort("createdAt", -1).skip((page - 1) * limit).limit(limit)
    items = [serialize_activity_log(d) for d in cursor]
    return jsonify({"items": items, "total": total, "page": page, "limit": limit})


@admin_bp.route("/courses/<course_id>/status", methods=["PATCH"])
@jwt_required()
def patch_course_status(course_id):
    """Activate or deactivate a training (CFRD §1)."""
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    if c.get("deleted"):
        return jsonify({"error": "Cannot change status of a deleted training. Restore it first."}), 400
    data = request.get_json() or {}
    if "active" not in data:
        return jsonify({"error": "active (boolean) is required"}), 400
    active = bool(data["active"])
    old = bool(c.get("active", True))
    coll.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": {"active": active, "updatedAt": datetime.utcnow()}},
    )
    _log_admin(
        "course.activate" if active else "course.deactivate",
        "course",
        course_id,
        old_value={"active": old},
        new_value={"active": active},
    )
    updated = coll.find_one({"_id": ObjectId(course_id)})
    return jsonify(_course_to_item(updated))


@admin_bp.route("/courses/<course_id>", methods=["DELETE"])
@jwt_required()
def soft_delete_course(course_id):
    """Soft-delete training (Super Admin). Body: { confirmTitle } must match title."""
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    if c.get("deleted"):
        return jsonify({"error": "Training already deleted"}), 400
    data = request.get_json(silent=True) or {}
    confirm = (data.get("confirmTitle") or data.get("title") or "").strip()
    title = (c.get("title") or "").strip()
    if not confirm or confirm.casefold() != title.casefold():
        return jsonify({"error": "Type the training title exactly to confirm delete"}), 400
    actor = _admin_actor()
    coll.update_one(
        {"_id": ObjectId(course_id)},
        {
            "$set": {
                "deleted": True,
                "deletedAt": datetime.utcnow(),
                "deletedBy": actor["actor_id"],
                "active": False,
                "updatedAt": datetime.utcnow(),
            }
        },
    )
    _log_admin("course.soft_delete", "course", course_id, old_value={"title": title, "active": c.get("active")}, new_value={"deleted": True})
    return jsonify({"ok": True, "id": course_id})


@admin_bp.route("/courses/<course_id>/restore", methods=["POST"])
@jwt_required()
def restore_course(course_id):
    """Restore soft-deleted training (Super Admin)."""
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    if not c.get("deleted"):
        return jsonify({"error": "Training is not deleted"}), 400
    coll.update_one(
        {"_id": ObjectId(course_id)},
        {
            "$set": {"deleted": False, "updatedAt": datetime.utcnow(), "active": False},
            "$unset": {"deletedAt": "", "deletedBy": ""},
        },
    )
    _log_admin("course.restore", "course", course_id, new_value={"deleted": False, "active": False})
    updated = coll.find_one({"_id": ObjectId(course_id)})
    return jsonify(_course_to_item(updated))


@admin_bp.route("/leads", methods=["GET"])
@jwt_required()
def leads():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    q = {}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if status and status != "all":
        q["status"] = status
    cursor = get_contacts_collection().find(q).sort("createdAt", -1)
    items = [_lead_to_row(c) for c in cursor]
    return jsonify({"items": items})


@admin_bp.route("/payments", methods=["GET"])
@jwt_required()
def payments():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": [], "total": 0, "message": "Database not configured"}), 503
    flt = collect_payment_filter_params(request.args)
    items, total = list_payments(flt)
    return jsonify({
        "items": items,
        "total": total,
        "page": flt["page"],
        "limit": flt["limit"],
    })


@admin_bp.route("/payments/summary", methods=["GET"])
@jwt_required()
def payments_summary():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({
            "totalRevenue": 0,
            "successfulCount": 0,
            "failedCount": 0,
            "pendingCount": 0,
            "refundsSum": 0,
            "refundsCount": 0,
            "percentChange": None,
            "error": "Database not configured",
        }), 503
    try:
        flt = collect_payment_filter_params(request.args)
        # Summary cards are aggregate metrics — never apply status filter to totals so
        # revenue/success/failed/pending/refunds always reflect the filter set except status.
        # Date/course/university/coupon still apply. Status remains for list, not cards.
        flt_cards = dict(flt)
        flt_cards["status"] = ""
        summary = compute_payments_summary(flt_cards)
        return jsonify(summary)
    except Exception:
        current_app.logger.exception("payments_summary failed")
        return jsonify({
            "totalRevenue": 0,
            "successfulCount": 0,
            "failedCount": 0,
            "pendingCount": 0,
            "refundsSum": 0,
            "refundsCount": 0,
            "percentChange": None,
        })


@admin_bp.route("/payments/bulk-invoice-download", methods=["POST"])
@jwt_required()
def payments_bulk_invoice_download():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    body = request.get_json(silent=True) or {}
    # Filters: query string wins, then body filters
    flt = collect_payment_filter_params(request.args)
    body_filters = body.get("filters") if isinstance(body.get("filters"), dict) else body
    for k in ("search", "status", "paymentMode", "dateFrom", "dateTo", "courseId", "university", "coupon"):
        if body_filters.get(k) and not request.args.get(k):
            flt[k] = str(body_filters.get(k) or "").strip()
    for k in ("amountMin", "amountMax"):
        if body_filters.get(k) is not None and flt.get(k) is None:
            try:
                flt[k] = float(body_filters[k])
            except (TypeError, ValueError):
                pass

    ids_raw = body.get("ids") if isinstance(body.get("ids"), list) else []
    use_filters = bool(body.get("useFilters"))
    orders_coll = get_orders_collection()
    orders: list = []

    if ids_raw and not use_filters:
        oids = [ObjectId(x) for x in ids_raw if ObjectId.is_valid(str(x))]
        orders = list(orders_coll.find({"_id": {"$in": oids}, "status": "success"}))
    else:
        # Force success-only for bulk invoices
        flt_bulk = dict(flt)
        flt_bulk["status"] = "success"
        uni_ids = resolve_university_user_ids(flt_bulk.get("university") or "")
        if uni_ids is not None and len(uni_ids) == 0:
            orders = []
        else:
            q = build_orders_mongo_query(flt_bulk, user_ids_for_university=uni_ids)
            # Cap scan for safety; job path for huge sets
            orders = list(orders_coll.find(q).sort("createdAt", -1).limit(BULK_THRESHOLD + 1))

    count = len(orders)
    actor = _admin_actor()
    if count == 0:
        return jsonify({"error": "No successful payments matched"}), 404

    if count > BULK_THRESHOLD:
        active = count_active_bulk_jobs(actor["actor_email"])
        if active >= BULK_CONCURRENT_LIMIT:
            return jsonify({
                "error": f"Too many concurrent bulk invoice jobs (max {BULK_CONCURRENT_LIMIT}). Wait for one to finish.",
                "code": "bulk_rate_limited",
            }), 429
        # Re-query all matching ids for the job (may be >501)
        flt_bulk = dict(flt)
        flt_bulk["status"] = "success"
        uni_ids = resolve_university_user_ids(flt_bulk.get("university") or "")
        q = build_orders_mongo_query(flt_bulk, user_ids_for_university=uni_ids) if (uni_ids is None or uni_ids) else {"_id": None}
        all_ids = [o["_id"] for o in orders_coll.find(q, {"_id": 1}).sort("createdAt", -1)]
        if ids_raw and not use_filters:
            all_ids = [ObjectId(x) for x in ids_raw if ObjectId.is_valid(str(x))]
        job = create_bulk_job(
            admin_email=actor["actor_email"],
            admin_id=actor["actor_id"],
            order_ids=all_ids,
            filters=flt,
            app=current_app._get_current_object(),
        )
        _log_admin(
            "payment.bulk_invoice_job",
            "payment",
            str(job["_id"]),
            meta={"count": len(all_ids), "mode": "async"},
        )
        return jsonify({
            "ok": True,
            "async": True,
            "jobId": str(job["_id"]),
            "count": len(all_ids),
            "message": (
                f"More than {BULK_THRESHOLD} invoices — job queued. "
                "You will receive an email when processing finishes."
            ),
        }), 202

    zip_bytes = build_bulk_zip(orders)
    _log_admin(
        "payment.bulk_invoice_download",
        "payment",
        None,
        meta={"count": count, "mode": "sync", "bytes": len(zip_bytes)},
    )
    return send_file(
        BytesIO(zip_bytes),
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"invoices_bulk_{datetime.utcnow().strftime('%Y%m%d')}.zip",
    )


# ----- Dashboard -----
@admin_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    users = get_users_collection()
    courses = get_courses_collection()
    orders = get_orders_collection()
    contacts = get_contacts_collection()
    enrollments = get_enrollments_collection()
    internships = get_internships_collection()

    total_students = users.count_documents({"role": "student"})
    total_companies = users.count_documents({"role": "company"})
    total_courses = courses.count_documents({})
    total_internships = internships.count_documents({})
    total_orders = orders.count_documents({})
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total_revenue = _sum_order_amounts(orders, {"status": "success"})
    revenue_this_month = _sum_order_amounts(
        orders,
        {"status": "success", "createdAt": {"$gte": month_start}},
    )
    certs_count = get_certificates_collection().count_documents({})
    leads_7d = contacts.count_documents({"createdAt": {"$gte": now - timedelta(days=7)}})
    pending_companies = users.count_documents({"role": "company", "status": "pending"})
    pending_internships = internships.count_documents({"status": "pending_approval"})
    active_enrollments = enrollments.count_documents({})

    kpis = {
        "totalStudents": total_students,
        "totalTrainings": total_courses,
        "totalCompanies": total_companies,
        "totalInternships": total_internships,
        "totalRevenue": total_revenue,
        "revenueThisMonth": revenue_this_month,
        "certificatesGenerated": certs_count,
        "newLeads7Days": leads_7d,
        "pendingApprovals": (pending_companies or 0) + (pending_internships or 0),
        "activeEnrollments": active_enrollments,
    }

    pending_items = [
        {"label": "Pending Company Approvals", "count": pending_companies or 0, "to": "/admin/companies?tab=pending"},
        {"label": "Pending Internship Listings", "count": pending_internships or 0, "to": "/admin/internships?tab=pending"},
        {"label": "Pending Refund Requests", "count": 0, "to": "/admin/payments?tab=refunds"},
        {"label": "New Leads", "count": leads_7d, "to": "/admin/leads"},
    ]

    recent = []
    for u in users.find({"role": "student"}).sort("createdAt", -1).limit(3):
        recent.append({"type": "student", "text": f"New student registered — {u.get('name') or u.get('fullName') or 'Student'}", "time": u.get("createdAt"), "entityId": str(u["_id"])})
    for c in contacts.find().sort("createdAt", -1).limit(3):
        recent.append({"type": "lead", "text": f"Lead from contact form — {c.get('name', '')}", "time": c.get("createdAt"), "entityId": str(c["_id"])})
    for o in orders.find({"status": "success"}).sort("createdAt", -1).limit(3):
        recent.append({"type": "payment", "text": f"Payment received — ₹{o.get('amount', 0)}", "time": o.get("createdAt"), "entityId": str(o["_id"])})
    recent.sort(key=lambda x: x["time"] or datetime.min, reverse=True)
    recent = recent[:15]
    for r in recent:
        if isinstance(r.get("time"), datetime):
            r["time"] = r["time"].strftime("%Y-%m-%d %H:%M")
        else:
            r["time"] = ""

    recent_kit = []
    kit_pending = 0
    try:
        from app.kit_orders import recent_kit_orders, sync_kit_orders_from_orders
        sync_kit_orders_from_orders(50)
        recent_kit, kit_pending = recent_kit_orders(5)
    except Exception:
        current_app.logger.exception("kit orders dashboard widget")

    return jsonify({
        "kpis": kpis,
        "pendingItems": pending_items,
        "recentActivity": recent,
        "recentKitOrders": recent_kit,
        "kitOrdersPendingCount": kit_pending,
    })


@admin_bp.route("/kit-orders", methods=["GET"])
@jwt_required()
def admin_kit_orders_list():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": [], "total": 0}), 503
    from app.kit_orders import list_kit_orders, sync_kit_orders_from_orders
    try:
        sync_kit_orders_from_orders(100)
    except Exception:
        pass
    items, total = list_kit_orders(request.args)
    try:
        page = max(1, int(request.args.get("page") or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = min(200, max(1, int(request.args.get("limit") or 50)))
    except (TypeError, ValueError):
        limit = 50
    return jsonify({"items": items, "total": total, "page": page, "limit": limit})


@admin_bp.route("/kit-orders/<kit_id>/status", methods=["PATCH"])
@jwt_required()
def admin_kit_order_status(kit_id):
    err = _admin_required()
    if err:
        return err
    from app.kit_orders import get_kit_orders_collection, serialize_kit_order
    if not ObjectId.is_valid(kit_id):
        return jsonify({"error": "Invalid id"}), 400
    data = request.get_json() or {}
    status = (data.get("status") or "").strip().lower()
    allowed = {"pending", "packed", "dispatched", "delivered", "returned", "cancelled"}
    if status not in allowed:
        return jsonify({"error": f"status must be one of {sorted(allowed)}"}), 400
    tracking = (data.get("trackingNo") or data.get("tracking") or "").strip()
    coll = get_kit_orders_collection()
    doc = coll.find_one({"_id": ObjectId(kit_id)})
    if not doc:
        return jsonify({"error": "Kit order not found"}), 404
    upd = {"status": status, "updatedAt": datetime.utcnow()}
    if tracking or status == "dispatched":
        if tracking:
            upd["trackingNo"] = tracking
    coll.update_one({"_id": ObjectId(kit_id)}, {"$set": upd})
    _log_admin(
        "kit_order.status",
        "kit_order",
        kit_id,
        old_value={"status": doc.get("status")},
        new_value={"status": status, "trackingNo": tracking or doc.get("trackingNo")},
    )
    updated = coll.find_one({"_id": ObjectId(kit_id)})
    return jsonify(serialize_kit_order(updated))


@admin_bp.route("/kit-orders/export", methods=["GET"])
@jwt_required()
def admin_kit_orders_export():
    err = _admin_required()
    if err:
        return err
    from app.kit_orders import list_kit_orders
    import csv
    from io import StringIO
    items, _ = list_kit_orders({**request.args, "page": "1", "limit": "5000"})
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["Kit Order ID", "Kit", "Training", "Student", "Email", "Phone", "City", "State", "Status", "Tracking", "Ordered At", "Amount"])
    for r in items:
        ship = r.get("shippingAddress") or {}
        w.writerow([
            r.get("kitOrderId"), r.get("kitName"), r.get("courseTitle"), r.get("studentName"),
            r.get("studentEmail"), r.get("studentPhone"), ship.get("city"), ship.get("state"),
            r.get("status"), r.get("trackingNo"), r.get("orderedAt"), r.get("amount"),
        ])
    _log_admin("kit_order.export", "kit_order", None, meta={"count": len(items)})
    return Response(
        buf.getvalue().encode("utf-8-sig"),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=kit-orders.csv"},
    )


@admin_bp.route("/kit-orders/shipping-labels", methods=["POST"])
@jwt_required()
def admin_kit_shipping_labels():
    """Simple multi-label PDF (approx 4x6 inch cells on A4)."""
    err = _admin_required()
    if err:
        return err
    from app.kit_orders import get_kit_orders_collection, serialize_kit_order
    from fpdf import FPDF
    data = request.get_json() or {}
    ids = data.get("ids") if isinstance(data.get("ids"), list) else []
    coll = get_kit_orders_collection()
    docs = []
    for i in ids[:100]:
        if ObjectId.is_valid(str(i)):
            d = coll.find_one({"_id": ObjectId(str(i))})
            if d:
                docs.append(serialize_kit_order(d))
    if not docs:
        return jsonify({"error": "No kit orders selected"}), 400
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    for r in docs:
        pdf.add_page()
        ship = r.get("shippingAddress") or {}
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "XpertIntern Shipping Label", ln=1)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, f"Order: {r.get('kitOrderId')}", ln=1)
        pdf.cell(0, 7, f"Kit: {r.get('kitName')}", ln=1)
        pdf.cell(0, 7, f"Training: {(r.get('courseTitle') or '')[:60]}", ln=1)
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 7, "Ship To:", ln=1)
        pdf.set_font("Helvetica", "", 11)
        for line in (
            r.get("studentName"),
            ship.get("line1"),
            ship.get("line2"),
            f"{ship.get('city') or ''}, {ship.get('state') or ''} {ship.get('pincode') or ''}",
            f"Phone: {ship.get('phone') or r.get('studentPhone') or ''}",
        ):
            if line and str(line).strip():
                pdf.cell(0, 6, str(line)[:90], ln=1)
        pdf.ln(6)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"TXN: {r.get('orderId') or r.get('paymentId')}", ln=1)
    out = pdf.output()
    if isinstance(out, (bytes, bytearray)):
        payload = bytes(out)
    else:
        payload = str(out).encode("latin-1", errors="ignore")
    _log_admin("kit_order.print_labels", "kit_order", None, meta={"count": len(docs)})
    return send_file(
        BytesIO(payload),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="shipping-labels.pdf",
    )


def _hosted_course_media_missing_response(url: str):
    """
    If url points at our /api/courses/media/... storage, require the object to exist.
    Prevents saving DB rows whose cover was uploaded only to another environment (e.g. local disk).
    """
    ref = parse_stored_course_media_url(url)
    if not ref:
        return None
    kind, fname = ref
    try:
        if course_media_object_exists(kind, fname):
            return None
    except Exception:
        current_app.logger.exception("hosted course media existence check failed")
        return jsonify({"error": "Could not verify course media storage"}), 503
    return (
        jsonify(
            {
                "error": (
                    "Course media file not found for the URL you saved. Choose the file again in Admin "
                    "(upload) while using this same API, or use a full https:// image or video link."
                ),
                "code": "course_media_missing",
                "kind": kind,
                "file": fname,
            }
        ),
        400,
    )


# ----- Course by ID -----
@admin_bp.route("/courses/<course_id>", methods=["GET"])
@jwt_required()
def get_course(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    c = get_courses_collection().find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    c = migrate_legacy_course_fields(get_courses_collection(), c)
    return jsonify(_course_to_detail(c))


@admin_bp.route("/courses/<course_id>", methods=["PATCH"])
@jwt_required()
def update_course(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    data = request.get_json() or {}
    updates = {}
    for key in ("title", "description", "shortDescription", "fullDescription", "category", "duration", "trainerName", "durationValue", "durationUnit"):
        if key in data:
            updates[key] = data[key]
    if "universities" in data:
        uv = data["universities"]
        if isinstance(uv, list):
            updates["universities"] = ",".join(str(x) for x in uv) if uv else ""
        else:
            updates["universities"] = uv
    if "mode" in data:
        mv = data["mode"]
        if isinstance(mv, list):
            updates["mode"] = ",".join(str(m) for m in mv) if mv else "Online"
        else:
            updates["mode"] = (str(mv or "Online")).strip() or "Online"
    if "price" in data or "fee" in data:
        updates["price"] = int(data.get("price") or data.get("fee") or 0)
    if "active" in data:
        updates["active"] = bool(data["active"])
    if "batches" in data and isinstance(data["batches"], list):
        updates["batches"] = data["batches"]
    if "curriculum" in data:
        norm, terr = normalize_curriculum(data.get("curriculum"))
        if terr:
            return jsonify({"error": terr}), 400
        updates["curriculum"] = norm
    if "classLinks" in data and isinstance(data["classLinks"], list):
        updates["classLinks"] = data["classLinks"]
    if "studyMaterials" in data and isinstance(data["studyMaterials"], list):
        updates["studyMaterials"] = data["studyMaterials"]
    if "assignments" in data and isinstance(data["assignments"], list):
        updates["assignments"] = data["assignments"]
    if "quizzes" in data and isinstance(data["quizzes"], list):
        updates["quizzes"] = data["quizzes"]
    if "announcements" in data and isinstance(data["announcements"], list):
        updates["announcements"] = data["announcements"]
    if "slug" in data:
        new_slug = _slugify_title(str(data.get("slug") or ""))
        if new_slug:
            clash = coll.find_one({"slug": new_slug, "_id": {"$ne": ObjectId(course_id)}})
            if clash:
                return jsonify({"error": "Slug already in use"}), 400
            updates["slug"] = new_slug
    if "difficulty" in data:
        updates["difficulty"] = (str(data.get("difficulty") or "all").strip() or "all")
    if "featuredImageUrl" in data:
        fi = (str(data.get("featuredImageUrl") or "")).strip()
        bad = _hosted_course_media_missing_response(fi)
        if bad:
            return bad
        updates["featuredImageUrl"] = fi
    if "introVideoUrl" in data:
        iv = (str(data.get("introVideoUrl") or "")).strip()
        bad_iv = _hosted_course_media_missing_response(iv)
        if bad_iv:
            return bad_iv
        updates["introVideoUrl"] = iv
    if "originalPrice" in data:
        try:
            updates["originalPrice"] = int(data.get("originalPrice") or 0)
        except (TypeError, ValueError):
            updates["originalPrice"] = 0
    if "whatYouWillLearn" in data:
        updates["whatYouWillLearn"] = _coerce_str_list(data.get("whatYouWillLearn"))
    if "targetAudience" in data:
        updates["targetAudience"] = (str(data.get("targetAudience") or "")).strip()
    if "materialsIncluded" in data:
        updates["materialsIncluded"] = _coerce_str_list(data.get("materialsIncluded"))
    if "instructions" in data:
        updates["instructions"] = (str(data.get("instructions") or "")).strip()
    if "trainingTags" in data:
        updates["trainingTags"] = _coerce_str_list(data.get("trainingTags"))
    if "listingVisibility" in data:
        lv = (str(data.get("listingVisibility") or "public")).strip().lower()
        updates["listingVisibility"] = lv if lv in ("public", "unlisted") else "public"
    if "scheduledPublishAt" in data:
        s = (str(data.get("scheduledPublishAt") or "")).strip()
        if s:
            updates["scheduledPublishAt"] = s
        else:
            updates["scheduledPublishAt"] = None
    if "marketingCategories" in data and isinstance(data.get("marketingCategories"), list):
        updates["marketingCategories"] = [str(x).strip() for x in data["marketingCategories"] if str(x).strip()]
    if "courses" in data and isinstance(data["courses"], list):
        updates["courses"] = data["courses"]
    if "streams" in data and isinstance(data["streams"], list):
        updates["streams"] = data["streams"]
    if "subjects" in data and isinstance(data.get("subjects"), list):
        updates["subjects"] = [str(x).strip() for x in data["subjects"] if str(x).strip()]
    if "trainingStartDate" in data:
        ts = (str(data.get("trainingStartDate") or "")).strip()
        updates["trainingStartDate"] = ts if ts else None
    if "trainingEndDate" in data:
        te = (str(data.get("trainingEndDate") or "")).strip()
        updates["trainingEndDate"] = te if te else None
    if "trainingMaxSeats" in data:
        tms = data.get("trainingMaxSeats")
        if tms is None or str(tms).strip() == "":
            updates["trainingMaxSeats"] = None
        else:
            try:
                updates["trainingMaxSeats"] = max(0, int(tms))
            except (TypeError, ValueError):
                updates["trainingMaxSeats"] = None
    if "completionQuizTitle" in data:
        raw_ct = (str(data.get("completionQuizTitle") or "")).strip()
        updates["completionQuizTitle"] = raw_ct[:500]
    if "certificateEmailOnly" in data:
        updates["certificateEmailOnly"] = bool(data.get("certificateEmailOnly"))
    if "trainingKit" in data and isinstance(data.get("trainingKit"), dict):
        updates["trainingKit"] = data["trainingKit"]
    if "enrollmentCoupons" in data and isinstance(data.get("enrollmentCoupons"), list):
        updates["enrollmentCoupons"] = data["enrollmentCoupons"]
    pub_assignments: list[str] = []
    pub_quizzes: list[str] = []
    pub_curriculum: list[str] = []
    if "assignments" in updates and isinstance(updates.get("assignments"), list):
        pub_assignments = newly_published_flat_assignments(c.get("assignments"), updates["assignments"])
    if "quizzes" in updates and isinstance(updates.get("quizzes"), list):
        pub_quizzes = newly_published_flat_quizzes(c.get("quizzes"), updates["quizzes"])
    if "curriculum" in updates:
        pub_curriculum = newly_published_curriculum_topic_titles(c.get("curriculum"), updates["curriculum"])
    if updates:
        updates["updatedAt"] = datetime.utcnow()
        coll.update_one({"_id": ObjectId(course_id)}, {"$set": updates})
    updated = coll.find_one({"_id": ObjectId(course_id)})
    if pub_assignments or pub_quizzes or pub_curriculum:
        try:
            notify_enrolled_content_published(
                course_id=course_id,
                course_title=str((updated or c).get("title") or ""),
                assignment_titles=pub_assignments,
                quiz_titles=pub_quizzes,
                curriculum_titles=pub_curriculum,
            )
        except Exception:
            current_app.logger.exception("notify_enrolled_content_published")
    return jsonify(_course_to_detail(updated))


@admin_bp.route("/courses/<course_id>/curriculum", methods=["PUT"])
@jwt_required()
def put_course_curriculum(course_id):
    """Replace course curriculum with a normalized payload (Add Training shape)."""
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    data = request.get_json() or {}
    if "curriculum" not in data:
        return jsonify({"error": "Request body must include a curriculum array"}), 400
    norm, terr = normalize_curriculum(data.get("curriculum"))
    if terr:
        return jsonify({"error": terr}), 400
    pub_curriculum = newly_published_curriculum_topic_titles(c.get("curriculum"), norm)
    coll.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": {"curriculum": norm, "updatedAt": datetime.utcnow()}},
    )
    if pub_curriculum:
        try:
            notify_enrolled_content_published(
                course_id=course_id,
                course_title=str(c.get("title") or ""),
                assignment_titles=[],
                quiz_titles=[],
                curriculum_titles=pub_curriculum,
            )
        except Exception:
            current_app.logger.exception("notify_enrolled_content_published curriculum")
    return jsonify({"ok": True, "curriculum": norm}), 200


@admin_bp.route("/courses/<course_id>/coupon-redemptions", methods=["GET"])
@jwt_required()
def admin_course_coupon_redemptions(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    c = get_courses_collection().find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    rows = c.get("enrollmentCoupons") if isinstance(c.get("enrollmentCoupons"), list) else []
    orders_coll = get_orders_collection()
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code") or "").strip().upper()
        if not code:
            continue
        used = count_successful_redemptions_for_course(orders_coll, course_id, code)
        max_u = row.get("maxUses")
        try:
            max_uses = int(max_u) if max_u is not None and str(max_u).strip() != "" else None
        except (TypeError, ValueError):
            max_uses = None
        out.append({"code": code, "used": used, "maxUses": max_uses})
    return jsonify({"items": out})


@admin_bp.route("/courses/<course_id>/curriculum-quiz-attempts", methods=["GET"])
@jwt_required()
def admin_course_curriculum_quiz_attempts(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not get_courses_collection().find_one({"_id": ObjectId(course_id)}):
        return jsonify({"error": "Course not found"}), 404
    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    items = []
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)).sort("createdAt", -1):
        raw_attempts = e.get("curriculumQuizAttempts")
        if not isinstance(raw_attempts, list) or not raw_attempts:
            continue
        uid = str(e.get("userId") or "")
        u = users_coll.find_one({"_id": ObjectId(uid)}) if uid and ObjectId.is_valid(uid) else None
        name = (u.get("name") or u.get("fullName") or "") if u else ""
        email = (u.get("email") or "") if u else ""
        items.append({
            "enrollmentId": str(e.get("_id")),
            "userId": uid,
            "studentName": name,
            "email": email,
            "attempts": _serialize_curriculum_quiz_attempts(e),
        })
    return jsonify({"items": items})


def _enrollment_list_filters_from_request():
    return {
        "university": (request.args.get("university") or "").strip(),
        "college": (request.args.get("college") or "").strip(),
        "course": (request.args.get("course") or "").strip(),
        "branch": (request.args.get("branch") or "").strip(),
        "date_from": (request.args.get("dateFrom") or "").strip(),
        "date_to": (request.args.get("dateTo") or "").strip(),
        "search": (request.args.get("search") or "").strip().lower(),
    }


def _enrollment_created_date_only(e):
    ca = e.get("createdAt")
    if ca is None:
        return None
    if hasattr(ca, "date"):
        return ca.date()
    return None


def _parse_ymd_date(s):
    if not s or len(s) < 10:
        return None
    try:
        return datetime.strptime(s.strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _enrollment_matches_filters(e, u, flt):
    if not any(flt.values()):
        return True
    m = merged_student_fields_for_admin(e, u)
    if flt["university"] and flt["university"].lower() not in m["university"].lower():
        return False
    if flt["college"] and flt["college"].lower() not in m["collegeName"].lower():
        return False
    if flt["course"] and flt["course"].lower() not in m["course"].lower():
        return False
    if flt["branch"] and flt["branch"].lower() not in m["branch"].lower():
        return False
    ed = _enrollment_created_date_only(e)
    df = _parse_ymd_date(flt["date_from"])
    dt = _parse_ymd_date(flt["date_to"])
    if df and ed and ed < df:
        return False
    if dt and ed and ed > dt:
        return False
    if flt["search"]:
        hay = f"{m['name']} {m['email']} {m['registrationNo']} {m['mobile']}".lower()
        if flt["search"] not in hay:
            return False
    return True


@admin_bp.route("/courses/<course_id>/enrollments", methods=["GET"])
@jwt_required()
def course_enrollments(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    flt = _enrollment_list_filters_from_request()
    cursor = enroll_coll.find(course_id_enrollment_filter(course_id)).sort("createdAt", -1)
    items = []
    for e in cursor:
        uid = e.get("userId")
        uids = str(uid).strip() if uid is not None else ""
        u = users_coll.find_one({"_id": ObjectId(uids)}) if uids and ObjectId.is_valid(uids) else None
        if not _enrollment_matches_filters(e, u, flt):
            continue
        m = merged_student_fields_for_admin(e, u)
        subs = e.get("assignmentSubmissions") if isinstance(e.get("assignmentSubmissions"), list) else []
        items.append({
            "id": str(e["_id"]),
            "userId": e.get("userId", ""),
            "name": m["name"],
            "email": m["email"],
            "mobile": m["mobile"],
            "university": m["university"],
            "collegeName": m["collegeName"],
            "course": m["course"],
            "stream": m["branch"],
            "branch": m["branch"],
            "semester": m["semester"],
            "registrationNumber": m["registrationNo"],
            "enrolledAt": e.get("createdAt").strftime("%Y-%m-%d") if e.get("createdAt") else "",
            "submissionsCount": assignment_submissions_submitted_count(e),
            "batch": e.get("batch", ""),
            "orderId": e.get("orderId", ""),
            "assignmentSubmissions": [_serialize_submission(x) for x in subs if isinstance(x, dict)],
        })
    return jsonify({"items": items})


@admin_bp.route("/courses/<course_id>/reviews", methods=["GET"])
@jwt_required()
def admin_course_reviews(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    coll = get_course_reviews_collection()
    rows = list(coll.find({"courseId": course_id}).sort("createdAt", -1).limit(500))
    items = []
    for r in rows:
        items.append({
            "id": str(r["_id"]),
            "studentName": r.get("studentName") or "",
            "userId": str(r.get("userId") or ""),
            "rating": int(r.get("rating") or 0),
            "title": r.get("title") or "",
            "body": r.get("body") or "",
            "flagged": bool(r.get("flagged")),
            "deleted": bool(r.get("deleted")),
            "createdAt": r.get("createdAt").strftime("%Y-%m-%dT%H:%M:%SZ") if r.get("createdAt") else "",
        })
    return jsonify({"items": items})


@admin_bp.route("/courses/<course_id>/reviews/<review_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_course_review(course_id, review_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id) or not ObjectId.is_valid(review_id):
        return jsonify({"error": "Invalid id"}), 400
    coll = get_course_reviews_collection()
    coll.update_one(
        {"_id": ObjectId(review_id), "courseId": course_id},
        {"$set": {"deleted": True, "updatedAt": datetime.utcnow()}},
    )
    return jsonify({"ok": True})


@admin_bp.route("/courses/<course_id>/reviews/<review_id>/flag", methods=["PATCH"])
@jwt_required()
def admin_flag_course_review(course_id, review_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id) or not ObjectId.is_valid(review_id):
        return jsonify({"error": "Invalid id"}), 400
    data = request.get_json() or {}
    flagged = bool(data.get("flagged", True))
    coll = get_course_reviews_collection()
    coll.update_one(
        {"_id": ObjectId(review_id), "courseId": course_id},
        {"$set": {"flagged": flagged, "updatedAt": datetime.utcnow()}},
    )
    return jsonify({"ok": True})


@admin_bp.route("/courses/<course_id>/enrollments/export.xlsx", methods=["GET"])
@jwt_required()
def export_course_enrollments_xlsx(course_id):
    """Excel: students, assignment submission columns, completion quiz flags, ApproveCertificate for re-upload workflow."""
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    flt = _enrollment_list_filters_from_request()
    rows = []
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)).sort("createdAt", 1):
        uid = e.get("userId")
        uids = str(uid).strip() if uid is not None else ""
        u = users_coll.find_one({"_id": ObjectId(uids)}) if uids and ObjectId.is_valid(uids) else None
        if not _enrollment_matches_filters(e, u, flt):
            continue
        rows.append(export_row_for_enrollment(c, e, u))
    try:
        blob = build_enrollment_workbook_bytes(c, rows)
    except ImportError:
        return jsonify({"error": "Excel export requires openpyxl (pip install openpyxl)"}), 503
    safe_title = re.sub(r"[^\w\-]+", "_", (c.get("title") or "enrollments")[:60]).strip("_") or "enrollments"
    fname = f"{safe_title}_enrollments.xlsx"
    return send_file(
        BytesIO(blob),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=fname,
    )


@admin_bp.route("/courses/<course_id>/enrollments/certificate-sheet/parse", methods=["POST"])
@jwt_required()
def parse_course_certificate_sheet(course_id):
    """Upload edited export workbook; returns rows for admin review (match + ApproveCertificate from sheet).

    Accepts either:
    - JSON ``{ "fileBase64": "...", "filename": "optional.xlsx" }`` (recommended behind API Gateway binary multipart)
    - multipart field ``file`` (legacy; can be corrupted when API Gateway treats multipart as binary)
    """
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    parsed = None
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        b64 = payload.get("fileBase64")
        if not b64 or not isinstance(b64, str):
            return jsonify({"error": "fileBase64 is required in JSON body"}), 400
        try:
            raw = base64.b64decode(b64.strip(), validate=False)
        except Exception:
            return jsonify({"error": "Invalid base64 payload"}), 400
        if len(raw) > 12 * 1024 * 1024:
            return jsonify({"error": "Workbook too large (max 12MB)"}), 400
        fn = str(payload.get("filename") or "").strip().lower()
        if fn and not (fn.endswith(".xlsx") or fn.endswith(".xlsm")):
            return jsonify({"error": "Only .xlsx / .xlsm workbooks are supported."}), 400
        try:
            _, parsed = parse_workbook_rows(BytesIO(raw))
        except Exception as ex:
            return jsonify({"error": f"Could not read Excel workbook: {ex}"}), 400
    else:
        f = request.files.get("file")
        if not f or not f.filename:
            return jsonify({"error": "file is required (multipart field 'file') or send JSON with fileBase64"}), 400
        fn = (f.filename or "").lower()
        if fn and not (fn.endswith(".xlsx") or fn.endswith(".xlsm")):
            return jsonify({"error": "Only .xlsx / .xlsm workbooks are supported."}), 400
        try:
            raw = f.read()
            _, parsed = parse_workbook_rows(BytesIO(raw))
        except Exception as ex:
            return jsonify({"error": f"Could not read Excel workbook: {ex}"}), 400

    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    by_id = {}
    by_email = {}
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)):
        eid = str(e["_id"])
        by_id[eid] = e
        uid = e.get("userId")
        u = users_coll.find_one({"_id": ObjectId(uid)}) if uid and ObjectId.is_valid(str(uid)) else None
        em = (u.get("email") or "").strip().lower() if u else ""
        if em:
            by_email[em] = e

    def _sheet_display_name(raw_row: dict) -> str:
        for k in ("Name", "name", "LearnerName", "StudentName", "FullName", "Full name", "Student Name"):
            if k not in raw_row:
                continue
            v = raw_row.get(k)
            if v is None:
                continue
            s = str(v).strip()
            if s:
                return s
        return ""

    preview = []
    for raw in parsed:
        eid = row_enrollment_id(raw)
        em = row_email(raw)
        e = None
        if eid and eid in by_id:
            e = by_id[eid]
        elif em and em in by_email:
            e = by_email[em]
        uid = e.get("userId") if e else None
        u = users_coll.find_one({"_id": ObjectId(uid)}) if e and uid and ObjectId.is_valid(str(uid)) else None
        pq = (e or {}).get("pythonQuiz") or {}
        cc = (e or {}).get("courseCertificate") or {}
        sheet_name = _sheet_display_name(raw)
        db_name = (u.get("name") or u.get("fullName") or "").strip() if u else ""
        preview.append({
            "enrollmentId": str(e["_id"]) if e else (eid or ""),
            "email": (u.get("email") or "").strip() if u else em,
            "name": db_name or sheet_name or (em or ""),
            "matched": e is not None,
            "approveInSheet": norm_approve_certificate_cell(raw.get("ApproveCertificate")),
            "completionQuizPassed": bool(pq.get("passedAt")) if e else False,
            "certificateIssued": bool((cc.get("certNo") or "").strip()) if e else False,
        })
    return jsonify({"items": preview, "count": len(preview)}), 200


@admin_bp.route("/courses/<course_id>/certificates/bulk-email", methods=["POST"])
@jwt_required()
def bulk_email_certificates_for_course(course_id):
    """Issue certificate + email for selected enrollments (admin). Re-sends email for existing certificates (same cert ID)."""
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    data = request.get_json() or {}
    ids = data.get("enrollmentIds")
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "enrollmentIds must be a non-empty list"}), 400
    if len(ids) > 200:
        return jsonify({"error": "At most 200 enrollments per request"}), 400

    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    courses_coll = get_courses_collection()
    c = courses_coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404

    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    app_obj = current_app._get_current_object()
    emailed = 0
    newly_issued = 0
    resent = 0
    errors: list = []
    for raw_id in ids:
        eid = str(raw_id or "").strip()
        if not eid or not ObjectId.is_valid(eid):
            errors.append({"enrollmentId": eid, "error": "invalid id"})
            continue
        e = enroll_coll.find_one({"_id": ObjectId(eid), **course_id_enrollment_filter(course_id)})
        if not e:
            errors.append({"enrollmentId": eid, "error": "not found for this course"})
            continue
        cc = e.get("courseCertificate") or {}
        had_cert = bool((cc.get("certNo") or "").strip())
        uid = e.get("userId")
        if not uid or not ObjectId.is_valid(str(uid)):
            errors.append({"enrollmentId": eid, "error": "invalid user on enrollment"})
            continue
        user = users_coll.find_one({"_id": ObjectId(str(uid))})
        if not user:
            errors.append({"enrollmentId": eid, "error": "user not found"})
            continue
        try:
            result = apply_quiz_pass_certificate(
                app_obj,
                user_id=str(uid),
                course_id=course_id,
                enrollment=e,
                course=c,
                user=user,
                for_pdf_download=False,
                cert_source="admin-bulk",
            )
            if isinstance(result, dict) and result.get("certNo"):
                emailed += 1
                if had_cert:
                    resent += 1
                else:
                    newly_issued += 1
            else:
                errors.append({"enrollmentId": eid, "error": "unexpected issue result"})
        except Exception as ex:
            errors.append({"enrollmentId": eid, "error": str(ex)})
    return jsonify({
        "ok": True,
        "issuedOrEmailed": emailed,
        "newlyIssued": newly_issued,
        "resent": resent,
        "skippedAlreadyIssued": 0,
        "errors": errors,
    }), 200


# ----- Lead by ID + update -----
@admin_bp.route("/leads/<lead_id>", methods=["GET", "PATCH"])
@jwt_required()
def lead_by_id(lead_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(lead_id):
        return jsonify({"error": "Invalid lead id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_contacts_collection()
    lead = coll.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        return jsonify({"error": "Lead not found"}), 404

    if request.method == "GET":
        out = _lead_to_row(lead)
        followups = list(get_followups_collection().find({"leadId": lead_id}).sort("createdAt", -1))
        out["followUps"] = [
            {"type": f.get("type", ""), "date": f.get("date"), "notes": f.get("notes", ""), "addedBy": f.get("addedBy", ""), "createdAt": f.get("createdAt").strftime("%Y-%m-%d %H:%M") if f.get("createdAt") else ""}
            for f in followups
        ]
        return jsonify(out)

    data = request.get_json() or {}
    updates = {}
    if "status" in data:
        updates["status"] = str(data["status"]).strip().lower().replace(" ", "_")
    if "assignedTo" in data:
        updates["assignedTo"] = str(data["assignedTo"]).strip()
    if updates:
        coll.update_one({"_id": ObjectId(lead_id)}, {"$set": updates})

    if data.get("followUp"):
        fu = data["followUp"]
        get_followups_collection().insert_one({
            "leadId": lead_id,
            "type": fu.get("type", "Note"),
            "date": fu.get("date") or datetime.utcnow().isoformat(),
            "notes": fu.get("notes", ""),
            "addedBy": get_jwt_identity() or "",
            "createdAt": datetime.utcnow(),
        })

    lead = coll.find_one({"_id": ObjectId(lead_id)})
    return jsonify(_lead_to_row(lead))


# Student routes live in admin_students.py (CFRD §4).

# ----- Payment by ID + verify / refund / invoice -----
@admin_bp.route("/payments/<payment_id>", methods=["GET"])
@jwt_required()
def get_payment(payment_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(payment_id):
        return jsonify({"error": "Invalid payment id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    o = get_orders_collection().find_one({"_id": ObjectId(payment_id)})
    if not o:
        return jsonify({"error": "Payment not found"}), 404
    users_by_id, courses_by_id = load_user_course_maps([o])
    row = enrich_payment_row(o, users_by_id, courses_by_id)
    row.update({
        "verifiedAt": o.get("verifiedAt").strftime("%Y-%m-%d %H:%M") if o.get("verifiedAt") else "",
        "verifiedNote": o.get("verifiedNote") or "",
        "refundedAt": o.get("refundedAt").strftime("%Y-%m-%d %H:%M") if o.get("refundedAt") else "",
        "refundGatewayRef": o.get("refundGatewayRef") or "",
        "billingSnapshot": o.get("billingSnapshot") if isinstance(o.get("billingSnapshot"), dict) else {},
        "hasInvoicePdf": bool(get_stored_invoice_pdf(o) or o.get("invoiceNumber")),
    })
    return jsonify(row)


@admin_bp.route("/payments/<payment_id>/verify", methods=["POST"])
@jwt_required()
def verify_payment(payment_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(payment_id):
        return jsonify({"error": "Invalid payment id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    data = request.get_json() or {}
    ref = (data.get("reference") or data.get("note") or "").strip()
    coll = get_orders_collection()
    o = coll.find_one({"_id": ObjectId(payment_id)})
    if not o:
        return jsonify({"error": "Payment not found"}), 404
    if (o.get("status") or "").lower() == "refunded":
        return jsonify({"error": "Cannot verify a refunded payment"}), 400
    if (o.get("status") or "").lower() == "success":
        return jsonify({"ok": True, "message": "Payment already verified"})

    now = datetime.utcnow()
    gateway_ref = ref or o.get("transactionId") or o.get("orderId") or f"manual-{payment_id}"
    coll.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {
            "status": "success",
            "verifiedAt": now,
            "invoiceReceiptAt": now,
            "verifiedNote": ref,
            "verifiedBy": _admin_actor()["actor_email"],
            "transactionId": o.get("transactionId") or gateway_ref,
            "gatewayRef": o.get("gatewayRef") or gateway_ref,
        }},
    )
    o = coll.find_one({"_id": ObjectId(payment_id)}) or o

    # Ensure enrollment (best-effort) then invoice
    try:
        from app.routes.payments import _ensure_enrollment_for_successful_order
        uid = str(o.get("userId") or o.get("studentId") or "")
        if uid:
            _ensure_enrollment_for_successful_order(uid, o)
    except Exception:
        current_app.logger.exception("manual verify enrollment failed")

    try:
        pdf_bytes, upd = generate_and_store_invoice_pdf(o, force=True)
        o.update(upd)
        # Email student with PDF
        uid = str(o.get("userId") or "")
        if uid and ObjectId.is_valid(uid):
            u = get_users_collection().find_one({"_id": ObjectId(uid)})
            if u and (u.get("email") or "").strip():
                title = ""
                cid = str(o.get("courseId") or "")
                if cid and ObjectId.is_valid(cid):
                    c = get_courses_collection().find_one({"_id": ObjectId(cid)})
                    title = (c.get("title") if c else "") or "Training"
                amt = float(o.get("amount") or 0)
                amount_display = f"₹{amt:,.0f}" if amt == int(amt) else f"₹{amt:,.2f}"
                send_payment_success_email(
                    current_app.config,
                    u.get("name") or u.get("fullName") or "there",
                    (u.get("email") or "").strip(),
                    title or "your course",
                    amount_display,
                    gateway_ref,
                    True,
                    invoice_number=o.get("invoiceNumber") or upd.get("invoiceNumber"),
                    pdf_bytes=pdf_bytes,
                    pdf_filename=invoice_filename(o),
                )
    except Exception:
        current_app.logger.exception("manual verify invoice generation failed")

    _log_admin(
        "payment.verify",
        "payment",
        payment_id,
        old_value={"status": "pending"},
        new_value={"status": "success", "reference": ref},
    )
    return jsonify({"ok": True, "message": "Payment marked as verified"})


@admin_bp.route("/payments/<payment_id>/refund", methods=["POST"])
@jwt_required()
def refund_payment(payment_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(payment_id):
        return jsonify({"error": "Invalid payment id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    data = request.get_json() or {}
    amount = data.get("amount")
    reason = (data.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Refund reason is required"}), 400
    o = get_orders_collection().find_one({"_id": ObjectId(payment_id)})
    if not o:
        return jsonify({"error": "Payment not found"}), 404
    if (o.get("status") or "").lower() == "refunded":
        return jsonify({"error": "Payment already refunded"}), 400
    try:
        refund_amount = int(amount) if amount is not None and str(amount).strip() != "" else int(o.get("amount", 0) or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid refund amount"}), 400
    old_status = o.get("status")
    get_orders_collection().update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {
            "status": "refunded",
            "refundedAt": datetime.utcnow(),
            "refundReason": reason,
            "refundAmount": refund_amount,
            "refundGatewayRef": (data.get("gatewayRef") or "").strip(),
            "refundedBy": _admin_actor()["actor_email"],
        }},
    )
    try:
        from app.partner_program import cancel_commission_for_order
        cancel_commission_for_order(payment_id)
    except Exception:
        current_app.logger.exception("partner commission reverse on refund failed")
    _log_admin(
        "payment.refund",
        "payment",
        payment_id,
        old_value={"status": old_status, "amount": o.get("amount")},
        new_value={"status": "refunded", "refundAmount": refund_amount, "reason": reason},
    )
    return jsonify({"ok": True, "message": "Refund recorded"})


@admin_bp.route("/payments/<payment_id>/invoice/download", methods=["GET"])
@jwt_required()
def download_payment_invoice(payment_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(payment_id):
        return jsonify({"error": "Invalid payment id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    o = get_orders_collection().find_one({"_id": ObjectId(payment_id)})
    if not o:
        return jsonify({"error": "Payment not found"}), 404
    if (o.get("status") or "").lower() not in ("success", "refunded"):
        return jsonify({"error": "Invoice available only for successful (or refunded) payments"}), 400
    try:
        pdf_bytes, _ = generate_and_store_invoice_pdf(o, force=False)
    except Exception as e:
        current_app.logger.exception("invoice download failed")
        return jsonify({"error": str(e) or "Could not generate invoice"}), 500
    fn = invoice_filename(o)
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=fn,
    )


@admin_bp.route("/payments/<payment_id>/invoice/regenerate", methods=["POST"])
@jwt_required()
def regenerate_payment_invoice(payment_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(payment_id):
        return jsonify({"error": "Invalid payment id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    o = get_orders_collection().find_one({"_id": ObjectId(payment_id)})
    if not o:
        return jsonify({"error": "Payment not found"}), 404
    if (o.get("status") or "").lower() not in ("success", "refunded"):
        return jsonify({"error": "Can only regenerate invoice for successful payments"}), 400
    try:
        pdf_bytes, upd = generate_and_store_invoice_pdf(o, force=True, bump_version=True)
        o.update(upd)
    except Exception as e:
        current_app.logger.exception("invoice regenerate failed")
        return jsonify({"error": str(e) or "Could not regenerate invoice"}), 500

    # Email student + BCC accounts
    emailed = False
    uid = str(o.get("userId") or "")
    if uid and ObjectId.is_valid(uid):
        u = get_users_collection().find_one({"_id": ObjectId(uid)})
        if u and (u.get("email") or "").strip():
            title = "Training"
            cid = str(o.get("courseId") or "")
            if cid and ObjectId.is_valid(cid):
                c = get_courses_collection().find_one({"_id": ObjectId(cid)})
                if c:
                    title = c.get("title") or title
            amt = float(o.get("amount") or 0)
            amount_display = f"₹{amt:,.0f}" if amt == int(amt) else f"₹{amt:,.2f}"
            emailed = send_payment_success_email(
                current_app.config,
                u.get("name") or u.get("fullName") or "there",
                (u.get("email") or "").strip(),
                title,
                amount_display,
                o.get("transactionId") or o.get("orderId") or payment_id,
                False,
                invoice_number=o.get("invoiceNumber"),
                pdf_bytes=pdf_bytes,
                pdf_filename=invoice_filename(o),
            )

    _log_admin(
        "payment.invoice_regenerate",
        "payment",
        payment_id,
        new_value={
            "invoiceVersion": o.get("invoiceVersion"),
            "invoiceNumber": o.get("invoiceNumber"),
            "reason": reason,
            "emailed": emailed,
        },
    )
    return jsonify({
        "ok": True,
        "invoiceNumber": o.get("invoiceNumber") or "",
        "invoiceVersion": int(o.get("invoiceVersion") or 1),
        "emailed": emailed,
        "message": "Invoice regenerated",
    })


# ----- Companies -----
def _company_to_row(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("companyName") or u.get("name", ""),
        "industry": u.get("industryType", ""),
        "contactEmail": u.get("email", ""),
        "registered": u.get("createdAt").strftime("%Y-%m-%d") if u.get("createdAt") else "",
        "listings": get_internships_collection().count_documents({"companyId": str(u["_id"])}),
        "applicants": 0,
        "status": (u.get("status") or "active").title(),
        "verified": bool(u.get("verified")),
    }


@admin_bp.route("/companies", methods=["GET"])
@jwt_required()
def companies_list():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    status = request.args.get("status", "").strip().lower()
    q = {"role": "company"}
    if status and status in ("pending", "active", "suspended", "rejected"):
        if status == "active":
            q["$or"] = [{"status": "active"}, {"status": {"$exists": False}}]
        else:
            q["status"] = status
    cursor = get_users_collection().find(q).sort("createdAt", -1)
    items = [_company_to_row(u) for u in cursor]
    return jsonify({"items": items})


@admin_bp.route("/companies/<company_id>", methods=["GET"])
@jwt_required()
def get_company(company_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(company_id):
        return jsonify({"error": "Invalid company id"}), 400
    u = get_users_collection().find_one({"_id": ObjectId(company_id), "role": "company"})
    if not u:
        return jsonify({"error": "Company not found"}), 404
    out = _company_to_row(u)
    out["hrName"] = u.get("hrName", "")
    out["hrMobile"] = u.get("hrMobile", "")
    out["address"] = u.get("address", "")
    out["website"] = u.get("website", "")
    return jsonify(out)


@admin_bp.route("/companies/<company_id>/approve", methods=["POST"])
@jwt_required()
def approve_company(company_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(company_id):
        return jsonify({"error": "Invalid company id"}), 400

    from app.email_smtp import send_company_approval_email
    from app.email_templates import public_app_url
    from app.registration_otp import smtp_or_ses_configured

    oid = ObjectId(company_id)
    users = get_users_collection()
    user = users.find_one({"_id": oid, "role": "company"})
    if not user:
        return jsonify({"error": "Company not found"}), 404

    st = user.get("status")
    if st != "pending":
        if st == "active":
            return jsonify({"error": "Company is already approved"}), 400
        if st == "rejected":
            return jsonify({"error": "This application was rejected; it cannot be approved from here"}), 400
        return jsonify({"error": "Company is not awaiting approval"}), 400

    result = users.update_one(
        {"_id": oid, "role": "company", "status": "pending"},
        {"$set": {"status": "active"}},
    )
    if result.modified_count == 0:
        return jsonify({"error": "Could not update company status"}), 500

    company_name = user.get("companyName") or user.get("name") or "Your organisation"
    to_email = (user.get("email") or "").strip()
    cfg = current_app.config
    if to_email and smtp_or_ses_configured(cfg):
        base = public_app_url().rstrip("/")
        login_url = f"{base}/login"
        if not send_company_approval_email(cfg, str(company_name), to_email, login_url):
            current_app.logger.warning("Company approval email failed for %s", to_email)

    return jsonify({"ok": True, "message": "Company approved"}), 200


@admin_bp.route("/companies/<company_id>/reject", methods=["POST"])
@jwt_required()
def reject_company(company_id):
    err = _admin_required()
    if err:
        return err
    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    if not ObjectId.is_valid(company_id):
        return jsonify({"error": "Invalid company id"}), 400
    result = get_users_collection().update_one(
        {"_id": ObjectId(company_id), "role": "company"},
        {"$set": {"status": "rejected", "rejectionReason": reason}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Company not found"}), 404
    return jsonify({"ok": True, "message": "Company rejected"})


@admin_bp.route("/companies/<company_id>/request-info", methods=["POST"])
@jwt_required()
def request_company_info(company_id):
    err = _admin_required()
    if err:
        return err
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not ObjectId.is_valid(company_id):
        return jsonify({"error": "Invalid company id"}), 400
    get_users_collection().update_one(
        {"_id": ObjectId(company_id), "role": "company"},
        {"$set": {"requestInfoMessage": message, "requestInfoAt": datetime.utcnow()}}
    )
    return jsonify({"ok": True, "message": "Request sent"})


# ----- Internships (admin list + moderate) -----
def _internship_to_admin_item(i, company_name=None):
    return {
        "id": str(i["_id"]),
        "title": i.get("title", ""),
        "companyName": company_name or i.get("companyName", ""),
        "companyId": i.get("companyId", ""),
        "category": i.get("domain", ""),
        "type": i.get("type", "Remote"),
        "posted": i.get("createdAt").strftime("%Y-%m-%d") if i.get("createdAt") else "",
        "deadline": i.get("deadline", ""),
        "applicants": get_applications_collection().count_documents({"internshipId": str(i["_id"])}),
        "status": (i.get("status") or ("active" if i.get("active", True) else "closed")).replace("_", " ").title(),
        "active": i.get("active", True),
        "featured": i.get("featured", False),
    }


@admin_bp.route("/internships", methods=["GET"])
@jwt_required()
def admin_internships_list():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    status = request.args.get("status", "").strip().lower()
    q = {}
    if status == "pending_approval":
        q["status"] = "pending_approval"
    elif status == "active":
        q["active"] = True
    elif status == "closed":
        q["active"] = False
    coll = get_internships_collection()
    users = get_users_collection()
    cursor = coll.find(q).sort("createdAt", -1)
    items = []
    for i in cursor:
        cid = i.get("companyId")
        cname = i.get("companyName")
        if cid and not cname:
            u = users.find_one({"_id": ObjectId(cid)})
            cname = (u.get("companyName") or u.get("name", "")) if u else ""
        items.append(_internship_to_admin_item(i, cname))
    return jsonify({"items": items})


@admin_bp.route("/internships/<internship_id>", methods=["GET"])
@jwt_required()
def admin_get_internship(internship_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    i = get_internships_collection().find_one({"_id": ObjectId(internship_id)})
    if not i:
        return jsonify({"error": "Internship not found"}), 404
    cname = i.get("companyName")
    if i.get("companyId"):
        u = get_users_collection().find_one({"_id": ObjectId(i["companyId"])})
        if u:
            cname = u.get("companyName") or u.get("name", "")
    out = _internship_to_admin_item(i, cname)
    out["description"] = i.get("description", "")
    out["requirements"] = i.get("requirements", "")
    out["skills"] = i.get("skills", "")
    out["stipend"] = i.get("stipend", "")
    out["location"] = i.get("location", "")
    out["openings"] = i.get("openings", 1)
    return jsonify(out)


@admin_bp.route("/internships/<internship_id>/approve", methods=["POST"])
@jwt_required()
def approve_internship(internship_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    result = get_internships_collection().update_one(
        {"_id": ObjectId(internship_id)},
        {"$set": {"active": True, "status": "active"}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Internship not found"}), 404
    return jsonify({"ok": True, "message": "Internship approved"})


@admin_bp.route("/internships/<internship_id>/reject", methods=["POST"])
@jwt_required()
def reject_internship(internship_id):
    err = _admin_required()
    if err:
        return err
    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    result = get_internships_collection().update_one(
        {"_id": ObjectId(internship_id)},
        {"$set": {"active": False, "status": "rejected", "rejectionReason": reason}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Internship not found"}), 404
    return jsonify({"ok": True, "message": "Internship rejected"})


@admin_bp.route("/internships/<internship_id>/feature", methods=["POST"])
@jwt_required()
def feature_internship(internship_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    result = get_internships_collection().update_one(
        {"_id": ObjectId(internship_id)},
        {"$set": {"featured": True}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Internship not found"}), 404
    return jsonify({"ok": True, "message": "Listing featured"})


@admin_bp.route("/internships/<internship_id>/force-close", methods=["POST"])
@jwt_required()
def force_close_internship(internship_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    result = get_internships_collection().update_one(
        {"_id": ObjectId(internship_id)},
        {"$set": {"active": False, "status": "closed"}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Internship not found"}), 404
    return jsonify({"ok": True, "message": "Listing closed"})


# ----- Certificates (register list + trainings for dropdown) -----
def _issue_date_str(c: dict) -> str:
    v = c.get("issueDate")
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, str) and v.strip():
        return v.strip()[:10]
    return str(c.get("completionDate") or "")[:10]


@admin_bp.route("/certificates", methods=["GET"])
@jwt_required()
def certificates_list():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    search = request.args.get("search", "").strip()
    email_filter = request.args.get("email", "").strip()
    status = request.args.get("status", "").strip().lower()
    cert_coll = get_certificates_collection()
    users_coll = get_users_collection()

    and_parts: list = []
    if search:
        and_parts.append({
            "$or": [
                {"certNo": {"$regex": search, "$options": "i"}},
                {"studentName": {"$regex": search, "$options": "i"}},
                {"studentEmail": {"$regex": search, "$options": "i"}},
            ],
        })
    if email_filter:
        esc = re.escape(email_filter)
        uid_list: list[str] = []
        for u in users_coll.find({"email": {"$regex": esc, "$options": "i"}}, {"_id": 1}).limit(400):
            uid_list.append(str(u["_id"]))
        email_or = [{"studentEmail": {"$regex": esc, "$options": "i"}}]
        if uid_list:
            email_or.append({"studentId": {"$in": uid_list}})
        and_parts.append({"$or": email_or})
    if status in ("valid", "revoked"):
        and_parts.append({"status": status})

    if not and_parts:
        q: dict = {}
    elif len(and_parts) == 1:
        q = and_parts[0]
    else:
        q = {"$and": and_parts}

    cursor = cert_coll.find(q).sort("issueDate", -1).limit(500)
    items = []
    for c in cursor:
        uid = str(c.get("studentId") or "")
        em = (c.get("studentEmail") or "").strip()
        if not em and uid and ObjectId.is_valid(uid):
            u = users_coll.find_one({"_id": ObjectId(uid)}, {"email": 1})
            em = (u.get("email") or "").strip() if u else ""
        items.append({
            "id": str(c["_id"]),
            "certNo": c.get("certNo", ""),
            "studentName": c.get("studentName", ""),
            "studentEmail": em,
            "programName": c.get("programName", "") or c.get("domain", "") or c.get("course", ""),
            "courseId": str(c.get("courseId") or ""),
            "issueDate": _issue_date_str(c),
            "completionDate": str(c.get("completionDate") or c.get("internshipEndDate") or "")[:10],
            "university": c.get("university", "") or c.get("collegeName", ""),
            "collegeName": c.get("collegeName", "") or c.get("university", ""),
            "domain": c.get("domain", "") or c.get("programName", ""),
            "mode": c.get("mode", ""),
            "status": c.get("status", "valid"),
            "source": c.get("source", "") or "",
            "hasUploadedPdf": bool((c.get("certificatePdfKey") or "").strip()),
            "pdfStatus": c.get("pdfStatus")
            or ("uploaded" if (c.get("certificatePdfKey") or "").strip() else "generated"),
            "pdfError": c.get("pdfError") or "",
            "bulkUploadedAt": (
                c["bulkUploadedAt"].strftime("%Y-%m-%d")
                if hasattr(c.get("bulkUploadedAt"), "strftime")
                else str(c.get("bulkUploadedAt") or "")[:10]
            ),
            "bulkJobId": str(c.get("bulkJobId") or ""),
        })
    return jsonify({"items": items})


@admin_bp.route("/certificates/trainings", methods=["GET"])
@jwt_required()
def certificates_trainings():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    cursor = get_courses_collection().find({"active": True}).sort("title", 1)
    items = [{"id": str(c["_id"]), "title": c.get("title", "")} for c in cursor]
    return jsonify({"items": items})


@admin_bp.route("/certificates/bulk/template.xlsx", methods=["GET"])
@jwt_required()
def certificates_bulk_template_xlsx():
    err = _admin_required()
    if err:
        return err
    data = build_xlsx_template()
    return send_file(
        BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="xpertintern_bulk_certificates_template.xlsx",
    )


@admin_bp.route("/certificates/bulk/template.csv", methods=["GET"])
@jwt_required()
def certificates_bulk_template_csv():
    err = _admin_required()
    if err:
        return err
    data = build_csv_template()
    return send_file(
        BytesIO(data),
        mimetype="text/csv",
        as_attachment=True,
        download_name="xpertintern_bulk_certificates_template.csv",
    )


@admin_bp.route("/certificates/bulk/preview", methods=["POST"])
@jwt_required()
def certificates_bulk_preview():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "Upload an Excel or CSV file."}), 400
    raw = f.read()
    rows, parse_err = parse_upload_file(raw, f.filename)
    if parse_err:
        return jsonify({"error": parse_err}), 400
    result = validate_bulk_rows(rows or [])
    # Drop heavy raw payloads for response size — keep raw only on error rows for errors export client-side
    slim_rows = []
    for r in result["rows"]:
        slim_rows.append({
            "row": r["row"],
            "status": r["status"],
            "errorReason": r.get("errorReason") or "",
            "errors": r.get("errors") or [],
            "studentName": r.get("studentName") or "",
            "domain": r.get("domain") or "",
            "certNo": r.get("certNo") or "",
            "payload": r.get("payload"),
            "raw": r.get("raw") if r.get("status") == "error" else None,
        })
    return jsonify({
        "fileName": secure_filename(f.filename) or "upload.xlsx",
        "total": result["total"],
        "validCount": result["validCount"],
        "errorCount": result["errorCount"],
        "rows": slim_rows,
        "trainingTitles": result.get("trainingTitles") or [],
    })


@admin_bp.route("/certificates/bulk/errors.xlsx", methods=["POST"])
@jwt_required()
def certificates_bulk_errors_xlsx():
    err = _admin_required()
    if err:
        return err
    data = request.get_json() or {}
    rows = data.get("rows") or []
    xlsx = build_errors_xlsx(rows)
    return send_file(
        BytesIO(xlsx),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="certificate_upload_errors.xlsx",
    )


@admin_bp.route("/certificates/bulk/generate", methods=["POST"])
@jwt_required()
def certificates_bulk_generate():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    data = request.get_json() or {}
    payloads = data.get("rows") or data.get("payloads") or []
    if not isinstance(payloads, list) or not payloads:
        return jsonify({"error": "No valid rows to generate."}), 400
    if len(payloads) > 1000:
        return jsonify({"error": "Maximum 1000 certificates per upload."}), 400

    valid_payloads = []
    for item in payloads:
        if isinstance(item, dict) and item.get("payload"):
            valid_payloads.append(item["payload"])
        elif isinstance(item, dict) and item.get("studentName"):
            valid_payloads.append(item)
    if not valid_payloads:
        return jsonify({"error": "No valid rows to generate."}), 400

    actor = _admin_actor()
    job = create_bulk_certificate_job(
        app=current_app._get_current_object(),
        admin_id=actor["actor_id"],
        admin_email=actor["actor_email"],
        admin_name=actor["actor_name"],
        file_name=str(data.get("fileName") or "upload.xlsx"),
        file_bytes=None,
        valid_payloads=valid_payloads,
        total_rows=int(data.get("totalRows") or len(valid_payloads)),
        error_rows=int(data.get("errorRows") or 0),
    )
    _log_admin(
        "bulk_certificate_upload",
        "certificate_bulk",
        str(job["_id"]),
        meta={
            "createdCount": job.get("createdCount"),
            "validRows": job.get("validRows"),
            "errorRows": job.get("errorRows"),
            "fileName": job.get("fileName"),
        },
    )
    return jsonify({
        "job": _serialize_job(job),
        "message": (
            f"{job.get('createdCount') or 0} certificates queued. "
            f"{job.get('errorRows') or 0} rows skipped due to errors. "
            "You will receive an email when all PDFs are ready."
        ),
    }), 201


@admin_bp.route("/certificates/bulk/jobs", methods=["GET"])
@jwt_required()
def certificates_bulk_jobs_list():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": []}), 503
    return jsonify({"items": list_bulk_jobs()})


@admin_bp.route("/certificates/bulk/jobs/active", methods=["GET"])
@jwt_required()
def certificates_bulk_jobs_active():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"job": None}), 503
    return jsonify({"job": active_bulk_progress()})


@admin_bp.route("/certificates/bulk/jobs/<job_id>", methods=["GET"])
@jwt_required()
def certificates_bulk_job_detail(job_id):
    err = _admin_required()
    if err:
        return err
    job = get_bulk_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    # Tick progress while viewing
    process_bulk_cert_job(job_id, max_items=8)
    job = get_bulk_job(job_id)
    cert_ids = [str(x) for x in (job.get("certificateIds") or [])]
    certs = []
    if cert_ids:
        oids = [ObjectId(i) for i in cert_ids if ObjectId.is_valid(i)]
        for c in get_certificates_collection().find({"_id": {"$in": oids}}):
            certs.append({
                "id": str(c["_id"]),
                "certNo": c.get("certNo") or "",
                "studentName": c.get("studentName") or "",
                "domain": c.get("domain") or c.get("programName") or "",
                "pdfStatus": c.get("pdfStatus") or ("generated" if c.get("certificatePdfKey") else "pending"),
                "pdfError": c.get("pdfError") or "",
                "status": c.get("status") or "valid",
            })
    out = _serialize_job(job)
    out["certificates"] = certs
    return jsonify(out)


@admin_bp.route("/certificates/bulk/jobs/<job_id>/file", methods=["GET"])
@jwt_required()
def certificates_bulk_job_file(job_id):
    err = _admin_required()
    if err:
        return err
    job = get_bulk_job(job_id, include_file=True)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    raw = job.get("originalFile")
    if not raw:
        return jsonify({"error": "Original file was not stored for this upload."}), 404
    data = bytes(raw)
    name = job.get("fileName") or "upload.xlsx"
    return send_file(BytesIO(data), as_attachment=True, download_name=secure_filename(name) or "upload.xlsx")


@admin_bp.route("/certificates/<cert_id>/retry-pdf", methods=["POST"])
@jwt_required()
def certificate_admin_retry_pdf(cert_id):
    err = _admin_required()
    if err:
        return err
    updated, err_msg = retry_certificate_pdf(cert_id, app=current_app._get_current_object())
    if err_msg and not updated:
        return jsonify({"error": err_msg}), 400
    claims = get_jwt()
    log_certificate_audit(
        certificate_id=cert_id,
        cert_no=str((updated or {}).get("certNo") or ""),
        action="retry_pdf",
        admin_user_id=str(get_jwt_identity()),
        admin_email=str(claims.get("email") or ""),
    )
    users_coll = get_users_collection()
    courses_coll = get_courses_collection()
    return jsonify(_certificate_to_admin_detail(updated, users_coll, courses_coll))


def _certificate_to_admin_detail(c: dict, users_coll, courses_coll) -> dict:
    uid = str(c.get("studentId") or "")
    em = (c.get("studentEmail") or "").strip()
    if not em and uid and ObjectId.is_valid(uid):
        u = users_coll.find_one({"_id": ObjectId(uid)}, {"email": 1, "mobile": 1})
        em = (u.get("email") or "").strip() if u else ""
        mobile = (u.get("mobile") or "").strip() if u else ""
    else:
        mobile = ""
        if uid and ObjectId.is_valid(uid):
            u = users_coll.find_one({"_id": ObjectId(uid)}, {"mobile": 1})
            mobile = (u.get("mobile") or "").strip() if u else ""
    course_title = ""
    cid = c.get("courseId")
    if cid is not None and str(cid).strip():
        cs = str(cid).strip()
        if ObjectId.is_valid(cs):
            crs = courses_coll.find_one({"_id": ObjectId(cs)}, {"title": 1})
            if crs:
                course_title = crs.get("title") or ""
    revoked_at = c.get("revokedAt")
    base = {
        "id": str(c["_id"]),
        "certNo": c.get("certNo", ""),
        "studentName": c.get("studentName", ""),
        "studentEmail": em,
        "studentMobile": mobile,
        "studentId": uid,
        "programName": c.get("programName", "") or c.get("domain", "") or c.get("course", ""),
        "courseId": str(c.get("courseId") or ""),
        "courseTitle": course_title,
        "university": c.get("university", "") or c.get("collegeName", ""),
        "issueDate": _issue_date_str(c),
        "completionDate": str(c.get("completionDate") or c.get("internshipEndDate") or "")[:10],
        "status": c.get("status", "valid"),
        "source": c.get("source", "") or "",
        "revokeReason": c.get("revokeReason") or "",
        "revokedAt": revoked_at.strftime("%Y-%m-%d %H:%M UTC") if hasattr(revoked_at, "strftime") else (str(revoked_at) if revoked_at else ""),
    }
    base.update(certificate_admin_detail_fields(c))
    return base


@admin_bp.route("/certificates", methods=["POST"])
@jwt_required()
def certificate_admin_create():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    data = request.get_json() or {}
    fields = parse_certificate_admin_fields(data)
    cert_no = fields.get("certNo") or ""
    if not cert_no and data.get("autoGenerateCertNo"):
        domain = fields.get("domain") or "INT"
        cert_no = allocate_certificate_number(domain)
        fields["certNo"] = cert_no
    if not cert_no:
        return jsonify({"error": "Certificate number is required (or enable autoGenerateCertNo)."}), 400
    if not fields.get("studentName"):
        return jsonify({"error": "Student name is required."}), 400
    if find_certificate_by_no(cert_no):
        return jsonify({"error": "Certificate number already exists."}), 409

    now = datetime.utcnow()
    doc = {
        **{k: v for k, v in fields.items() if v or k == "certNo"},
        "certNo": cert_no,
        "status": "valid",
        "source": "admin-manual",
        "issueDate": now,
        "createdAt": now,
        "updatedAt": now,
    }
    if not doc.get("completionDate") and doc.get("internshipEndDate"):
        doc["completionDate"] = doc["internshipEndDate"]

    coll = get_certificates_collection()
    res = coll.insert_one(doc)
    cid = str(res.inserted_id)
    claims = get_jwt()
    log_certificate_audit(
        certificate_id=cid,
        cert_no=cert_no,
        action="create",
        admin_user_id=str(get_jwt_identity()),
        admin_email=str(claims.get("email") or ""),
        changes=fields,
    )
    return jsonify({"id": cid, "certNo": cert_no, "message": "Certificate created."}), 201


@admin_bp.route("/certificates/<cert_id>", methods=["PUT", "PATCH"])
@jwt_required()
def certificate_admin_update(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    coll = get_certificates_collection()
    existing = coll.find_one({"_id": ObjectId(cert_id)})
    if not existing:
        return jsonify({"error": "Certificate not found"}), 404

    data = request.get_json() or {}
    fields = parse_certificate_admin_fields(data)
    new_cert_no = fields.get("certNo") or existing.get("certNo") or ""
    if new_cert_no and new_cert_no != existing.get("certNo"):
        if find_certificate_by_no(new_cert_no):
            other = find_certificate_by_no(new_cert_no)
            if other and str(other["_id"]) != cert_id:
                return jsonify({"error": "Certificate number already in use."}), 409

    patch = {k: v for k, v in fields.items() if v or k in data}
    if "certNo" in data or "certificate_no" in data:
        patch["certNo"] = new_cert_no
    patch["updatedAt"] = datetime.utcnow()
    if patch.get("internshipEndDate") and not patch.get("completionDate"):
        patch["completionDate"] = patch["internshipEndDate"]

    coll.update_one({"_id": ObjectId(cert_id)}, {"$set": patch})
    claims = get_jwt()
    log_certificate_audit(
        certificate_id=cert_id,
        cert_no=new_cert_no,
        action="update",
        admin_user_id=str(get_jwt_identity()),
        admin_email=str(claims.get("email") or ""),
        changes=patch,
    )
    updated = coll.find_one({"_id": ObjectId(cert_id)})
    users_coll = get_users_collection()
    courses_coll = get_courses_collection()
    return jsonify(_certificate_to_admin_detail(updated, users_coll, courses_coll))


@admin_bp.route("/certificates/<cert_id>", methods=["DELETE"])
@jwt_required()
def certificate_admin_delete(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    coll = get_certificates_collection()
    c = coll.find_one({"_id": ObjectId(cert_id)})
    if not c:
        return jsonify({"error": "Certificate not found"}), 404
    pdf_key = (c.get("certificatePdfKey") or "").strip()
    if pdf_key:
        delete_certificate_pdf(pdf_key)
    coll.delete_one({"_id": ObjectId(cert_id)})
    claims = get_jwt()
    log_certificate_audit(
        certificate_id=cert_id,
        cert_no=str(c.get("certNo") or ""),
        action="delete",
        admin_user_id=str(get_jwt_identity()),
        admin_email=str(claims.get("email") or ""),
        changes={"deletedCertNo": c.get("certNo")},
    )
    return jsonify({"ok": True, "message": "Certificate deleted."})


@admin_bp.route("/certificates/<cert_id>/upload-pdf", methods=["POST"])
@jwt_required()
def certificate_admin_upload_pdf(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    coll = get_certificates_collection()
    c = coll.find_one({"_id": ObjectId(cert_id)})
    if not c:
        return jsonify({"error": "Certificate not found"}), 404

    f = request.files.get("file") or request.files.get("pdf")
    if not f:
        return jsonify({"error": "PDF file is required (field: file)."}), 400
    raw = f.read()
    try:
        key = save_certificate_pdf(raw, cert_no=str(c.get("certNo") or ""))
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

    old_key = (c.get("certificatePdfKey") or "").strip()
    coll.update_one(
        {"_id": ObjectId(cert_id)},
        {"$set": {
            "certificatePdfKey": key,
            "certificatePdfUploadedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }},
    )
    if old_key and old_key != key:
        delete_certificate_pdf(old_key)

    claims = get_jwt()
    log_certificate_audit(
        certificate_id=cert_id,
        cert_no=str(c.get("certNo") or ""),
        action="upload_pdf",
        admin_user_id=str(get_jwt_identity()),
        admin_email=str(claims.get("email") or ""),
        changes={"certificatePdfKey": key},
    )
    return jsonify({"ok": True, "message": "Certificate PDF uploaded.", "hasUploadedPdf": True})


@admin_bp.route("/certificates/<cert_id>/audit", methods=["GET"])
@jwt_required()
def certificate_admin_audit_log(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    rows = list(
        db["certificate_audit_logs"]
        .find({"certificateId": cert_id})
        .sort("createdAt", -1)
        .limit(100)
    )
    items = []
    for r in rows:
        ts = r.get("createdAt")
        items.append({
            "action": r.get("action", ""),
            "adminEmail": r.get("adminEmail", ""),
            "changes": r.get("changes") or {},
            "createdAt": ts.strftime("%Y-%m-%d %H:%M UTC") if hasattr(ts, "strftime") else str(ts or ""),
        })
    return jsonify({"items": items})


@admin_bp.route("/certificates/<cert_id>/pdf", methods=["GET"])
@jwt_required()
def certificate_admin_pdf(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    cert_coll = get_certificates_collection()
    c = cert_coll.find_one({"_id": ObjectId(cert_id)})
    if not c:
        return jsonify({"error": "Certificate not found"}), 404
    cert_no = (c.get("certNo") or "").strip() or "CERT"
    try:
        pdf_bytes = certificate_pdf_bytes(c)
    except Exception as ex:
        return jsonify({"error": f"Could not build PDF: {ex}"}), 500
    safe_name = "".join(ch for ch in cert_no if ch.isalnum() or ch in "-_")
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"XpertIntern-{safe_name or 'certificate'}.pdf",
    )


@admin_bp.route("/certificates/<cert_id>/revoke", methods=["POST"])
@jwt_required()
def certificate_admin_revoke(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    data = request.get_json() or {}
    reason = str(data.get("reason") or "").strip()
    if len(reason) < 3:
        return jsonify({"error": "A revoke reason of at least 3 characters is required."}), 400
    reason = reason[:2000]
    cert_coll = get_certificates_collection()
    res = cert_coll.update_one(
        {"_id": ObjectId(cert_id), "status": {"$ne": "revoked"}},
        {"$set": {
            "status": "revoked",
            "revokedAt": datetime.utcnow(),
            "revokeReason": reason,
        }},
    )
    if res.matched_count == 0:
        c = cert_coll.find_one({"_id": ObjectId(cert_id)})
        if not c:
            return jsonify({"error": "Certificate not found"}), 404
        return jsonify({"error": "Certificate is already revoked."}), 400
    claims = get_jwt()
    c = cert_coll.find_one({"_id": ObjectId(cert_id)})
    log_certificate_audit(
        certificate_id=cert_id,
        cert_no=str(c.get("certNo") if c else ""),
        action="revoke",
        admin_user_id=str(get_jwt_identity()),
        admin_email=str(claims.get("email") or ""),
        changes={"reason": reason},
    )
    return jsonify({"ok": True, "message": "Certificate revoked."})


@admin_bp.route("/certificates/<cert_id>", methods=["GET"])
@jwt_required()
def certificate_admin_detail(cert_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(cert_id):
        return jsonify({"error": "Invalid certificate id"}), 400
    cert_coll = get_certificates_collection()
    c = cert_coll.find_one({"_id": ObjectId(cert_id)})
    if not c:
        return jsonify({"error": "Certificate not found"}), 404
    users_coll = get_users_collection()
    courses_coll = get_courses_collection()
    return jsonify(_certificate_to_admin_detail(c, users_coll, courses_coll))


_MEDIA_UPLOAD_NAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(jpe?g|png|mp4|mov|avi)$",
    re.IGNORECASE,
)
_STUDY_MATERIAL_UPLOAD_NAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(pdf|pptx?|docx?|xlsx?|zip|txt|csv)$",
    re.IGNORECASE,
)

_STUDY_MATERIAL_EXTS = frozenset({".pdf", ".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".txt", ".csv"})


@admin_bp.route("/uploads/course-media", methods=["POST"])
@jwt_required()
def upload_course_media():
    """Store featured image, intro/lesson video, or study-material document; returns API-relative URL path."""
    err = _admin_required()
    if err:
        return err
    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400
    uf = request.files["file"]
    if not uf or not uf.filename:
        return jsonify({"error": "Empty file"}), 400
    kind = (request.form.get("kind") or "").strip().lower()
    if kind not in ("featured", "intro", "lesson", "material"):
        return jsonify({"error": "Invalid kind; use featured, intro, lesson, or material"}), 400
    raw_name = secure_filename(uf.filename) or "file.bin"
    ext = Path(raw_name).suffix.lower()
    if kind == "featured":
        if ext not in (".jpg", ".jpeg", ".png"):
            return jsonify({"error": "Featured image must be JPEG or PNG"}), 400
        max_bytes = 2 * 1024 * 1024
    elif kind == "material":
        if ext not in _STUDY_MATERIAL_EXTS:
            return jsonify(
                {
                    "error": "Study material must be PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, ZIP, TXT, or CSV",
                }
            ), 400
        max_mb = int(current_app.config.get("MAX_COURSE_STUDY_MATERIAL_UPLOAD_MB", 50))
        max_bytes = max(1, max_mb) * 1024 * 1024
    else:
        if ext not in (".mp4", ".mov", ".avi"):
            return jsonify({"error": "Video must be MP4, MOV, or AVI"}), 400
        max_mb = int(
            current_app.config.get(
                "MAX_COURSE_LESSON_UPLOAD_MB" if kind == "lesson" else "MAX_COURSE_INTRO_UPLOAD_MB",
                80,
            )
        )
        max_bytes = max(1, max_mb) * 1024 * 1024
    try:
        uf.seek(0, os.SEEK_END)
        sz = uf.tell()
        uf.seek(0)
    except OSError:
        return jsonify({"error": "Could not read upload"}), 400
    if sz > max_bytes:
        return jsonify({"error": f"File too large (max {max_bytes // 1024 // 1024}MB for this field)"}), 400
    if sz <= 0:
        return jsonify({"error": "Empty file"}), 400
    safe_ext = ".jpg" if ext == ".jpeg" else ext
    fn = f"{uuid.uuid4().hex}_{uuid.uuid4().hex[:8]}{safe_ext}"
    name_ok = _STUDY_MATERIAL_UPLOAD_NAME_RE.match(fn) if kind == "material" else _MEDIA_UPLOAD_NAME_RE.match(fn)
    if not name_ok:
        return jsonify({"error": "Invalid generated name"}), 500
    try:
        save_uploaded_file(kind, fn, uf)
    except ValueError as e:
        return jsonify({"error": str(e) or "Invalid upload"}), 400
    except OSError as e:
        current_app.logger.exception("course-media save failed: %s", e)
        return jsonify({"error": "Could not store file (check server storage configuration)"}), 503
    except Exception as e:
        current_app.logger.exception("course-media save failed: %s", e)
        return jsonify({"error": "Could not store file"}), 502
    url_path = f"/api/courses/media/{kind}/{fn}"
    return jsonify({"url": url_path})


@admin_bp.route("/courses/<course_id>/attendance", methods=["GET"])
@jwt_required()
def admin_get_course_attendance(course_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    links = c.get("classLinks") if isinstance(c.get("classLinks"), list) else []
    session_att = c.get("sessionAttendance") if isinstance(c.get("sessionAttendance"), dict) else {}
    today = date.today()
    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    students = []
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)):
        uid = e.get("userId")
        uids = str(uid).strip() if uid is not None else ""
        u = users_coll.find_one({"_id": ObjectId(uids)}) if uids and ObjectId.is_valid(uids) else None
        m = merged_student_fields_for_admin(e, u)
        students.append({
            "userId": uids,
            "name": m["name"] or ((u.get("name") or u.get("fullName") or "") if u else ""),
            "email": m["email"] or ((u.get("email") or "") if u else ""),
        })
    sessions_out = []
    for i, link in enumerate(links):
        if not isinstance(link, dict):
            continue
        sk = class_link_session_key(link, i)
        sd = parse_class_link_date(link.get("date"))
        can_mark = sd is not None and sd <= today
        block = session_att.get(sk) if isinstance(session_att.get(sk), dict) else {}
        recs = block.get("records") if isinstance(block.get("records"), list) else []
        by_uid = {}
        for r in recs:
            if not isinstance(r, dict):
                continue
            uu = str(r.get("userId") or "").strip()
            if uu:
                by_uid[uu] = {
                    "status": norm_attendance_status(r.get("status")),
                    "note": str(r.get("note") or "").strip()[:500],
                }
        sessions_out.append({
            "sessionKey": sk,
            "title": (link.get("title") or "Session").strip(),
            "sessionDate": sd.isoformat() if sd else "",
            "time": str(link.get("time") or "").strip(),
            "platform": str(link.get("platform") or "").strip(),
            "canMark": can_mark,
            "records": by_uid,
            "updatedAt": block.get("updatedAt").strftime("%Y-%m-%dT%H:%M:%SZ") if block.get("updatedAt") else "",
        })
    return jsonify({"sessions": sessions_out, "students": students})


@admin_bp.route("/courses/<course_id>/attendance/<path:session_key>", methods=["PUT"])
@jwt_required()
def admin_put_course_attendance_session(course_id, session_key):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(course_id):
        return jsonify({"error": "Invalid course id"}), 400
    sk = (session_key or "").strip()
    if not sk:
        return jsonify({"error": "Invalid session"}), 400
    data = request.get_json() or {}
    mark_all = bool(data.get("markAllPresent"))
    records_in = data.get("records") if isinstance(data.get("records"), list) else []
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_courses_collection()
    c = coll.find_one({"_id": ObjectId(course_id)})
    if not c:
        return jsonify({"error": "Course not found"}), 404
    links = c.get("classLinks") if isinstance(c.get("classLinks"), list) else []
    target = None
    for i, link in enumerate(links):
        if not isinstance(link, dict):
            continue
        if class_link_session_key(link, i) == sk:
            target = link
            break
    if not target:
        return jsonify({"error": "Session not found for this course"}), 404
    sd = parse_class_link_date(target.get("date"))
    today = date.today()
    if sd is None or sd > today:
        return jsonify({"error": "Attendance can be marked only on or after the session date"}), 400
    enroll_coll = get_enrollments_collection()
    allowed_uids = set()
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)):
        uid = e.get("userId")
        if uid is not None:
            allowed_uids.add(str(uid).strip())
    records_out = []
    if mark_all:
        for uu in sorted(allowed_uids):
            if uu:
                records_out.append({"userId": uu, "status": "present", "note": ""})
    else:
        for r in records_in:
            if not isinstance(r, dict):
                continue
            uu = str(r.get("userId") or "").strip()
            if not uu or uu not in allowed_uids:
                continue
            records_out.append({
                "userId": uu,
                "status": norm_attendance_status(r.get("status")),
                "note": str(r.get("note") or "").strip()[:500],
            })
    now = datetime.utcnow()
    coll.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": {f"sessionAttendance.{sk}": {"records": records_out, "updatedAt": now}}},
    )
    return jsonify({"ok": True, "count": len(records_out)}), 200


_DEFAULT_SUPPORT_FAQS = [
    {"id": "faq_invoice", "question": "How do I download my invoice?", "answer": "Open Payments & Invoices in your dashboard. For completed orders, use Download next to the transaction to get your GST tax invoice PDF (same file emailed after payment).", "sortOrder": 0, "displayOrder": 0, "category": "Payment", "visibility": "both", "active": True},
    {"id": "faq_certificate", "question": "How do I get a certificate?", "answer": "Complete your course requirements, including any completion quiz set by your trainer. When eligible, you can download or receive your certificate from the Certificate section of the course.", "sortOrder": 1, "displayOrder": 1, "category": "Certificate", "visibility": "both", "active": True},
    {"id": "faq_change_course", "question": "Can I change my course after enrolling?", "answer": "Contact support through Raise a Ticket with your enrollment details. Our team will check eligibility and guide you on any transfer or refund policy.", "sortOrder": 2, "displayOrder": 2, "category": "Training", "visibility": "both", "active": True},
]


@admin_bp.route("/support-content", methods=["GET"])
@jwt_required()
def admin_get_support_content():
    err = _admin_required()
    if err:
        return err
    from app.support_faq import serialize_faqs_from_doc

    db = get_db()
    if db is None:
        return jsonify({"faqs": _DEFAULT_SUPPORT_FAQS}), 503
    coll = get_app_settings_collection()
    doc = coll.find_one({"_id": "global"}) or {}
    safe = serialize_faqs_from_doc(doc, audience=None)
    return jsonify({"faqs": safe})


@admin_bp.route("/support-content", methods=["PUT"])
@jwt_required()
def admin_put_support_content():
    err = _admin_required()
    if err:
        return err
    from app.support_faq import normalize_faq_row

    data = request.get_json() or {}
    raw = data.get("faqs")
    if not isinstance(raw, list):
        return jsonify({"error": "faqs must be an array"}), 400
    out = []
    for i, x in enumerate(raw[:80]):
        if not isinstance(x, dict):
            continue
        row = normalize_faq_row(x, i)
        if row:
            out.append(row)
    out.sort(key=lambda z: z.get("displayOrder", 0))
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_app_settings_collection()
    coll.update_one(
        {"_id": "global"},
        {"$set": {"supportFaqs": out, "supportFaqsUpdatedAt": datetime.utcnow()}, "$setOnInsert": {"_id": "global"}},
        upsert=True,
    )
    _log_admin("faq.update", "support_faqs", "global", new_value={"count": len(out)})
    return jsonify({"ok": True, "faqs": out})


def _ticket_serialize(t: dict, user_lookup: dict | None = None) -> dict:
    uid = str(t.get("userId") or "")
    uname = ""
    uemail = ""
    if user_lookup and uid in user_lookup:
        u = user_lookup[uid]
        uname = (u.get("fullName") or u.get("name") or "").strip()
        uemail = (u.get("email") or "").strip()
    msgs = t.get("messages") if isinstance(t.get("messages"), list) else []
    safe_msgs = []
    for m in msgs[-50:]:
        if not isinstance(m, dict):
            continue
        safe_msgs.append({
            "from": m.get("from", "student"),
            "body": (m.get("body") or "")[:20000],
            "createdAt": m.get("createdAt").strftime("%Y-%m-%dT%H:%M:%SZ") if m.get("createdAt") else "",
        })
    return {
        "id": str(t["_id"]),
        "ticketId": t.get("ticketId", ""),
        "userId": uid,
        "studentName": uname,
        "studentEmail": uemail,
        "subject": t.get("subject", ""),
        "category": t.get("category", ""),
        "description": t.get("description", ""),
        "status": t.get("status", "open"),
        "priority": t.get("priority", "medium"),
        "createdAt": t.get("createdAt").strftime("%Y-%m-%dT%H:%M:%SZ") if t.get("createdAt") else "",
        "updatedAt": t.get("updatedAt").strftime("%Y-%m-%dT%H:%M:%SZ") if t.get("updatedAt") else "",
        "messages": safe_msgs,
    }


@admin_bp.route("/support-tickets", methods=["GET"])
@jwt_required()
def admin_list_support_tickets():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    status_f = (request.args.get("status") or "").strip().lower()
    cat_f = (request.args.get("category") or "").strip()
    pri_f = (request.args.get("priority") or "").strip().lower()
    date_from = (request.args.get("dateFrom") or "").strip()
    date_to = (request.args.get("dateTo") or "").strip()
    coll = get_support_tickets_collection()
    q: dict = {}
    if status_f:
        q["status"] = status_f
    if cat_f:
        q["category"] = cat_f
    if pri_f:
        q["priority"] = pri_f
    if date_from or date_to:
        rq: dict = {}
        try:
            if date_from:
                rq["$gte"] = datetime.strptime(date_from[:10], "%Y-%m-%d")
            if date_to:
                rq["$lte"] = datetime.strptime(date_to[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            rq = {}
        if rq:
            q["createdAt"] = rq
    rows = list(coll.find(q).sort("createdAt", -1).limit(200))
    uids = [str(r.get("userId")) for r in rows if r.get("userId")]
    users_coll = get_users_collection()
    lookup = {}
    if uids:
        oids = []
        for u in uids:
            try:
                if ObjectId.is_valid(u):
                    oids.append(ObjectId(u))
            except Exception:
                pass
        if oids:
            for udoc in users_coll.find({"_id": {"$in": oids}}):
                lookup[str(udoc["_id"])] = udoc
    items = [_ticket_serialize(r, lookup) for r in rows]
    return jsonify({"items": items})


@admin_bp.route("/support-tickets/<ticket_id>", methods=["GET"])
@jwt_required()
def admin_get_support_ticket(ticket_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(ticket_id):
        return jsonify({"error": "Invalid ticket id"}), 400
    coll = get_support_tickets_collection()
    t = coll.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        return jsonify({"error": "Not found"}), 404
    uid = str(t.get("userId") or "")
    lookup = {}
    if uid:
        udoc = get_users_collection().find_one({"_id": ObjectId(uid)})
        if udoc:
            lookup[uid] = udoc
    return jsonify(_ticket_serialize(t, lookup))


@admin_bp.route("/support-tickets/<ticket_id>/reply", methods=["POST"])
@jwt_required()
def admin_reply_support_ticket(ticket_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(ticket_id):
        return jsonify({"error": "Invalid ticket id"}), 400
    data = request.get_json() or {}
    body = (data.get("message") or data.get("body") or "").strip()
    if len(body) < 2:
        return jsonify({"error": "Message is required"}), 400
    coll = get_support_tickets_collection()
    t = coll.find_one({"_id": ObjectId(ticket_id)})
    if not t:
        return jsonify({"error": "Not found"}), 404
    if str(t.get("status", "")).lower() == "closed":
        return jsonify({"error": "Ticket is closed"}), 400
    msgs = t.get("messages") if isinstance(t.get("messages"), list) else []
    now = datetime.utcnow()
    msgs = list(msgs) + [{"from": "staff", "body": body, "createdAt": now}]
    coll.update_one(
        {"_id": t["_id"]},
        {"$set": {
            "messages": msgs,
            "updatedAt": now,
            "status": "in_progress" if str(t.get("status")) == "open" else t.get("status"),
        }},
    )
    t2 = coll.find_one({"_id": t["_id"]})
    uid = str(t2.get("userId") or "")
    lookup = {}
    udoc = None
    if uid:
        udoc = get_users_collection().find_one({"_id": ObjectId(uid)})
        if udoc:
            lookup[uid] = udoc
    if udoc:
        to_email = (udoc.get("email") or "").strip()
        stu_name = (udoc.get("name") or udoc.get("fullName") or "").strip()
        if to_email:
            try:
                send_support_ticket_staff_reply(
                    current_app.config,
                    stu_name,
                    to_email,
                    str(t2.get("ticketId") or ""),
                    str(t2.get("subject") or ""),
                    body,
                )
            except Exception:
                current_app.logger.exception("send_support_ticket_staff_reply")

    return jsonify(_ticket_serialize(t2, lookup))


@admin_bp.route("/support-tickets/<ticket_id>/status", methods=["PATCH"])
@jwt_required()
def admin_support_ticket_status(ticket_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(ticket_id):
        return jsonify({"error": "Invalid ticket id"}), 400
    data = request.get_json() or {}
    st = (data.get("status") or "").strip().lower()
    if st not in ("open", "in_progress", "resolved", "closed"):
        return jsonify({"error": "Invalid status"}), 400
    coll = get_support_tickets_collection()
    t_prev = coll.find_one({"_id": ObjectId(ticket_id)})
    prev_st = str(t_prev.get("status") or "").lower() if t_prev else ""
    now = datetime.utcnow()
    r = coll.update_one({"_id": ObjectId(ticket_id)}, {"$set": {"status": st, "updatedAt": now}})
    if r.matched_count == 0:
        return jsonify({"error": "Not found"}), 404
    t = coll.find_one({"_id": ObjectId(ticket_id)})
    uid = str(t.get("userId") or "")
    lookup = {}
    udoc = None
    if uid:
        udoc = get_users_collection().find_one({"_id": ObjectId(uid)})
        if udoc:
            lookup[uid] = udoc
    _ticket_status_labels = {
        "open": "Open",
        "in_progress": "In progress",
        "resolved": "Resolved",
        "closed": "Closed",
    }
    if udoc and st != prev_st:
        to_email = (udoc.get("email") or "").strip()
        stu_name = (udoc.get("name") or udoc.get("fullName") or "").strip()
        label = _ticket_status_labels.get(st, st.replace("_", " ").title())
        if to_email:
            try:
                send_support_ticket_status_update(
                    current_app.config,
                    stu_name,
                    to_email,
                    str(t.get("ticketId") or ""),
                    str(t.get("subject") or ""),
                    label,
                )
            except Exception:
                current_app.logger.exception("send_support_ticket_status_update")
    return jsonify(_ticket_serialize(t, lookup))
