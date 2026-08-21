"""Core lead CRM business logic."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId

from app.db import (
    get_crm_call_attempts_collection,
    get_crm_lead_events_collection,
    get_crm_leads_collection,
    get_crm_lead_notes_collection,
    get_users_collection,
)
from app.lead_crm.constants import DISPOSITIONS, EVENT_SCORES, LIFECYCLE_STAGES
from app.lead_crm.identity import mask_mobile, normalize_email, normalize_mobile, temperature_from_score

UTC = timezone.utc


def _now() -> datetime:
    return datetime.now(UTC)


def _oid(value: str | ObjectId | None) -> ObjectId | None:
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _idempotency_key(event_type: str, payload: dict[str, Any]) -> str:
    parts = [event_type]
    for k in sorted(payload.keys()):
        v = payload.get(k)
        if v is not None and k not in ("createdAt", "updatedAt", "_id"):
            parts.append(f"{k}={v}")
    digest = hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]
    return f"{event_type}:{digest}"


def _event_score(event_type: str, payload: dict[str, Any]) -> int:
    base = EVENT_SCORES.get(event_type, 5)
    if event_type in ("payment.failed", "payment.abandoned", "payment.created"):
        amt = payload.get("amount") or payload.get("amountPaise")
        if isinstance(amt, (int, float)) and amt >= 500000:  # ₹5000+
            base += 10
    return base


def _lifecycle_for_event(event_type: str, current: str) -> str:
    if event_type == "payment.successful":
        return "enrolled"
    if event_type in ("payment.failed", "payment.abandoned", "payment.created"):
        if current in ("enrolled", "not_interested", "dnd", "invalid"):
            return current
        return "payment_pending"
    if event_type in ("callback.requested", "contact.submitted", "registration.incomplete"):
        if current in ("enrolled", "dnd", "invalid"):
            return current
        return "new"
    return current or "new"


def _find_lead_by_identity(mobile: str | None, email: str | None) -> dict[str, Any] | None:
    col = get_crm_leads_collection()
    if mobile:
        doc = col.find_one({"mobile": mobile})
        if doc:
            return doc
    if email:
        doc = col.find_one({"email": email})
        if doc:
            return doc
    return None


def _merge_identity(existing: dict[str, Any], mobile: str | None, email: str | None, name: str | None) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    if mobile and not existing.get("mobile"):
        patch["mobile"] = mobile
    if email and not existing.get("email"):
        patch["email"] = email
    if name and not existing.get("fullName"):
        patch["fullName"] = name
    elif name and existing.get("fullName") and len(name) > len(str(existing.get("fullName"))):
        patch["fullName"] = name
    return patch


def ingest_lead_event(
    *,
    event_type: str,
    source: str,
    mobile: str | None = None,
    email: str | None = None,
    full_name: str | None = None,
    payload: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    actor_id: str | None = None,
    lead_id: str | None = None,
) -> dict[str, Any]:
    """
    Create or update canonical lead and append timeline event.
    Requires at least one of mobile or email (PRD: no orphan anonymous leads),
    unless lead_id is provided for internal CRM events.
    """
    payload = dict(payload or {})
    mobile_n = normalize_mobile(mobile or payload.get("mobile") or payload.get("phone"))
    email_n = normalize_email(email or payload.get("email"))
    name = (full_name or payload.get("fullName") or payload.get("name") or "").strip() or None

    lead: dict[str, Any] | None = None
    if lead_id:
        lead_oid = _oid(lead_id)
        if lead_oid:
            lead = get_crm_leads_collection().find_one({"_id": lead_oid})

    if not lead and not mobile_n and not email_n:
        return {"ok": False, "error": "mobile_or_email_required"}

    idem = idempotency_key or _idempotency_key(event_type, {**payload, "mobile": mobile_n, "email": email_n})
    events_col = get_crm_lead_events_collection()
    if events_col.find_one({"idempotencyKey": idem}):
        existing = events_col.find_one({"idempotencyKey": idem})
        lead_id = existing.get("leadId") if existing else None
        return {"ok": True, "duplicate": True, "leadId": str(lead_id) if lead_id else None}

    now = _now()
    leads_col = get_crm_leads_collection()
    if not lead:
        lead = _find_lead_by_identity(mobile_n, email_n)
    score_delta = _event_score(event_type, payload)

    if lead:
        lead_id = lead["_id"]
        patch = _merge_identity(lead, mobile_n, email_n, name)
        new_score = _cap_score(int(lead.get("score") or 0) + score_delta)
        lifecycle = _lifecycle_for_event(event_type, str(lead.get("lifecycleStage") or "new"))
        patch.update(
            {
                "score": new_score,
                "temperature": temperature_from_score(new_score),
                "lifecycleStage": lifecycle,
                "lastEventAt": now,
                "lastEventType": event_type,
                "lastSource": source,
                "updatedAt": now,
            }
        )
        if event_type.startswith("payment.") and payload.get("courseId"):
            patch["lastCourseId"] = payload.get("courseId")
            patch["lastCourseTitle"] = payload.get("courseTitle")
        leads_col.update_one({"_id": lead_id}, {"$set": patch})
    else:
        new_score = _cap_score(score_delta)
        lifecycle = _lifecycle_for_event(event_type, "new")
        doc = {
            "mobile": mobile_n,
            "email": email_n,
            "fullName": name,
            "score": new_score,
            "temperature": temperature_from_score(new_score),
            "lifecycleStage": lifecycle,
            "status": "open",
            "assignedTo": None,
            "assignedToName": None,
            "assignedAt": None,
            "lastEventAt": now,
            "lastEventType": event_type,
            "lastSource": source,
            "followUpAt": None,
            "disposition": None,
            "callAttempts": 0,
            "sourcesSeen": [source],
            "createdAt": now,
            "updatedAt": now,
        }
        if payload.get("courseId"):
            doc["lastCourseId"] = payload.get("courseId")
            doc["lastCourseTitle"] = payload.get("courseTitle")
        ins = leads_col.insert_one(doc)
        lead_id = ins.inserted_id

    if lead and source not in (lead.get("sourcesSeen") or []):
        leads_col.update_one({"_id": lead_id}, {"$addToSet": {"sourcesSeen": source}})

    event_doc = {
        "leadId": lead_id,
        "eventType": event_type,
        "source": source,
        "payload": payload,
        "scoreDelta": score_delta,
        "idempotencyKey": idem,
        "actorId": _oid(actor_id),
        "createdAt": now,
    }
    events_col.insert_one(event_doc)
    return {"ok": True, "leadId": str(lead_id), "eventType": event_type, "scoreDelta": score_delta}


def serialize_lead(doc: dict[str, Any], *, mask_phone: bool = False) -> dict[str, Any]:
    mobile = doc.get("mobile")
    return {
        "id": str(doc["_id"]),
        "fullName": doc.get("fullName") or "Unknown",
        "mobile": mask_mobile(mobile) if mask_phone else mobile,
        "email": doc.get("email"),
        "score": int(doc.get("score") or 0),
        "temperature": doc.get("temperature") or "cold",
        "lifecycleStage": doc.get("lifecycleStage") or "new",
        "status": doc.get("status") or "open",
        "assignedTo": str(doc["assignedTo"]) if doc.get("assignedTo") else None,
        "assignedToName": doc.get("assignedToName"),
        "assignedAt": doc.get("assignedAt").isoformat() if doc.get("assignedAt") else None,
        "lastEventAt": doc.get("lastEventAt").isoformat() if doc.get("lastEventAt") else None,
        "lastEventType": doc.get("lastEventType"),
        "lastSource": doc.get("lastSource"),
        "followUpAt": doc.get("followUpAt").isoformat() if doc.get("followUpAt") else None,
        "disposition": doc.get("disposition"),
        "callAttempts": int(doc.get("callAttempts") or 0),
        "lastCourseId": doc.get("lastCourseId"),
        "lastCourseTitle": doc.get("lastCourseTitle"),
        "sourcesSeen": doc.get("sourcesSeen") or [],
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
        "updatedAt": doc.get("updatedAt").isoformat() if doc.get("updatedAt") else None,
    }


def serialize_event(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "leadId": str(doc["leadId"]),
        "eventType": doc.get("eventType"),
        "source": doc.get("source"),
        "payload": doc.get("payload") or {},
        "scoreDelta": doc.get("scoreDelta"),
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
    }


def _cap_score(score: int) -> int:
    return max(0, min(100, score))


def _lead_filter(
    *,
    view: str | None = None,
    assigned_to: str | None = None,
    lifecycle: str | None = None,
    temperature: str | None = None,
    q: str | None = None,
    follow_up_due: bool = False,
) -> dict[str, Any]:
    from app.lead_crm.constants import SOURCE_VIEWS

    filt: dict[str, Any] = {"status": {"$ne": "merged"}}
    if view and view in SOURCE_VIEWS:
        filt["lastEventType"] = {"$in": SOURCE_VIEWS[view]}
    if assigned_to == "unassigned":
        filt["assignedTo"] = None
    elif assigned_to:
        oid = _oid(assigned_to)
        if oid:
            filt["assignedTo"] = oid
    if lifecycle:
        filt["lifecycleStage"] = lifecycle
    if temperature:
        filt["temperature"] = temperature
    if follow_up_due:
        filt["followUpAt"] = {"$lte": _now()}
        filt["status"] = "open"
    if q:
        q = q.strip()
        ors = [{"fullName": {"$regex": q, "$options": "i"}}]
        mob = normalize_mobile(q)
        if mob:
            ors.append({"mobile": mob})
        if "@" in q:
            em = normalize_email(q)
            if em:
                ors.append({"email": em})
        filt["$or"] = ors
    return filt


def list_leads(
    *,
    view: str | None = None,
    assigned_to: str | None = None,
    lifecycle: str | None = None,
    temperature: str | None = None,
    q: str | None = None,
    follow_up_due: bool = False,
    limit: int = 50,
    skip: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    filt = _lead_filter(
        view=view,
        assigned_to=assigned_to,
        lifecycle=lifecycle,
        temperature=temperature,
        q=q,
        follow_up_due=follow_up_due,
    )
    col = get_crm_leads_collection()
    total = col.count_documents(filt)
    cursor = col.find(filt).sort([("score", -1), ("lastEventAt", -1)]).skip(skip).limit(min(limit, 200))
    return [serialize_lead(d) for d in cursor], total


def export_leads_csv(
    *,
    view: str | None = None,
    assigned_to: str | None = None,
    lifecycle: str | None = None,
    temperature: str | None = None,
    q: str | None = None,
    follow_up_due: bool = False,
    limit: int = 5000,
) -> str:
    import csv
    import io

    items, _ = list_leads(
        view=view,
        assigned_to=assigned_to,
        lifecycle=lifecycle,
        temperature=temperature,
        q=q,
        follow_up_due=follow_up_due,
        limit=limit,
        skip=0,
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "ID", "Name", "Mobile", "Email", "Score", "Temperature", "Stage",
        "Assigned To", "Last Event", "Follow-up At", "Created At",
    ])
    for row in items:
        writer.writerow([
            row["id"],
            row["fullName"],
            row.get("mobile") or "",
            row.get("email") or "",
            row.get("score"),
            row.get("temperature"),
            row.get("lifecycleStage"),
            row.get("assignedToName") or "",
            row.get("lastEventType") or "",
            row.get("followUpAt") or "",
            row.get("createdAt") or "",
        ])
    return buf.getvalue()


def get_lead_detail(lead_id: str) -> dict[str, Any] | None:
    oid = _oid(lead_id)
    if not oid:
        return None
    doc = get_crm_leads_collection().find_one({"_id": oid})
    if not doc:
        return None
    events = list(
        get_crm_lead_events_collection()
        .find({"leadId": oid})
        .sort("createdAt", -1)
        .limit(100)
    )
    notes = list(
        get_crm_lead_notes_collection()
        .find({"leadId": oid})
        .sort("createdAt", -1)
        .limit(50)
    )
    calls = list(
        get_crm_call_attempts_collection()
        .find({"leadId": oid})
        .sort("createdAt", -1)
        .limit(30)
    )
    return {
        "lead": serialize_lead(doc),
        "events": [serialize_event(e) for e in events],
        "notes": [
            {
                "id": str(n["_id"]),
                "body": n.get("body"),
                "authorId": str(n["authorId"]) if n.get("authorId") else None,
                "authorName": n.get("authorName"),
                "createdAt": n.get("createdAt").isoformat() if n.get("createdAt") else None,
            }
            for n in notes
        ],
        "calls": [
            {
                "id": str(c["_id"]),
                "direction": c.get("direction"),
                "status": c.get("status"),
                "durationSec": c.get("durationSec"),
                "recordingUrl": c.get("recordingUrl"),
                "agentName": c.get("agentName"),
                "createdAt": c.get("createdAt").isoformat() if c.get("createdAt") else None,
            }
            for c in calls
        ],
    }


def assign_lead(lead_id: str, agent_id: str, actor_name: str) -> dict[str, Any]:
    from werkzeug.security import generate_password_hash

    from app.lead_crm.agents import _gen_password, send_lead_assignment_email

    lead_oid = _oid(lead_id)
    agent_oid = _oid(agent_id)
    if not lead_oid or not agent_oid:
        return {"ok": False, "error": "invalid_id"}
    agent = get_users_collection().find_one({"_id": agent_oid, "role": "admin"})
    if not agent:
        return {"ok": False, "error": "agent_not_found"}
    now = _now()
    name = agent.get("fullName") or agent.get("name") or agent.get("email", "Agent")
    get_crm_leads_collection().update_one(
        {"_id": lead_oid},
        {
            "$set": {
                "assignedTo": agent_oid,
                "assignedToName": name,
                "assignedAt": now,
                "lifecycleStage": "assigned",
                "updatedAt": now,
            }
        },
    )
    ingest_lead_event(
        event_type="lead.assigned",
        source="crm",
        payload={"agentId": str(agent_oid), "agentName": name, "assignedBy": actor_name},
        idempotency_key=f"assign:{lead_id}:{agent_id}:{now.isoformat()}",
        lead_id=lead_id,
    )
    temp_password = None
    include_creds = bool(agent.get("forcePasswordChange"))
    if include_creds:
        temp_password = _gen_password()
        get_users_collection().update_one(
            {"_id": agent_oid},
            {"$set": {"password": generate_password_hash(temp_password, method="pbkdf2:sha256")}},
        )
    lead_doc = get_crm_leads_collection().find_one({"_id": lead_oid})
    if lead_doc and agent.get("email"):
        try:
            send_lead_assignment_email(
                agent_email=agent["email"],
                agent_name=name,
                lead=serialize_lead(lead_doc),
                assigned_by=actor_name,
                include_credentials=include_creds,
                password=temp_password,
            )
        except Exception:
            pass
    return {"ok": True}


def bulk_assign(lead_ids: list[str], agent_id: str, actor_name: str) -> dict[str, Any]:
    ok, fail = 0, 0
    for lid in lead_ids:
        r = assign_lead(lid, agent_id, actor_name)
        if r.get("ok"):
            ok += 1
        else:
            fail += 1
    return {"ok": True, "assigned": ok, "failed": fail, "mode": "bulk"}


def round_robin_assign(
    lead_ids: list[str],
    agent_ids: list[str] | None,
    actor_name: str,
) -> dict[str, Any]:
    """Distribute leads across agents in rotation (PRD: round-robin assignment)."""
    pool = agent_ids or [a["id"] for a in list_crm_agents()]
    pool = [a for a in pool if _oid(a)]
    if not pool:
        return {"ok": False, "error": "no_agents"}
    if not lead_ids:
        return {"ok": False, "error": "no_leads"}

    from app.db import get_app_settings_collection

    settings = get_app_settings_collection()
    state = settings.find_one({"_id": "crm"}) or {}
    idx = int(state.get("roundRobinIndex") or 0)
    assigned_map: dict[str, list[str]] = {}
    ok, fail = 0, 0

    for lid in lead_ids:
        agent_id = pool[idx % len(pool)]
        idx += 1
        r = assign_lead(lid, agent_id, actor_name)
        if r.get("ok"):
            ok += 1
            assigned_map.setdefault(agent_id, []).append(lid)
        else:
            fail += 1

    settings.update_one(
        {"_id": "crm"},
        {"$set": {"roundRobinIndex": idx, "updatedAt": _now()}},
        upsert=True,
    )
    return {"ok": True, "assigned": ok, "failed": fail, "mode": "round_robin", "byAgent": assigned_map}


def set_disposition(
    lead_id: str,
    disposition: str,
    *,
    follow_up_at: datetime | None = None,
    note: str | None = None,
    actor_id: str | None = None,
    actor_name: str = "Agent",
) -> dict[str, Any]:
    if disposition not in DISPOSITIONS:
        return {"ok": False, "error": "invalid_disposition"}
    needs_follow_up = disposition.startswith("followup_") or disposition.startswith("interested_")
    if needs_follow_up and not follow_up_at:
        return {"ok": False, "error": "follow_up_required"}
    if not note or not note.strip():
        return {"ok": False, "error": "note_required"}
    note = note.strip()
    lead_oid = _oid(lead_id)
    if not lead_oid:
        return {"ok": False, "error": "invalid_id"}
    now = _now()
    lifecycle = "follow_up_scheduled" if follow_up_at else "attempted"
    if disposition.startswith("not_interested"):
        lifecycle = "not_interested"
    elif disposition == "dnd":
        lifecycle = "dnd"
    elif disposition.startswith("interested"):
        lifecycle = "interested"
    patch: dict[str, Any] = {
        "disposition": disposition,
        "lifecycleStage": lifecycle,
        "updatedAt": now,
    }
    if follow_up_at:
        patch["followUpAt"] = follow_up_at
    get_crm_leads_collection().update_one({"_id": lead_oid}, {"$set": patch})
    if note:
        get_crm_lead_notes_collection().insert_one(
            {
                "leadId": lead_oid,
                "body": note,
                "authorId": _oid(actor_id),
                "authorName": actor_name,
                "createdAt": now,
            }
        )
    ingest_lead_event(
        event_type="lead.disposition",
        source="crm",
        payload={"disposition": disposition, "followUpAt": follow_up_at.isoformat() if follow_up_at else None, "note": note},
        idempotency_key=f"disp:{lead_id}:{disposition}:{now.timestamp()}",
        actor_id=actor_id,
        lead_id=lead_id,
    )
    return {"ok": True}


def add_note(lead_id: str, body: str, actor_id: str, actor_name: str) -> dict[str, Any]:
    lead_oid = _oid(lead_id)
    if not lead_oid or not body.strip():
        return {"ok": False, "error": "invalid"}
    now = _now()
    get_crm_lead_notes_collection().insert_one(
        {"leadId": lead_oid, "body": body.strip(), "authorId": _oid(actor_id), "authorName": actor_name, "createdAt": now}
    )
    return {"ok": True}


def record_call_attempt(
    lead_id: str,
    *,
    direction: str = "outbound",
    status: str = "initiated",
    telecmi_call_id: str | None = None,
    agent_id: str | None = None,
    agent_name: str | None = None,
) -> dict[str, Any]:
    lead_oid = _oid(lead_id)
    if not lead_oid:
        return {"ok": False, "error": "invalid_id"}
    now = _now()
    call_id = telecmi_call_id or f"mock-{uuid.uuid4().hex[:12]}"
    get_crm_call_attempts_collection().insert_one(
        {
            "leadId": lead_oid,
            "direction": direction,
            "status": status,
            "telecmiCallId": call_id,
            "agentId": _oid(agent_id),
            "agentName": agent_name,
            "durationSec": None,
            "recordingUrl": None,
            "createdAt": now,
        }
    )
    get_crm_leads_collection().update_one(
        {"_id": lead_oid},
        {
            "$inc": {"callAttempts": 1},
            "$set": {"lifecycleStage": "attempted", "updatedAt": now},
        },
    )
    ingest_lead_event(
        event_type="call.outbound" if direction == "outbound" else "call.inbound",
        source="telecmi",
        payload={"callId": call_id, "status": status},
        idempotency_key=f"call:{call_id}",
        actor_id=agent_id,
        lead_id=lead_id,
    )
    return {"ok": True, "callId": call_id}


def my_day_queue(agent_id: str) -> dict[str, Any]:
    oid = _oid(agent_id)
    if not oid:
        return {"followUps": [], "newAssigned": [], "hotUncontacted": []}
    col = get_crm_leads_collection()
    now = _now()
    follow = list(
        col.find({"assignedTo": oid, "followUpAt": {"$lte": now}, "status": "open"})
        .sort("followUpAt", 1)
        .limit(20)
    )
    new_assigned = list(
        col.find({"assignedTo": oid, "lifecycleStage": "assigned"})
        .sort("assignedAt", -1)
        .limit(20)
    )
    hot = list(
        col.find(
            {
                "assignedTo": oid,
                "temperature": "hot",
                "callAttempts": 0,
                "status": "open",
            }
        )
        .sort("score", -1)
        .limit(20)
    )
    return {
        "followUps": [serialize_lead(l) for l in follow],
        "newAssigned": [serialize_lead(l) for l in new_assigned],
        "hotUncontacted": [serialize_lead(l) for l in hot],
    }


def crm_summary() -> dict[str, Any]:
    from app.lead_crm.constants import SOURCE_VIEWS

    col = get_crm_leads_collection()
    today_start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    view_counts: dict[str, int] = {}
    for view_key, event_types in SOURCE_VIEWS.items():
        view_counts[view_key] = col.count_documents({
            "status": {"$ne": "merged"},
            "lastEventType": {"$in": event_types},
        })
    return {
        "totalOpen": col.count_documents({"status": "open"}),
        "unassigned": col.count_documents({"status": "open", "assignedTo": None}),
        "hot": col.count_documents({"temperature": "hot", "status": "open"}),
        "followUpsDue": col.count_documents({"followUpAt": {"$lte": _now()}, "status": "open"}),
        "newToday": col.count_documents({"createdAt": {"$gte": today_start}}),
        "enrolled": col.count_documents({"lifecycleStage": "enrolled"}),
        "viewCounts": view_counts,
    }


def list_crm_agents(*, assignable_only: bool = True) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {"role": "admin", "accountStatus": {"$ne": "inactive"}}
    if assignable_only:
        filt["$or"] = [
            {"adminPortalAccess": True},
            {"leadRole": {"$in": ["agent", "manager"]}},
        ]
    users = get_users_collection().find(filt).sort("email", 1)
    out = []
    for u in users:
        out.append(
            {
                "id": str(u["_id"]),
                "email": u.get("email"),
                "fullName": u.get("fullName") or u.get("name") or u.get("email"),
                "mobile": u.get("mobile"),
                "leadRole": u.get("leadRole") or "agent",
                "telecmiAgentId": u.get("telecmiAgentId"),
                "accountStatus": u.get("accountStatus") or "active",
            }
        )
    return out


def create_manual_lead(
    *,
    full_name: str,
    mobile: str,
    source: str = "manual.entry",
    course_id: str | None = None,
    course_title: str | None = None,
    actor_id: str | None = None,
) -> dict[str, Any]:
    from app.lead_crm.constants import EVENT_SCORES

    src = (source or "manual.entry").strip()
    event_type = src if src in EVENT_SCORES else "manual.entry"
    payload: dict[str, Any] = {}
    if course_id:
        payload["courseId"] = course_id
    if course_title:
        payload["courseTitle"] = course_title
    return ingest_lead_event(
        event_type=event_type,
        source=src,
        mobile=mobile,
        full_name=full_name.strip(),
        payload=payload,
        actor_id=actor_id,
    )


def agent_workload() -> list[dict[str, Any]]:
    agents = list_crm_agents()
    leads_col = get_crm_leads_collection()
    calls_col = get_crm_call_attempts_collection()
    today_start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    out: list[dict[str, Any]] = []
    for a in agents:
        role = str(a.get("leadRole") or "")
        if role not in ("agent", "manager"):
            continue
        aid = _oid(a["id"])
        active = leads_col.count_documents({"assignedTo": aid, "status": "open"}) if aid else 0
        calls_today = calls_col.count_documents({"agentId": aid, "createdAt": {"$gte": today_start}}) if aid else 0
        capacity = min(100, int(round(active / 40 * 100))) if active else 0
        out.append({**a, "activeLeads": active, "callsToday": calls_today, "capacityPct": capacity})
    out.sort(key=lambda x: (-x["activeLeads"], -x["callsToday"]))
    return out[:8]


def recent_activity(limit: int = 8) -> list[dict[str, Any]]:
    events_col = get_crm_lead_events_collection()
    leads_col = get_crm_leads_collection()
    events = list(events_col.find().sort("createdAt", -1).limit(max(1, min(limit, 30))))
    if not events:
        return []
    lead_ids = list({e["leadId"] for e in events if e.get("leadId")})
    name_map: dict[Any, str] = {}
    for doc in leads_col.find({"_id": {"$in": lead_ids}}, {"fullName": 1}):
        name_map[doc["_id"]] = doc.get("fullName") or "Lead"
    out: list[dict[str, Any]] = []
    for e in events:
        lid = e.get("leadId")
        out.append(
            {
                "id": str(e["_id"]),
                "eventType": e.get("eventType"),
                "source": e.get("source"),
                "leadId": str(lid) if lid else None,
                "leadName": name_map.get(lid, "Lead"),
                "createdAt": e.get("createdAt").isoformat() if e.get("createdAt") else None,
                "payload": e.get("payload") or {},
            }
        )
    return out


def call_log_stats(agent_id: str | None = None) -> dict[str, Any]:
    col = get_crm_call_attempts_collection()
    filt: dict[str, Any] = {}
    if agent_id:
        oid = _oid(agent_id)
        if oid:
            filt["agentId"] = oid
    total = col.count_documents(filt)
    connected_filt = {**filt, "status": {"$in": ["connected", "completed", "answered"]}}
    connected = col.count_documents(connected_filt)
    pipeline = [
        {"$match": {**filt, "durationSec": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$durationSec"}}},
    ]
    avg_row = list(col.aggregate(pipeline))
    avg_sec = int(avg_row[0]["avg"]) if avg_row else 0
    lead_filt: dict[str, Any] = {"followUpAt": {"$ne": None}, "status": "open"}
    if agent_id:
        oid = _oid(agent_id)
        if oid:
            lead_filt["assignedTo"] = oid
    follow_ups = get_crm_leads_collection().count_documents(lead_filt)
    return {
        "totalCalls": total,
        "connected": connected,
        "avgDurationSec": avg_sec,
        "followUpsSet": follow_ups,
    }


def list_call_log(limit: int = 50, agent_id: str | None = None) -> list[dict[str, Any]]:
    col = get_crm_call_attempts_collection()
    filt: dict[str, Any] = {}
    if agent_id:
        oid = _oid(agent_id)
        if oid:
            filt["agentId"] = oid
    calls = list(col.find(filt).sort("createdAt", -1).limit(max(1, min(limit, 200))))
    if not calls:
        return []
    leads_col = get_crm_leads_collection()
    lead_ids = list({c["leadId"] for c in calls if c.get("leadId")})
    lead_map: dict[Any, dict] = {}
    for doc in leads_col.find({"_id": {"$in": lead_ids}}):
        lead_map[doc["_id"]] = serialize_lead(doc)
    out: list[dict[str, Any]] = []
    for c in calls:
        lid = c.get("leadId")
        lead = lead_map.get(lid) or {}
        status = str(c.get("status") or "initiated")
        out.append(
            {
                "id": str(c["_id"]),
                "leadId": str(lid) if lid else None,
                "leadName": lead.get("fullName") or "Lead",
                "leadMobile": lead.get("mobile"),
                "agentName": c.get("agentName") or "Agent",
                "direction": c.get("direction"),
                "status": status,
                "durationSec": c.get("durationSec"),
                "recordingUrl": c.get("recordingUrl"),
                "createdAt": c.get("createdAt").isoformat() if c.get("createdAt") else None,
            }
        )
    return out


def migrate_contacts_to_crm(limit: int = 500) -> dict[str, Any]:
    from app.db import get_contacts_collection

    migrated = 0
    for c in get_contacts_collection().find().sort("createdAt", -1).limit(limit):
        mobile = c.get("phone") or c.get("mobile")
        email = c.get("email")
        name = c.get("name") or c.get("fullName")
        r = ingest_lead_event(
            event_type="contact.submitted",
            source="contact_us",
            mobile=mobile,
            email=email,
            full_name=name,
            payload={
                "message": c.get("message"),
                "subject": c.get("subject"),
                "legacyContactId": str(c.get("_id")),
            },
            idempotency_key=f"legacy-contact:{c.get('_id')}",
        )
        if r.get("ok"):
            migrated += 1
    return {"ok": True, "migrated": migrated}
