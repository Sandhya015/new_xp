"""Academic masters for admin/student dropdowns (same catalog as registration form)."""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.registration_constants import (
    BA_SUBJECTS,
    BBA_SUBJECTS,
    BCA_SUBJECTS,
    BRANCH_OTHERS_LABEL,
    BRANCHES_66,
    BSC_SUBJECTS,
    BCOM_SUBJECTS,
    OTHER_OPTION_VALUE,
    STUDENT_COURSES,
)

# Mirrors frontend/src/constants/registrationUniversities.ts (excluding __OTHER__).
UNIVERSITIES: list[dict[str, str]] = [
    {"shortCode": "BRABU", "fullName": "Babasaheb Bhimrao Ambedkar Bihar University (BRABU), Muzaffarpur", "state": "Bihar"},
    {"shortCode": "BNMU", "fullName": "Bhupendra Narayan Mandal University (BNMU), Madhepura", "state": "Bihar"},
    {"shortCode": "BEU", "fullName": "Bihar Engineering University (BEU), Patna", "state": "Bihar"},
    {"shortCode": "BTEUP", "fullName": "Board of Technical Education Uttar Pradesh (BTEUP), Lucknow", "state": "Uttar Pradesh"},
    {"shortCode": "AKTU", "fullName": "Dr. A. P. J. Abdul Kalam Technical University (AKTU), Lucknow", "state": "Uttar Pradesh"},
    {"shortCode": "JPU", "fullName": "Jai Prakash University (JPU), Chapra", "state": "Bihar"},
    {"shortCode": "JUT", "fullName": "Jharkhand University of Technology (JUT), Ranchi", "state": "Jharkhand"},
    {"shortCode": "LNMU", "fullName": "Lalit Narayan Mithila University (LNMU), Darbhanga", "state": "Bihar"},
    {"shortCode": "MU (Magadh)", "fullName": "Magadh University (MU), Bodh Gaya", "state": "Bihar"},
    {"shortCode": "MU (Munger)", "fullName": "Munger University (MU), Munger", "state": "Bihar"},
    {"shortCode": "NOU", "fullName": "Nalanda Open University (NOU), Nalanda", "state": "Bihar"},
    {"shortCode": "PPU", "fullName": "Patliputra University (PPU), Patna", "state": "Bihar"},
    {"shortCode": "PU (Patna)", "fullName": "Patna University (PU), Patna", "state": "Bihar"},
    {"shortCode": "PU (Purnea)", "fullName": "Purnea University (PU), Purnea", "state": "Bihar"},
    {"shortCode": "SBTE", "fullName": "State Board of Technical Education (SBTE), Bihar", "state": "Bihar"},
    {"shortCode": "TMBU", "fullName": "Tilka Manjhi Bhagalpur University (TMBU), Bhagalpur", "state": "Bihar"},
    {"shortCode": "VKSU", "fullName": "Veer Kunwar Singh University (VKSU), Ara", "state": "Bihar"},
]

INDIAN_STATES = [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
]


def max_semester_for_course(course: str) -> int:
    c = (course or "").strip()
    if c in ("Diploma",):
        return 6
    if c in ("B.Tech", "M.Tech"):
        return 8
    if c in ("B.Sc", "B.Com", "B.A.", "BBA", "BCA", "MBA", "MCA", "M.Sc", "MA", "M.Com"):
        return 6
    if c in ("PhD",):
        return 10
    return 8


def label_type_for_course(course: str) -> str:
    c = (course or "").strip()
    if c in ("B.Tech", "M.Tech", "Diploma", "BCA", "MCA"):
        return "branch"
    return "subject"


def streams_for_course(course: str) -> list[dict[str, str]]:
    c = (course or "").strip()
    items: tuple[str, ...] = ()
    if c in ("B.Tech", "Diploma", "M.Tech"):
        items = BRANCHES_66
    elif c == "B.Sc":
        items = BSC_SUBJECTS
    elif c == "B.Com":
        items = BCOM_SUBJECTS
    elif c == "B.A.":
        items = BA_SUBJECTS
    elif c == "BBA":
        items = BBA_SUBJECTS
    elif c == "BCA":
        items = BCA_SUBJECTS
    return [{"name": x, "labelType": label_type_for_course(c)} for x in items]


@lru_cache(maxsize=1)
def academic_courses_payload() -> list[dict[str, Any]]:
    out = []
    for name in STUDENT_COURSES:
        if name == OTHER_OPTION_VALUE:
            continue
        out.append({
            "name": name,
            "type": "Diploma" if name == "Diploma" else ("PG" if name.startswith("M") or name == "PhD" else "UG"),
            "maxSemester": max_semester_for_course(name),
            "labelType": label_type_for_course(name),
            "isActive": True,
        })
    return out


def universities_payload() -> list[dict[str, Any]]:
    return [
        {
            "id": u["shortCode"],
            "shortCode": u["shortCode"],
            "fullName": u["fullName"],
            "state": u.get("state") or "",
            "isActive": True,
            "label": f"{u['shortCode']} — {u['fullName']}",
        }
        for u in UNIVERSITIES
    ]


def colleges_for_universities(university_names: list[str]) -> list[dict[str, Any]]:
    """Discover college names from enrolled student profiles (and optional uni filter)."""
    import re

    from app.db import get_users_collection, get_db

    if get_db() is None:
        return []
    names = [n.strip() for n in university_names if n and n.strip()]
    q: dict[str, Any] = {"role": "student", "collegeName": {"$exists": True, "$nin": [None, ""]}}
    if names:
        ors = []
        for n in names:
            ors.append({"university": n})
            ors.append({"university": {"$regex": re.escape(n), "$options": "i"}})
        q["$or"] = ors
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for u in get_users_collection().find(q, {"collegeName": 1, "university": 1}).limit(5000):
        col = (u.get("collegeName") or "").strip()
        uni = (u.get("university") or "").strip()
        if not col or col in seen:
            continue
        seen.add(col)
        out.append({"name": col, "university": uni, "isActive": True})
    out.sort(key=lambda x: x["name"].lower())
    return out[:500]
