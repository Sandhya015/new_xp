"""
Admin: dashboard, course CRUD, students, leads, payments, companies, internships, certificates. Admin JWT required.
"""
import base64
import os
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from werkzeug.utils import secure_filename
from bson import ObjectId
from io import BytesIO

from flask import Blueprint, current_app, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.routes.enrollments import _serialize_submission
from app.services.course_media_storage import (
    course_media_object_exists,
    parse_stored_course_media_url,
    save_uploaded_file,
)
from app.certificate_pdf import build_course_certificate_pdf
from app.certificate_quiz_pass import apply_quiz_pass_certificate
from app.services.curriculum import normalize_curriculum
from app.services.enrollment_excel import (
    build_enrollment_workbook_bytes,
    export_row_for_enrollment,
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
    get_applications_collection,
    get_internships_collection,
    get_certificates_collection,
    get_followups_collection,
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


def _user_to_row(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("name") or u.get("fullName") or "",
        "email": u.get("email", ""),
        "mobile": u.get("mobile") or "",
        "university": u.get("university") or "",
        "course": u.get("course") or "",
        "registered": u.get("createdAt").strftime("%Y-%m-%d") if u.get("createdAt") else "",
        "status": "Active",
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
        "active": c.get("active", True),
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
    out["certificateEmailOnly"] = bool(c.get("certificateEmailOnly"))
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
        q = {}
        search = request.args.get("search", "").strip()
        if search:
            q["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]
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
    return jsonify(_course_to_item(doc)), 201


@admin_bp.route("/students", methods=["GET"])
@jwt_required()
def students():
    err = _admin_required()
    if err:
        return err
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    search = request.args.get("search", "").strip()
    q = {"role": "student"}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"fullName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
        ]
    cursor = get_users_collection().find(q).sort("createdAt", -1)
    items = [_user_to_row(u) for u in cursor]
    return jsonify({"items": items})


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
        return jsonify({"items": [], "message": "Database not configured"}), 503
    search = request.args.get("search", "").strip()
    q = {}
    if search:
        q["$or"] = [
            {"studentId": {"$regex": search, "$options": "i"}},
            {"orderId": {"$regex": search, "$options": "i"}},
        ]
    cursor = get_orders_collection().find(q).sort("createdAt", -1)
    items = []
    for o in cursor:
        items.append({
            "id": str(o["_id"]),
            "orderId": o.get("orderId", ""),
            "studentId": o.get("userId") or o.get("studentId", ""),
            "amount": o.get("amount", 0),
            "status": o.get("status", "pending"),
            "createdAt": o.get("createdAt").strftime("%Y-%m-%d %H:%M") if o.get("createdAt") else "",
        })
    return jsonify({"items": items})


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

    return jsonify({"kpis": kpis, "pendingItems": pending_items, "recentActivity": recent})


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
    if updates:
        updates["updatedAt"] = datetime.utcnow()
        coll.update_one({"_id": ObjectId(course_id)}, {"$set": updates})
    updated = coll.find_one({"_id": ObjectId(course_id)})
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
    coll.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": {"curriculum": norm, "updatedAt": datetime.utcnow()}},
    )
    return jsonify({"ok": True, "curriculum": norm}), 200


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
    cursor = enroll_coll.find(course_id_enrollment_filter(course_id)).sort("createdAt", -1)
    items = []
    for e in cursor:
        uid = e.get("userId")
        u = users_coll.find_one({"_id": ObjectId(uid)}) if uid and ObjectId.is_valid(uid) else None
        subs = e.get("assignmentSubmissions") if isinstance(e.get("assignmentSubmissions"), list) else []
        items.append({
            "id": str(e["_id"]),
            "userId": e.get("userId", ""),
            "name": (u.get("name") or u.get("fullName", "")) if u else "",
            "email": (u.get("email", "")) if u else "",
            "mobile": (u.get("mobile", "")) if u else "",
            "university": (u.get("university", "")) if u else "",
            "collegeName": (u.get("collegeName", "")) if u else "",
            "course": (u.get("course", "")) if u else "",
            "stream": (u.get("stream", "")) if u else "",
            "semester": (u.get("semester", "")) if u else "",
            "enrolledAt": e.get("createdAt").strftime("%Y-%m-%d") if e.get("createdAt") else "",
            "batch": e.get("batch", ""),
            "orderId": e.get("orderId", ""),
            "assignmentSubmissions": [_serialize_submission(x) for x in subs if isinstance(x, dict)],
        })
    return jsonify({"items": items})


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
    rows = []
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)).sort("createdAt", 1):
        uid = e.get("userId")
        u = users_coll.find_one({"_id": ObjectId(uid)}) if uid and ObjectId.is_valid(str(uid)) else None
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


