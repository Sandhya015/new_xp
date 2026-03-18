"""
Internships: list (public), get by id, create (company), applications. DB wired.
"""
from bson import ObjectId
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.db import (
    get_db,
    get_internships_collection,
    get_applications_collection,
    get_users_collection,
)

internship_bp = Blueprint("internship", __name__)


def _internship_to_item(i, company_name=None):
    status = i.get("status")
    if status is None:
        status = "active" if i.get("active", True) else "closed"
    return {
        "id": str(i["_id"]),
        "title": i.get("title", ""),
        "companyId": i.get("companyId", ""),
        "companyName": company_name or i.get("companyName", ""),
        "domain": i.get("domain", ""),
        "duration": i.get("duration", ""),
        "type": i.get("type", "Remote"),
        "stipend": i.get("stipend", ""),
        "deadline": i.get("deadline", ""),
        "description": i.get("description", ""),
        "requirements": i.get("requirements", ""),
        "skills": i.get("skills", ""),
        "location": i.get("location", ""),
        "openings": i.get("openings", 1),
        "featured": i.get("featured", False),
        "active": i.get("active", True),
        "status": status,
        "createdAt": i.get("createdAt").strftime("%Y-%m-%d") if i.get("createdAt") else "",
    }


@internship_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def list_internships():
    """List internships. Public list when mine not set; company's own list when mine=1 (requires valid company JWT)."""
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    coll = get_internships_collection()
    users = get_users_collection()
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "").strip().lower()
    mine = request.args.get("mine", "").strip() in ("1", "true", "yes")
    if mine:
        claims = get_jwt()
        company_id = get_jwt_identity()
        if not company_id or claims.get("role") != "company":
            return jsonify({"error": "Company login required"}), 403
    else:
        company_id = None

    if mine and company_id:
        q = {"companyId": company_id}
        if status_filter and status_filter in ("draft", "active", "paused", "closed", "expired"):
            q["status"] = status_filter
        if search:
            q["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"domain": {"$regex": search, "$options": "i"}},
            ]
    else:
        q = {"active": True}
        if search:
            q["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"companyName": {"$regex": search, "$options": "i"}},
                {"domain": {"$regex": search, "$options": "i"}},
            ]

    cursor = coll.find(q).sort("createdAt", -1)
    items = []
    app_coll = get_applications_collection() if mine else None
    for i in cursor:
        cid = i.get("companyId")
        cname = i.get("companyName")
        if cid and not cname:
            u = users.find_one({"_id": ObjectId(cid)})
            cname = u.get("companyName") or u.get("name", "") if u else ""
        item = _internship_to_item(i, cname)
        if mine and app_coll:
            item["applicantsCount"] = app_coll.count_documents({"internshipId": str(i["_id"])})
        items.append(item)
    return jsonify({"items": items})


