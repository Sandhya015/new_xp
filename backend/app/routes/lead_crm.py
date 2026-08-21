"""Lead CRM REST API."""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from flask import Blueprint, current_app, g, jsonify, request, Response
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.db import get_db, get_users_collection
from app.lead_crm.auth import get_lead_role, require_lead_access
from app.lead_crm.constants import DISPOSITIONS, SOURCE_VIEWS
from app.lead_crm.service import (
    add_note,
    assign_lead,
    agent_workload,
    bulk_assign,
    create_manual_lead,
    crm_summary,
    export_leads_csv,
    get_lead_detail,
    ingest_lead_event,
    list_call_log,
    list_crm_agents,
    list_leads,
    call_log_stats,
    migrate_contacts_to_crm,
    my_day_queue,
    recent_activity,
    round_robin_assign,
    set_disposition,
)
from app.lead_crm.ops import (
    complete_follow_up,
    export_import_template_csv,
    follow_up_stats,
    get_crm_settings,
    import_leads_csv,
    list_audit_log,
    list_follow_up_leads,
    list_import_history,
    log_crm_audit,
    reschedule_follow_up,
    schedule_follow_up,
    update_crm_settings,
)
from app.lead_crm.telecmi import handle_webhook, initiate_outbound_call, list_telecmi_agents, telecmi_status

crm_bp = Blueprint("crm", __name__)


def _admin_panel_allowed_email() -> str:
    return (current_app.config.get("ADMIN_PANEL_ALLOWED_EMAIL") or "admin@xpertintern.com").strip().lower()


def _load_current_user():
    claims = get_jwt() or {}
    uid = get_jwt_identity()
    user = {"id": str(uid) if uid else "", "email": claims.get("email"), "role": claims.get("role"), "leadRole": claims.get("leadRole")}
    if uid and ObjectId.is_valid(str(uid)):
        u = get_users_collection().find_one({"_id": ObjectId(str(uid))}, {"email": 1, "role": 1, "leadRole": 1, "fullName": 1, "name": 1})
        if u:
            user["email"] = u.get("email") or user.get("email")
            user["role"] = u.get("role") or user.get("role")
            user["leadRole"] = u.get("leadRole") or user.get("leadRole")
            user["fullName"] = u.get("fullName") or u.get("name") or user.get("email")
    g.current_user = user
    return user


def _admin_gate():
    claims = get_jwt() or {}
    if claims.get("role") != "admin" or claims.get("admin_portal") is not True:
        return jsonify({"error": "Admin access required", "code": "admin_portal_required"}), 403
    email = (claims.get("email") or "").strip().lower()
    is_super = email == _admin_panel_allowed_email()
    is_crm = bool(claims.get("adminPortalAccess")) or str(claims.get("leadRole") or "") in (
        "agent",
        "manager",
        "super_admin",
    )
    if not is_super and not is_crm:
        return jsonify({"error": "Admin panel access denied"}), 403
    _load_current_user()
    return None


