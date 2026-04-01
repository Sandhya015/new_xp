"""Transactional email: SMTP (Zoho) via app config.

Most sends use a background thread so routes return quickly (avoids API Gateway 504).

**Welcome email on AWS Lambda:** background daemon threads are often frozen as soon as
the HTTP response is sent, so SMTP never completes. We always run the **student welcome**
send in the request thread when `AWS_LAMBDA_FUNCTION_NAME` is set (adds a little latency
to `/register` only).

Other emails: still background unless `EMAIL_SEND_SYNC=1` (or use SES/SQS for hard guarantees).
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any, Callable

from bson import ObjectId
from flask import Flask

from app.db import get_db, get_users_collection, get_courses_collection
from app.email_smtp import (
    send_certificate_email,
    send_enrollment_confirmation,
    send_payment_success_email,
    send_student_welcome,
)

logger = logging.getLogger(__name__)


def email_send_synchronous() -> bool:
    """True only when EMAIL_SEND_SYNC=1 — run SMTP in the request thread (blocks the API)."""
    explicit = os.environ.get("EMAIL_SEND_SYNC", "").strip().lower()
    return explicit in ("1", "true", "yes")


def _run_in_app_context(app: Flask, fn: Callable[..., None], *args: Any, **kwargs: Any) -> None:
    with app.app_context():
        try:
            fn(*args, **kwargs)
        except Exception:
            logger.exception("Background notification failed")


def _dispatch_email_job(app: Flask, job: Callable[..., None]) -> None:
    if email_send_synchronous():
        _run_in_app_context(app, job)
    else:
        t = threading.Thread(target=_run_in_app_context, args=(app, job), daemon=True)
        t.start()


def _running_on_aws_lambda() -> bool:
    return bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "").strip())


def welcome_email_uses_request_thread() -> bool:
    """True when student welcome is sent before the HTTP handler returns (Lambda or EMAIL_SEND_SYNC)."""
    return email_send_synchronous() or _running_on_aws_lambda()


def schedule_welcome_email(app: Flask, student_name: str, email: str) -> None:
    if not email:
        return

    def job():
        cfg = app.config
        ok = send_student_welcome(cfg, student_name, email)
        if ok:
            logger.info("Welcome email sent OK for %s", email)
        else:
            logger.warning("Welcome email was not sent for %s (SMTP disabled or failed — see logs above)", email)

    # Lambda: must run before the invocation ends; background threads are unreliable.
    if welcome_email_uses_request_thread():
        _run_in_app_context(app, job)
    else:
        _dispatch_email_job(app, job)


def schedule_enrollment_email(app: Flask, user_id: str, course_id: str) -> None:
    def job():
        db = get_db()
        if db is None:
            return
        try:
            oid = ObjectId(user_id)
            cid = ObjectId(course_id)
        except Exception:
            return
        users = get_users_collection()
        user = users.find_one({"_id": oid})
        if not user or user.get("role") != "student":
            return
        email = (user.get("email") or "").strip()
        name = user.get("name") or user.get("fullName") or "there"
        course = get_courses_collection().find_one({"_id": cid})
        title = (course.get("title") if course else None) or "your course"
        ok = send_enrollment_confirmation(app.config, name, email, title)
        if ok:
            logger.info("Enrollment confirmation email sent to %s", email)
        else:
            logger.warning("Enrollment confirmation not sent to %s (SMTP disabled or failed)", email)

    _dispatch_email_job(app, job)


def schedule_payment_success_email(
    app: Flask,
    user_id: str,
    course_id: str | None,
    amount_rupees: float,
    payment_ref: str,
    new_enrollment: bool,
) -> None:
    """After Razorpay verify — payment receipt (+ enrollment note if new)."""

    def job():
        db = get_db()
        if db is None:
            return
        try:
            uid = ObjectId(user_id)
        except Exception:
            return
        users = get_users_collection()
        user = users.find_one({"_id": uid})
        if not user or user.get("role") != "student":
            return
        email = (user.get("email") or "").strip()
        name = user.get("name") or user.get("fullName") or "there"
        title = "your course"
        if course_id and ObjectId.is_valid(course_id):
            course = get_courses_collection().find_one({"_id": ObjectId(course_id)})
            if course and course.get("title"):
                title = course.get("title", title)
        try:
            amt = float(amount_rupees)
            amount_display = f"₹{amt:,.0f}" if amt == int(amt) else f"₹{amt:,.2f}"
        except (TypeError, ValueError):
            amount_display = "₹—"
        ref = (payment_ref or "").strip() or "—"
        ok = send_payment_success_email(
            app.config, name, email, title, amount_display, ref, new_enrollment
        )
        if ok:
            logger.info("Payment success email sent to %s", email)
        else:
            logger.warning("Payment success email not sent to %s (SMTP disabled or failed)", email)

    _dispatch_email_job(app, job)


def schedule_certificate_email(
    app: Flask,
    student_name: str,
    email: str,
    course_title: str,
    cert_no: str,
    pdf_bytes: bytes,
) -> None:
    if not email or not pdf_bytes:
        return

    def job():
        ok = send_certificate_email(app.config, student_name, email, course_title, cert_no, pdf_bytes)
        if ok:
            logger.info("Certificate email sent to %s", email)
        else:
            logger.warning("Certificate email not sent to %s (SMTP disabled or failed)", email)

    _dispatch_email_job(app, job)
