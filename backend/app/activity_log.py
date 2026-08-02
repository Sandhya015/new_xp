"""
Admin / system activity log (CFRD). Never log secrets or full passwords.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from flask import Request


def client_ip(req: Request | None) -> str:
    if req is None:
        return ""
    forwarded = (req.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    if forwarded:
        return forwarded[:80]
    real = (req.headers.get("X-Real-IP") or "").strip()
    if real:
        return real[:80]
    return (req.remote_addr or "")[:80]


def client_user_agent(req: Request | None) -> str:
    if req is None:
        return ""
    return (req.headers.get("User-Agent") or "")[:400]


def log_activity(
    *,
    actor_type: str,
    actor_id: str | None = None,
    actor_email: str | None = None,
    actor_name: str | None = None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
    meta: dict | None = None,
    request: Request | None = None,
) -> str | None:
    """
    Insert one activity_logs document. Returns inserted id string or None on failure.
    Failures are swallowed so business routes never 500 solely due to logging.
    """
    try:
        from app.db import get_activity_logs_collection

        coll = get_activity_logs_collection()
        doc: dict[str, Any] = {
            "actorType": (actor_type or "system").strip().lower()[:40],
            "actorId": str(actor_id or "")[:80],
            "actorEmail": (actor_email or "").strip().lower()[:200],
            "actorName": (actor_name or "").strip()[:200],
            "action": (action or "").strip()[:120],
            "entityType": (entity_type or "").strip()[:80],
            "entityId": str(entity_id or "")[:80],
            "oldValue": old_value,
            "newValue": new_value,
            "meta": meta if isinstance(meta, dict) else {},
            "ip": client_ip(request),
            "userAgent": client_user_agent(request),
            "createdAt": datetime.utcnow(),
        }
        result = coll.insert_one(doc)
        return str(result.inserted_id)
    except Exception:
        return None


def log_admin_action(
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
    meta: dict | None = None,
    request: Request | None = None,
    actor_id: str | None = None,
    actor_email: str | None = None,
    actor_name: str | None = None,
) -> str | None:
    return log_activity(
        actor_type="admin",
        actor_id=actor_id,
        actor_email=actor_email,
        actor_name=actor_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        meta=meta,
        request=request,
    )


def serialize_activity_log(doc: dict) -> dict:
    created = doc.get("createdAt")
    return {
        "id": str(doc.get("_id", "")),
        "actorType": doc.get("actorType") or "",
        "actorId": doc.get("actorId") or "",
        "actorEmail": doc.get("actorEmail") or "",
        "actorName": doc.get("actorName") or "",
        "action": doc.get("action") or "",
        "entityType": doc.get("entityType") or "",
        "entityId": doc.get("entityId") or "",
        "oldValue": doc.get("oldValue"),
        "newValue": doc.get("newValue"),
        "meta": doc.get("meta") if isinstance(doc.get("meta"), dict) else {},
        "ip": doc.get("ip") or "",
        "userAgent": doc.get("userAgent") or "",
        "createdAt": created.isoformat() + "Z" if hasattr(created, "isoformat") else (str(created) if created else ""),
    }
