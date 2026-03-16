"""
One-time seed: ensure default admin user exists. Called at app startup when DB is configured.
"""
from datetime import datetime
import bcrypt

from app.db import get_users_collection

ADMIN_EMAIL = "admin@xpertintern.com"
ADMIN_PASSWORD = "Admin@xpertintern"
ADMIN_NAME = "XpertIntern Admin"


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_admin_if_missing() -> None:
    try:
        users = get_users_collection()
        if users.find_one({"email": ADMIN_EMAIL}):
            return
        users.insert_one({
            "email": ADMIN_EMAIL,
            "password": _hash(ADMIN_PASSWORD),
            "name": ADMIN_NAME,
            "role": "admin",
            "createdAt": datetime.utcnow(),
        })
    except Exception:
        pass