@crm_bp.route("/summary", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def summary():
    err = _admin_gate()
    if err:
        return err
    return jsonify(crm_summary())


@crm_bp.route("/leads", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def leads_list():
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    role = get_lead_role(user)
    assigned = request.args.get("assignedTo")
    if role == "agent":
        assigned = user.get("id")
    limit = min(int(request.args.get("limit") or 20), 200)
    skip = int(request.args.get("skip") or 0)
    page = int(request.args.get("page") or 1)
    if request.args.get("page"):
        skip = (max(page, 1) - 1) * limit
    items, total = list_leads(
        view=request.args.get("view"),
        assigned_to=assigned,
        lifecycle=request.args.get("lifecycle"),
        temperature=request.args.get("temperature"),
        q=request.args.get("q") or request.args.get("search"),
        follow_up_due=request.args.get("followUpDue") == "1",
        limit=limit,
        skip=skip,
    )
    total_pages = max(1, (total + limit - 1) // limit) if total else 1
    return jsonify({
        "items": items,
        "total": total,
        "page": max(page, 1),
        "limit": limit,
        "totalPages": total_pages,
        "views": list(SOURCE_VIEWS.keys()),
    })


@crm_bp.route("/leads", methods=["POST"])
@jwt_required()
@require_lead_access("manager")
def lead_create():
    err = _admin_gate()
    if err:
        return err
    data = request.get_json() or {}
    full_name = (data.get("fullName") or data.get("studentName") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    if not full_name:
        return jsonify({"error": "fullName required"}), 400
    if not mobile:
        return jsonify({"error": "mobile required"}), 400
    r = create_manual_lead(
        full_name=full_name,
        mobile=mobile,
        source=(data.get("source") or "manual.entry").strip(),
        course_id=(data.get("courseId") or "").strip() or None,
        course_title=(data.get("courseTitle") or "").strip() or None,
        actor_id=g.current_user.get("id"),
    )
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r), 201


@crm_bp.route("/overview-extras", methods=["GET"])
@jwt_required()
@require_lead_access("manager")
def overview_extras():
    err = _admin_gate()
    if err:
        return err
    return jsonify({
        "agentWorkload": agent_workload(),
        "recentActivity": recent_activity(8),
    })


@crm_bp.route("/calls", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def calls_log():
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    role = get_lead_role(user)
    agent_id = user.get("id") if role == "agent" else None
    limit = min(int(request.args.get("limit") or 50), 200)
    return jsonify({
        "stats": call_log_stats(agent_id=agent_id),
        "items": list_call_log(limit, agent_id=agent_id),
    })


@crm_bp.route("/leads/<lead_id>", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def lead_get(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    detail = get_lead_detail(lead_id)
    if not detail:
        return jsonify({"error": "Lead not found"}), 404
    user = g.current_user
    if get_lead_role(user) == "agent" and detail["lead"].get("assignedTo") != user.get("id"):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(detail)


@crm_bp.route("/leads/<lead_id>/assign", methods=["POST"])
@jwt_required()
@require_lead_access("manager")
def lead_assign(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    data = request.get_json() or {}
    agent_id = (data.get("agentId") or "").strip()
    if not agent_id:
        return jsonify({"error": "agentId required"}), 400
    actor = g.current_user.get("fullName") or g.current_user.get("email") or "Admin"
    r = assign_lead(lead_id, agent_id, actor)
    if not r.get("ok"):
        return jsonify(r), 400
    log_crm_audit(
        action=f"Lead assigned to agent",
        actor_id=g.current_user.get("id"),
        actor_name=actor,
        meta={"leadId": lead_id, "agentId": agent_id},
        ip=request.remote_addr,
    )
    return jsonify(r)


@crm_bp.route("/leads/export", methods=["GET"])
@jwt_required()
@require_lead_access("manager")
def leads_export():
    err = _admin_gate()
    if err:
        return err
    csv_data = export_leads_csv(
        view=request.args.get("view"),
        assigned_to=request.args.get("assignedTo"),
        lifecycle=request.args.get("lifecycle"),
        temperature=request.args.get("temperature"),
        q=request.args.get("q") or request.args.get("search"),
        follow_up_due=request.args.get("followUpDue") == "1",
    )
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads-export.csv"},
    )


@crm_bp.route("/leads/round-robin-assign", methods=["POST"])
@jwt_required()
@require_lead_access("manager")
def leads_round_robin():
    err = _admin_gate()
    if err:
        return err
    data = request.get_json() or {}
    lead_ids = data.get("leadIds") or []
    agent_ids = data.get("agentIds") or None
    if not lead_ids:
        return jsonify({"error": "leadIds required"}), 400
    actor = g.current_user.get("fullName") or g.current_user.get("email") or "Admin"
    r = round_robin_assign(lead_ids, agent_ids, actor)
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r)


@crm_bp.route("/leads/bulk-assign", methods=["POST"])
@jwt_required()
@require_lead_access("manager")
def leads_bulk_assign():
    err = _admin_gate()
    if err:
        return err
    data = request.get_json() or {}
    lead_ids = data.get("leadIds") or []
    agent_id = (data.get("agentId") or "").strip()
    if not lead_ids or not agent_id:
        return jsonify({"error": "leadIds and agentId required"}), 400
    actor = g.current_user.get("fullName") or g.current_user.get("email") or "Admin"
    return jsonify(bulk_assign(lead_ids, agent_id, actor))


@crm_bp.route("/leads/<lead_id>/disposition", methods=["POST"])
@jwt_required()
@require_lead_access("agent")
def lead_disposition(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    data = request.get_json() or {}
    disposition = (data.get("disposition") or "").strip()
    note = (data.get("note") or "").strip() or None
    follow_raw = data.get("followUpAt")
    follow_up = None
    if follow_raw:
        try:
            follow_up = datetime.fromisoformat(str(follow_raw).replace("Z", "+00:00"))
        except ValueError:
            return jsonify({"error": "Invalid followUpAt"}), 400
    user = g.current_user
    r = set_disposition(
        lead_id,
        disposition,
        follow_up_at=follow_up,
        note=note,
        actor_id=user.get("id"),
        actor_name=user.get("fullName") or user.get("email") or "Agent",
    )
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r)


@crm_bp.route("/leads/<lead_id>/notes", methods=["POST"])
@jwt_required()
@require_lead_access("agent")
def lead_note(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    data = request.get_json() or {}
    body = (data.get("body") or "").strip()
    user = g.current_user
    r = add_note(lead_id, body, user.get("id"), user.get("fullName") or user.get("email") or "Agent")
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r)


@crm_bp.route("/leads/<lead_id>/call", methods=["POST"])
@jwt_required()
@require_lead_access("agent")
def lead_call(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    detail = get_lead_detail(lead_id)
    if not detail:
        return jsonify({"error": "Lead not found"}), 404
    mobile = detail["lead"].get("mobile")
    if not mobile or mobile.startswith("*"):
        return jsonify({"error": "Lead has no callable mobile"}), 400
    user = g.current_user
    telecmi_id = user.get("telecmiAgentId") or None
    telecmi_pwd = user.get("telecmiAgentPassword") or None
    r = initiate_outbound_call(
        lead_id,
        mobile,
        user.get("id"),
        user.get("fullName") or user.get("email") or "Agent",
        agent_telecmi_id=telecmi_id,
        agent_telecmi_password=telecmi_pwd,
    )
    if not r.get("ok"):
        return jsonify(r), 502
    return jsonify(r)


@crm_bp.route("/telecmi/agents", methods=["GET"])
@jwt_required()
@require_lead_access("manager")
def telecmi_agents_route():
    err = _admin_gate()
    if err:
        return err
    return jsonify({"items": list_telecmi_agents()})


@crm_bp.route("/telecmi/status", methods=["GET"])
@jwt_required()
@require_lead_access("manager")
def telecmi_status_route():
    err = _admin_gate()
    if err:
        return err
    return jsonify(telecmi_status())


@crm_bp.route("/my-day", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def my_day():
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    return jsonify(my_day_queue(user.get("id")))


@crm_bp.route("/agents", methods=["GET", "POST"])
@jwt_required()
@require_lead_access("manager")
def agents_list():
    err = _admin_gate()
    if err:
        return err
    if request.method == "POST":
        from app.lead_crm.agents import create_crm_agent, send_agent_welcome_email

        data = request.get_json() or {}
        r = create_crm_agent(
            full_name=data.get("fullName") or data.get("name") or "",
            email=data.get("email") or "",
            mobile=data.get("mobile"),
            telecmi_agent_id=data.get("telecmiAgentId"),
            telecmi_extension=data.get("telecmiExtension"),
            lead_role=data.get("leadRole") or "agent",
            password=data.get("password") or data.get("temporaryPassword"),
            reporting_manager_id=data.get("reportingManagerId"),
            daily_lead_capacity=data.get("dailyLeadCapacity"),
        )
        if not r.get("ok"):
            status = 409 if r.get("error") == "email_exists" else 400
            return jsonify(r), status
        email_sent = send_agent_welcome_email(
            agent_email=r["email"],
            agent_name=r["fullName"],
            password=r["temporaryPassword"],
            lead_role=r["leadRole"],
        )
        log_crm_audit(
            action=f"Added CRM {r['leadRole']} {r['fullName']}",
            actor_id=g.current_user.get("id"),
            actor_name=g.current_user.get("fullName") or g.current_user.get("email") or "Admin",
            meta={"email": r["email"], "emailSent": email_sent},
            ip=request.remote_addr,
        )
        return jsonify(
            {
                "ok": True,
                "agent": {
                    "id": r["id"],
                    "email": r["email"],
                    "fullName": r["fullName"],
                    "leadRole": r["leadRole"],
                },
                "temporaryPassword": r["temporaryPassword"],
                "emailSent": email_sent,
            }
        ), 201
    return jsonify({"items": list_crm_agents()})


@crm_bp.route("/dispositions", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def dispositions_list():
    err = _admin_gate()
    if err:
        return err
    return jsonify({"items": list(DISPOSITIONS)})


@crm_bp.route("/migrate-contacts", methods=["POST"])
@jwt_required()
@require_lead_access("super_admin")
def migrate_contacts():
    err = _admin_gate()
    if err:
        return err
    limit = int((request.get_json() or {}).get("limit") or 500)
    return jsonify(migrate_contacts_to_crm(limit=limit))


@crm_bp.route("/settings", methods=["GET", "PATCH"])
@jwt_required()
@require_lead_access("manager")
def crm_settings_route():
    err = _admin_gate()
    if err:
        return err
    if request.method == "GET":
        return jsonify(get_crm_settings())
    data = request.get_json() or {}
    user = g.current_user
    actor = user.get("fullName") or user.get("email") or "Admin"
    if get_lead_role(user) != "super_admin" and _admin_panel_allowed_email() != (user.get("email") or "").lower():
        allowed_keys = {"emailAlerts", "whatsappAlerts", "overdueFollowUpAlerts"}
        data = {k: v for k, v in data.items() if k in allowed_keys}
    r = update_crm_settings(data, actor_id=user.get("id"), actor_name=actor)
    return jsonify(r)


@crm_bp.route("/audit-log", methods=["GET"])
@jwt_required()
@require_lead_access("manager")
def audit_log_route():
    err = _admin_gate()
    if err:
        return err
    limit = min(int(request.args.get("limit") or 30), 100)
    return jsonify({"items": list_audit_log(limit)})


@crm_bp.route("/follow-ups", methods=["GET"])
@jwt_required()
@require_lead_access("agent")
def follow_ups_list():
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    role = get_lead_role(user)
    assigned = user.get("id") if role == "agent" else request.args.get("assignedTo")
    limit = min(int(request.args.get("limit") or 200), 500)
    return jsonify({
        "items": list_follow_up_leads(assigned_to=assigned, limit=limit),
        "stats": follow_up_stats(assigned_to=assigned if role == "agent" else None),
    })


@crm_bp.route("/leads/<lead_id>/follow-up", methods=["POST", "PATCH"])
@jwt_required()
@require_lead_access("agent")
def follow_up_mutate(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    if get_lead_role(user) == "agent":
        detail = get_lead_detail(lead_id)
        if not detail or detail["lead"].get("assignedTo") != user.get("id"):
            return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    actor = user.get("fullName") or user.get("email") or "Agent"
    follow_raw = data.get("followUpAt")
    if not follow_raw:
        return jsonify({"error": "followUpAt required"}), 400
    try:
        follow_up = datetime.fromisoformat(str(follow_raw).replace("Z", "+00:00"))
    except ValueError:
        return jsonify({"error": "Invalid followUpAt"}), 400
    if request.method == "PATCH":
        r = reschedule_follow_up(
            lead_id,
            follow_up_at=follow_up,
            note=data.get("note"),
            actor_id=user.get("id"),
            actor_name=actor,
        )
    else:
        note = (data.get("note") or "").strip()
        if not note:
            return jsonify({"error": "note required"}), 400
        r = schedule_follow_up(
            lead_id,
            follow_up_at=follow_up,
            note=note,
            actor_id=user.get("id"),
            actor_name=actor,
        )
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r)


@crm_bp.route("/leads/<lead_id>/follow-up/complete", methods=["POST"])
@jwt_required()
@require_lead_access("agent")
def follow_up_complete(lead_id: str):
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    if get_lead_role(user) == "agent":
        detail = get_lead_detail(lead_id)
        if not detail or detail["lead"].get("assignedTo") != user.get("id"):
            return jsonify({"error": "Forbidden"}), 403
    data = request.get_json() or {}
    actor = user.get("fullName") or user.get("email") or "Agent"
    r = complete_follow_up(
        lead_id,
        note=data.get("note"),
        actor_id=user.get("id"),
        actor_name=actor,
    )
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r)


@crm_bp.route("/imports", methods=["GET", "POST"])
@jwt_required()
@require_lead_access("manager")
def imports_route():
    err = _admin_gate()
    if err:
        return err
    user = g.current_user
    actor = user.get("fullName") or user.get("email") or "Admin"
    if request.method == "GET":
        limit = min(int(request.args.get("limit") or 20), 50)
        return jsonify({"items": list_import_history(limit)})
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "empty filename"}), 400
    raw = f.read()
    if not raw:
        return jsonify({"error": "empty file"}), 400
    r = import_leads_csv(
        raw,
        duplicate_mode=request.form.get("duplicateMode") or "update",
        assign_mode=request.form.get("assignMode") or "unassigned",
        actor_id=user.get("id"),
        actor_name=actor,
        filename=f.filename,
    )
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r), 201


@crm_bp.route("/imports/template", methods=["GET"])
@jwt_required()
@require_lead_access("manager")
def import_template():
    err = _admin_gate()
    if err:
        return err
    csv_data = export_import_template_csv()
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=lead-import-template.csv"},
    )


@crm_bp.route("/telecmi/test", methods=["POST"])
@jwt_required()
@require_lead_access("manager")
def telecmi_test_route():
    err = _admin_gate()
    if err:
        return err
    status = telecmi_status()
    ok = bool(status.get("connected") or status.get("ok"))
    user = g.current_user
    log_crm_audit(
        action="TeleCMI connection test",
        actor_id=user.get("id"),
        actor_name=user.get("fullName") or user.get("email") or "Admin",
        meta=status,
    )
    return jsonify({"ok": ok, "status": status})


@crm_bp.route("/telecmi/webhook", methods=["POST"])
def telecmi_webhook():
    """TeleCMI CDR webhook (no JWT — verify signature in production)."""
    if get_db() is None:
        return jsonify({"error": "Service unavailable"}), 503
    payload = request.get_json(silent=True) or {}
    return jsonify(handle_webhook(payload))


@crm_bp.route("/events", methods=["POST"])
def ingest_event_public():
    """
    Internal/public lead event ingestion (contact forms, integrations).
    Optional shared secret via LEAD_EVENT_INGEST_SECRET header.
    """
    if get_db() is None:
        return jsonify({"error": "Service unavailable"}), 503
    secret = current_app.config.get("LEAD_EVENT_INGEST_SECRET") or ""
    if secret:
        hdr = request.headers.get("X-Lead-Ingest-Secret") or ""
        if hdr != secret:
            return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json() or {}
    r = ingest_lead_event(
        event_type=(data.get("eventType") or "").strip(),
        source=(data.get("source") or "api").strip(),
        mobile=data.get("mobile") or data.get("phone"),
        email=data.get("email"),
        full_name=data.get("fullName") or data.get("name"),
        payload=data.get("payload") if isinstance(data.get("payload"), dict) else data,
    )
    if not r.get("ok"):
        return jsonify(r), 400
    return jsonify(r), 201
