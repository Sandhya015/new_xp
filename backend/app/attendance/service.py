"""Unified attendance: config, daily IN/OUT, class sessions, percent calc."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from bson import ObjectId

from app.db import (
    get_attendance_config_collection,
    get_attendance_records_collection,
    get_enrollments_collection,
    get_users_collection,
)
from app.document_storage import save_attendance_photo
from app.services.enrollment_excel import merged_student_fields_for_admin


def _now() -> datetime:
    return datetime.utcnow()


def _parse_date(val: Any) -> date | None:
    if not val:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def _hours_between(t_in: str, t_out: str) -> float:
    try:
        a = datetime.strptime(t_in.strip(), "%H:%M")
        b = datetime.strptime(t_out.strip(), "%H:%M")
        diff = (b - a).total_seconds() / 3600.0
        return max(0.0, round(diff, 2))
    except ValueError:
        return 0.0


def get_config(course_id: str, *, session: str = "", semester: str = "") -> dict[str, Any] | None:
    filt: dict[str, Any] = {"courseId": course_id}
    if session:
        filt["session"] = session
    if semester:
        filt["semester"] = semester
    doc = get_attendance_config_collection().find_one(filt)
    if not doc and (session or semester):
        doc = get_attendance_config_collection().find_one({"courseId": course_id})
    return _serialize_config(doc) if doc else None


def _serialize_config(doc: dict) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "courseId": doc.get("courseId"),
        "session": doc.get("session") or "",
        "semester": doc.get("semester") or "",
        "durationUnit": doc.get("durationUnit") or "hours",
        "totalHours": doc.get("totalHours") or 0,
        "dailyHours": doc.get("dailyHours") or 4,
        "durationWeeks": doc.get("durationWeeks") or 0,
        "universityDateRanges": doc.get("universityDateRanges") or [],
        "updatedAt": doc.get("updatedAt").isoformat() if doc.get("updatedAt") else None,
    }


def upsert_config(course_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    payload = {
        "courseId": course_id,
        "session": (data.get("session") or "").strip(),
        "semester": (data.get("semester") or "").strip(),
        "durationUnit": data.get("durationUnit") or "hours",
        "totalHours": float(data.get("totalHours") or 0),
        "dailyHours": float(data.get("dailyHours") or 4),
        "durationWeeks": int(data.get("durationWeeks") or 0),
        "universityDateRanges": data.get("universityDateRanges") or [],
        "updatedAt": now,
    }
    coll = get_attendance_config_collection()
    existing = coll.find_one({"courseId": course_id})
    if existing:
        coll.update_one({"_id": existing["_id"]}, {"$set": payload})
        doc = coll.find_one({"_id": existing["_id"]})
    else:
        payload["createdAt"] = now
        ins = coll.insert_one(payload)
        doc = coll.find_one({"_id": ins.inserted_id})
    return _serialize_config(doc)


def _required_hours(config: dict | None) -> float:
    if not config:
        return 0.0
    if (config.get("durationUnit") or "hours") == "weeks":
        weeks = float(config.get("durationWeeks") or 0)
        daily = float(config.get("dailyHours") or 4)
        return weeks * 5 * daily
    return float(config.get("totalHours") or 0)


def _completed_hours_for_user(course_id: str, user_id: str) -> float:
    coll = get_attendance_records_collection()
    rows = list(coll.find({"courseId": course_id, "userId": user_id}))
    total = 0.0
    for r in rows:
        h = r.get("hoursCompleted")
        if h is not None:
            total += float(h)
            continue
        if r.get("recordType") == "class_session" and r.get("status") in ("present", "late"):
            cfg = get_attendance_config_collection().find_one({"courseId": course_id})
            total += float((cfg or {}).get("dailyHours") or 4)
        elif r.get("timeIn") and r.get("timeOut"):
            total += _hours_between(str(r["timeIn"]), str(r["timeOut"]))
    return round(total, 2)


def attendance_percent_for_user(course_id: str, user_id: str) -> int | None:
    cfg_doc = get_attendance_config_collection().find_one({"courseId": course_id})
    required = _required_hours(cfg_doc)
    if required <= 0:
        return None
    completed = _completed_hours_for_user(course_id, user_id)
    return min(100, round(100.0 * completed / required))


def _university_valid_today(university: str, config: dict | None) -> bool:
    if not config:
        return True
    ranges = config.get("universityDateRanges") or []
    if not ranges:
        return True
    today = date.today()
    uni = (university or "").strip().lower()
    matched = False
    for r in ranges:
        if not isinstance(r, dict):
            continue
        u = (r.get("university") or "").strip().lower()
        if u and uni and u not in uni and uni not in u:
            continue
        matched = True
        vf = _parse_date(r.get("validFrom"))
        vt = _parse_date(r.get("validTo"))
        if vf and today < vf:
            return False
        if vt and today > vt:
            return False
        return True
    return not matched


def sync_class_session_records(
    *,
    course_id: str,
    session_key: str,
    session_date: date | None,
    records: list[dict],
    enrollment_batch_map: dict[str, str] | None = None,
) -> None:
    """Dual-write class session attendance into attendance_records."""
    coll = get_attendance_records_collection()
    coll.delete_many({"courseId": course_id, "sessionKey": session_key, "recordType": "class_session"})
    cfg = get_attendance_config_collection().find_one({"courseId": course_id})
    daily_h = float((cfg or {}).get("dailyHours") or 4)
    now = _now()
    for r in records:
        uid = str(r.get("userId") or "").strip()
        if not uid:
            continue
        status = (r.get("status") or "absent").strip().lower()
        hours = daily_h if status in ("present", "late") else 0.0
        coll.insert_one(
            {
                "courseId": course_id,
                "userId": uid,
                "enrollmentId": "",
                "batch": (enrollment_batch_map or {}).get(uid) or "",
                "recordType": "class_session",
                "sessionKey": session_key,
                "sessionDate": session_date.isoformat() if session_date else "",
                "timeIn": "",
                "timeOut": "",
                "hoursCompleted": hours,
                "status": status,
                "markedBy": "admin",
                "createdAt": now,
            }
        )


def list_students_with_percent(course_id: str) -> list[dict[str, Any]]:
    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    out: list[dict[str, Any]] = []
    for e in enroll_coll.find({"courseId": course_id, "status": {"$ne": "cancelled"}}):
        uid = str(e.get("userId") or "")
        if not uid:
            continue
        u = users_coll.find_one({"_id": ObjectId(uid)}) if ObjectId.is_valid(uid) else None
        m = merged_student_fields_for_admin(e, u)
        pct = attendance_percent_for_user(course_id, uid)
        out.append(
            {
                "userId": uid,
                "enrollmentId": str(e.get("_id")),
                "name": m.get("name") or "",
                "email": m.get("email") or "",
                "university": m.get("university") or "",
                "collegeName": m.get("collegeName") or "",
                "batch": e.get("batch") or "",
                "attendancePercent": pct,
            }
        )
    out.sort(key=lambda x: (x.get("name") or "").lower())
    return out


def attendance_history_for_user(course_id: str, user_id: str) -> list[dict[str, Any]]:
    rows = list(
        get_attendance_records_collection()
        .find({"courseId": course_id, "userId": user_id})
        .sort([("sessionDate", 1), ("createdAt", 1)])
    )
    out: list[dict[str, Any]] = []
    for r in rows:
        if r.get("recordType") == "class_session" and r.get("status") not in ("present", "late", "partial"):
            continue
        out.append(
            {
                "date": r.get("sessionDate") or "",
                "sessionDate": r.get("sessionDate") or "",
                "timeIn": r.get("timeIn") or "",
                "timeOut": r.get("timeOut") or "",
                "hoursCompleted": r.get("hoursCompleted"),
                "hours": r.get("hoursCompleted"),
                "status": r.get("status"),
                "recordType": r.get("recordType"),
            }
        )
    return out


def student_daily_history(course_id: str, user_id: str) -> dict[str, Any]:
    cfg = get_config(course_id)
    history = attendance_history_for_user(course_id, user_id)
    pct = attendance_percent_for_user(course_id, user_id)
    today = date.today().isoformat()
    today_rec = get_attendance_records_collection().find_one(
        {"courseId": course_id, "userId": user_id, "recordType": "daily_in_out", "sessionKey": today}
    )
    return {
        "config": cfg,
        "percent": pct,
        "completedHours": _completed_hours_for_user(course_id, user_id),
        "requiredHours": _required_hours(get_attendance_config_collection().find_one({"courseId": course_id})),
        "today": {
            "date": today,
            "timeIn": today_rec.get("timeIn") if today_rec else None,
            "timeOut": today_rec.get("timeOut") if today_rec else None,
            "status": today_rec.get("status") if today_rec else None,
        },
        "history": history,
    }


def mark_in(
    *,
    course_id: str,
    user_id: str,
    enrollment_id: str,
    photo_bytes: bytes,
    latitude: float | None,
    longitude: float | None,
    location_label: str = "",
) -> dict[str, Any]:
    cfg_doc = get_attendance_config_collection().find_one({"courseId": course_id})
    cfg = _serialize_config(cfg_doc) if cfg_doc else None
    e = get_enrollments_collection().find_one({"_id": ObjectId(enrollment_id)}) if ObjectId.is_valid(enrollment_id) else None
    u = get_users_collection().find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
    merged = merged_student_fields_for_admin(e, u) if e else {}
    if not _university_valid_today(merged.get("university") or "", cfg_doc):
        return {"ok": False, "error": "Attendance marking is not allowed outside your university valid dates"}
    today = date.today().isoformat()
    coll = get_attendance_records_collection()
    existing = coll.find_one({"courseId": course_id, "userId": user_id, "recordType": "daily_in_out", "sessionKey": today})
    if existing and existing.get("timeIn"):
        return {"ok": False, "error": "Already marked IN for today"}
    photo_key = save_attendance_photo(photo_bytes)
    now = _now()
    time_in = now.strftime("%H:%M")
    doc = {
        "courseId": course_id,
        "userId": user_id,
        "enrollmentId": enrollment_id,
        "batch": (e or {}).get("batch") or "",
        "recordType": "daily_in_out",
        "sessionKey": today,
        "sessionDate": today,
        "timeIn": time_in,
        "timeOut": "",
        "hoursCompleted": 0.0,
        "status": "partial",
        "photoKey": photo_key,
        "latitude": latitude,
        "longitude": longitude,
        "locationLabel": location_label,
        "markedBy": "student",
        "markedByUserId": user_id,
        "createdAt": now,
    }
    if existing:
        coll.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        coll.insert_one(doc)
    return {"ok": True, "timeIn": time_in}


def mark_out(*, course_id: str, user_id: str) -> dict[str, Any]:
    today = date.today().isoformat()
    coll = get_attendance_records_collection()
    rec = coll.find_one({"courseId": course_id, "userId": user_id, "recordType": "daily_in_out", "sessionKey": today})
    if not rec or not rec.get("timeIn"):
        return {"ok": False, "error": "Mark IN first before marking OUT"}
    if rec.get("timeOut"):
        return {"ok": False, "error": "Already marked OUT for today"}
    now = _now()
    time_out = now.strftime("%H:%M")
    hours = _hours_between(str(rec["timeIn"]), time_out)
    cfg = get_attendance_config_collection().find_one({"courseId": course_id})
    daily = float((cfg or {}).get("dailyHours") or 4)
    status = "present" if hours >= daily * 0.5 else "partial"
    coll.update_one(
        {"_id": rec["_id"]},
        {"$set": {"timeOut": time_out, "hoursCompleted": hours, "status": status, "updatedAt": now}},
    )
    return {"ok": True, "timeOut": time_out, "hoursCompleted": hours, "status": status}


def admin_bulk_mark(
    *,
    course_id: str,
    user_ids: list[str],
    date_from: str,
    date_to: str,
    status: str,
    actor_id: str,
) -> dict[str, Any]:
    d0 = _parse_date(date_from)
    d1 = _parse_date(date_to)
    if not d0 or not d1 or d1 < d0:
        return {"ok": False, "error": "Invalid date range"}
    cfg = get_attendance_config_collection().find_one({"courseId": course_id})
    daily = float((cfg or {}).get("dailyHours") or 4)
    hours = daily if status in ("present", "late") else 0.0
    coll = get_attendance_records_collection()
    now = _now()
    created = 0
    cur = d0
    while cur <= d1:
        sk = cur.isoformat()
        for uid in user_ids:
            uid = str(uid).strip()
            if not uid:
                continue
            coll.update_one(
                {"courseId": course_id, "userId": uid, "recordType": "daily_in_out", "sessionKey": sk},
                {
                    "$set": {
                        "sessionDate": sk,
                        "timeIn": "09:00" if status in ("present", "late", "partial") else "",
                        "timeOut": "17:00" if status in ("present", "late", "partial") else "",
                        "hoursCompleted": hours,
                        "status": status,
                        "markedBy": "admin",
                        "markedByUserId": actor_id,
                        "updatedAt": now,
                    },
                    "$setOnInsert": {"courseId": course_id, "userId": uid, "recordType": "daily_in_out", "sessionKey": sk, "createdAt": now},
                },
                upsert=True,
            )
            created += 1
        cur += timedelta(days=1)
    return {"ok": True, "marked": created}
