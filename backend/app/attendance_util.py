"""Class-link session keys and date parsing for per-session attendance (A-11)."""
from __future__ import annotations

from datetime import date, datetime


def class_link_session_key(link: dict, index: int) -> str:
    lid = (link.get("id") or "").strip()
    if lid:
        return lid
    return f"idx_{index}"


def parse_class_link_date(raw) -> date | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if len(s) >= 10:
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date()
        except ValueError:
            pass
    for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s[:10]).date()
    except ValueError:
        return None


def norm_attendance_status(raw) -> str:
    s = str(raw or "").strip().lower()
    if s in ("present", "absent", "late"):
        return s
    return "absent"
