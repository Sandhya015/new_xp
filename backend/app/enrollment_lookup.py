"""Consistent lookup for student enrollments when courseId may be stored as str or BSON ObjectId."""

from __future__ import annotations

from bson import ObjectId


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
