"""TeleCMI CHUB integration — agent login, click-to-call, CDR webhooks."""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import urllib.error
import urllib.request

from app.lead_crm.service import ingest_lead_event, record_call_attempt

logger = logging.getLogger(__name__)

UTC = timezone.utc
AGENT_LOGIN_URL = "https://piopiy.telecmi.com/v1/agentLogin"
USER_LOGIN_URL = "https://rest.telecmi.com/v2/user/login"
AGENT_CONNECT_URL = "https://piopiy.telecmi.com/v1/agentConnect"
CLICK2CALL_URL = "https://rest.telecmi.com/v2/click2call"


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def telecmi_configured() -> bool:
    if _env("TELECMI_AGENT_TOKEN"):
        return True
    if _env("TELECMI_AGENT_ID") and _env("TELECMI_AGENT_PASSWORD"):
        return True
    if _env("TELECMI_USER_ID") and _env("TELECMI_USER_PASSWORD"):
        return True
    if _env("TELECMI_APP_ID") and _env("TELECMI_APP_SECRET"):
        return True
    return False


def _telecmi_to_number(mobile: str | None) -> str | None:
    """Format mobile for TeleCMI (91XXXXXXXXXX digits, no +)."""
    if not mobile:
        return None
    digits = re.sub(r"\D", "", mobile)
    if digits.startswith("91") and len(digits) == 12:
        return digits
    if len(digits) == 10 and digits[0] in "6789":
        return f"91{digits}"
    return digits or None


def _http_post(url: str, payload: dict[str, Any], timeout: int = 25) -> dict[str, Any]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"msg": body, "code": e.code}
        parsed["_http_status"] = e.code
        return parsed
    except Exception as exc:
        logger.exception("TeleCMI HTTP POST failed %s", url)
        return {"error": True, "msg": str(exc)}


def _token_cache_get() -> dict[str, Any] | None:
    try:
        from app.db import get_app_settings_collection
        doc = get_app_settings_collection().find_one({"_id": "telecmi_token"})
        if not doc or not doc.get("token"):
            return None
        exp = doc.get("expiresAt")
        if exp and isinstance(exp, datetime) and exp.replace(tzinfo=UTC) <= datetime.now(UTC):
            return None
        return doc
    except Exception:
        return None


def _token_cache_set(token: str, agent_meta: dict[str, Any] | None = None) -> None:
    try:
        from app.db import get_app_settings_collection
        get_app_settings_collection().update_one(
            {"_id": "telecmi_token"},
            {
                "$set": {
                    "token": token,
                    "agent": agent_meta or {},
                    "expiresAt": datetime.now(UTC) + timedelta(days=25),
                    "updatedAt": datetime.now(UTC),
                }
            },
            upsert=True,
        )
    except Exception:
        logger.exception("TeleCMI token cache write failed")


def get_agent_token(
    *,
    agent_id: str | None = None,
    agent_password: str | None = None,
    force_refresh: bool = False,
) -> tuple[str | None, dict[str, Any]]:
    """Return cached or freshly fetched TeleCMI agent/user token."""
    static = _env("TELECMI_AGENT_TOKEN")
    if static:
        return static, {"source": "env_token"}

    if not force_refresh:
        cached = _token_cache_get()
        if cached:
            return cached["token"], {"source": "cache", "agent": cached.get("agent") or {}}

    aid = agent_id or _env("TELECMI_AGENT_ID") or _env("TELECMI_USER_ID")
    pwd = agent_password or _env("TELECMI_AGENT_PASSWORD") or _env("TELECMI_USER_PASSWORD")
    if not aid or not pwd:
        return None, {"error": "missing_agent_credentials"}

    # Try CHUB agent login first (India)
    resp = _http_post(AGENT_LOGIN_URL, {"id": aid, "password": pwd})
    token = resp.get("token")
    if token and resp.get("code") == 200:
        _token_cache_set(token, resp.get("agent") if isinstance(resp.get("agent"), dict) else {})
        return token, {"source": "agentLogin", "agent": resp.get("agent") or {}}

    # Fallback: rest user login
    resp2 = _http_post(USER_LOGIN_URL, {"id": aid, "password": pwd})
    token2 = resp2.get("token")
    if token2 and resp2.get("code") == 200:
        _token_cache_set(token2, resp2.get("agent") if isinstance(resp2.get("agent"), dict) else {})
        return token2, {"source": "userLogin", "agent": resp2.get("agent") or {}}

    return None, {"error": resp.get("msg") or resp2.get("msg") or "login_failed", "detail": resp, "detail2": resp2}


