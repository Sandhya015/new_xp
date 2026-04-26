"""
WhatsApp OTP sender (best-effort).

Designed for WhatsApp Business Cloud API (Meta Graph). Keep secrets in env vars.
If not configured, functions return False and the caller can continue with email.
"""
from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Optional


def _digits_only(s: str) -> str:
    return re.sub(r"\D", "", str(s or ""))


def normalize_mobile_e164_in(mobile: str) -> Optional[str]:
    """
    Convert a 10-digit Indian mobile (or +91/91 prefixed) to E.164 without '+' for WhatsApp API.
    Returns string like '917004762654' or None if invalid.
    """
    d = _digits_only(mobile)
    if d.startswith("91") and len(d) == 12:
        # already normalized (India country code + 10 digits)
        return d
    elif len(d) == 10:
        return "91" + d
    else:
        return None



def whatsapp_configured() -> bool:
    return bool(
        (os.environ.get("WHATSAPP_TOKEN") or "").strip()
        and (os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or "").strip()
    )


def send_whatsapp_otp(mobile_e164_no_plus: str, otp: str) -> bool:
    """
    Send OTP via WhatsApp Cloud API.
    Requires:
      - WHATSAPP_TOKEN
      - WHATSAPP_PHONE_NUMBER_ID
    Optional:
      - WHATSAPP_OTP_TEMPLATE (default: "xpertintern_otp")
      - WHATSAPP_GRAPH_VERSION (default: "v19.0")

    Note: Template must be approved in your WhatsApp Business account.
    """
    token = (os.environ.get("WHATSAPP_TOKEN") or "").strip()
    phone_id = (os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or "").strip()
    if not token or not phone_id:
        return False

    tpl = (os.environ.get("WHATSAPP_OTP_TEMPLATE") or "xpertintern_otp").strip()
    graph_ver = (os.environ.get("WHATSAPP_GRAPH_VERSION") or "v19.0").strip()
    url = f"https://graph.facebook.com/{graph_ver}/{phone_id}/messages"

    body = {
        "messaging_product": "whatsapp",
        "to": mobile_e164_no_plus,
        "type": "template",
        "template": {
            "name": tpl,
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(otp)}],
                }
            ],
        },
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= int(getattr(resp, "status", 0) or 0) < 300
    except Exception:
        return False

