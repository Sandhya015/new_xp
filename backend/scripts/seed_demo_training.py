#!/usr/bin/env python3
"""
Insert one demo training (paid course) with curriculum: 4 lectures + end quiz,
random YouTube URLs, and payment-gated topics (lockedUntilPayment).

Run from backend/:
  source venv/bin/activate
  set -a && source .env && set +a
  python scripts/seed_demo_training.py
  python scripts/seed_demo_training.py --replace
  python scripts/seed_demo_training.py --replace --enroll-email you@example.com
  python scripts/seed_demo_training.py --replace --enroll-email you@example.com --with-payment

Enrollment orderId matches production: internal Mongo id of the orders row
(str(order["_id"])), same as Razorpay verify flow.
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


def _load_normalize_curriculum():
    path = os.path.join(backend_root, "app", "services", "curriculum.py")
    spec = importlib.util.spec_from_file_location("curriculum_seed", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load curriculum module")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.normalize_curriculum

DEMO_SLUG = "demo-ic-engine-seed"
DB_NAME = "xpertintern"


def _mongo_host(uri: str) -> str:
    try:
        return (urlparse(uri).hostname or "").strip() or "(unknown host)"
    except Exception:
        return "(unknown host)"


def _public_seed_course_query() -> dict:
    """Same visibility as GET /api/courses for this slug (active + public listing)."""
    return {
        "$and": [
            {"slug": DEMO_SLUG},
            {"active": True},
            {
                "$or": [
                    {"listingVisibility": {"$exists": False}},
                    {"listingVisibility": "public"},
                ]
            },
        ]
    }

# Real-ish embed URLs (public YouTube). Picked at random per run for lessons + intro.
YT_POOL = [
    "https://www.youtube.com/watch?v=OGVzV1bqEt0",
    "https://www.youtube.com/watch?v=AiTs8cNB0MI",
    "https://www.youtube.com/watch?v=Fa_V9fK89uQ",
    "https://www.youtube.com/watch?v=6_R-mX-SSJc",
    "https://www.youtube.com/watch?v=U9TiGZ4m6Y4",
]


def _pick_urls(n: int) -> list[str]:
    return [random.choice(YT_POOL) for _ in range(n)]


def _raw_curriculum(video_urls: list[str]) -> list[dict]:
    """4 lectures (first two previewable without payment record) + quiz at end."""
    v0, v1, v2, v3 = video_urls[:4]
    return [
        {
            "id": "mod_core",
            "title": "Core syllabus",
            "order": 0,
            "topics": [
                {
                    "id": "lec_1",
                    "title": "IC engine fundamentals",
                    "type": "Lecture",
                    "duration": "25 min",
                    "details": "<p>Working cycles, terminology, and applications.</p>",
                    "lessonVideoUrl": v0,
                    "lessonVideoAttachMode": "url",
                    "lessonPreviewEnabled": True,
                    "lockedUntilPayment": False,
                },
                {
                    "id": "lec_2",
                    "title": "Fuel systems & carburation",
                    "type": "Lecture",
                    "duration": "28 min",
                    "details": "<p>Mixture preparation and delivery to the cylinder.</p>",
                    "lessonVideoUrl": v1,
                    "lessonVideoAttachMode": "url",
                    "lessonPreviewEnabled": True,
                    "lockedUntilPayment": False,
                },
                {
                    "id": "lec_3",
                    "title": "Combustion & knocking",
                    "type": "Lecture",
                    "duration": "32 min",
                    "details": "<p>Octane, cetane, and abnormal combustion.</p>",
                    "lessonVideoUrl": v2,
                    "lessonVideoAttachMode": "url",
                    "lockedUntilPayment": True,
                },
                {
                    "id": "lec_4",
                    "title": "Emissions & aftertreatment",
                    "type": "Lecture",
                    "duration": "30 min",
                    "details": "<p>EGR, catalytic converters, and regulations overview.</p>",
                    "lessonVideoUrl": v3,
                    "lessonVideoAttachMode": "url",
                    "lockedUntilPayment": True,
                },
                {
                    "id": "quiz_final",
                    "title": "End of module assessment",
                    "type": "Quiz",
                    "duration": "20 min",
                    "details": "<p>Answer all questions; passing is set in quiz settings.</p>",
                    "lockedUntilPayment": True,
                    "quizSettings": {
                        "passingGradePercent": "70",
                        "attemptsAllowed": "5",
                        "feedbackMode": "retry",
                    },
                    "quizQuestions": [
                        {
                            "id": "qq1",
                            "title": "Which cycle is most common in modern petrol car engines?",
                            "options": ["Diesel", "Otto", "Stirling", "Brayton"],
                            "correctOptionIndex": 1,
                        },
                        {
                            "id": "qq2",
                            "title": "Knocking in SI engines is primarily related to:",
                            "options": [
                                "Auto-ignition of end gas",
                                "Rich mixture only",
                                "Battery voltage",
                                "Oil viscosity",
                            ],
                            "correctOptionIndex": 0,
                        },
                        {
                            "id": "qq3",
                            "title": "EGR is often used to reduce:",
                            "options": ["CO₂ only", "NOx", "Engine oil pressure", "Brake fade"],
                            "correctOptionIndex": 1,
                        },
                    ],
                },
            ],
        }
    ]


def _course_doc(intro_url: str, curriculum: list) -> dict:
    now = datetime.now(timezone.utc)
    price = 2499
    return {
        "title": "Internal Combustion Engines — Demo (seed)",
        "slug": DEMO_SLUG,
        "description": "Hands-on style demo course: four video lessons and a closing quiz. "
        "Earlier lessons are visible without a paid order on file; later lessons and the quiz stay gated until payment.",
        "shortDescription": "Four lessons + quiz; payment-gated tail content.",
        "fullDescription": "<p>Seeded training for QA of curriculum, video URLs, and paywall flags.</p>",
        "category": "technical",
        "duration": "2 Weeks",
        "durationValue": "2",
        "durationUnit": "weeks",
        "mode": "Online",
        "universities": "Demo University",
        "price": price,
        "originalPrice": 2999,
        "tag": "Mechanical",
        "active": True,
        "listingVisibility": "public",
        "difficulty": "Beginner",
        "trainerName": "Demo Trainer",
        "introVideoUrl": intro_url,
        "featuredImageUrl": "",
        "whatYouWillLearn": [
            "Name the main subsystems of a reciprocating IC engine",
            "Explain why some curriculum topics can be payment-gated",
        ],
        "targetAudience": "Engineering students and demo testers",
        "materialsIncluded": ["PDF outlines (placeholder)"],
        "instructions": "Enroll, open Course Content → Curriculum to see lock states.",
        "trainingTags": ["seed", "demo"],
        "curriculum": curriculum,
        "createdAt": now,
        "updatedAt": now,
        "authorId": "",
        "authorName": "Seed Script",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed one demo paid training with curriculum.")
    parser.add_argument(
        "--replace",
        action="store_true",
        help=f"Remove existing course with slug {DEMO_SLUG} (and related seed enrollments/orders) then reinsert.",
    )
    parser.add_argument(
        "--enroll-email",
        default="",
        help="If set, upsert an enrollment for this student on the seeded course.",
    )
    parser.add_argument(
        "--with-payment",
        action="store_true",
        help="With --enroll-email: also insert a successful order and set enrollment.orderId (unlocks gated topics in UI).",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Only print whether the seed course exists in Mongo and would appear on the public catalog; no writes.",
    )
    args = parser.parse_args()

    uri = (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "").strip()
    if not uri:
        print("ERROR: MONGODB_URI (or MONGO_URI) not set.")
        sys.exit(1)

    if args.status:
        client = MongoClient(uri)
        db = client[DB_NAME]
        courses = db["courses"]
        c = courses.find_one({"slug": DEMO_SLUG})
        print("MongoDB host:", _mongo_host(uri))
        print("Database:", DB_NAME)
        if not c:
            print(f"No course with slug={DEMO_SLUG!r} in this database.")
            sys.exit(2)
        visible = courses.count_documents(_public_seed_course_query()) >= 1
        print("Seed course _id:", str(c["_id"]))
        print("  title:", (c.get("title") or "")[:80])
        print("  active:", c.get("active"))
        print("  listingVisibility:", c.get("listingVisibility", "(missing → public)"))
        print("  matches public /api/courses filter:", visible)
        if not visible:
            print("  Fix: set active=true and listingVisibility to 'public' or omit it.")
        sys.exit(0 if visible else 3)

    if args.with_payment and not args.enroll_email:
        print("ERROR: --with-payment requires --enroll-email.")
        sys.exit(1)

    random.seed()
    urls = _pick_urls(5)
    intro_url = urls[0]
    lesson_urls = urls[1:5]
    normalize_curriculum = _load_normalize_curriculum()
    raw_curriculum = _raw_curriculum(lesson_urls)
    norm, err = normalize_curriculum(raw_curriculum)
    if err or norm is None:
        print("ERROR: curriculum normalization failed:", err)
        sys.exit(1)

    client = MongoClient(uri)
    db = client[DB_NAME]
    courses = db["courses"]
    enrollments = db["enrollments"]
    orders = db["orders"]
    users = db["users"]

    existing = courses.find_one({"slug": DEMO_SLUG})
    if existing and not args.replace:
        print(f"Course already exists (slug={DEMO_SLUG}). Use --replace to recreate.")
        print("  id:", str(existing["_id"]))
        sys.exit(0)

    if existing and args.replace:
        cid = str(existing["_id"])
        enrollments.delete_many({"courseId": cid})
        orders.delete_many({"courseId": cid, "method": "seed_demo"})
        courses.delete_one({"_id": existing["_id"]})
        print("Removed previous seed course and related enrollments / seed orders.")

    doc = _course_doc(intro_url, norm)
    ins = courses.insert_one(doc)
    course_id = str(ins.inserted_id)
    print("Inserted course id:", course_id)
    print("  slug:", DEMO_SLUG)
    print("  introVideoUrl:", intro_url)
    print("  lesson URLs:", ", ".join(lesson_urls))

    email = (args.enroll_email or "").strip().lower()
    if email:
        user = users.find_one({"email": email})
        if not user:
            print("ERROR: No user with email", email)
            sys.exit(1)
        uid = str(user["_id"])
        enrollments.delete_many({"userId": uid, "courseId": course_id})

        order_oid = None
        if args.with_payment:
            amt = float(doc.get("price") or 0)
            order_doc = {
                "userId": uid,
                "courseId": course_id,
                "amount": amt,
                "amountPaise": int(round(amt * 100)),
                "currency": "INR",
                "orderId": f"seed_{secrets.token_hex(16)}",
                "receipt": f"seed_rcpt_{secrets.token_hex(8)}",
                "status": "success",
                "method": "seed_demo",
                "createdAt": datetime.now(timezone.utc),
                "verifiedAt": datetime.now(timezone.utc),
            }
            oins = orders.insert_one(order_doc)
            order_oid = str(oins.inserted_id)
            print("Inserted seed order id (enrollment.orderId):", order_oid)

        enrollments.insert_one(
            {
                "userId": uid,
                "courseId": course_id,
                "orderId": order_oid,
                "status": "active",
                "createdAt": datetime.now(timezone.utc),
            }
        )
        paid = bool(order_oid)
        print("Enrolled:", email, "| paid enrollment (order on file):" if paid else "| enrolled without payment record:", paid)

    vis = courses.count_documents(_public_seed_course_query()) >= 1
    print("Done.")
    print("")
    print("Visibility check (this MongoDB vs your browser):")
    print("  • Catalog / Trainings list uses GET /api/courses — DB host above must match the API’s MONGODB_URI.")
    print("  • If the UI is not localhost, frontend defaults to the deployed API unless frontend/.env sets VITE_API_URL.")
    print("  • Seed course visible to catalog filter:", vis)
    print("  • “My Courses” only lists enrollments — run with --enroll-email (see script header).")
    print("  • After seeding, hard-refresh the Trainings page (or wait a moment); empty catalog responses are not cached long.")


if __name__ == "__main__":
    main()
