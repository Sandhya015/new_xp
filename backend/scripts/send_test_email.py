#!/usr/bin/env python3
"""
Send one test message using the same SMTP/SES path as registration (email_smtp.send_email).

Usage (from repo root or backend):
  cd backend && python scripts/send_test_email.py you@example.com

Requires backend/.env with SMTP_* (or SES) set like your running API.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from dotenv import load_dotenv

load_dotenv(BACKEND / ".env")

from app import create_app
from app.email_smtp import send_email


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/send_test_email.py <recipient@email.com>", file=sys.stderr)
        print("  Run from the backend folder with .env configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, …).", file=sys.stderr)
        return 2
    to = sys.argv[1].strip()
    if not to or "@" not in to:
        print("Invalid recipient address.", file=sys.stderr)
        return 2

    app = create_app()
    ok = send_email(
        app.config,
        to,
        "XpertIntern — SMTP test",
        "<html><body style=\"font-family:system-ui,sans-serif\"><p>If you see this, outbound mail from this environment is working.</p><p>Sent by <code>scripts/send_test_email.py</code>.</p></body></html>",
    )
    if ok:
        print("OK — email accepted for delivery to", to)
        return 0
    print("FAILED — check logs above (SMTP not configured, auth error, or SES error).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