# ----- Student by ID -----
@admin_bp.route("/students/<student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    err = _admin_required()
    if err:
        return err
    if not ObjectId.is_valid(student_id):
        return jsonify({"error": "Invalid student id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    users = get_users_collection()
    u = users.find_one({"_id": ObjectId(student_id), "role": "student"})
    if not u:
        return jsonify({"error": "Student not found"}), 404
    out = _user_to_row(u)
    out["mobile"] = u.get("mobile") or ""
    out["collegeName"] = u.get("collegeName") or ""
    out["stream"] = u.get("stream") or ""
    out["semester"] = u.get("semester") or ""

    enrollments = list(get_enrollments_collection().find({"userId": student_id}).sort("createdAt", -1))
    out["enrollments"] = [
        {"id": str(e["_id"]), "courseId": e.get("courseId", ""), "courseTitle": e.get("courseTitle", ""), "createdAt": e.get("createdAt").strftime("%Y-%m-%d") if e.get("createdAt") else ""}
        for e in enrollments
    ]
    apps = list(get_applications_collection().find({"studentId": student_id}).sort("createdAt", -1))
    out["applications"] = [
        {"id": str(a["_id"]), "internshipId": a.get("internshipId", ""), "status": a.get("status", ""), "createdAt": a.get("createdAt").strftime("%Y-%m-%d") if a.get("createdAt") else ""}
        for a in apps
    ]
    return jsonify(out)


# ----- Payment by ID + verify / refund -----
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
    return jsonify({
        "id": str(o["_id"]),
        "orderId": o.get("orderId", ""),
        "studentId": o.get("userId") or o.get("studentId", ""),
        "amount": o.get("amount", 0),
        "status": o.get("status", "pending"),
        "createdAt": o.get("createdAt").strftime("%Y-%m-%d %H:%M") if o.get("createdAt") else "",
        "courseId": o.get("courseId", ""),
        "gatewayRef": o.get("gatewayRef", ""),
    })


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
    result = get_orders_collection().update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"status": "success", "verifiedAt": datetime.utcnow(), "verifiedNote": ref}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Payment not found or already verified"}), 404
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
    refund_amount = int(amount) if amount is not None else o.get("amount", 0)
    get_orders_collection().update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"status": "refunded", "refundedAt": datetime.utcnow(), "refundReason": reason, "refundAmount": refund_amount, "refundGatewayRef": data.get("gatewayRef", "")}}
    )
    return jsonify({"ok": True, "message": "Refund recorded"})


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
            "programName": c.get("programName", ""),
            "courseId": str(c.get("courseId") or ""),
            "issueDate": _issue_date_str(c),
            "completionDate": str(c.get("completionDate") or "")[:10],
            "university": c.get("university", ""),
            "status": c.get("status", "valid"),
            "source": c.get("source", "") or "",
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
    return {
        "id": str(c["_id"]),
        "certNo": c.get("certNo", ""),
        "studentName": c.get("studentName", ""),
        "studentEmail": em,
        "studentMobile": mobile,
        "studentId": uid,
        "programName": c.get("programName", ""),
        "courseId": str(c.get("courseId") or ""),
        "courseTitle": course_title,
        "university": c.get("university", ""),
        "issueDate": _issue_date_str(c),
        "completionDate": str(c.get("completionDate") or "")[:10],
        "status": c.get("status", "valid"),
        "source": c.get("source", "") or "",
        "revokeReason": c.get("revokeReason") or "",
        "revokedAt": revoked_at.strftime("%Y-%m-%d %H:%M UTC") if hasattr(revoked_at, "strftime") else (str(revoked_at) if revoked_at else ""),
    }


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
    student_name = c.get("studentName") or "Student"
    program = c.get("programName") or "Program"
    cert_no = (c.get("certNo") or "").strip() or "CERT"
    date_str = _issue_date_str(c) or datetime.utcnow().strftime("%Y-%m-%d")
    try:
        pdf_bytes = build_course_certificate_pdf(student_name, program, cert_no, date_str)
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
