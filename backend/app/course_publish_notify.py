"""Detect newly published learning content and email enrolled students (no payment logic)."""
from __future__ import annotations

from typing import Any

from bson import ObjectId
from flask import current_app

from app.db import get_enrollments_collection, get_users_collection
from app.email_smtp import send_learning_content_published_email
from app.enrollment_lookup import course_id_enrollment_filter


def _row_key(d: dict | None, idx: int, id_key: str = "id") -> str:
    if isinstance(d, dict):
        aid = str(d.get(id_key) or "").strip()
        if aid:
            return aid
    return f"_idx:{idx}"


def _was_publicly_visible(item: dict | None) -> bool:
    if not item or not isinstance(item, dict):
        return False
    return item.get("published") is not False


def newly_published_flat_assignments(old_list: Any, new_list: Any) -> list[str]:
    old = old_list if isinstance(old_list, list) else []
    new = new_list if isinstance(new_list, list) else []
    old_by_key: dict[str, dict] = {}
    for i, a in enumerate(old):
        if isinstance(a, dict):
            old_by_key[_row_key(a, i)] = a
    out: list[str] = []
    for i, a in enumerate(new):
        if not isinstance(a, dict):
            continue
        k = _row_key(a, i)
        prev = old_by_key.get(k)
        if prev is None and i < len(old) and isinstance(old[i], dict):
            prev = old[i]
        now_vis = _was_publicly_visible(a)
        was_vis = _was_publicly_visible(prev)
        if now_vis and not was_vis:
            t = str(a.get("title") or "").strip() or "Assignment"
            out.append(t)
    return out


def newly_published_flat_quizzes(old_list: Any, new_list: Any) -> list[str]:
    return newly_published_flat_assignments(old_list, new_list)


def _flatten_curriculum_topics(curriculum: Any) -> list[tuple[str, dict]]:
    rows: list[tuple[str, dict]] = []
    if not isinstance(curriculum, list):
        return rows
    for mi, mod in enumerate(curriculum):
        if not isinstance(mod, dict):
            continue
        topics = mod.get("topics")
        if not isinstance(topics, list):
            continue
        for ti, t in enumerate(topics):
            if not isinstance(t, dict):
                continue
            tid = str(t.get("id") or "").strip() or f"_idx:{mi}:{ti}"
            rows.append((tid, t))
    return rows


def newly_published_curriculum_topic_titles(old_curriculum: Any, new_curriculum: Any) -> list[str]:
    old_rows = _flatten_curriculum_topics(old_curriculum)
    new_rows = _flatten_curriculum_topics(new_curriculum)
    old_map = {k: v for k, v in old_rows}
    out: list[str] = []
    for tid, t in new_rows:
        prev = old_map.get(tid)
        now_vis = _was_publicly_visible(t)
        was_vis = _was_publicly_visible(prev)
        if now_vis and not was_vis:
            title = str(t.get("title") or "").strip() or "Lesson"
            typ = str(t.get("type") or "").strip().lower()
            if typ == "quiz":
                out.append(f"Quiz: {title}")
            else:
                out.append(title)
    return out


def _recipient_enrolled_emails(course_id: str) -> list[tuple[str, str]]:
    """Pairs (email, display_name) unique by email."""
    enroll_coll = get_enrollments_collection()
    users_coll = get_users_collection()
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    if users_coll.database is None:
        return out
    for e in enroll_coll.find(course_id_enrollment_filter(course_id)):
        uid = str(e.get("userId") or "").strip()
        if not uid or not ObjectId.is_valid(uid):
            continue
        u = users_coll.find_one({"_id": ObjectId(uid)})
        if not u:
            continue
        to = (u.get("email") or "").strip()
        if not to or to.lower() in seen:
            continue
        seen.add(to.lower())
        name = (u.get("name") or u.get("fullName") or "there").strip() or "there"
        out.append((to, name))
    return out


def notify_enrolled_content_published(
    *,
    course_id: str,
    course_title: str,
    assignment_titles: list[str],
    quiz_titles: list[str],
    curriculum_titles: list[str],
) -> None:
    lines: list[str] = []
    for t in assignment_titles:
        lines.append(f"Assignment: {t}")
    for t in quiz_titles:
        lines.append(f"Course quiz: {t}")
    for t in curriculum_titles:
        lines.append(t if t.startswith("Quiz:") else f"Curriculum: {t}")
    if not lines:
        return
    cfg = current_app.config
    title_clean = (course_title or "your course").strip() or "your course"
    for to_email, stu_name in _recipient_enrolled_emails(course_id):
        try:
            send_learning_content_published_email(
                cfg,
                stu_name,
                to_email,
                title_clean,
                lines,
            )
        except Exception:
            current_app.logger.exception("send_learning_content_published_email")