@internship_bp.route("/<internship_id>", methods=["GET"])
def get_internship(internship_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid id"}), 400
    coll = get_internships_collection()
    i = coll.find_one({"_id": ObjectId(internship_id)})
    if not i:
        return jsonify({"error": "Internship not found"}), 404
    is_owner = False
    try:
        uid = get_jwt_identity()
        claims = get_jwt()
        if uid and claims.get("role") == "company" and str(i.get("companyId")) == str(uid):
            is_owner = True
    except Exception:
        pass
    if not i.get("active") and not is_owner:
        return jsonify({"error": "Internship not found"}), 404
    cname = i.get("companyName")
    if i.get("companyId"):
        u = get_users_collection().find_one({"_id": ObjectId(i["companyId"])})
        if u:
            cname = u.get("companyName") or u.get("name", "")
    return jsonify(_internship_to_item(i, cname))


@internship_bp.route("", methods=["POST"])
@jwt_required()
def create_internship():
    claims = get_jwt()
    if claims.get("role") != "company":
        return jsonify({"error": "Company access required"}), 403
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    company_id = get_jwt_identity()
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    status = (data.get("status") or "active").strip().lower()
    if status not in ("draft", "active"):
        status = "active"
    doc = {
        "companyId": company_id,
        "title": title,
        "description": (data.get("description") or "").strip(),
        "requirements": (data.get("requirements") or "").strip(),
        "skills": (data.get("skills") or "").strip(),
        "domain": (data.get("domain") or "").strip(),
        "duration": (data.get("duration") or "").strip(),
        "type": (data.get("type") or "Remote").strip(),
        "stipend": (data.get("stipend") or "").strip(),
        "location": (data.get("location") or "").strip(),
        "openings": int(data.get("openings") or 1),
        "deadline": (data.get("deadline") or "").strip(),
        "featured": bool(data.get("featured")),
        "status": status,
        "active": status == "active",
        "createdAt": datetime.utcnow(),
    }
    u = get_users_collection().find_one({"_id": ObjectId(company_id)})
    if u:
        doc["companyName"] = u.get("companyName") or u.get("name", "")
    result = get_internships_collection().insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(_internship_to_item(doc)), 201


@internship_bp.route("/<internship_id>", methods=["PATCH"])
@jwt_required()
def update_internship(internship_id):
    """Company can update own listing (edit, pause, close)."""
    claims = get_jwt()
    if claims.get("role") != "company":
        return jsonify({"error": "Company access required"}), 403
    company_id = get_jwt_identity()
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    coll = get_internships_collection()
    i = coll.find_one({"_id": ObjectId(internship_id), "companyId": company_id})
    if not i:
        return jsonify({"error": "Internship not found"}), 404
    data = request.get_json() or {}
    updates = {}
    for key in ("title", "description", "requirements", "skills", "domain", "duration", "type", "stipend", "location", "deadline"):
        if key in data:
            if key == "openings":
                updates["openings"] = int(data.get("openings") or 1)
            else:
                updates[key] = data[key]
    if "openings" in data:
        updates["openings"] = int(data.get("openings") or 1)
    if "status" in data:
        s = str(data["status"]).strip().lower()
        if s in ("draft", "active", "paused", "closed"):
            updates["status"] = s
            updates["active"] = s == "active"
    if updates:
        coll.update_one({"_id": ObjectId(internship_id)}, {"$set": updates})
    i = coll.find_one({"_id": ObjectId(internship_id)})
    cname = i.get("companyName")
    if i.get("companyId"):
        u = get_users_collection().find_one({"_id": ObjectId(i["companyId"])})
        if u:
            cname = u.get("companyName") or u.get("name", "")
    return jsonify(_internship_to_item(i, cname))


@internship_bp.route("/<internship_id>/apply", methods=["POST"])
@jwt_required()
def apply(internship_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    if claims.get("role") != "student":
        return jsonify({"error": "Students only can apply"}), 403
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid internship id"}), 400
    coll = get_internships_collection()
    i = coll.find_one({"_id": ObjectId(internship_id), "active": True})
    if not i:
        return jsonify({"error": "Internship not found"}), 404
    app_coll = get_applications_collection()
    if app_coll.find_one({"studentId": user_id, "internshipId": internship_id}):
        return jsonify({"error": "Already applied"}), 409
    doc = {
        "studentId": user_id,
        "internshipId": internship_id,
        "status": "applied",
        "createdAt": datetime.utcnow(),
    }
    result = app_coll.insert_one(doc)
    return jsonify({"id": str(result.inserted_id), "message": "Application submitted"}), 201


def _application_to_item(a, student=None, internship=None):
    out = {
        "id": str(a["_id"]),
        "studentId": a.get("studentId"),
        "internshipId": a.get("internshipId"),
        "status": a.get("status", "applied"),
        "createdAt": a.get("createdAt").strftime("%Y-%m-%d") if a.get("createdAt") else "",
    }
    if student:
        out["studentName"] = student.get("name") or student.get("fullName") or ""
        out["studentEmail"] = student.get("email") or ""
        out["university"] = student.get("university") or ""
        out["course"] = student.get("course") or ""
        out["stream"] = student.get("stream") or ""
        out["collegeName"] = student.get("collegeName") or ""
    if internship:
        out["internshipTitle"] = internship.get("title") or ""
    return out


@internship_bp.route("/applications", methods=["GET"])
@jwt_required()
def list_applications():
    """Company: list applications for my internships (enriched); Student: list my applications."""
    user_id = get_jwt_identity()
    claims = get_jwt()
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    app_coll = get_applications_collection()
    internships_coll = get_internships_collection()
    users_coll = get_users_collection()
    status_filter = request.args.get("status", "").strip().lower()
    internship_filter = request.args.get("internshipId", "").strip()
    search = request.args.get("search", "").strip()

    if claims.get("role") == "company":
        my_ids = [str(x["_id"]) for x in internships_coll.find({"companyId": user_id})]
        q = {"internshipId": {"$in": my_ids}}
        if status_filter:
            if status_filter == "under_review":
                q["status"] = {"$in": ["applied", "under_review"]}
            elif status_filter in ("applied", "shortlisted", "interview_scheduled", "selected", "rejected", "not_selected"):
                q["status"] = status_filter
        if internship_filter:
            q["internshipId"] = internship_filter
        cursor = app_coll.find(q).sort("createdAt", -1)
        items = []
        for a in cursor:
            student = None
            if a.get("studentId"):
                try:
                    student = users_coll.find_one({"_id": ObjectId(a["studentId"])})
                except Exception:
                    student = users_coll.find_one({"email": a.get("studentId")})
            internship = None
            if a.get("internshipId"):
                try:
                    internship = internships_coll.find_one({"_id": ObjectId(a["internshipId"])})
                except Exception:
                    internship = internships_coll.find_one({"title": a.get("internshipId")})
            item = _application_to_item(a, student, internship)
            if search:
                search_lower = search.lower()
                if search_lower not in (item.get("studentName") or "").lower() and search_lower not in (item.get("studentEmail") or "").lower() and search_lower not in (item.get("university") or "").lower():
                    continue
            items.append(item)
        return jsonify({"items": items})
    else:
        cursor = app_coll.find({"studentId": user_id}).sort("createdAt", -1)
        items = []
        for a in cursor:
            internship = None
            if a.get("internshipId"):
                try:
                    internship = internships_coll.find_one({"_id": ObjectId(a["internshipId"])})
                except Exception:
                    pass
            items.append(_application_to_item(a, None, internship))
        return jsonify({"items": items})


@internship_bp.route("/applications/<application_id>", methods=["PATCH"])
@jwt_required()
def update_application(application_id):
    """Company can update application status: shortlisted, interview_scheduled, selected, rejected."""
    claims = get_jwt()
    if claims.get("role") != "company":
        return jsonify({"error": "Company access required"}), 403
    company_id = get_jwt_identity()
    if not ObjectId.is_valid(application_id):
        return jsonify({"error": "Invalid application id"}), 400
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    app_coll = get_applications_collection()
    internships_coll = get_internships_collection()
    my_ids = [str(x["_id"]) for x in internships_coll.find({"companyId": company_id})]
    a = app_coll.find_one({"_id": ObjectId(application_id), "internshipId": {"$in": my_ids}})
    if not a:
        return jsonify({"error": "Application not found"}), 404
    data = request.get_json() or {}
    new_status = (data.get("status") or "").strip().lower()
    allowed = ("under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "not_selected")
    updates = {"updatedAt": datetime.utcnow()}
    if new_status in allowed:
        updates["status"] = new_status
    interview = data.get("interview")
    if isinstance(interview, dict):
        updates["interview"] = interview
        if new_status != "interview_scheduled":
            updates["status"] = "interview_scheduled"
    if len(updates) > 1:
        app_coll.update_one({"_id": ObjectId(application_id)}, {"$set": updates})
    a = app_coll.find_one({"_id": ObjectId(application_id)})
    student = None
    if a.get("studentId"):
        try:
            student = get_users_collection().find_one({"_id": ObjectId(a["studentId"])})
        except Exception:
            pass
    internship = None
    if a.get("internshipId"):
        try:
            internship = internships_coll.find_one({"_id": ObjectId(a["internshipId"])})
        except Exception:
            pass
    return jsonify(_application_to_item(a, student, internship))
