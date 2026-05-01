"""
A-2 / A-3: One-time-style migrations for legacy course fields (run on GET and persist).
"""
from __future__ import annotations

import html
from typing import Any


def _html_from_plain_multiline(text: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return ""
    inner = "".join(f"<li>{html.escape(l)}</li>" for l in lines)
    return f"<ul>{inner}</ul>"


def migrate_legacy_course_fields(coll, c: dict[str, Any] | None) -> dict[str, Any] | None:
    """Merge legacy targetAudience / requirements into instructions; unset merged keys."""
    if not c:
        return c
    oid = c.get("_id")
    if oid is None:
        return c

    unset: dict[str, str] = {}
    blocks: list[str] = []

    req = c.get("requirements")
    if req is not None:
        if isinstance(req, list) and req:
            inner = "".join(f"<li>{html.escape(str(x))}</li>" for x in req if str(x).strip())
            if inner:
                blocks.append(f'<section class="xi-migrated"><h3>Requirements</h3><ul>{inner}</ul></section>')
                unset["requirements"] = ""
        elif isinstance(req, str) and req.strip():
            rs = req.strip()
            blocks.append(
                f'<section class="xi-migrated"><h3>Requirements</h3>{rs}</section>'
                if rs.startswith("<")
                else f'<section class="xi-migrated"><h3>Requirements</h3>{_html_from_plain_multiline(rs)}</section>'
            )
            unset["requirements"] = ""

    ta = c.get("targetAudience")
    if ta is not None and str(ta).strip():
        ts = str(ta).strip()
        blocks.append(
            f'<section class="xi-migrated"><h3>Requirements</h3>{ts}</section>'
            if ts.startswith("<")
            else f'<section class="xi-migrated"><h3>Requirements</h3>{_html_from_plain_multiline(ts)}</section>'
        )
        unset["targetAudience"] = ""

    if not blocks:
        return c

    inst = (c.get("instructions") or "").strip()
    merged = "".join(blocks) + (f"<div>{inst}</div>" if inst else "")

    op: dict[str, Any] = {"$set": {"instructions": merged}}
    if unset:
        op["$unset"] = unset
    coll.update_one({"_id": oid}, op)
    return coll.find_one({"_id": oid}) or c


def review_stats_for_course_ids(review_coll, course_ids: list[str]) -> dict[str, dict[str, float | int]]:
    if not course_ids:
        return {}
    pipeline = [
        {"$match": {"courseId": {"$in": course_ids}, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$courseId", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]
    out: dict[str, dict[str, float | int]] = {}
    for row in review_coll.aggregate(pipeline):
        cid = str(row.get("_id") or "")
        if not cid:
            continue
        n = int(row.get("n") or 0)
        avg = float(row.get("avg") or 0) if n else 0.0
        out[cid] = {"average": round(avg, 2), "total": n}
    return out
