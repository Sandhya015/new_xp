"""Consistent lookup for student enrollments when courseId may be stored as str or BSON ObjectId."""

from __future__ import annotations

from bson import ObjectId


def course_id_enrollment_filter(course_id: str) -> dict:
    """
    Match enrollments for a course when courseId is stored as a hex string or legacy BSON ObjectId.
    """
    cid = (course_id or "").strip()
    if not cid:
        return {"courseId": "__invalid__"}
    clauses: list[dict] = [{"courseId": cid}]
    if ObjectId.is_valid(cid):
        clauses.append({"courseId": ObjectId(cid)})
    return {"$or": clauses}


def user_course_enrollment_filter(user_id: str, course_id: str) -> dict:
    """
    Build a find_one / find filter for { userId, courseId }.
    Legacy rows may use ObjectId for courseId; newer rows use the same hex string as the API.
    """
    course_id = (course_id or "").strip()
    clauses: list[dict] = [{"courseId": course_id}]
    if course_id and ObjectId.is_valid(course_id):
        clauses.append({"courseId": ObjectId(course_id)})
    return {"userId": user_id, "$or": clauses}
