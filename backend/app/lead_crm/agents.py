"""CRM lead agents — create portal users and assignment emails."""
from __future__ import annotations

import secrets
import string
from typing import Any

from bson import ObjectId
from flask import current_app
from werkzeug.security import generate_password_hash

from app.db import get_users_collection
from app.email_smtp import send_email, smtp_configured


def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def create_crm_agent(
    *,
    full_name: str,
    email: str,
    mobile: str | None = None,
    telecmi_agent_id: str | None = None,
    lead_role: str = "agent",
) -> dict[str, Any]:
    email = email.strip().lower()
    name = full_name.strip()
    if not email or not name:
        return {"ok": False, "error": "name_and_email_required"}

    col = get_users_collection()
    if col.find_one({"email": email}):
        return {"ok": False, "error": "email_exists"}

    temp_password = _gen_password()
    doc = {
        "email": email,
        "fullName": name,
        "name": name,
        "mobile": (mobile or "").strip() or None,
        "role": "admin",
        "leadRole": lead_role if lead_role in ("agent", "manager") else "agent",
        "adminPortalAccess": True,
        "telecmiAgentId": (telecmi_agent_id or "").strip() or None,
        "password": generate_password_hash(temp_password, method="pbkdf2:sha256"),
        "forcePasswordChange": True,
        "accountStatus": "active",
        "createdAt": __import__("datetime").datetime.utcnow(),
    }
    ins = col.insert_one(doc)
    return {
        "ok": True,
        "id": str(ins.inserted_id),
        "email": email,
        "fullName": name,
        "leadRole": doc["leadRole"],
        "temporaryPassword": temp_password,
    }


def send_agent_welcome_email(
    *,
    agent_email: str,
    agent_name: str,
    password: str,
) -> bool:
    cfg = current_app.config
    if not smtp_configured(cfg):
        current_app.logger.warning("SMTP not configured — skip agent welcome email")
        return False
    base = (cfg.get("PUBLIC_APP_URL") or "http://localhost:5173").rstrip("/")
    login_url = f"{base}/admin/login"
    html = f"""
    <p>Hi {agent_name},</p>
    <p>You have been added as a <strong>Lead CRM Agent</strong> on XpertIntern.</p>
    <p><strong>Login URL:</strong> <a href="{login_url}">{login_url}</a></p>
    <p><strong>Email:</strong> {agent_email}<br/>
    <strong>Temporary password:</strong> {password}</p>
    <p>After login, open <strong>Leads → My Day</strong> to work assigned leads (call, disposition, follow-up).</p>
    <p>Please change your password after first login.</p>
    """
    return send_email(
        cfg,
        to=agent_email,
        subject="Your XpertIntern Lead CRM login",
        html_body=html,
    )


def send_lead_assignment_email(
    *,
    agent_email: str,
    agent_name: str,
    lead: dict[str, Any],
    assigned_by: str,
    include_credentials: bool = False,
    password: str | None = None,
) -> bool:
    cfg = current_app.config
    if not smtp_configured(cfg):
        return False
    base = (cfg.get("PUBLIC_APP_URL") or "http://localhost:5173").rstrip("/")
    login_url = f"{base}/admin/login"
    lead_id = lead.get("id") or lead.get("_id")
    profile_url = f"{base}/admin/leads/{lead_id}" if lead_id else login_url

    cred_block = ""
    if include_credentials and password:
        cred_block = f"""
        <p><strong>Your login (first time):</strong><br/>
        Email: {agent_email}<br/>
        Password: {password}</p>
        """
    else:
        cred_block = f'<p>Sign in at <a href="{login_url}">{login_url}</a> with your existing CRM credentials.</p>'

    html = f"""
    <p>Hi {agent_name},</p>
    <p>A new lead has been assigned to you by {assigned_by}.</p>
    <table cellpadding="6" style="border-collapse:collapse;">
      <tr><td><strong>Name</strong></td><td>{lead.get('fullName') or '—'}</td></tr>
      <tr><td><strong>Mobile</strong></td><td>{lead.get('mobile') or '—'}</td></tr>
      <tr><td><strong>Email</strong></td><td>{lead.get('email') or '—'}</td></tr>
      <tr><td><strong>Score</strong></td><td>{lead.get('score') or 0} ({lead.get('temperature') or 'cold'})</td></tr>
      <tr><td><strong>Stage</strong></td><td>{lead.get('lifecycleStage') or 'new'}</td></tr>
      <tr><td><strong>Last event</strong></td><td>{lead.get('lastEventType') or '—'}</td></tr>
    </table>
    {cred_block}
    <p><a href="{profile_url}">Open lead in CRM</a> → use <strong>My Day</strong> or the link above.</p>
    """
    return send_email(
        cfg,
        to=agent_email,
        subject=f"Lead assigned: {lead.get('fullName') or 'New lead'}",
        html_body=html,
    )
