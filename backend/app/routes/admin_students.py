"""
Admin student management (CFRD §4): list/export, profile override, suspend/delete,
password reset, messaging, tab data. Registered under /api/admin.
"""
from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import secrets
import uuid
from datetime import date, datetime, timedelta
from urllib.parse import quote

from bson import ObjectId
from flask import Blueprint, Response, current_app, jsonify, request, send_file
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from app.activity_log import serialize_activity_log
from app.db import (
    get_activity_logs_collection,
    get_applications_collection,
    get_certificates_collection,
    get_courses_collection,
    get_db,
    get_enrollments_collection,
    get_internships_collection,
    get_orders_collection,
    get_password_reset_tokens_collection,
    get_support_tickets_collection,
    get_users_collection,
)
from app.email_smtp import send_email, send_password_reset_email
from app.email_templates import public_app_url
from app.registration_otp import smtp_or_ses_configured, utcnow
from app.routes.admin import (
    _admin_actor,
    _admin_required,
    _log_admin,
    _ticket_serialize,
    _user_to_row,
)
from app.routes.enrollments import _curriculum_topic_ids

admin_students_bp = Blueprint("admin_students", __name__)

_PASSWORD_RESET_ADMIN_EXPIRY = timedelta(minutes=30)

_EXPORT_COLUMNS = {
    "id": "ID",
    "name": "Name",
    "email": "Email",
    "mobile": "Mobile",
    "university": "University",
    "collegeName": "College",
    "course": "Course",
    "branch": "Branch",
    "semester": "Semester",
    "registered": "Registered",
    "status": "Status",
    "accountStatus": "Account Status",
    "emailVerified": "Email Verified",
}

_PATCH_FIELDS = (
    "name",
    "fullName",
    "email",
    "mobile",
    "university",
    "collegeName",
    "course",
    "branch",
    "stream",
    "subject",
    "semester",
    "dateOfBirth",
    "addressLine1",
    "addressApartment",
    "addressCity",
    "addressState",
    "addressPincode",
    "addressCountry",
)


def _hash_password_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _fmt_date(val) -> str:
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, date):
        return val.isoformat()
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val).strip()


def _fmt_dt(val) -> str:
    if val is None:
        return ""
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d %H:%M")
    return str(val).strip()


def _parse_ymd(s: str) -> datetime | None:
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def _student_detail_fields(u: dict) -> dict:
    out = _user_to_row(u)
    dob = u.get("dateOfBirth")
    out.update({
        "mobile": u.get("mobile") or "",
        "collegeName": u.get("collegeName") or "",
        "stream": u.get("stream") or "",
        "branch": u.get("branch") or u.get("stream") or u.get("subject") or "",
        "semester": u.get("semester") or "",
        "dateOfBirth": _fmt_date(dob),
        "addressLine1": u.get("addressLine1") or "",
        "addressApartment": u.get("addressApartment") or "",
        "addressCity": u.get("addressCity") or "",
        "addressState": u.get("addressState") or "",
        "addressPincode": u.get("addressPincode") or "",
        "addressCountry": u.get("addressCountry") or "",
        "suspendedAt": _fmt_dt(u.get("suspendedAt")),
        "suspendedBy": u.get("suspendedBy") or "",
        "suspendReason": u.get("suspendReason") or "",
        "deletedAt": _fmt_dt(u.get("deletedAt")),
    })
    return out


def _find_student(student_id: str):
    if not ObjectId.is_valid(student_id):
        return None, (jsonify({"error": "Invalid student id"}), 400)
    u = get_users_collection().find_one({"_id": ObjectId(student_id), "role": "student"})
    if not u:
        return None, (jsonify({"error": "Student not found"}), 404)
    return u, None


def _enrolled_user_ids() -> set[str]:
    ids = get_enrollments_collection().distinct("userId")
    return {str(x) for x in ids if x}


