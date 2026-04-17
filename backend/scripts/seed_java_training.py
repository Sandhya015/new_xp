#!/usr/bin/env python3
"""
Seed a free "Java Programming" demo course: 3 modules, YouTube + external links,
one closing quiz, cover image path pointing at frontend public assets.

Run from backend/:
  set -a && source .env && set +a
  python scripts/seed_java_training.py --replace
  python scripts/seed_java_training.py --status
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import random
import secrets
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(backend_root)

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

from pymongo import MongoClient

JAVA_SLUG = "demo-java-programming-seed"
DB_NAME = "xpertintern"
# Served from frontend `public/` (same origin as the app).
FEATURED_IMAGE = "/images/hero-xpertintern.png"


def _mongo_host(uri: str) -> str:
    try:
        return (urlparse(uri).hostname or "").strip() or "(unknown host)"
    except Exception:
        return "(unknown host)"


def _load_normalize_curriculum():
    path = os.path.join(backend_root, "app", "services", "curriculum.py")
    spec = importlib.util.spec_from_file_location("curriculum_seed_java", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load curriculum module")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.normalize_curriculum


def _public_java_course_query() -> dict:
    return {
        "$and": [
            {"slug": JAVA_SLUG},
            {
                "$or": [
                    {"active": True},
                    {"active": {"$exists": False}},
                ]
            },
            {
                "$or": [
                    {"listingVisibility": {"$exists": False}},
                    {"listingVisibility": "public"},
                ]
            },
        ]
    }


MEDIA_POOL = [
    "https://www.youtube.com/watch?v=eIrMbAQSU34",
    "https://www.youtube.com/watch?v=Z8z3k4eiRf0",
    "https://www.youtube.com/watch?v=xk4_1vDrzzo",
    "https://www.youtube.com/watch?v=grEKMHGYyns",
    "https://dev.java/learn/",
    "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/index.html",
]


def _pick_media() -> str:
    return random.choice(MEDIA_POOL)


def _lecture(tid: str, title: str, duration: str, preview: bool = False) -> dict:
    return {
        "id": tid,
        "title": title,
        "type": "Lecture",
        "duration": duration,
        "details": f"<p>Introductory material. Follow along with the linked resource.</p>",
        "lessonVideoAttachMode": "url",
        "lessonVideoUrl": _pick_media(),
        "lessonPreviewEnabled": preview,
        "lockedUntilPayment": False,
    }


def _reading(tid: str, title: str, duration: str) -> dict:
    return {
        "id": tid,
        "title": title,
        "type": "Reading",
        "duration": duration,
        "details": (
            "<p>Official and community resources:</p><ul>"
            '<li><a href="https://docs.oracle.com/javase/tutorial/" target="_blank" rel="noopener">Oracle Java Tutorials</a></li>'
            '<li><a href="https://dev.java/learn/" target="_blank" rel="noopener">dev.java — Learn</a></li>'
            "</ul>"
        ),
    }


def _raw_curriculum() -> list[dict]:
    return [
        {
            "id": "java_mod_1",
            "title": "Java platform & syntax basics",
            "order": 0,
            "topics": [
                _lecture("java_m1_t1", "JDK, JRE, and your first program", "35 min", preview=True),
                _lecture("java_m1_t2", "Variables, operators, and control flow", "40 min", preview=True),
            ],
        },
        {
            "id": "java_mod_2",
            "title": "Classes, objects, and collections",
            "order": 1,
            "topics": [
                _lecture("java_m2_t1", "OOP: classes, encapsulation, inheritance", "45 min"),
                _reading("java_m2_t2", "Java language & API reading list", "20 min"),
            ],
        },
        {
            "id": "java_mod_3",
            "title": "Robust programs & assessment",
            "order": 2,
            "topics": [
                _lecture("java_m3_t1", "Exceptions, try-with-resources, and I/O basics", "38 min"),
                {
                    "id": "java_m3_quiz",
                    "title": "Module wrap-up quiz",
                    "type": "Quiz",
                    "duration": "25 min",
                    "details": "<p>Check your understanding of core Java concepts from this course.</p>",
                    "lockedUntilPayment": False,
                    "quizSettings": {
                        "passingGradePercent": "60",
                        "attemptsAllowed": "10",
                        "feedbackMode": "retry",
                    },
                    "quizQuestions": [
                        {
                            "id": "jq1",
                            "title": "Which keyword declares a class in Java?",
                            "options": ["struct", "class", "def", "function"],
                            "correctOptionIndex": 1,
                        },
                        {
                            "id": "jq2",
                            "title": "What is the entry point method signature for a runnable Java application?",
                            "options": [
                                "public static void main(String[] args)",
                                "public void start(String[] argv)",
                                "static main()",
                                "void main(String args)",
                            ],
                            "correctOptionIndex": 0,
                        },
                        {
                            "id": "jq3",
                            "title": "Which collection type stores key-value pairs?",
                            "options": ["ArrayList", "HashMap", "HashSet", "Queue"],
                            "correctOptionIndex": 1,
                        },
                    ],
                },
            ],
        },
    ]


def _course_doc(intro_url: str, curriculum: list) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "title": "Java Programming — Introductory (seed)",
        "slug": JAVA_SLUG,
        "description": "Free seeded course: three modules with video and reading resources plus a short quiz. "
        "Use it to test catalog cards, lesson preview, and curriculum layout.",
        "shortDescription": "Free · 3 modules · Java basics to quiz",
        "fullDescription": "<p>Hands-on style overview of Java for QA and demos. Price is zero so previews and enrollment behave as a free program.</p>",
        "category": "technical",
        "duration": "3 Weeks",
        "durationValue": "3",
        "durationUnit": "weeks",
        "mode": "Online",
        "universities": "BEU, AKTU",
        "price": 0,
        "originalPrice": 0,
        "tag": "Java",
        "active": True,
        "listingVisibility": "public",
        "difficulty": "Beginner",
        "trainerName": "Demo Java Trainer",
        "introVideoUrl": intro_url,
        "featuredImageUrl": FEATURED_IMAGE,
        "whatYouWillLearn": [
            "Compile and run a simple Java program",
            "Model data with classes and use core collections",
            "Handle errors with exceptions and optional resources",
        ],
        "targetAudience": "Beginners and anyone validating the training UI",
        "materialsIncluded": ["Sample outlines (seed)"],
        "instructions": "Enroll for free, open course content, and try lesson preview where enabled.",
        "trainingTags": ["seed", "java", "free"],
        "curriculum": curriculum,
        "createdAt": now,
        "updatedAt": now,
        "authorId": "",
        "authorName": "Seed Script (Java)",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed free Java Programming demo course.")
    parser.add_argument("--replace", action="store_true", help=f"Remove existing slug {JAVA_SLUG} and reinsert.")
    parser.add_argument(
        "--enroll-email",
        default="",
        help="Optional: create a free enrollment for this student (orderId omitted).",
    )
    parser.add_argument("--status", action="store_true", help="Read-only: catalog visibility for Java seed slug.")
    args = parser.parse_args()

    uri = (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "").strip()
    if not uri:
        print("ERROR: MONGODB_URI (or MONGO_URI) not set.")
        sys.exit(1)

    if args.status:
        client = MongoClient(uri)
        db = client[DB_NAME]
        courses = db["courses"]
        c = courses.find_one({"slug": JAVA_SLUG})
        print("MongoDB host:", _mongo_host(uri))
        print("Database:", DB_NAME)
        if not c:
            print(f"No course with slug={JAVA_SLUG!r}.")
            sys.exit(2)
        visible = courses.count_documents(_public_java_course_query()) >= 1
        print("Course _id:", str(c["_id"]))
        print("  title:", (c.get("title") or "")[:80])
        print("  price:", c.get("price"))
        print("  featuredImageUrl:", (c.get("featuredImageUrl") or "")[:120])
        print("  matches public catalog filter:", visible)
        sys.exit(0 if visible else 3)

    random.seed()
    intro_url = _pick_media()
    normalize_curriculum = _load_normalize_curriculum()
    raw = _raw_curriculum()
    norm, err = normalize_curriculum(raw)
    if err or norm is None:
        print("ERROR: curriculum normalization failed:", err)
        sys.exit(1)

    client = MongoClient(uri)
    db = client[DB_NAME]
    courses = db["courses"]
    enrollments = db["enrollments"]
    users = db["users"]

    existing = courses.find_one({"slug": JAVA_SLUG})
    if existing and not args.replace:
        print(f"Course already exists (slug={JAVA_SLUG}). Use --replace to recreate.")
        print("  id:", str(existing["_id"]))
        sys.exit(0)

    if existing and args.replace:
        cid = str(existing["_id"])
        enrollments.delete_many({"courseId": cid})
        db["orders"].delete_many({"courseId": cid, "method": "seed_java"})
        courses.delete_one({"_id": existing["_id"]})
        print("Removed previous Java seed course and related enrollments / seed orders.")

    doc = _course_doc(intro_url, norm)
    ins = courses.insert_one(doc)
    course_id = str(ins.inserted_id)
    print("Inserted Java course id:", course_id)
    print("  slug:", JAVA_SLUG)
    print("  price: 0 (free)")
    print("  featuredImageUrl:", FEATURED_IMAGE)
    print("  introVideoUrl:", intro_url)

    email = (args.enroll_email or "").strip().lower()
    if email:
        user = users.find_one({"email": email})
        if not user:
            print("ERROR: No user with email", email)
            sys.exit(1)
        uid = str(user["_id"])
        enrollments.delete_many({"userId": uid, "courseId": course_id})
        enrollments.insert_one(
            {
                "userId": uid,
                "courseId": course_id,
                "orderId": None,
                "status": "active",
                "createdAt": datetime.now(timezone.utc),
            }
        )
        print("Enrolled (free):", email)

    vis = courses.count_documents(_public_java_course_query()) >= 1
    print("Done. Public catalog visible:", vis)


if __name__ == "__main__":
    main()
