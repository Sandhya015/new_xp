#!/usr/bin/env python3
"""
Send sample Welcome + OTP emails (template QA). Requires working SMTP/SES in .env.

Usage (from repo root or backend/):
  cd backend && ./venv/bin/python scripts/send_sample_transactional_emails.py recipient@example.com

Safety: runs only when FLASK_ENV is development-like OR ALLOW_EMAIL_TEST_SCRIPT=1.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

_env = (os.environ.get("FLASK_ENV") or "").strip().lower()
_allow = (os.environ.get("ALLOW_EMAIL_TEST_SCRIPT") or "").strip().lower() in ("1", "true", "yes")
if _env not in ("development", "dev") and not _allow:
    print(
        "Refusing to send: set FLASK_ENV=development in .env, or run with ALLOW_EMAIL_TEST_SCRIPT=1 once.",
        file=sys.stderr,
    )
    sys.exit(2)

if len(sys.argv) < 2:
    print("Usage: python scripts/send_sample_transactional_emails.py <recipient@email.com>", file=sys.stderr)
    sys.exit(1)

recipient = sys.argv[1].strip()
if "@" not in recipient:
    print("Invalid email address.", file=sys.stderr)
    sys.exit(1)

from app import create_app
from app.email_smtp import send_registration_otp, send_student_welcome

app = create_app()
sample_name = "Sandhya"
sample_otp = "483921"

with app.app_context():
    ok_welcome = send_student_welcome(app.config, sample_name, recipient)
    ok_otp = send_registration_otp(app.config, sample_name, recipient, sample_otp)

print("Welcome email:", "sent" if ok_welcome else "FAILED (check SMTP logs)")
print("OTP sample email:", "sent" if ok_otp else "FAILED (check SMTP logs)")
sys.exit(0 if (ok_welcome and ok_otp) else 1)
