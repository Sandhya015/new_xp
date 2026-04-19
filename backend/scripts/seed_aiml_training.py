#!/usr/bin/env python3
"""
Seed a free, public AIML foundations course with fixed YouTube intro + two module lessons,
module quizzes (curriculum), and an AIML completion quiz (Quizzes tab).

Run from backend/:
  set -a && source .env && set +a
  python scripts/seed_aiml_training.py --replace
  python scripts/seed_aiml_training.py --replace --enroll-email student@example.com
  python scripts/seed_aiml_training.py --status

Intro (course header): https://www.youtube.com/watch?v=8WzSEikpHk8
Module 1 lesson:       https://www.youtube.com/watch?v=t9MJ1gxcJ4w&t=680s
Module 2 lesson:       https://www.youtube.com/watch?v=oGdt3tzo074
"""
from __future__ import annotations

import argparse
import importlib.util
import os
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

AIML_SLUG = "aiml-foundations-seed"
DB_NAME = "xpertintern"
FEATURED_IMAGE = "/images/hero-xpertintern.png"

INTRO_VIDEO_URL = "https://www.youtube.com/watch?v=8WzSEikpHk8"
MODULE1_LESSON_URL = "https://www.youtube.com/watch?v=t9MJ1gxcJ4w&t=680s"
MODULE2_LESSON_URL = "https://www.youtube.com/watch?v=oGdt3tzo074"


def _mongo_host(uri: str) -> str:
    try:
        return (urlparse(uri).hostname or "").strip() or "(unknown host)"
    except Exception:
        return "(unknown host)"


