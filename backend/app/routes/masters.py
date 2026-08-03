"""Public masters for admin dropdowns (cached ~1 hour)."""
from __future__ import annotations

import time
from flask import Blueprint, jsonify, request

from app.masters_data import (
    INDIAN_STATES,
    academic_courses_payload,
    colleges_for_universities,
    streams_for_course,
    universities_payload,
    max_semester_for_course,
    label_type_for_course,
)
from app.registration_constants import BRANCHES_66, BRANCH_OTHERS_LABEL, OTHER_OPTION_VALUE

masters_bp = Blueprint("masters", __name__)

_cache: dict[str, tuple[float, object]] = {}
_TTL = 3600.0


def _cached(key: str, builder):
    now = time.time()
    hit = _cache.get(key)
    if hit and hit[0] + _TTL > now:
        return hit[1]
    val = builder()
    _cache[key] = (now, val)
    return val


@masters_bp.route("/universities", methods=["GET"])
def masters_universities():
    data = _cached("universities", universities_payload)
    return jsonify({"items": data, "cacheSeconds": int(_TTL)})


@masters_bp.route("/colleges", methods=["GET"])
def masters_colleges():
    raw = request.args.get("universityIds") or request.args.get("university_ids") or request.args.get("universities") or ""
    ids = [x.strip() for x in raw.split(",") if x.strip()]
    # Also accept university full names
    if not ids:
        uni = (request.args.get("university") or "").strip()
        if uni:
            ids = [uni]
    key = "colleges:" + ",".join(sorted(ids)) if ids else "colleges:all"
    items = _cached(key, lambda: colleges_for_universities(ids))
    return jsonify({"items": items, "cacheSeconds": int(_TTL)})


@masters_bp.route("/courses", methods=["GET"])
def masters_courses():
    return jsonify({"items": _cached("courses", academic_courses_payload), "cacheSeconds": int(_TTL)})


@masters_bp.route("/course-streams", methods=["GET"])
def masters_course_streams():
    course = (request.args.get("courseId") or request.args.get("course") or "").strip()
    items = streams_for_course(course) if course else [{"name": b, "labelType": "branch"} for b in BRANCHES_66]
    return jsonify({
        "items": items,
        "labelType": label_type_for_course(course) if course else "branch",
        "maxSemester": max_semester_for_course(course) if course else 8,
        "otherLabel": BRANCH_OTHERS_LABEL,
        "otherValue": OTHER_OPTION_VALUE,
        "cacheSeconds": int(_TTL),
    })


@masters_bp.route("/states", methods=["GET"])
def masters_states():
    return jsonify({"items": [{"name": s} for s in INDIAN_STATES], "cacheSeconds": int(_TTL)})


@masters_bp.route("/semesters", methods=["GET"])
def masters_semesters():
    course = (request.args.get("course") or "").strip()
    mx = max_semester_for_course(course) if course else 8
    # Match registration style labels
    labels = [f"{n}st" if n == 1 else f"{n}nd" if n == 2 else f"{n}rd" if n == 3 else f"{n}th" for n in range(1, mx + 1)]
    return jsonify({"items": labels, "maxSemester": mx})
