"""CRM settings, follow-ups, imports, and audit log."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.db import get_app_settings_collection, get_crm_leads_collection
from app.lead_crm.identity import normalize_mobile
from app.lead_crm.service import _find_lead_by_identity, _now, _oid, add_note, ingest_lead_event, recent_activity

CRM_SETTINGS_ID = "crm_settings"

DEFAULT_CRM_SETTINGS: dict[str, Any] = {
    "autoAssign": True,
    "duplicateDetection": True,
    "overdueFollowUpAlerts": True,
    "recordingAccess": True,
    "emailAlerts": True,
    "whatsappAlerts": False,
    "recordingRetentionDays": 180,
}


def _audit_col():
    return get_app_settings_collection().database["crm_audit_log"]


def _imports_col():
    return get_app_settings_collection().database["crm_imports"]


def log_crm_audit(
    *,
    action: str,
    actor_id: str | None = None,
    actor_name: str = "System",
    meta: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    try:
        _audit_col().insert_one(
            {
                "action": action,
                "actorId": _oid(actor_id),
                "actorName": actor_name,
                "meta": meta or {},
                "ip": ip,
                "createdAt": _now(),
            }
        )
    except Exception:
        pass


def get_crm_settings() -> dict[str, Any]:
    doc = get_app_settings_collection().find_one({"_id": CRM_SETTINGS_ID}) or {}
    out = {**DEFAULT_CRM_SETTINGS}
    for key in DEFAULT_CRM_SETTINGS:
        if key in doc:
            out[key] = doc[key]
    return out


def update_crm_settings(patch: dict[str, Any], *, actor_id: str | None, actor_name: str) -> dict[str, Any]:
    allowed = set(DEFAULT_CRM_SETTINGS.keys())
    clean = {k: patch[k] for k in patch if k in allowed}
    if "recordingRetentionDays" in clean:
        try:
            clean["recordingRetentionDays"] = max(30, min(int(clean["recordingRetentionDays"]), 730))
        except (TypeError, ValueError):
            clean.pop("recordingRetentionDays", None)
    if not clean:
        return {"ok": True, "settings": get_crm_settings()}
    clean["updatedAt"] = _now()
    clean["updatedBy"] = actor_name
    get_app_settings_collection().update_one({"_id": CRM_SETTINGS_ID}, {"$set": clean}, upsert=True)
    log_crm_audit(action="CRM settings updated", actor_id=actor_id, actor_name=actor_name, meta={"keys": list(clean.keys())})
    return {"ok": True, "settings": get_crm_settings()}


def list_audit_log(limit: int = 30) -> list[dict[str, Any]]:
    try:
        rows = list(_audit_col().find().sort("createdAt", -1).limit(max(1, min(limit, 100))))
    except Exception:
        rows = []
    if not rows:
        return _audit_from_events(limit)
    out: list[dict[str, Any]] = []
    for r in rows:
        created = r.get("createdAt")
        out.append(
            {
                "id": str(r["_id"]),
                "action": r.get("action") or "Activity",
                "actorName": r.get("actorName") or "System",
                "meta": r.get("meta") or {},
                "ip": r.get("ip"),
                "createdAt": created.isoformat() if isinstance(created, datetime) else None,
            }
        )
    return out


def _audit_from_events(limit: int) -> list[dict[str, Any]]:
    """Fallback when dedicated audit collection is empty."""
    events = recent_activity(limit)
    labels = {
        "lead.assigned": "Lead assigned",
        "lead.disposition": "Disposition updated",
        "lead.followup.scheduled": "Follow-up scheduled",
        "lead.followup.completed": "Follow-up completed",
        "lead.imported": "Leads imported",
        "call.outbound": "Outbound call",
    }
    out: list[dict[str, Any]] = []
    for e in events:
        et = e.get("eventType") or ""
        out.append(
            {
                "id": e.get("id"),
                "action": labels.get(et, et.replace(".", " ").replace("_", " ").title()),
                "actorName": (e.get("payload") or {}).get("actorName") or "System",
                "meta": {"leadName": e.get("leadName"), "eventType": et},
                "ip": None,
                "createdAt": e.get("createdAt"),
            }
        )
    return out


def list_follow_up_leads(*, assigned_to: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {"status": "open", "followUpAt": {"$ne": None}}
    if assigned_to:
        oid = _oid(assigned_to)
        if oid:
            filt["assignedTo"] = oid
    rows = list(get_crm_leads_collection().find(filt).sort("followUpAt", 1).limit(max(1, min(limit, 500))))
    from app.lead_crm.service import serialize_lead

    return [serialize_lead(r) for r in rows]


def follow_up_stats(*, assigned_to: str | None = None) -> dict[str, Any]:
    now = _now()
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    filt: dict[str, Any] = {"status": "open", "followUpAt": {"$ne": None}}
    if assigned_to:
        oid = _oid(assigned_to)
        if oid:
            filt["assignedTo"] = oid
    col = get_crm_leads_collection()
    open_count = col.count_documents(filt)
    overdue = col.count_documents({**filt, "followUpAt": {"$lt": now}})
    due_today = col.count_documents({**filt, "followUpAt": {"$gte": now, "$lte": today_end}})
    upcoming = max(0, open_count - overdue - due_today)

    events_col = get_app_settings_collection().database["crm_lead_events"]
    month_ago = now - __import__("datetime").timedelta(days=30)
    completed = events_col.count_documents({"eventType": "lead.followup.completed", "createdAt": {"$gte": month_ago}})
    scheduled = events_col.count_documents({"eventType": "lead.followup.scheduled", "createdAt": {"$gte": month_ago}})
    on_time_pct = round((completed / max(scheduled, 1)) * 100) if scheduled else 0

    return {
        "open": open_count,
        "overdue": overdue,
        "dueToday": due_today,
        "upcoming": upcoming,
        "completedOnTimePct": min(100, on_time_pct),
    }


def schedule_follow_up(
    lead_id: str,
    *,
    follow_up_at: datetime,
    note: str,
    actor_id: str | None,
    actor_name: str,
) -> dict[str, Any]:
    lead_oid = _oid(lead_id)
    if not lead_oid:
        return {"ok": False, "error": "invalid_id"}
    note = (note or "").strip()
    if not note:
        return {"ok": False, "error": "note_required"}
    now = _now()
    get_crm_leads_collection().update_one(
        {"_id": lead_oid},
        {
            "$set": {
                "followUpAt": follow_up_at,
                "lifecycleStage": "follow_up_scheduled",
                "disposition": "followup_specific_time",
                "updatedAt": now,
            }
        },
    )
    add_note(lead_id, note, actor_id or "", actor_name)
    ingest_lead_event(
        event_type="lead.followup.scheduled",
        source="crm",
        payload={"followUpAt": follow_up_at.isoformat(), "note": note, "actorName": actor_name},
        idempotency_key=f"fu:sched:{lead_id}:{follow_up_at.timestamp()}",
        actor_id=actor_id,
        lead_id=lead_id,
    )
    log_crm_audit(
        action=f"Follow-up scheduled for lead",
        actor_id=actor_id,
        actor_name=actor_name,
        meta={"leadId": lead_id, "followUpAt": follow_up_at.isoformat()},
    )
    return {"ok": True}


def reschedule_follow_up(
    lead_id: str,
    *,
    follow_up_at: datetime,
    note: str | None,
    actor_id: str | None,
    actor_name: str,
) -> dict[str, Any]:
    lead_oid = _oid(lead_id)
    if not lead_oid:
        return {"ok": False, "error": "invalid_id"}
    now = _now()
    get_crm_leads_collection().update_one(
        {"_id": lead_oid},
        {"$set": {"followUpAt": follow_up_at, "updatedAt": now}},
    )
    if note and note.strip():
        add_note(lead_id, note.strip(), actor_id or "", actor_name)
    ingest_lead_event(
        event_type="lead.followup.scheduled",
        source="crm",
        payload={"followUpAt": follow_up_at.isoformat(), "rescheduled": True, "actorName": actor_name},
        idempotency_key=f"fu:resched:{lead_id}:{follow_up_at.timestamp()}",
        actor_id=actor_id,
        lead_id=lead_id,
    )
    return {"ok": True}


def complete_follow_up(
    lead_id: str,
    *,
    note: str | None,
    actor_id: str | None,
    actor_name: str,
) -> dict[str, Any]:
    lead_oid = _oid(lead_id)
    if not lead_oid:
        return {"ok": False, "error": "invalid_id"}
    now = _now()
    get_crm_leads_collection().update_one(
        {"_id": lead_oid},
        {
            "$unset": {"followUpAt": ""},
            "$set": {"lifecycleStage": "connected", "updatedAt": now},
        },
    )
    body = (note or "").strip() or "Follow-up marked complete."
    add_note(lead_id, body, actor_id or "", actor_name)
    ingest_lead_event(
        event_type="lead.followup.completed",
        source="crm",
        payload={"note": body, "actorName": actor_name},
        idempotency_key=f"fu:done:{lead_id}:{now.timestamp()}",
        actor_id=actor_id,
        lead_id=lead_id,
    )
    log_crm_audit(action="Follow-up completed", actor_id=actor_id, actor_name=actor_name, meta={"leadId": lead_id})
    return {"ok": True}


def import_leads_csv(
    file_bytes: bytes,
    *,
    duplicate_mode: str = "update",
    assign_mode: str = "unassigned",
    actor_id: str | None,
    actor_name: str,
    filename: str = "upload.csv",
) -> dict[str, Any]:
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return {"ok": False, "error": "empty_csv"}

    def pick(row: dict, *keys: str) -> str:
        lower = {str(k).strip().lower(): v for k, v in row.items() if k}
        for key in keys:
            val = lower.get(key.lower())
            if val is not None and str(val).strip():
                return str(val).strip()
        return ""

    added = 0
    updated = 0
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):
        name = pick(row, "name", "full name", "fullname", "student name", "full_name")
        mobile = pick(row, "mobile", "phone", "phone number", "contact")
        email = pick(row, "email", "e-mail")
        course = pick(row, "course", "training", "course title", "interest")
        if not name or not mobile:
            errors.append(f"Row {i}: name and mobile required")
            continue
        mob = normalize_mobile(mobile)
        existed = _find_lead_by_identity(mob, email or None) if mob else None
        r = ingest_lead_event(
            event_type="manual.upload",
            source="manual.upload",
            mobile=mobile,
            email=email or None,
            full_name=name,
            payload={"courseTitle": course} if course else {},
            actor_id=actor_id,
        )
        if r.get("ok"):
            if existed:
                updated += 1
            else:
                added += 1
        else:
            errors.append(f"Row {i}: {r.get('error', 'failed')}")

    status = "completed" if not errors else ("review" if added or updated else "failed")
    import_doc = {
        "filename": filename,
        "added": added,
        "updated": updated,
        "errors": errors[:20],
        "errorCount": len(errors),
        "status": status,
        "duplicateMode": duplicate_mode,
        "assignMode": assign_mode,
        "actorId": _oid(actor_id),
        "actorName": actor_name,
        "createdAt": _now(),
    }
    ins = _imports_col().insert_one(import_doc)
    log_crm_audit(
        action=f"Imported {added} leads from {filename}",
        actor_id=actor_id,
        actor_name=actor_name,
        meta={"added": added, "updated": updated, "errors": len(errors)},
    )
    return {
        "ok": True,
        "importId": str(ins.inserted_id),
        "added": added,
        "updated": updated,
        "errors": errors,
        "status": status,
    }


def list_import_history(limit: int = 20) -> list[dict[str, Any]]:
    try:
        rows = list(_imports_col().find().sort("createdAt", -1).limit(max(1, min(limit, 50))))
    except Exception:
        return []
    out: list[dict[str, Any]] = []
    for r in rows:
        created = r.get("createdAt")
        ext = (r.get("filename") or "import.csv").rsplit(".", 1)[-1].upper()
        out.append(
            {
                "id": str(r["_id"]),
                "filename": r.get("filename") or "import.csv",
                "type": ext if ext in ("CSV", "XLSX", "XLS") else "CSV",
                "added": r.get("added", 0),
                "updated": r.get("updated", 0),
                "errorCount": r.get("errorCount", 0),
                "status": r.get("status") or "completed",
                "meta": f"{r.get('added', 0)} added · {r.get('updated', 0)} updated",
                "createdAt": created.isoformat() if isinstance(created, datetime) else None,
            }
        )
    return out


def export_import_template_csv() -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "mobile", "email", "course"])
    w.writerow(["Aman Kumar", "9876543210", "aman@example.com", "Full Stack Development"])
    return buf.getvalue()
