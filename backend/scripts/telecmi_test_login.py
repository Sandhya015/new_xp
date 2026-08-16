#!/usr/bin/env python3
"""Test TeleCMI agent login — requires TELECMI_AGENT_ID + TELECMI_AGENT_PASSWORD in .env"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.lead_crm.telecmi import get_agent_token, telecmi_status, initiate_outbound_call


def main() -> int:
    agent_id = os.getenv("TELECMI_AGENT_ID", "").strip()
    if not agent_id:
        print("Set TELECMI_AGENT_ID in backend/.env (from CHUB dashboard → Users → Agent ID, e.g. 103_1234567)")
        print("Dashboard email/password is for https://dashboard.telecmi.com — API uses Agent ID + agent password.")
        return 1

    print("Status:", json.dumps(telecmi_status(), indent=2))
    token, meta = get_agent_token(force_refresh=True)
    if not token:
        print("Login FAILED:", meta)
        return 1
    print("Login OK — token prefix:", token[:12] + "...")
    print("Meta:", json.dumps({k: v for k, v in meta.items() if k not in ("detail", "detail2")}, indent=2))

    if len(sys.argv) > 1 and sys.argv[1] == "--call":
        to = sys.argv[2] if len(sys.argv) > 2 else "919123456789"
        r = initiate_outbound_call("test", to, "admin", "Test Agent")
        print("Call test:", json.dumps(r, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
