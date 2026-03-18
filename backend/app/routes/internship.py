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
        "createdAt": i.get("createdAt").strftime("%Y-%m-%d") if i.get("createdAt") else "",
    }


@internship_bp.route("", methods=["GET"])
def list_internships():
    db = get_db()
    if db is None:
        return jsonify({"items": [], "message": "Database not configured"}), 503
    coll = get_internships_collection()
    users = get_users_collection()
    search = request.args.get("search", "").strip()
    q = {"active": True}
    if search:
        q["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"companyName": {"$regex": search, "$options": "i"}},
            {"domain": {"$regex": search, "$options": "i"}},
        ]
    cursor = coll.find(q).sort("createdAt", -1)
    items = []
    for i in cursor:
        cid = i.get("companyId")
        cname = i.get("companyName")
        if cid and not cname:
            u = users.find_one({"_id": ObjectId(cid)})
            cname = u.get("companyName") or u.get("name", "") if u else ""
        items.append(_internship_to_item(i, cname))
    return jsonify({"items": items})


@internship_bp.route("/<internship_id>", methods=["GET"])
def get_internship(internship_id):
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    if not ObjectId.is_valid(internship_id):
        return jsonify({"error": "Invalid id"}), 400
    coll = get_internships_collection()
    i = coll.find_one({"_id": ObjectId(internship_id), "active": True})
    if not i:
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
        "active": True,
        "createdAt": datetime.utcnow(),
    }
    u = get_users_collection().find_one({"_id": ObjectId(company_id)})
    if u:
        doc["companyName"] = u.get("companyName") or u.get("name", "")
    result = get_internships_collection().insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(_internship_to_item(doc)), 201


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


@internship_bp.route("/applications", methods=["GET"])
@jwt_required()
def list_applications():
    """Company: list applications for my internships; Student: list my applications."""
    user_id = get_jwt_identity()
    claims = get_jwt()
    db = get_db()
    if db is None:
        return jsonify({"items": []}), 503
    app_coll = get_applications_collection()
    if claims.get("role") == "company":
        my_ids = [str(x["_id"]) for x in get_internships_collection().find({"companyId": user_id})]
        cursor = app_coll.find({"internshipId": {"$in": my_ids}}).sort("createdAt", -1)
    else:
        cursor = app_coll.find({"studentId": user_id}).sort("createdAt", -1)
    items = []
    for a in cursor:
        items.append({
            "id": str(a["_id"]),
            "studentId": a.get("studentId"),
            "internshipId": a.get("internshipId"),
            "status": a.get("status", "applied"),
            "createdAt": a.get("createdAt").strftime("%Y-%m-%d") if a.get("createdAt") else "",
        })
    return jsonify({"items": items})
