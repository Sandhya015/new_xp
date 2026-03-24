#!/usr/bin/env python3
"""
Create or update a demo student for local/testing login.
Passwords in MongoDB are hashed — plaintext cannot be "fetched" from DB.

Run from backend/:
  source venv/bin/activate
  set -a && source .env && set +a
  python scripts/ensure_dev_student.py
"""
import os
import sys
from datetime import datetime, timezone

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_root)
os.chdir(backend_root)

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from pymongo import MongoClient
from werkzeug.security import generate_password_hash

# Demo credentials (change after first login in production)
DEMO_EMAIL = "sandhyanaik3249@gmail.com"
DEMO_PASSWORD = "Student@Demo#2026"
DEMO_NAME = "Sandhya Naik"


def main():
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        print("ERROR: MONGODB_URI not set. Use .env in backend/ or export it.")
        sys.exit(1)

    hashed = generate_password_hash(DEMO_PASSWORD, method="pbkdf2:sha256")
    client = MongoClient(uri)
    db = client["xpertintern"]
    users = db["users"]

    users.update_one(
        {"email": DEMO_EMAIL},
        {
            "$set": {
                "email": DEMO_EMAIL,
                "password": hashed,
                "name": DEMO_NAME,
                "role": "student",
                "mobile": "",
            },
            "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
        },
        upsert=True,
    )

    print("Demo student is ready (created or password reset).")
    print("")
    print("  Email:    ", DEMO_EMAIL)
    print("  Password: ", DEMO_PASSWORD)
    print("")
    print("Use the Student login form at /login (not Company).")


if __name__ == "__main__":
    main()
