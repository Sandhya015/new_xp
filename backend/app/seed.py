"""
One-time seed: ensure default admin user and sample courses exist. Called at app startup when DB is configured.
Uses werkzeug hashing to match auth (no bcrypt on Lambda).
Set RESET_ADMIN_PASSWORD=1 in env to force-update existing admin password to ADMIN_PASSWORD (one-time).
"""
import os
from datetime import datetime
from werkzeug.security import generate_password_hash

from app.db import get_users_collection, get_courses_collection

ADMIN_EMAIL = "admin@xpertintern.com"
ADMIN_PASSWORD = "Admin@xpertintern#@"
ADMIN_NAME = "XpertIntern Admin"

DEFAULT_COURSES = [
    {"title": "Full Stack Web Development", "description": "Build dynamic, responsive, and scalable web applications.", "category": "technical", "duration": "4 Weeks", "mode": "Online", "universities": "BEU, SBTE, AKTU", "price": 2499, "tag": "MERN Stack", "active": True},
    {"title": "Artificial Intelligence & Machine Learning", "description": "Comprehensive training in AI & ML covering algorithms and practical applications.", "category": "technical", "duration": "4 Weeks", "mode": "Online", "universities": "AKTU, JUT", "price": 4999, "tag": "AI/ML", "active": True},
    {"title": "Data Science", "description": "Master data analysis, visualization, and machine learning with Python.", "category": "technical", "duration": "4 Weeks", "mode": "Hybrid", "universities": "BEU, AKTU", "price": 3999, "tag": "Python & Analytics", "active": True},
    {"title": "Digital Marketing", "description": "SEO, social media, and campaign management for career-ready skills.", "category": "non-technical", "duration": "4 Weeks", "mode": "Online", "universities": "Patna University", "price": 1499, "tag": "Marketing", "active": True},
    {"title": "Cyber Security", "description": "Ethical hacking, network security, and compliance fundamentals.", "category": "technical", "duration": "4 Weeks", "mode": "Online", "universities": "BEU, SBTE", "price": 3499, "tag": "Security", "active": True},
    {"title": "Cloud & DevOps", "description": "Cloud infrastructure and CI/CD for modern software delivery.", "category": "technical", "duration": "4 Weeks", "mode": "Hybrid", "universities": "AKTU", "price": 2999, "tag": "AWS / DevOps", "active": True},
]


def _hash(password: str) -> str:
    return generate_password_hash(password, method="pbkdf2:sha256")


def seed_admin_if_missing() -> None:
    try:
        users = get_users_collection()
        admin = users.find_one({"email": ADMIN_EMAIL})
        hashed = _hash(ADMIN_PASSWORD)
        if admin:
            if os.environ.get("RESET_ADMIN_PASSWORD", "").strip().lower() in ("1", "true", "yes"):
                users.update_one(
                    {"email": ADMIN_EMAIL},
                    {"$set": {"password": hashed, "name": ADMIN_NAME}},
                )
            return
        users.insert_one({
            "email": ADMIN_EMAIL,
            "password": hashed,
            "name": ADMIN_NAME,
            "role": "admin",
            "createdAt": datetime.utcnow(),
        })
    except Exception:
        pass

    try:
        coll = get_courses_collection()
        if coll.count_documents({}) > 0:
            return
        for c in DEFAULT_COURSES:
            c["createdAt"] = datetime.utcnow()
            coll.insert_one(c)
    except Exception:
        pass
