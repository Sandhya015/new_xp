"""Validate company registration before OTP (client spec v1.0)."""
from __future__ import annotations

import re
from typing import Any

from app.company_registration_constants import DPIIT_INDUSTRY_SECTORS
from app.registration_validate import normalize_mobile


def validate_company_registration(data: dict) -> tuple[dict[str, str], dict[str, Any] | None]:
    """Returns (field_errors, normalized) — normalized None if errors."""
    errors: dict[str, str] = {}

    company_name = (data.get("companyName") or data.get("name") or "").strip()
    if len(company_name) < 3 or len(company_name) > 150:
        errors["companyName"] = "Please enter your company name."

    email = (data.get("companyEmail") or data.get("email") or "").strip().lower()
    if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        errors["companyEmail"] = "Please enter a valid company email address."

    mobile_digits, mobile_err = normalize_mobile(data.get("mobile") or "")
    if mobile_err:
        errors["mobile"] = mobile_err

    industry = (data.get("industryType") or "").strip()
    if not industry:
        errors["industryType"] = "Please select your industry type."
    elif industry not in DPIIT_INDUSTRY_SECTORS:
        errors["industryType"] = "Please select your industry type."

    address = (data.get("address") or "").strip()
    if not address:
        errors["address"] = "Company address is required."

    website = (data.get("website") or "").strip() or None

    hr_name = (data.get("hrName") or "").strip()
    if not hr_name:
        errors["hrName"] = "HR contact name is required."

    hr_mobile_digits, hr_mobile_err = normalize_mobile(data.get("hrMobile") or "")
    if hr_mobile_err:
        errors["hrMobile"] = hr_mobile_err

    password = data.get("password") or ""
    confirm = data.get("confirmPassword") or ""
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    if password != confirm:
        errors["confirmPassword"] = "Passwords do not match."

    if errors:
        return errors, None

    assert mobile_digits is not None and hr_mobile_digits is not None

    normalized: dict[str, Any] = {
        "companyName": company_name,
        "email": email,
        "mobile": mobile_digits,
        "industryType": industry,
        "address": address,
        "website": website,
        "hrName": hr_name,
        "hrMobile": hr_mobile_digits,
        "password": password,
    }
    return {}, normalized


def normalized_company_to_user_payload(normalized: dict[str, Any], password_hash: str) -> dict[str, Any]:
    """Mongo user document for company (pending admin) — inserted after OTP verify."""
    name = normalized["companyName"]
    return {
        "email": normalized["email"],
        "password": password_hash,
        "name": name,
        "fullName": name,
        "mobile": normalized["mobile"],
        "role": "company",
        "companyName": name,
        "status": "pending",
        "hrName": normalized["hrName"],
        "hrMobile": normalized["hrMobile"],
        "industryType": normalized["industryType"],
        "address": normalized["address"],
        "website": normalized.get("website"),
    }