def list_telecmi_agents() -> list[dict[str, Any]]:
    """Discover agents via App ID + Secret (extensions 101–120)."""
    app_id = _env("TELECMI_APP_ID")
    secret = _env("TELECMI_APP_SECRET")
    if not app_id or not secret:
        return []
    try:
        app_num = int(app_id)
    except ValueError:
        return []
    out: list[dict[str, Any]] = []
    for ext in range(100, 121):
        aid = f"{ext}_{app_num}"
        resp = _http_post(
            "https://piopiy.telecmi.com/v1/agent/get",
            {"appid": app_num, "secret": secret, "id": aid},
        )
        agent = resp.get("agent") if isinstance(resp.get("agent"), dict) else None
        if agent:
            out.append(
                {
                    "agentId": agent.get("agent_id") or aid,
                    "name": agent.get("name"),
                    "extension": agent.get("extension"),
                    "phone": agent.get("phone"),
                }
            )
    return out


def telecmi_status() -> dict[str, Any]:
    configured = telecmi_configured()
    out: dict[str, Any] = {
        "configured": configured,
        "hasAgentId": bool(_env("TELECMI_AGENT_ID") or _env("TELECMI_USER_ID")),
        "hasAgentPassword": bool(_env("TELECMI_AGENT_PASSWORD") or _env("TELECMI_USER_PASSWORD")),
        "hasStaticToken": bool(_env("TELECMI_AGENT_TOKEN")),
        "hasAppCredentials": bool(_env("TELECMI_APP_ID") and _env("TELECMI_APP_SECRET")),
    }
    if configured:
        token, meta = get_agent_token()
        out["tokenOk"] = bool(token)
        out["loginMeta"] = {k: v for k, v in meta.items() if k != "detail" and k != "detail2"}
        if not token:
            out["loginError"] = meta.get("error")
        out["telecmiAgents"] = list_telecmi_agents()
    return out


def initiate_outbound_call(
    lead_id: str,
    to_mobile: str,
    agent_id: str,
    agent_name: str,
    *,
    agent_telecmi_id: str | None = None,
    agent_telecmi_password: str | None = None,
) -> dict[str, Any]:
    """Initiate TeleCMI click-to-call; falls back to mock when not configured."""
    to_digits = _telecmi_to_number(to_mobile)
    if not to_digits:
        return {"ok": False, "error": "invalid_mobile"}

    if not telecmi_configured():
        r = record_call_attempt(
            lead_id,
            direction="outbound",
            status="mock_ringing",
            telecmi_call_id=f"mock-{uuid.uuid4().hex[:12]}",
            agent_id=agent_id,
            agent_name=agent_name,
        )
        return {
            "ok": True,
            "mode": "mock",
            "message": "TeleCMI not configured — set TELECMI_AGENT_ID + TELECMI_AGENT_PASSWORD in .env",
            **r,
        }

    token, login_meta = get_agent_token(
        agent_id=agent_telecmi_id,
        agent_password=agent_telecmi_password,
    )
    if not token:
        return {
            "ok": False,
            "error": "telecmi_login_failed",
            "detail": login_meta.get("error"),
            "hint": "TeleCMI API needs Agent ID (e.g. 103_1234567) from CHUB dashboard, not dashboard email.",
        }

    extra = json.dumps({"leadId": lead_id, "crm": "true"})
    resp = _http_post(
        AGENT_CONNECT_URL,
        {
            "token": token,
            "to": to_digits,
            "extra_params": extra,
        },
    )

    # Some accounts use rest click2call instead
    if resp.get("code") not in (200, "200") and resp.get("error"):
        resp = _http_post(
            CLICK2CALL_URL,
            {
                "token": token,
                "to": int(to_digits),
                "extra_params": {"leadId": lead_id, "crm": "true"},
            },
        )

    request_id = (
        resp.get("request_id")
        or resp.get("requestId")
        or resp.get("cmiuuid")
        or f"telecmi-{uuid.uuid4().hex[:12]}"
    )
    code = resp.get("code")
    if code not in (200, "200") and resp.get("error"):
        return {
            "ok": False,
            "error": "telecmi_call_failed",
            "detail": resp.get("msg") or resp,
        }

    r = record_call_attempt(
        lead_id,
        direction="outbound",
        status="initiated",
        telecmi_call_id=str(request_id),
        agent_id=agent_id,
        agent_name=agent_name,
    )
    return {
        "ok": True,
        "mode": "telecmi",
        "message": resp.get("msg") or "Call initiated",
        "requestId": request_id,
        "telecmiResponse": {k: v for k, v in resp.items() if not str(k).startswith("_")},
        **r,
    }


