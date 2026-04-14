"""Validate and normalize student registration payloads (client spec v2.1)."""
from __future__ import annotations

import re
from typing import Any

from app.registration_constants import (
    BA_SUBJECTS,
    BBA_SUBJECTS,
    BCA_SUBJECTS,
    BCOM_SUBJECTS,
    BRANCHES_66,
    BRANCH_OTHERS_LABEL,
    BSC_SUBJECTS,
    OTHER_OPTION_VALUE,
    STUDENT_COURSES,
)


def _is_full_name_allowed(name: str) -> bool:
    """Letters (Unicode-aware), spaces, period, apostrophe, hyphen — min 3 chars checked separately."""
    for ch in name:
        if ch.isspace() or ch in ".'-":
            continue
        if not ch.isalpha():
            return False
    return True


def _norm_str(v: Any) -> str:
    return (v or "").strip() if v is not None else ""


def normalize_mobile(raw: str) -> tuple[str | None, str | None]:
    """
    Accept +91 prefix and spaces; require exactly 10 digits.
    Returns (digits10, error_message) — digits10 is None if invalid.
    """
    s = _norm_str(raw).replace(" ", "").replace("-", "")
    if s.startswith("+91"):
        s = s[3:]
    elif s.startswith("91") and len(s) == 12:
        s = s[2:]
    if not s.isdigit() or len(s) != 10:
        return None, "Please enter a valid 10-digit mobile number."
    return s, None


def validate_student_registration(data: dict) -> tuple[dict[str, str], dict[str, Any] | None]:
    """
    Returns (field_errors, normalized_doc) — if field_errors non-empty, normalized_doc is None.
    normalized_doc keys match Mongo user insert (camelCase extras for stream display).
    """
    errors: dict[str, str] = {}

    full_name = _norm_str(data.get("fullName") or data.get("name"))
    if len(full_name) < 3 or not _is_full_name_allowed(full_name):
        errors["fullName"] = "Please enter your full name (minimum 3 characters)."

    email = _norm_str(data.get("email")).lower()
    if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        errors["email"] = "Please enter a valid email address."

    mobile_digits, mobile_err = normalize_mobile(data.get("mobile") or "")
    if mobile_err:
        errors["mobile"] = mobile_err

    university_sel = _norm_str(data.get("university"))
    university_other = _norm_str(data.get("universityOther"))
    if not university_sel:
        errors["university"] = "Please select your university."
    elif university_sel == OTHER_OPTION_VALUE:
        if len(university_other) < 5:
            errors["universityOther"] = "Please enter your university name."
    else:
        university_other = ""

    college_name = _norm_str(data.get("collegeName"))
    if not college_name:
        errors["collegeName"] = "College name is required."

    semester = _norm_str(data.get("semester"))
    if not semester:
        errors["semester"] = "Semester is required."

    college_reg = _norm_str(data.get("collegeRegNo"))
    if not college_reg:
        errors["collegeRegNo"] = "College registration number is required."

    course = _norm_str(data.get("course"))
    if not course:
        errors["course"] = "Please select your course."

    branch = _norm_str(data.get("branch"))
    branch_other = _norm_str(data.get("branchOther"))
    subject = _norm_str(data.get("subject"))
    subject_other = _norm_str(data.get("subjectOther"))
    course_other = _norm_str(data.get("courseOther"))

    stream_display = ""
    branch_final = None
    subject_final = None

    if course and course not in STUDENT_COURSES and course != OTHER_OPTION_VALUE:
        errors["course"] = "Please select your course."

    if course == OTHER_OPTION_VALUE:
        if len(course_other) < 5:
            errors["courseOther"] = "Please specify your course name."
        stream_display = course_other
    elif course in ("B.Tech", "Diploma"):
        if not branch:
            errors["branch"] = "Please select your branch."
        elif branch not in BRANCHES_66:
            errors["branch"] = "Please select your branch."
        elif branch == BRANCH_OTHERS_LABEL:
            if len(branch_other) < 3:
                errors["branchOther"] = "Please specify your branch name."
            else:
                stream_display = branch_other
                branch_final = branch
        else:
            stream_display = branch
            branch_final = branch
    elif course in ("B.Sc", "B.Com", "B.A.", "BBA", "BCA"):
        if not subject:
            errors["subject"] = "Please select your subject or specialisation."
        elif subject == OTHER_OPTION_VALUE:
            if len(subject_other) < 3:
                errors["subjectOther"] = "Please specify your subject name."
            else:
                stream_display = subject_other
                subject_final = "Other"
        else:
            allowed = {
                "B.Sc": BSC_SUBJECTS,
                "B.Com": BCOM_SUBJECTS,
                "B.A.": BA_SUBJECTS,
                "BBA": BBA_SUBJECTS,
                "BCA": BCA_SUBJECTS,
            }.get(course, ())
            if subject not in allowed:
                errors["subject"] = "Please select your subject or specialisation."
            else:
                stream_display = subject
                subject_final = subject

    password = data.get("password") or ""
    confirm = data.get("confirmPassword") or ""
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    if password != confirm:
        errors["confirmPassword"] = "Passwords do not match."

    if errors:
        return errors, None

    assert mobile_digits is not None

    university_stored = university_other if university_sel == OTHER_OPTION_VALUE else university_sel

    normalized: dict[str, Any] = {
        "email": email,
        "fullName": full_name,
        "name": full_name,
        "mobile": mobile_digits,
        "university": university_stored,
        "universitySelect": university_sel,
        "universityOther": university_other if university_sel == OTHER_OPTION_VALUE else None,
        "collegeName": college_name,
        "semester": semester,
        "collegeRegNo": college_reg,
        "course": course if course != OTHER_OPTION_VALUE else "Other",
        "courseRaw": course,
        "courseOther": course_other if course == OTHER_OPTION_VALUE else None,
        "branch": branch_final,
        "branchOther": branch_other if branch == BRANCH_OTHERS_LABEL else None,
        "subject": subject_final,
        "subjectOther": subject_other if subject == OTHER_OPTION_VALUE else None,
        "stream": stream_display,
        "password": password,
    }
    return {}, normalized


def normalized_to_user_doc(normalized: dict[str, Any], password_hash: str) -> dict[str, Any]:
    """Build Mongo user document from normalized registration (no OTP fields)."""
    doc: dict[str, Any] = {
        "email": normalized["email"],
        "password": password_hash,
        "name": normalized["fullName"],
        "fullName": normalized["fullName"],
        "mobile": normalized["mobile"],
        "role": "student",
        "university": normalized["university"],
        "collegeName": normalized["collegeName"],
        "semester": normalized["semester"],
        "collegeRegNo": normalized["collegeRegNo"],
        "course": normalized["course"],
        "stream": normalized.get("stream") or "",
    }
    if normalized.get("universityOther"):
        doc["universityOther"] = normalized["universityOther"]
    if normalized.get("courseOther"):
        doc["courseOther"] = normalized["courseOther"]
    if normalized.get("branch"):
        doc["branch"] = normalized["branch"]
    if normalized.get("branchOther"):
        doc["branchOther"] = normalized["branchOther"]
    if normalized.get("subject") is not None:
        doc["subject"] = normalized["subject"]
    if normalized.get("subjectOther"):
        doc["subjectOther"] = normalized["subjectOther"]
    return doc
