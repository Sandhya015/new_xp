"""Normalize lead identity fields for deduplication."""
from __future__ import annotations

import re


def normalize_mobile(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw).strip())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        return None
    return f"+91{digits}"


def normalize_email(raw: str | None) -> str | None:
    if not raw:
        return None
    e = str(raw).strip().lower()
    if "@" not in e or len(e) < 5:
        return None
    return e


def mask_mobile(mobile: str | None) -> str:
    if not mobile:
        return "—"
    d = re.sub(r"\D", "", mobile)
    if len(d) >= 4:
        return f"******{d[-4:]}"
    return "******"


def temperature_from_score(score: int, hot: int = 70, warm: int = 40) -> str:
    if score >= hot:
        return "hot"
    if score >= warm:
        return "warm"
    return "cold"
