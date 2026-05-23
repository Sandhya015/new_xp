"""
Cashfree Payments Gateway helpers (Hosted Checkout / Orders API).

Uses urllib (no extra deps). Never log client secret.
Docs: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from typing import Any
from urllib.parse import quote


def cashfree_base_url(env: str) -> str:
    e = (env or "production").strip().lower()
    if e == "sandbox":
        return "https://sandbox.cashfree.com/pg"
    return "https://api.cashfree.com/pg"


def _request_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    body: dict[str, Any] | None,
    timeout_sec: float = 30.0,
) -> tuple[Any | None, int, str]:
    """Return (parsed_json_or_none, status_code, error_message_for_logs)."""
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        if "Content-Type" not in {k.title(): v for k, v in headers.items()}:
            headers = {**headers, "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.getcode()
            if not raw.strip():
                return None, status, ""
            try:
                return json.loads(raw), status, ""
            except json.JSONDecodeError:
                return None, status, f"invalid JSON body: {raw[:200]}"
    except urllib.error.HTTPError as e:
        raw = ""
        try:
            raw = e.read().decode("utf-8")
        except Exception:
            pass
        msg = raw or str(e.reason)
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = None
        return parsed, e.code, msg
    except Exception as e:
        return None, 0, str(e)


def cashfree_create_order(
    *,
    base_url: str,
    api_version: str,
    client_id: str,
    client_secret: str,
    merchant_order_id: str,
    order_amount_rupees: float,
    order_currency: str,
    customer_id: str,
    customer_email: str,
    customer_phone: str,
    customer_name: str,
    return_url: str,
    order_note: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    POST /orders → returns decoded JSON body on success (2xx).
    On failure returns (parsed_error_body_or_none, error_text).
    """
    url = f"{base_url.rstrip('/')}/orders"
    hid = str(uuid.uuid4())
    headers = {
        "Accept": "application/json",
        "x-api-version": api_version,
        "x-client-id": client_id,
        "x-client-secret": client_secret,
        "x-request-id": hid,
    }
    body: dict[str, Any] = {
        "order_id": merchant_order_id,
        "order_amount": round(float(order_amount_rupees), 2),
        "order_currency": (order_currency or "INR").upper(),
        "customer_details": {
            "customer_id": customer_id[:50],
            "customer_email": customer_email[:100],
            "customer_phone": customer_phone[-10:] if len(customer_phone) >= 10 else customer_phone,
            "customer_name": (customer_name or "Customer")[:100],
        },
        "order_meta": {
            "return_url": return_url,
        },
    }
    if order_note:
        body["order_note"] = order_note[:200]
    parsed, status, raw_err = _request_json("POST", url, headers=headers, body=body)
    if 200 <= status < 300 and isinstance(parsed, dict):
        return parsed, None
    detail = ""
    if isinstance(parsed, dict):
        msg = parsed.get("message") or parsed.get("error") or parsed.get("type")
        if isinstance(msg, str):
            detail = msg[:500]
        else:
            detail = json.dumps(parsed)[:500]
    elif raw_err:
        detail = raw_err[:500]
    return None, detail or f"Cashfree create order failed (HTTP {status})"


def cashfree_fetch_order(
    *,
    base_url: str,
    api_version: str,
    client_id: str,
    client_secret: str,
    merchant_order_id: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """GET /orders/{order_id}"""
    oid = quote(merchant_order_id, safe="")
    url = f"{base_url.rstrip('/')}/orders/{oid}"
    headers = {
        "Accept": "application/json",
        "x-api-version": api_version,
        "x-client-id": client_id,
        "x-client-secret": client_secret,
        "x-request-id": str(uuid.uuid4()),
    }
    parsed, status, raw_err = _request_json("GET", url, headers=headers, body=None)
    if status == 200 and isinstance(parsed, dict):
        return parsed, None
    detail = raw_err[:500] if raw_err else f"HTTP {status}"
    if isinstance(parsed, dict):
        m = parsed.get("message") or parsed.get("error")
        if isinstance(m, str):
            detail = m[:500]
    return None, detail
