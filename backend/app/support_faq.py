"""Support FAQ serialization (CFRD §3 visibility / category)."""
from __future__ import annotations

from typing import Any

FAQ_CATEGORIES = ("General", "Payment", "Certificate", "Internship", "Training", "Account")
FAQ_VISIBILITIES = ("public", "students", "both")


def normalize_faq_row(x: dict, index: int = 0) -> dict[str, Any] | None:
    q = str(x.get("question") or "").strip()
    if not q:
        return None
    vis = str(x.get("visibility") or "both").strip().lower()
    if vis not in FAQ_VISIBILITIES:
        vis = "both"
    cat = str(x.get("category") or "General").strip()
    if cat not in FAQ_CATEGORIES:
        # allow free text but default unknown to General
        if not cat:
            cat = "General"
    active = x.get("active")
    if active is None:
        active = True
    display = x.get("displayOrder")
    if display is None:
        display = x.get("sortOrder")
    try:
        display_order = int(display if display is not None else index)
    except (TypeError, ValueError):
        display_order = index
    return {
        "id": str(x.get("id") or f"faq_{index}")[:80],
        "question": q[:500],
        "answer": str(x.get("answer") or "").strip()[:20000],
        "category": cat[:80],
        "visibility": vis,
        "active": bool(active),
        "displayOrder": display_order,
        "sortOrder": display_order,  # backward compat for older clients
    }


def serialize_faqs_from_doc(doc: dict, *, audience: str | None = None) -> list[dict]:
    """
    audience: None = all (admin), 'public' | 'students' = filter by visibility + active.
    """
    raw = doc.get("supportFaqs")
    faqs = raw if isinstance(raw, list) else []
    safe: list[dict] = []
    for i, x in enumerate(faqs[:80]):
        if not isinstance(x, dict):
            continue
        row = normalize_faq_row(x, i)
        if not row:
            continue
        if audience in ("public", "students"):
            if not row["active"]:
                continue
            vis = row["visibility"]
            if audience == "public" and vis not in ("public", "both"):
                continue
            if audience == "students" and vis not in ("students", "both"):
                continue
        safe.append(row)
    safe.sort(key=lambda z: (z.get("displayOrder", 0), z.get("question", "")))
    return safe
