"""
Admin: dashboard, course CRUD, students, leads, payments, companies, internships, certificates. Admin JWT required.
"""
from datetime import datetime, timedelta
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

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


def _admin_required():
    """After @jwt_required(), check role is admin. Returns (error_response, status) or None."""
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
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
        "category": c.get("category", "technical"),
        "duration": c.get("duration", ""),
        "mode": c.get("mode", "Online"),
        "universities": c.get("universities", ""),
        "price": c.get("price", 0),
        "tag": c.get("tag", ""),
        "active": c.get("active", True),
    }


def _course_to_detail(c):
    """Full course for manage/edit: includes batches, curriculum, classLinks, etc."""
    out = _course_to_item(c)
    out["shortDescription"] = c.get("shortDescription", "")
    out["fullDescription"] = c.get("fullDescription", "")
    out["trainerName"] = c.get("trainerName", "")
    out["durationValue"] = c.get("durationValue", "")
    out["durationUnit"] = c.get("durationUnit", "weeks")
    out["courses"] = c.get("courses", [])
    out["streams"] = c.get("streams", [])
    out["batches"] = c.get("batches", [])
    out["curriculum"] = c.get("curriculum", [])
    out["classLinks"] = c.get("classLinks", [])
    out["studyMaterials"] = c.get("studyMaterials", [])
    out["assignments"] = c.get("assignments", [])
    out["quizzes"] = c.get("quizzes", [])
    out["announcements"] = c.get("announcements", [])
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
    from datetime import datetime
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
    doc = {
        "title": title,
        "description": description,
        "category": (data.get("category") or "technical").strip().lower(),
        "duration": duration_val.strip(),
        "mode": mode_str,
        "universities": universities_str,
        "price": price,
        "tag": (data.get("tag") or "").strip(),
        "active": data.get("active", True),
        "createdAt": datetime.utcnow(),
    }
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
    if isinstance(data.get("batches"), list):
        doc["batches"] = data["batches"]
    if isinstance(data.get("curriculum"), list):
        doc["curriculum"] = data["curriculum"]
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
    total_revenue = sum(o.get("amount", 0) for o in orders.find({"status": "success"})) or 0
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_this_month = sum(
        o.get("amount", 0) for o in orders.find({
            "status": "success",
            "createdAt": {"$gte": month_start},
        })
    ) or 0
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
    for key in ("title", "description", "shortDescription", "fullDescription", "category", "duration", "mode", "universities", "trainerName", "durationValue", "durationUnit"):
        if key in data:
            if key in ("universities",) and isinstance(data[key], list):
                updates[key] = ",".join(str(x) for x in data[key]) if data[key] else ""
            else:
                updates[key] = data[key]
    if "price" in data or "fee" in data:
        updates["price"] = int(data.get("price") or data.get("fee") or 0)
    if "active" in data:
        updates["active"] = bool(data["active"])
    if "batches" in data and isinstance(data["batches"], list):
        updates["batches"] = data["batches"]
    if "curriculum" in data and isinstance(data["curriculum"], list):
        updates["curriculum"] = data["curriculum"]
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
    if updates:
        coll.update_one({"_id": ObjectId(course_id)}, {"$set": updates})
    updated = coll.find_one({"_id": ObjectId(course_id)})
    return jsonify(_course_to_detail(updated))


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
    cursor = enroll_coll.find({"courseId": course_id}).sort("createdAt", -1)
    items = []
    for e in cursor:
        uid = e.get("userId")
        u = users_coll.find_one({"_id": ObjectId(uid)}) if uid and ObjectId.is_valid(uid) else None
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
        })
    return jsonify({"items": items})


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
    result = get_users_collection().update_one(
        {"_id": ObjectId(company_id), "role": "company"},
        {"$set": {"status": "active"}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Company not found"}), 404
    return jsonify({"ok": True, "message": "Company approved"})


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
    status = request.args.get("status", "").strip().lower()
    q = {}
    if search:
        q["$or"] = [
            {"certNo": {"$regex": search, "$options": "i"}},
            {"studentName": {"$regex": search, "$options": "i"}},
        ]
    if status in ("valid", "revoked"):
        q["status"] = status
    cursor = get_certificates_collection().find(q).sort("issueDate", -1)
    items = []
    for c in cursor:
        items.append({
            "id": str(c["_id"]),
            "certNo": c.get("certNo", ""),
            "studentName": c.get("studentName", ""),
            "programName": c.get("programName", ""),
            "issueDate": c.get("issueDate", ""),
            "university": c.get("university", ""),
            "status": c.get("status", "valid"),
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
