"""
Company dashboard: stats, recent activity. Company JWT required.
"""
from bson import ObjectId
from datetime import datetime, timedelta
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.db import (
    get_db,
    get_users_collection,
    get_internships_collection,
    get_applications_collection,
)

company_bp = Blueprint("company", __name__)


@company_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    """Company dashboard: stats (listings by status, applicants, shortlisted, selected, closed), recent activity."""
    claims = get_jwt()
    if claims.get("role") != "company":
        return jsonify({"error": "Company access required"}), 403
    company_id = get_jwt_identity()
    db = get_db()
    if db is None:
        return jsonify({"error": "Database not configured"}), 503

    users = get_users_collection()
    internships = get_internships_collection()
    applications = get_applications_collection()

    company = users.find_one({"_id": ObjectId(company_id)})
    company_name = (company.get("companyName") or company.get("name") or "") if company else ""
    account_status = company.get("status", "active") if company else "active"
    profile_complete = 100

    my_internship_ids = [str(x["_id"]) for x in internships.find({"companyId": company_id})]
    total_listings = len(my_internship_ids)
    by_status = {"draft": 0, "active": 0, "paused": 0, "closed": 0, "expired": 0}
    for i in internships.find({"companyId": company_id}):
        s = i.get("status")
        if not s:
            s = "active" if i.get("active", True) else "closed"
        by_status[s] = by_status.get(s, 0) + 1

    apps = list(applications.find({"internshipId": {"$in": my_internship_ids}}))
    total_applicants = len(apps)
    shortlisted = sum(1 for a in apps if (a.get("status") or "applied") == "shortlisted")
    selected = sum(1 for a in apps if (a.get("status") or "").lower() in ("selected", "offer_sent", "offer_accepted", "internship_ongoing", "internship_completed"))
    not_selected = sum(1 for a in apps if (a.get("status") or "").lower() in ("rejected", "not_selected"))

    recent_activity = []
    app_list = list(applications.find({"internshipId": {"$in": my_internship_ids}}).sort("createdAt", -1).limit(10))
    for a in app_list:
        created = a.get("createdAt")
        if created:
            ts = created.strftime("%Y-%m-%dT%H:%M:%S") if hasattr(created, "strftime") else str(created)
            recent_activity.append({
                "type": "application",
                "text": "New application received",
                "applicationId": str(a["_id"]),
                "internshipId": a.get("internshipId"),
                "createdAt": ts,
            })
    for i in internships.find({"companyId": company_id}).sort("createdAt", -1).limit(5):
        created = i.get("createdAt")
        if created:
            ts = created.strftime("%Y-%m-%dT%H:%M:%S") if hasattr(created, "strftime") else str(created)
            recent_activity.append({
                "type": "listing",
                "text": f'Internship "{i.get("title", "")}" published',
                "internshipId": str(i["_id"]),
                "createdAt": ts,
            })
    recent_activity.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    recent_activity = recent_activity[:10]

    return jsonify({
        "companyName": company_name,
        "accountStatus": account_status,
        "profileComplete": profile_complete,
        "stats": {
            "totalListings": total_listings,
            "activeListings": by_status.get("active", 0),
            "draftListings": by_status.get("draft", 0),
            "pausedListings": by_status.get("paused", 0),
            "closedListings": by_status.get("closed", 0) + by_status.get("expired", 0),
            "totalApplicants": total_applicants,
            "shortlisted": shortlisted,
            "selected": selected,
            "notSelected": not_selected,
        },
        "recentActivity": recent_activity,
    })
