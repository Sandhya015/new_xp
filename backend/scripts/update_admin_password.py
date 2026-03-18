#!/usr/bin/env python3
"""
One-off script: update admin user password in MongoDB.
Run from backend/: python scripts/update_admin_password.py
Requires: .env with MONGODB_URI, or set MONGODB_URI in environment.
"""
import os
import sys

# Load .env from backend root
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

ADMIN_EMAIL = "admin@xpertintern.com"
NEW_PASSWORD = "Admin@xpertintern#@"
METHOD = "pbkdf2:sha256"

def main():
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        print("ERROR: MONGODB_URI not set. Set it in .env or environment.")
        sys.exit(1)
    client = MongoClient(uri)
    db = client["xpertintern"]
    users = db["users"]
    hashed = generate_password_hash(NEW_PASSWORD, method=METHOD)
    result = users.update_one(
        {"email": ADMIN_EMAIL},
        {"$set": {"password": hashed}},
    )
    if result.matched_count == 0:
        print(f"No user found with email {ADMIN_EMAIL}. Create admin first (e.g. run app so seed runs).")
        sys.exit(1)
    print(f"Updated password for {ADMIN_EMAIL} (matched_count={result.matched_count}, modified_count={result.modified_count}).")
    print("Admin can now log in with the new password.")

if __name__ == "__main__":
    main()
