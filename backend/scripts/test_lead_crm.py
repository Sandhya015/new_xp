#!/usr/bin/env python3
"""
Lead CRM smoke test — run with backend on http://127.0.0.1:5001

  export ADMIN_PASSWORD='Admin@xpertintern#@'
  python3 scripts/test_lead_crm.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://127.0.0.1:5001").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@xpertintern.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@xpertintern#@")


def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} -> {e.code}: {err}") from e


def main() -> int:
    steps_ok = 0

    print("=== Lead CRM Smoke Test ===\n")

    print("[1] Public callback ingest")
    r = req("POST", "/api/contact/callback", {
        "fullName": "CRM Smoke Test",
        "contactNumber": "9123456789",
        "course": "B.Tech",
        "university": "Test University",
        "message": "Automated smoke test",
    })
    print(f"    OK: {r.get('message', r)[:60]}")
    steps_ok += 1

    print("[2] Admin login")
    auth = req("POST", "/api/auth/admin/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    token = auth.get("token")
    if not token:
        print("    FAIL: no token", auth, file=sys.stderr)
        return 1
    print("    OK: logged in")
    steps_ok += 1

    print("[3] CRM summary + view counts")
    summary = req("GET", "/api/crm/summary", token=token)
    assert "totalOpen" in summary
    print(f"    OK: open={summary['totalOpen']} unassigned={summary['unassigned']} views={len(summary.get('viewCounts') or {})}")
    steps_ok += 1

    print("[4] Paginated lead list (page 1, limit 5)")
    page1 = req("GET", "/api/crm/leads?page=1&limit=5", token=token)
    total = page1.get("total", 0)
    items = page1.get("items") or []
    print(f"    OK: page {page1.get('page')} / {page1.get('totalPages')} — {len(items)} rows, {total} total")
    if not items:
        print("    FAIL: no leads", file=sys.stderr)
        return 1
    steps_ok += 1

    if total > 5:
        print("[5] Pagination page 2")
        page2 = req("GET", "/api/crm/leads?page=2&limit=5", token=token)
        print(f"    OK: page 2 has {len(page2.get('items') or [])} rows")
        steps_ok += 1
    else:
        print("[5] Pagination page 2 — skipped (≤5 leads)")

    lead_id = items[0]["id"]
    print(f"[6] Lead detail ({lead_id[:8]}…)")
    detail = req("GET", f"/api/crm/leads/{lead_id}", token=token)
    print(f"    OK: {len(detail.get('events') or [])} events")
    steps_ok += 1

    print("[7] List agents (for assignment)")
    agents = req("GET", "/api/crm/agents", token=token).get("items") or []
    if not agents:
        print("    FAIL: no agents", file=sys.stderr)
        return 1
    agent_id = agents[0]["id"]
    print(f"    OK: {len(agents)} agent(s), using {agents[0].get('fullName') or agents[0].get('email')}")
    steps_ok += 1

    print("[8] Manual assign lead to agent")
    assign = req("POST", f"/api/crm/leads/{lead_id}/assign", {"agentId": agent_id}, token=token)
    if not assign.get("ok"):
        print("    FAIL:", assign, file=sys.stderr)
        return 1
    print("    OK: assigned")
    steps_ok += 1

    # Pick up to 3 unassigned for bulk/round-robin
    unassigned = req("GET", "/api/crm/leads?assignedTo=unassigned&limit=3", token=token).get("items") or []
    bulk_ids = [x["id"] for x in unassigned[:3]]
    if len(bulk_ids) >= 2:
        print(f"[9] Round-robin assign {len(bulk_ids)} leads")
        rr = req("POST", "/api/crm/leads/round-robin-assign", {"leadIds": bulk_ids}, token=token)
        print(f"    OK: mode={rr.get('mode')} assigned={rr.get('assigned')} failed={rr.get('failed')}")
        steps_ok += 1
    else:
        print("[9] Round-robin — skipped (need 2+ unassigned leads)")

    print("[10] Mock click-to-call")
    call = req("POST", f"/api/crm/leads/{lead_id}/call", token=token)
    print(f"    OK: {call.get('mode') or call.get('message') or 'initiated'}")
    steps_ok += 1

    print("[11] Disposition with note + follow-up")
    from datetime import datetime, timedelta, timezone
    fu = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    disp = req("POST", f"/api/crm/leads/{lead_id}/disposition", {
        "disposition": "followup_specific_time",
        "note": "Smoke test — will call back tomorrow",
        "followUpAt": fu,
    }, token=token)
    if not disp.get("ok"):
        print("    FAIL:", disp, file=sys.stderr)
        return 1
    print("    OK: disposition saved")
    steps_ok += 1

    print("[12] My Day queue")
    myday = req("GET", "/api/crm/my-day", token=token)
    print(f"    OK: followUps={len(myday.get('followUps') or [])} new={len(myday.get('newAssigned') or [])}")
    steps_ok += 1

    print(f"\n=== PASSED ({steps_ok} steps) ===")
    print("\nManual UI test:")
    print("  1. Open http://localhost:5173/admin/leads")
    print("  2. Use pagination at bottom, filters, and view tabs")
    print("  3. Select leads → Assign selected (bulk or round-robin)")
    print("  4. Open a lead → Assign, Call, Disposition")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