def _load_normalize_curriculum():
    path = os.path.join(backend_root, "app", "services", "curriculum.py")
    spec = importlib.util.spec_from_file_location("curriculum_seed_aiml", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load curriculum module")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.normalize_curriculum


def _public_aiml_course_query() -> dict:
    return {
        "$and": [
            {"slug": AIML_SLUG},
            {"$or": [{"active": True}, {"active": {"$exists": False}}]},
            {"$or": [{"listingVisibility": {"$exists": False}}, {"listingVisibility": "public"}]},
        ]
    }


def _raw_curriculum() -> list[dict]:
    return [
        {
            "id": "aiml_mod1",
            "title": "Module 1 — Machine learning foundations",
            "order": 0,
            "topics": [
                {
                    "id": "aiml_m1_lesson",
                    "title": "Supervised learning & evaluation",
                    "type": "Lecture",
                    "duration": "50 min",
                    "details": "<p>How labeled data drives learning, train/validation thinking, and avoiding overfitting at a conceptual level.</p>",
                    "lessonVideoAttachMode": "url",
                    "lessonVideoUrl": MODULE1_LESSON_URL,
                    "lessonContent": (
                        "<h3>What you will do in this lesson</h3>"
                        "<ul>"
                        "<li>Relate <strong>features</strong> and <strong>labels</strong> to real prediction tasks</li>"
                        "<li>See why we reserve held-out data to judge generalization</li>"
                        "<li>Build intuition for <strong>bias vs variance</strong> and overfitting</li>"
                        "</ul>"
                        "<p>Use the video timeline if your instructor referenced a specific segment; the embed starts at the seeded chapter when supported.</p>"
                    ),
                    "lessonPreviewEnabled": True,
                },
                {
                    "id": "aiml_m1_quiz",
                    "title": "Module 1 — Knowledge check",
                    "type": "Quiz",
                    "duration": "15 min",
                    "details": "<p>Quick checks on terminology from Module 1 (study aid; completion scoring is via the Quizzes tab).</p>",
                    "quizSettings": {
                        "passingGradePercent": "70",
                        "attemptsAllowed": "10",
                        "feedbackMode": "retry",
                    },
                    "quizQuestions": [
                        {
                            "id": "aiml_m1_q1",
                            "title": "Supervised learning examples include:",
                            "options": [
                                "Spam detection with labeled email",
                                "Clustering customers without labels",
                                "Dimensionality reduction only",
                                "Random number generation",
                            ],
                            "correctOptionIndex": 0,
                        },
                        {
                            "id": "aiml_m1_q2",
                            "title": "A validation set is primarily used to:",
                            "options": [
                                "Train with more epochs always",
                                "Tune models and estimate performance on unseen data",
                                "Remove labels from the dataset",
                                "Guarantee 100% test accuracy",
                            ],
                            "correctOptionIndex": 1,
                        },
                        {
                            "id": "aiml_m1_q3",
                            "questionType": "true_false",
                            "title": "More model complexity always improves real-world performance.",
                            "tfCorrect": False,
                            "marks": 1,
                        },
                    ],
                },
            ],
        },
        {
            "id": "aiml_mod2",
            "title": "Module 2 — Neural networks essentials",
            "order": 1,
            "topics": [
                {
                    "id": "aiml_m2_lesson",
                    "title": "From linear models to neural nets",
                    "type": "Lecture",
                    "duration": "55 min",
                    "details": "<p>Layers, activations, and how depth helps with non-linear patterns—without diving into production training infrastructure.</p>",
                    "lessonVideoAttachMode": "url",
                    "lessonVideoUrl": MODULE2_LESSON_URL,
                    "lessonContent": (
                        "<h3>Key ideas</h3>"
                        "<ol>"
                        "<li>Stacking linear blocks alone is still linear—<strong>non-linear activations</strong> matter</li>"
                        "<li>Depth trades off expressiveness with data and compute needs</li>"
                        "<li>Training uses gradients; stable practice matters in real systems</li>"
                        "</ol>"
                    ),
                },
                {
                    "id": "aiml_m2_quiz",
                    "title": "Module 2 — Knowledge check",
                    "type": "Quiz",
                    "duration": "15 min",
                    "details": "<p>High-level checks on neural network concepts from Module 2.</p>",
                    "quizSettings": {
                        "passingGradePercent": "70",
                        "attemptsAllowed": "10",
                        "feedbackMode": "retry",
                    },
                    "quizQuestions": [
                        {
                            "id": "aiml_m2_q1",
                            "title": "Which component introduces non-linearity in a typical feed-forward network?",
                            "options": ["Activation functions", "Only batch size", "CSV export", "Learning rate schedule only"],
                            "correctOptionIndex": 0,
                        },
                        {
                            "id": "aiml_m2_q2",
                            "title": "Vanishing gradients can become more problematic when:",
                            "options": [
                                "Networks are very deep without careful initialization / architecture choices",
                                "Datasets are small only",
                                "Learning rate is zero",
                                "You use a confusion matrix",
                            ],
                            "correctOptionIndex": 0,
                        },
                    ],
                },
            ],
        },
    ]


def _course_doc(curriculum: list) -> dict:
    now = datetime.now(timezone.utc)
    short_plain = (
        "Professional AIML foundations: supervised learning, evaluation, and neural network essentials. "
        "Two video modules, checkpoints, free enrollment, and a completion quiz."
    )
    if len(short_plain) > 300:
        short_plain = short_plain[:297] + "…"

    full_html = """
<h2>About this program</h2>
<p>This seeded <strong>Artificial Intelligence &amp; Machine Learning</strong> track is designed for learners who want a
structured first pass: how supervised learning works, how we judge models responsibly, and how neural networks extend
linear ideas with depth and non-linearity.</p>

<h3>Format</h3>
<ul>
  <li><strong>Intro video</strong> on the course page (same YouTube URL stored as <code>introVideoUrl</code>)</li>
  <li><strong>Two modules</strong>, each with a primary lesson video plus a short curriculum quiz for self-check</li>
  <li><strong>Completion quiz</strong> in the learner portal (Quizzes tab) for certificate eligibility where enabled</li>
</ul>

<h3>Outcomes</h3>
<ul>
  <li>Explain supervised learning problems using features and labels</li>
  <li>Describe why validation data supports better generalization estimates</li>
  <li>Recognize overfitting and levers that reduce it at a high level</li>
  <li>Summarize the role of activations and depth in neural networks</li>
</ul>

<p><em>Note: This document is seeded for QA of enrollment, curriculum playback, and quizzes. Swap URLs or copy in Admin when you ship a production variant.</em></p>
""".strip()

    desc_plain = (
        "AIML foundations (seed): supervised learning, evaluation, neural network essentials, two YouTube modules, "
        "free enrollment, completion quiz."
    )

    return {
        "title": "Artificial Intelligence & Machine Learning — Foundations (seed)",
        "slug": AIML_SLUG,
        "description": desc_plain,
        "shortDescription": short_plain,
        "fullDescription": full_html,
        "category": "technical",
        "duration": "4 Weeks",
        "durationValue": "4",
        "durationUnit": "weeks",
        "mode": "Online",
        "universities": "AKTU, BEU, JUT",
        "courses": ["B.Tech"],
        "streams": ["CSE"],
        "subjects": ["AI & ML"],
        "price": 0,
        "originalPrice": 0,
        "fee": 0,
        "tag": "AI/ML",
        "active": True,
        "listingVisibility": "public",
        "difficulty": "Intermediate",
        "trainerName": "XpertIntern Faculty (seed)",
        "introVideoUrl": INTRO_VIDEO_URL,
        "featuredImageUrl": FEATURED_IMAGE,
        "whatYouWillLearn": [
            "Frame supervised learning tasks with clear features and labels",
            "Use train/validation thinking to judge generalization responsibly",
            "Describe overfitting and high-level mitigation strategies",
            "Explain why activations and depth matter in neural networks",
            "Interpret precision/recall tradeoffs at a conceptual level",
        ],
        "targetAudience": "Engineering students and early-career developers exploring AIML roles.",
        "materialsIncluded": ["Curriculum outlines (seed)", "Checkpoint quizzes in the learner portal"],
        "instructions": "Use Chrome or Edge for best video playback. Complete the Quizzes tab assessment to validate certificate flow when enabled.",
        "trainingTags": ["aiml", "seed", "machine-learning", "free"],
        "curriculum": curriculum,
        "quizzes": [
            {"title": "AIML completion quiz", "dueDate": "", "description": "Pass to unlock certificate generation when mail and Razorpay flows are configured."},
            {"title": "Module checkpoints", "dueDate": "", "description": "Study quizzes embedded per module in the Curriculum tab."},
        ],
        "createdAt": now,
        "updatedAt": now,
        "authorId": "",
        "authorName": "Seed Script (AIML)",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed free AIML foundations course (fixed YouTube URLs).")
    parser.add_argument("--replace", action="store_true", help=f"Remove existing slug {AIML_SLUG} and reinsert.")
    parser.add_argument(
        "--enroll-email",
        default="",
        help="Optional: create a free enrollment for this student (no order required).",
    )
    parser.add_argument("--status", action="store_true", help="Read-only: catalog visibility for AIML seed slug.")
    args = parser.parse_args()

    uri = (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "").strip()
    if not uri:
        print("ERROR: MONGODB_URI (or MONGO_URI) not set.")
        sys.exit(1)

    if args.status:
        client = MongoClient(uri)
        db = client[DB_NAME]
        courses = db["courses"]
        c = courses.find_one({"slug": AIML_SLUG})
        print("MongoDB host:", _mongo_host(uri))
        print("Database:", DB_NAME)
        if not c:
            print(f"No course with slug={AIML_SLUG!r}.")
            sys.exit(2)
        visible = courses.count_documents(_public_aiml_course_query()) >= 1
        print("Course _id:", str(c["_id"]))
        print("  title:", (c.get("title") or "")[:90])
        print("  price:", c.get("price"))
        print("  introVideoUrl:", (c.get("introVideoUrl") or "")[:120])
        print("  matches public catalog filter:", visible)
        sys.exit(0 if visible else 3)

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

    existing = courses.find_one({"slug": AIML_SLUG})
    if existing and not args.replace:
        print(f"Course already exists (slug={AIML_SLUG}). Use --replace to recreate.")
        print("  id:", str(existing["_id"]))
        sys.exit(0)

    if existing and args.replace:
        cid = str(existing["_id"])
        enrollments.delete_many({"courseId": cid})
        courses.delete_one({"_id": existing["_id"]})
        print("Removed previous AIML seed course and its enrollments.")

    doc = _course_doc(norm)
    ins = courses.insert_one(doc)
    course_id = str(ins.inserted_id)
    print("Inserted AIML course id:", course_id)
    print("  slug:", AIML_SLUG)
    print("  introVideoUrl:", INTRO_VIDEO_URL)
    print("  module1 lesson:", MODULE1_LESSON_URL)
    print("  module2 lesson:", MODULE2_LESSON_URL)

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

    vis = courses.count_documents(_public_aiml_course_query()) >= 1
    print("Catalog visibility:", vis)
    print("Open Course Detail with this id, enroll, then My Courses → Course Content → Curriculum / Quizzes.")


if __name__ == "__main__":
    main()