def _build_students_query(args) -> dict:
    clauses: list[dict] = [{"role": "student"}]

    account_status = (args.get("accountStatus") or "").strip().lower()
    if account_status == "deleted":
        clauses.append({"$or": [{"accountStatus": "deleted"}, {"deleted": True}]})
    elif account_status == "suspended":
        clauses.append({"accountStatus": "suspended"})
        clauses.append({"deleted": {"$ne": True}})
    elif account_status == "active":
        clauses.append({"deleted": {"$ne": True}})
        clauses.append({
            "$or": [
                {"accountStatus": "active"},
                {"accountStatus": {"$exists": False}},
                {"accountStatus": None},
                {"accountStatus": ""},
            ]
        })
    else:
        clauses.append({"deleted": {"$ne": True}})
        clauses.append({"accountStatus": {"$ne": "deleted"}})

    search = (args.get("search") or "").strip()
    if search:
        or_list: list[dict] = [
            {"name": {"$regex": re.escape(search), "$options": "i"}},
            {"fullName": {"$regex": re.escape(search), "$options": "i"}},
            {"email": {"$regex": re.escape(search), "$options": "i"}},
            {"mobile": {"$regex": re.escape(search), "$options": "i"}},
        ]
        if ObjectId.is_valid(search):
            or_list.append({"_id": ObjectId(search)})
        clauses.append({"$or": or_list})

    for key, field in (
        ("university", "university"),
        ("collegeName", "collegeName"),
        ("course", "course"),
        ("semester", "semester"),
    ):
        # Support multi-value: university=A,B or universities=A&universities=B
        multi = args.getlist(key + "s") if hasattr(args, "getlist") else []
        val = (args.get(key) or "").strip()
        vals = [v.strip() for v in multi if v and str(v).strip()]
        if val:
            vals.extend([x.strip() for x in val.split(",") if x.strip()])
        vals = list(dict.fromkeys(vals))
        if len(vals) == 1:
            clauses.append({field: {"$regex": f"^{re.escape(vals[0])}$", "$options": "i"}})
        elif len(vals) > 1:
            clauses.append({
                "$or": [{field: {"$regex": f"^{re.escape(v)}$", "$options": "i"}} for v in vals]
            })

    branch = (args.get("branch") or args.get("stream") or args.get("subject") or "").strip()
    branches = []
    if hasattr(args, "getlist"):
        branches = [b.strip() for b in args.getlist("branches") if b and str(b).strip()]
    if branch:
        branches.extend([x.strip() for x in branch.split(",") if x.strip()])
    branches = list(dict.fromkeys(branches))
    if branches:
        or_b = []
        for b in branches:
            or_b.extend([
                {"branch": {"$regex": re.escape(b), "$options": "i"}},
                {"stream": {"$regex": re.escape(b), "$options": "i"}},
                {"subject": {"$regex": re.escape(b), "$options": "i"}},
            ])
        clauses.append({"$or": or_b})

    registered_from = (args.get("registeredFrom") or "").strip()
    registered_to = (args.get("registeredTo") or "").strip()
    if registered_from or registered_to:
        rq: dict = {}
        if registered_from:
            dt = _parse_ymd(registered_from)
            if dt:
                rq["$gte"] = dt
        if registered_to:
            dt = _parse_ymd(registered_to)
            if dt:
                rq["$lte"] = dt.replace(hour=23, minute=59, second=59)
        if rq:
            clauses.append({"createdAt": rq})

    enrollment_status = (args.get("enrollmentStatus") or "").strip().lower()
    if enrollment_status in ("enrolled", "not_enrolled"):
        enrolled = _enrolled_user_ids()
        oids = [ObjectId(x) for x in enrolled if ObjectId.is_valid(x)]
        if enrollment_status == "enrolled":
            clauses.append({"_id": {"$in": oids}})
        else:
            clauses.append({"_id": {"$nin": oids}})

    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _pagination(args, default_limit: int = 50, max_limit: int = 200):
    try:
        page = max(1, int(args.get("page") or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = min(max_limit, max(1, int(args.get("limit") or default_limit)))
    except (TypeError, ValueError):
        limit = default_limit
    return page, limit


def _progress_percent(enrollment: dict, course: dict | None) -> int | None:
    if not course:
        return None
    ids = _curriculum_topic_ids(course)
    if not ids:
        return None
    raw_done = enrollment.get("completedCurriculumTopicIds")
    done = {str(x) for x in raw_done} if isinstance(raw_done, list) else set()
    n_done = sum(1 for tid in ids if tid in done)
    return min(100, int(round(100.0 * n_done / len(ids))))


def _certificate_status(enrollment: dict) -> str:
    cc = enrollment.get("courseCertificate") or {}
    if cc.get("issuedAt") or (cc.get("certNo") or "").strip():
        return "issued"
    if enrollment.get("completedAt") or bool((enrollment.get("pythonQuiz") or {}).get("passedAt")):
        return "eligible"
    return "pending"


def _fee_paid_for_enrollment(enrollment: dict) -> bool:
    order_id = enrollment.get("orderId")
    if not order_id:
        return str(enrollment.get("status") or "").lower() in ("active", "completed")
    orders = get_orders_collection()
    o = None
    if ObjectId.is_valid(str(order_id)):
        o = orders.find_one({"_id": ObjectId(str(order_id))})
    if not o:
        o = orders.find_one({"orderId": str(order_id)})
    if not o:
        return False
    return str(o.get("status") or "").lower() in ("success", "paid", "verified")


def _enrolled_trainings_items(student_id: str) -> list[dict]:
    enrollments = list(
        get_enrollments_collection().find({"userId": student_id}).sort("createdAt", -1)
    )
    course_ids = []
    for e in enrollments:
        cid = e.get("courseId")
        if cid and ObjectId.is_valid(str(cid)):
            course_ids.append(ObjectId(str(cid)))
    courses = {}
    if course_ids:
        for c in get_courses_collection().find({"_id": {"$in": course_ids}}):
            courses[str(c["_id"])] = c
    items = []
    for e in enrollments:
        cid = str(e.get("courseId") or "")
        course = courses.get(cid)
        uni = ""
        if course:
            uni = course.get("universities") or course.get("university") or ""
            if isinstance(uni, list):
                uni = ", ".join(str(x) for x in uni if x)
        items.append({
            "id": str(e["_id"]),
            "courseId": cid,
            "title": (course.get("title") if course else None) or e.get("courseTitle") or "",
            "university": uni or "",
            "category": (course.get("category") if course else "") or "",
            "mode": (e.get("mode") or (course.get("mode") if course else "") or ""),
            "duration": (course.get("duration") if course else "") or "",
            "feePaid": _fee_paid_for_enrollment(e),
            "enrollmentDate": _fmt_date(e.get("createdAt")),
            "progressPercent": _progress_percent(e, course),
            "certificateStatus": _certificate_status(e),
            "status": e.get("status") or "active",
        })
    return items


def _applied_internships_items(student_id: str) -> list[dict]:
    apps = list(
        get_applications_collection().find({"studentId": student_id}).sort("createdAt", -1)
    )
    intern_ids = [ObjectId(a["internshipId"]) for a in apps if a.get("internshipId") and ObjectId.is_valid(str(a["internshipId"]))]
    interns = {}
    if intern_ids:
        for i in get_internships_collection().find({"_id": {"$in": intern_ids}}):
            interns[str(i["_id"])] = i
    company_ids = []
    for i in interns.values():
        cid = i.get("companyId")
        if cid and ObjectId.is_valid(str(cid)):
            company_ids.append(ObjectId(str(cid)))
    companies = {}
    if company_ids:
        for u in get_users_collection().find({"_id": {"$in": company_ids}}):
            companies[str(u["_id"])] = u
    items = []
    for a in apps:
        iid = str(a.get("internshipId") or "")
        intern = interns.get(iid)
        company_name = ""
        role = ""
        if intern:
            role = intern.get("title") or ""
            company_name = intern.get("companyName") or ""
            cid = str(intern.get("companyId") or "")
            if not company_name and cid in companies:
                c = companies[cid]
                company_name = c.get("companyName") or c.get("name") or ""
        offer = (
            a.get("offerLetterUrl")
            or a.get("offerLetter")
            or a.get("offerLetterPdf")
            or (intern.get("offerLetterUrl") if intern else None)
            or ""
        )
        items.append({
            "id": str(a["_id"]),
            "internshipId": iid,
            "company": company_name,
            "role": role,
            "appliedAt": _fmt_date(a.get("createdAt")),
            "startDate": _fmt_date(a.get("startDate") or (intern.get("startDate") if intern else None)),
            "endDate": _fmt_date(a.get("endDate") or (intern.get("endDate") if intern else None)),
            "status": a.get("status") or "applied",
            "offerLetter": offer or None,
        })
    return items


def _documents_items(student_id: str, student_email: str = "") -> list[dict]:
    docs: list[dict] = []
    q: dict = {"$or": [{"studentId": student_id}]}
    if student_email:
        q["$or"].append({"email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}})
    for c in get_certificates_collection().find(q).sort("issueDate", -1):
        issue = c.get("issueDate") or c.get("completionDate") or c.get("createdAt")
        docs.append({
            "id": str(c["_id"]),
            "type": "certificate",
            "title": c.get("programName") or c.get("domain") or c.get("course") or "Certificate",
            "certNo": c.get("certNo") or "",
            "status": c.get("status") or "valid",
            "issuedAt": _fmt_date(issue),
            "url": c.get("pdfUrl") or c.get("downloadUrl") or "",
        })
    for a in _applied_internships_items(student_id):
        if a.get("offerLetter"):
            docs.append({
                "id": f"offer-{a['id']}",
                "type": "offer_letter",
                "title": f"Offer — {a.get('company') or a.get('role') or 'Internship'}",
                "status": a.get("status") or "",
                "issuedAt": a.get("appliedAt") or "",
                "url": a["offerLetter"],
                "applicationId": a["id"],
            })
    return docs


def _payments_items(student_id: str) -> list[dict]:
    items = []
    for o in get_orders_collection().find({"userId": student_id}).sort("createdAt", -1):
        items.append({
            "id": str(o["_id"]),
            "orderId": o.get("orderId") or "",
            "courseId": o.get("courseId") or "",
            "amount": o.get("amount") or 0,
            "status": o.get("status") or "pending",
            "gatewayRef": o.get("gatewayRef") or o.get("razorpayPaymentId") or "",
            "createdAt": _fmt_dt(o.get("createdAt")),
        })
    return items


def _tickets_items(student_id: str) -> list[dict]:
    coll = get_support_tickets_collection()
    rows = list(coll.find({"userId": student_id}).sort("createdAt", -1))
    u = get_users_collection().find_one({"_id": ObjectId(student_id)}) if ObjectId.is_valid(student_id) else None
    lookup = {student_id: u} if u else {}
    return [_ticket_serialize(r, lookup) for r in rows]


def _activity_items(student_id: str, page: int = 1, limit: int = 50) -> tuple[list, int]:
    coll = get_activity_logs_collection()
    q = {"entityType": "student", "entityId": student_id}
    total = coll.count_documents(q)
    cursor = coll.find(q).sort("createdAt", -1).skip((page - 1) * limit).limit(limit)
    return [serialize_activity_log(d) for d in cursor], total


# ----- List / export -----
@admin_students_bp.route("/students", methods=["GET"])
@jwt_required()
def students():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": [], "total": 0, "page": 1, "limit": 50, "message": "Database not configured"}), 503
    q = _build_students_query(request.args)
    page, limit = _pagination(request.args)
    coll = get_users_collection()
    total = coll.count_documents(q)
    cursor = coll.find(q).sort("createdAt", -1).skip((page - 1) * limit).limit(limit)
    items = [_user_to_row(u) for u in cursor]
    return jsonify({"items": items, "total": total, "page": page, "limit": limit})


@admin_students_bp.route("/students/export", methods=["GET"])
@jwt_required()
def students_export():
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503

    fmt = (request.args.get("format") or "csv").strip().lower()
    if fmt not in ("csv", "xlsx"):
        return jsonify({"error": "format must be csv or xlsx"}), 400

    cols_raw = (request.args.get("columns") or "").strip()
    if cols_raw:
        columns = [c.strip() for c in cols_raw.split(",") if c.strip() and c.strip() in _EXPORT_COLUMNS]
    else:
        columns = list(_EXPORT_COLUMNS.keys())
    if not columns:
        columns = list(_EXPORT_COLUMNS.keys())

    q = _build_students_query(request.args)
    rows = [_user_to_row(u) for u in get_users_collection().find(q).sort("createdAt", -1).limit(10000)]

    headers = [_EXPORT_COLUMNS[c] for c in columns]
    data_rows = []
    for r in rows:
        data_rows.append([
            ("Yes" if r.get(c) is True else "No" if r.get(c) is False else ("" if r.get(c) is None else str(r.get(c))))
            for c in columns
        ])

    stamp = datetime.utcnow().strftime("%Y%m%d")
    if fmt == "xlsx":
        try:
            from openpyxl import Workbook
        except ImportError:
            fmt = "csv"
        else:
            wb = Workbook()
            ws = wb.active
            ws.title = "Students"
            ws.append(headers)
            for row in data_rows:
                ws.append(row)
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            _log_admin("student.export", "student", None, meta={"format": "xlsx", "count": len(rows)})
            return send_file(
                buf,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"students-{stamp}.xlsx",
            )

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers)
    writer.writerows(data_rows)
    payload = out.getvalue().encode("utf-8-sig")
    _log_admin("student.export", "student", None, meta={"format": "csv", "count": len(rows)})
    return Response(
        payload,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="students-{stamp}.csv"'},
    )


# ----- Detail + tabs -----
@admin_students_bp.route("/students/<student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    out = _student_detail_fields(u)
    out["enrollments"] = _enrolled_trainings_items(student_id)
    out["applications"] = _applied_internships_items(student_id)
    out["documents"] = _documents_items(student_id, u.get("email") or "")
    out["payments"] = _payments_items(student_id)
    out["tickets"] = _tickets_items(student_id)
    activity, activity_total = _activity_items(student_id, 1, 50)
    out["activityLog"] = activity
    out["activityLogTotal"] = activity_total
    return jsonify(out)


@admin_students_bp.route("/students/<student_id>", methods=["PATCH"])
@jwt_required()
def patch_student(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    data = request.get_json() or {}
    updates = {}
    changes = []
    for key in _PATCH_FIELDS:
        if key not in data:
            continue
        new_val = data.get(key)
        if new_val is None:
            continue
        if isinstance(new_val, str):
            new_val = new_val.strip()
        if key == "email" and new_val:
            new_val = str(new_val).strip().lower()
            other = get_users_collection().find_one({"email": new_val, "_id": {"$ne": u["_id"]}})
            if other:
                return jsonify({"error": "Email already in use"}), 409
        if key == "dateOfBirth" and new_val:
            parsed = _parse_ymd(str(new_val))
            new_val = parsed.date() if parsed else str(new_val).strip()
        old_val = u.get(key)
        if key == "dateOfBirth":
            old_cmp = _fmt_date(old_val)
            new_cmp = _fmt_date(new_val) if not isinstance(new_val, str) else new_val
        else:
            old_cmp = ("" if old_val is None else str(old_val).strip())
            new_cmp = ("" if new_val is None else str(new_val).strip())
        if old_cmp == new_cmp:
            continue
        updates[key] = new_val
        changes.append({"field": key, "old": old_cmp, "new": new_cmp})

    if "name" in updates and updates["name"] and "fullName" not in updates:
        updates["fullName"] = updates["name"]
        if str(u.get("fullName") or "") != str(updates["fullName"]):
            changes.append({
                "field": "fullName",
                "old": str(u.get("fullName") or ""),
                "new": str(updates["fullName"]),
            })
    elif "fullName" in updates and updates["fullName"] and "name" not in updates:
        updates["name"] = updates["fullName"]

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    updates["updatedAt"] = datetime.utcnow()
    get_users_collection().update_one({"_id": u["_id"]}, {"$set": updates})
    for ch in changes:
        _log_admin(
            "student.field_update",
            "student",
            student_id,
            old_value={ch["field"]: ch["old"]},
            new_value={ch["field"]: ch["new"]},
            meta={"field": ch["field"]},
        )
    u2 = get_users_collection().find_one({"_id": u["_id"]})
    return jsonify(_student_detail_fields(u2))


@admin_students_bp.route("/students/<student_id>/enrolled-trainings", methods=["GET"])
@jwt_required()
def student_enrolled_trainings(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": []}), 503
    _, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    return jsonify({"items": _enrolled_trainings_items(student_id)})


@admin_students_bp.route("/students/<student_id>/applied-internships", methods=["GET"])
@jwt_required()
def student_applied_internships(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": []}), 503
    _, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    return jsonify({"items": _applied_internships_items(student_id)})


@admin_students_bp.route("/students/<student_id>/documents", methods=["GET"])
@jwt_required()
def student_documents(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": []}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    return jsonify({"items": _documents_items(student_id, u.get("email") or "")})


@admin_students_bp.route("/students/<student_id>/payments", methods=["GET"])
@jwt_required()
def student_payments(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": []}), 503
    _, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    return jsonify({"items": _payments_items(student_id)})


@admin_students_bp.route("/students/<student_id>/tickets", methods=["GET"])
@jwt_required()
def student_tickets(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": []}), 503
    _, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    return jsonify({"items": _tickets_items(student_id)})


@admin_students_bp.route("/students/<student_id>/activity-log", methods=["GET"])
@jwt_required()
def student_activity_log(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"items": [], "total": 0}), 503
    _, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    page, limit = _pagination(request.args, default_limit=50, max_limit=100)
    items, total = _activity_items(student_id, page, limit)
    return jsonify({"items": items, "total": total, "page": page, "limit": limit})


# ----- Actions -----
@admin_students_bp.route("/students/<student_id>/suspend", methods=["POST"])
@jwt_required()
def suspend_student(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    if (u.get("accountStatus") or "").strip().lower() == "deleted" or u.get("deleted"):
        return jsonify({"error": "Cannot suspend a deleted account"}), 400
    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    from app.routes.admin import _admin_actor
    actor = _admin_actor()
    now = datetime.utcnow()
    get_users_collection().update_one(
        {"_id": u["_id"]},
        {"$set": {
            "accountStatus": "suspended",
            "suspendedAt": now,
            "suspendedBy": actor.get("actor_email") or actor.get("actor_id") or "",
            "suspendReason": reason,
            "updatedAt": now,
        }},
    )
    _log_admin(
        "student.suspend",
        "student",
        student_id,
        old_value={"accountStatus": u.get("accountStatus") or "active"},
        new_value={"accountStatus": "suspended", "reason": reason},
    )
    return jsonify({"ok": True, "message": "Student suspended"})


@admin_students_bp.route("/students/<student_id>/unsuspend", methods=["POST"])
@jwt_required()
def unsuspend_student(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    get_users_collection().update_one(
        {"_id": u["_id"]},
        {
            "$set": {"accountStatus": "active", "updatedAt": datetime.utcnow()},
            "$unset": {"suspendedAt": "", "suspendedBy": "", "suspendReason": ""},
        },
    )
    _log_admin(
        "student.unsuspend",
        "student",
        student_id,
        old_value={"accountStatus": u.get("accountStatus") or "suspended"},
        new_value={"accountStatus": "active"},
    )
    return jsonify({"ok": True, "message": "Student reactivated"})


@admin_students_bp.route("/students/<student_id>", methods=["DELETE"])
@jwt_required()
def delete_student(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    data = request.get_json(silent=True) or {}
    confirm = (data.get("confirmEmail") or "").strip().lower()
    email = (u.get("email") or "").strip().lower()
    if not confirm or confirm != email:
        return jsonify({"error": "confirmEmail must match the student email"}), 400
    from app.routes.admin import _admin_actor
    actor = _admin_actor()
    now = datetime.utcnow()
    get_users_collection().update_one(
        {"_id": u["_id"]},
        {"$set": {
            "accountStatus": "deleted",
            "deleted": True,
            "deletedAt": now,
            "deletedBy": actor.get("actor_email") or actor.get("actor_id") or "",
            "updatedAt": now,
        }},
    )
    _log_admin(
        "student.soft_delete",
        "student",
        student_id,
        old_value={"accountStatus": u.get("accountStatus") or "active", "email": email},
        new_value={"accountStatus": "deleted", "deleted": True},
    )
    return jsonify({"ok": True, "message": "Student soft-deleted"})


@admin_students_bp.route("/students/<student_id>/reset-password", methods=["POST"])
@jwt_required()
def reset_student_password(student_id):
    """
    Super Admin sets a new password directly (hashed with pbkdf2:sha256).
    Optional notify email (does not include password). Force change on next login flag.
    Rate limit: 3 resets / student / admin / day.
    """
    try:
        err = _admin_required()
        if err:
            if isinstance(err, tuple) and len(err) >= 2 and err[1] == 403:
                return jsonify({"error": "Only Super Admin can reset a student's password."}), 403
            return err
        if get_db() is None:
            return jsonify({
                "error": "Something went wrong on our side. Please try again in a moment.",
            }), 503
        u, err_resp = _find_student(student_id)
        if err_resp:
            return err_resp

        data = request.get_json(silent=True) or {}
        new_pw = (data.get("password") or data.get("newPassword") or "").strip()
        confirm = (data.get("confirmPassword") or data.get("confirm") or "").strip()
        reason = (data.get("reason") or "").strip()[:500]
        notify = data.get("notifyStudent", True)
        if notify is None:
            notify = True
        force_change = data.get("forceChangeOnLogin", True)
        if force_change is None:
            force_change = True

        # Backward compat: no body → old email-link flow
        if not new_pw and not data:
            return _reset_password_email_link(u, student_id)

        if not new_pw or not confirm:
            return jsonify({
                "error": "New password and Confirm password must be the same.",
            }), 400
        if new_pw != confirm:
            return jsonify({
                "error": "New password and Confirm password must be the same.",
            }), 400
        if len(new_pw) < 8 or not re.search(r"[A-Za-z]", new_pw) or not re.search(r"\d", new_pw):
            return jsonify({
                "error": "Password must be at least 8 characters and include a letter and a number.",
            }), 400

        actor = _admin_actor()
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        try:
            recent = get_activity_logs_collection().count_documents({
                "action": "student.set_password",
                "entityId": student_id,
                "actorEmail": actor.get("actor_email") or "",
                "createdAt": {"$gte": day_start},
            })
            if recent >= 3:
                return jsonify({
                    "error": "You have already reset this student's password 3 times today. Please try again tomorrow.",
                }), 429
        except Exception:
            current_app.logger.exception("password reset rate-limit check failed")

        from werkzeug.security import generate_password_hash
        from app.auth_session import new_session_epoch

        pw_hash = generate_password_hash(new_pw, method="pbkdf2:sha256")
        get_users_collection().update_one(
            {"_id": u["_id"]},
            {"$set": {
                "password": pw_hash,
                "forcePasswordChange": bool(force_change),
                "passwordResetAt": datetime.utcnow(),
                "passwordResetBy": actor.get("actor_email") or "",
                "sessionEpoch": new_session_epoch(),
                "updatedAt": datetime.utcnow(),
            }},
        )
        email = (u.get("email") or "").strip().lower()
        emailed = False
        if notify and email and smtp_or_ses_configured(current_app.config):
            name = u.get("name") or u.get("fullName") or email.split("@")[0]
            html = (
                f"<p>Hi {name},</p>"
                f"<p>Your XpertIntern account password was reset by support. "
                f"Please log in and change your password from your account settings.</p>"
                f"<p>— Team XpertIntern</p>"
            )
            try:
                emailed = bool(send_email(
                    current_app.config,
                    email,
                    "Your XpertIntern password was reset by support",
                    html,
                    bcc=["support@xpertintern.com"],
                ))
            except Exception:
                current_app.logger.exception("password reset notify email failed")
                emailed = False
        _log_admin(
            "student.set_password",
            "student",
            student_id,
            new_value={
                "forceChangeOnLogin": bool(force_change),
                "notifyEmail": emailed,
                "reason": reason or None,
            },
            meta={"reason": reason or None},
        )
        return jsonify({
            "ok": True,
            "message": "Password updated successfully",
            "notifyEmailSent": emailed,
            "forceChangeOnLogin": bool(force_change),
        })
    except Exception:
        current_app.logger.exception("reset_student_password failed for %s", student_id)
        return jsonify({
            "error": "Something went wrong on our side. Please try again in a moment.",
        }), 500


def _reset_password_email_link(u: dict, student_id: str):
    email = (u.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Student has no email"}), 400
    cfg = current_app.config
    if not smtp_or_ses_configured(cfg):
        return jsonify({"error": "Email transport not configured"}), 503
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_password_reset_token(raw_token)
    expires_at = utcnow() + _PASSWORD_RESET_ADMIN_EXPIRY
    tok_col = get_password_reset_tokens_collection()
    tok_col.delete_many({"email": email, "used": {"$ne": True}})
    insert_res = tok_col.insert_one({
        "tokenHash": token_hash,
        "email": email,
        "expiresAt": expires_at,
        "used": False,
        "createdAt": datetime.utcnow(),
        "createdByAdmin": True,
    })
    base = public_app_url().rstrip("/")
    reset_url = f"{base}/reset-password?token={quote(raw_token, safe='')}"
    display_name = u.get("name") or u.get("fullName") or email.split("@", 1)[0]
    sent = send_password_reset_email(cfg, str(display_name), email, reset_url)
    if not sent:
        tok_col.delete_one({"_id": insert_res.inserted_id})
        return jsonify({"error": "Failed to send reset email"}), 503
    _log_admin(
        "student.reset_password",
        "student",
        student_id,
        new_value={"emailSent": True, "expiresInMinutes": 30},
    )
    return jsonify({"ok": True, "message": "Password reset link sent to student email"})


@admin_students_bp.route("/students/<student_id>/message", methods=["POST"])
@jwt_required()
def message_student(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp

    # JSON or multipart
    if request.content_type and "multipart/form-data" in (request.content_type or ""):
        subject = (request.form.get("subject") or "").strip()
        body = (request.form.get("body") or request.form.get("html") or "").strip()
        files = request.files.getlist("files") or request.files.getlist("attachments") or []
    else:
        data = request.get_json() or {}
        subject = (data.get("subject") or "").strip()
        body = (data.get("body") or data.get("html") or data.get("text") or "").strip()
        files = []
        raw_atts = data.get("attachments") if isinstance(data.get("attachments"), list) else []
        for a in raw_atts[:5]:
            if isinstance(a, dict) and a.get("contentBase64") and a.get("filename"):
                import base64
                try:
                    files.append({
                        "filename": str(a["filename"])[:200],
                        "data": base64.b64decode(a["contentBase64"]),
                        "mime": str(a.get("mime") or "application/octet-stream"),
                    })
                except Exception:
                    continue

    if not subject:
        return jsonify({"error": "subject is required"}), 400
    if not body:
        return jsonify({"error": "body is required"}), 400

    email = (u.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Student has no email"}), 400

    ALLOWED_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".zip"}
    attachments: list[tuple[str, bytes, str]] = []
    total_size = 0
    file_meta = []

    def _add_file(filename: str, raw: bytes, mime: str):
        nonlocal total_size
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXT:
            raise ValueError(f"File type not allowed: {ext or filename}")
        if len(raw) > 10 * 1024 * 1024:
            raise ValueError(f"{filename} exceeds 10 MB")
        if total_size + len(raw) > 25 * 1024 * 1024:
            raise ValueError("Total attachments exceed 25 MB")
        from app.attachment_scan import scan_attachment_bytes, AttachmentScanError
        try:
            scan_attachment_bytes(filename, raw)
        except AttachmentScanError as se:
            raise ValueError(str(se)) from se
        total_size += len(raw)
        attachments.append((filename, raw, mime or "application/octet-stream"))
        file_meta.append({"filename": filename, "size": len(raw), "mime": mime})

    try:
        for f in files:
            if isinstance(f, dict):
                _add_file(f["filename"], f["data"], f.get("mime") or "application/octet-stream")
            else:
                raw = f.read()
                name = secure_filename(f.filename or "file.bin") or "file.bin"
                mime = f.mimetype or "application/octet-stream"
                _add_file(name, raw, mime)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

    if len(attachments) > 5:
        return jsonify({"error": "Maximum 5 attachments"}), 400

    # Light sanitize: strip script tags
    html_body = re.sub(r"(?is)<script[^>]*>.*?</script>", "", body)
    text_body = re.sub(r"<[^>]+>", " ", html_body)
    text_body = re.sub(r"\s+", " ", text_body).strip()

    cfg = current_app.config
    sent = False
    send_error = ""
    if smtp_or_ses_configured(cfg):
        try:
            sent = bool(send_email(
                cfg,
                email,
                subject,
                html_body,
                text_body=text_body,
                attachments=attachments or None,
                bcc=["support@xpertintern.com"],
            ))
            if not sent:
                send_error = "Email provider returned failure"
        except Exception as ex:
            send_error = str(ex)[:300]
    else:
        send_error = "Email not configured"

    now = datetime.utcnow()
    status = "open" if sent else "send_failed"
    ticket_doc = {
        "userId": student_id,
        "ticketId": "TKT-" + uuid.uuid4().hex[:8].upper(),
        "subject": subject,
        "category": "Admin Message",
        "description": text_body[:5000],
        "status": status,
        "priority": "medium",
        "createdAt": now,
        "updatedAt": now,
        "origin": "admin_outbound",
        "direction": "outbound",
        "htmlBody": html_body[:50000],
        "attachments": file_meta,
        "messages": [{"from": "admin", "body": text_body[:20000], "html": html_body[:50000], "createdAt": now}],
    }
    result = get_support_tickets_collection().insert_one(ticket_doc)
    _log_admin(
        "student.message",
        "student",
        student_id,
        new_value={
            "subject": subject,
            "emailSent": sent,
            "ticketId": str(result.inserted_id),
            "attachmentCount": len(attachments),
            "status": status,
        },
    )
    if not sent:
        return jsonify({
            "ok": False,
            "error": send_error or "Ticket created but email failed",
            "ticketId": str(result.inserted_id),
            "canRetry": True,
        }), 502
    return jsonify({
        "ok": True,
        "message": f"Message sent to {email}",
        "ticketId": str(result.inserted_id),
        "email": email,
    })


@admin_students_bp.route("/students/<student_id>/verify-email", methods=["POST"])
@jwt_required()
def verify_student_email(student_id):
    err = _admin_required()
    if err:
        return err
    if get_db() is None:
        return jsonify({"error": "Database not configured"}), 503
    u, err_resp = _find_student(student_id)
    if err_resp:
        return err_resp
    old = bool(u.get("emailVerified") or u.get("isEmailVerified"))
    get_users_collection().update_one(
        {"_id": u["_id"]},
        {"$set": {
            "emailVerified": True,
            "isEmailVerified": True,
            "emailVerifiedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }},
    )
    _log_admin(
        "student.verify_email",
        "student",
        student_id,
        old_value={"emailVerified": old},
        new_value={"emailVerified": True},
    )
    return jsonify({"ok": True, "message": "Email marked as verified"})