def _recording_url(filename: str | None) -> str | None:
    if not filename:
        return None
    base = _env("TELECMI_RECORDING_BASE_URL").rstrip("/")
    if base:
        return f"{base}/{filename.lstrip('/')}"
    return filename


def handle_webhook(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Process TeleCMI CDR webhook (outbound/inbound).
    Configure in CHUB: Settings → Webhooks → POST → /api/crm/telecmi/webhook
    """
    from app.db import get_crm_call_attempts_collection

    if not payload:
        return {"ok": False, "error": "empty_payload"}

    call_id = (
        payload.get("request_id")
        or payload.get("requestId")
        or payload.get("call_id")
        or payload.get("callId")
        or payload.get("cmiuuid")
        or payload.get("_id")
    )
    status = (payload.get("status") or payload.get("call_status") or "completed").lower()
    duration = (
        payload.get("answeredsec")
        or payload.get("billedsec")
        or payload.get("duration")
        or payload.get("billsec")
    )
    filename = payload.get("filename") or payload.get("record_file")
    recording = _recording_url(filename if isinstance(filename, str) else None)
    direction = (payload.get("direction") or "outbound").lower()

    col = get_crm_call_attempts_collection()
    if call_id:
        col.update_one(
            {"telecmiCallId": str(call_id)},
            {
                "$set": {
                    "status": status,
                    "durationSec": duration,
                    "recordingUrl": recording,
                    "cdrPayload": payload,
                    "updatedAt": datetime.now(UTC),
                }
            },
        )

    # Inbound / missed → create or update lead
    if direction == "inbound" or payload.get("type") == "cdr" and direction != "outbound":
        from_num = payload.get("from") or payload.get("caller") or payload.get("customer")
        if from_num:
            mobile = str(from_num)
            ingest_lead_event(
                event_type="inbound.call",
                source="inbound",
                mobile=mobile,
                payload={
                    "telecmiCallId": str(call_id) if call_id else None,
                    "status": status,
                    "durationSec": duration,
                },
                idempotency_key=f"inbound:{call_id or mobile}:{payload.get('time')}",
            )

    # Attach CDR to lead if extra_params contains leadId
    lead_id = None
    extra = payload.get("extra_params") or payload.get("custom")
    if isinstance(extra, str):
        try:
            extra_obj = json.loads(extra)
            lead_id = extra_obj.get("leadId")
        except json.JSONDecodeError:
            pass
    elif isinstance(extra, dict):
        lead_id = extra.get("leadId")

    if lead_id and call_id:
        ingest_lead_event(
            event_type=f"call.{status}",
            source="telecmi",
            payload={"callId": str(call_id), "status": status, "durationSec": duration},
            idempotency_key=f"cdr:{call_id}:{status}",
            lead_id=str(lead_id),
        )

    return {"ok": True, "callId": str(call_id) if call_id else None, "status": status}
