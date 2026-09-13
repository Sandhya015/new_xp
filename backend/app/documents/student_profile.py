"""Merge user + enrollment profile for document generation."""
from __future__ import annotations

from typing import Any

from bson import ObjectId

from app.db import get_courses_collection, get_enrollments_collection, get_users_collection
from app.services.enrollment_excel import merged_student_fields_for_admin


def get_enrolled_students_for_course(
    course_id: str,
    *,
    university: str | None = None,
    college: str | None = None,
    q: str | None = None,
) -> list[dict[str, Any]]:
    if not ObjectId.is_valid(course_id):
        return []
    enrs = list(get_enrollments_collection().find({"courseId": course_id, "status": {"$ne": "cancelled"}}))
    user_ids = [ObjectId(e["userId"]) for e in enrs if e.get("userId") and ObjectId.is_valid(str(e["userId"]))]
    users = {str(u["_id"]): u for u in get_users_collection().find({"_id": {"$in": user_ids}})}
    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) or {}
    domain = (course.get("title") or "").strip()
    out: list[dict[str, Any]] = []
    for e in enrs:
        uid = str(e.get("userId") or "")
        u = users.get(uid)
        if not u:
            continue
        merged = merged_student_fields_for_admin(e, u)
        if university and university.lower() not in (merged.get("university") or "").lower():
            continue
        if college and college.lower() not in (merged.get("collegeName") or "").lower():
            continue
        if q:
            ql = q.lower()
            hay = " ".join(
                [
                    merged.get("name") or "",
                    merged.get("email") or "",
                    merged.get("mobile") or "",
                    merged.get("registrationNo") or "",
                ]
            ).lower()
            if ql not in hay:
                continue
        out.append(
            {
                "userId": uid,
                "enrollmentId": str(e.get("_id")),
                "batch": e.get("batch") or "",
                "mode": e.get("mode") or "",
                "profile": {
                    **merged,
                    "session": merged.get("session") or "",
                    "domain": domain,
                    "programName": domain,
                },
            }
        )
    out.sort(key=lambda x: (x["profile"].get("name") or "").lower())
    return out


def profile_for_enrollment(user_id: str, course_id: str) -> dict[str, Any] | None:
    if not ObjectId.is_valid(user_id) or not ObjectId.is_valid(course_id):
        return None
    e = get_enrollments_collection().find_one({"userId": user_id, "courseId": course_id})
    if not e:
        return None
    u = get_users_collection().find_one({"_id": ObjectId(user_id)})
    course = get_courses_collection().find_one({"_id": ObjectId(course_id)}, {"title": 1}) or {}
    merged = merged_student_fields_for_admin(e, u)
    merged["domain"] = (course.get("title") or "").strip()
    merged["programName"] = merged["domain"]
    merged["session"] = merged.get("session") or ""
    return {
        "userId": user_id,
        "enrollmentId": str(e["_id"]),
        "batch": e.get("batch") or "",
        "profile": merged,
    }
