"""
Transactional email via SMTP (Zoho, etc.). Config from Flask app.config; no-op if SMTP not set.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Mapping, Optional

logger = logging.getLogger(__name__)


def smtp_configured(config: Mapping[str, Any]) -> bool:
    return bool(
        (config.get("SMTP_HOST") or "").strip()
        and (config.get("SMTP_USER") or "").strip()
        and (config.get("SMTP_PASSWORD") or "").strip()
    )


def _from_header(config: Mapping[str, Any]) -> str:
    addr = (config.get("MAIL_FROM") or config.get("SMTP_USER") or "").strip()
    name = (config.get("MAIL_FROM_NAME") or "XpertIntern").strip()
    if not addr:
        return ""
    return f"{name} <{addr}>"


def send_email(
    config: Mapping[str, Any],
    to_addr: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    attachments: Optional[list[tuple[str, bytes, str]]] = None,
) -> bool:
    """
    Send one email. attachments: list of (filename, bytes, mime_type).
    Returns True if sent, False if skipped or failed (errors logged).
    """
    if not smtp_configured(config):
        logger.info("SMTP not configured; skipping email to %s", to_addr)
        return False
    to_addr = (to_addr or "").strip()
    if not to_addr:
        return False

    host = (config.get("SMTP_HOST") or "").strip()
    port = int(config.get("SMTP_PORT") or 587)
    user = (config.get("SMTP_USER") or "").strip()
    password = (config.get("SMTP_PASSWORD") or "").strip()
    from_header = _from_header(config)
    if not from_header:
        logger.warning("MAIL_FROM / SMTP_USER missing; cannot send")
        return False

    text_body = text_body or _strip_html_simple(html_body)

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_addr

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(alt)

    for item in attachments or []:
        fn, data, mime = item[0], item[1], item[2] if len(item) > 2 else "application/octet-stream"
        part = MIMEApplication(data, _subtype=mime.split("/")[-1] if "/" in mime else "octet-stream")
        part.add_header("Content-Disposition", "attachment", filename=fn)
        msg.attach(part)

    try:
        context = ssl.create_default_context()
        envelope_from = (config.get("MAIL_FROM") or user).strip()
        use_ssl = bool(config.get("SMTP_USE_SSL")) or port == 465
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=30, context=context) as server:
                server.login(user, password)
                server.sendmail(envelope_from, [to_addr], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.starttls(context=context)
                server.login(user, password)
                server.sendmail(envelope_from, [to_addr], msg.as_string())
        logger.info("SMTP: sent mail to %s (subject will appear in inbox)", to_addr)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP auth failed for user %s: %s (check password; if it contains # use quotes in .env)", user, e)
        return False
    except Exception:
        logger.exception("Failed to send email to %s", to_addr)
        return False


def _strip_html_simple(html: str) -> str:
    import re
    t = re.sub(r"<[^>]+>", " ", html)
    return " ".join(t.split())


def send_student_welcome(config: Mapping[str, Any], student_name: str, to_email: str) -> bool:
    name = student_name or "there"
    subject = "Welcome to XpertIntern"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {name},</p>
    <p>Welcome to <strong>XpertIntern</strong> — we are glad you joined our learning community.</p>
    <p>You can log in anytime to explore trainings, enroll in courses, and track your progress from your student dashboard.</p>
    <p>If you have questions, reply to this email or use <strong>Help &amp; Support</strong> in your dashboard.</p>
    <p>Happy learning,<br/>Team XpertIntern</p>
    </body></html>
    """
    return send_email(config, to_email, subject, html)


def send_enrollment_confirmation(
    config: Mapping[str, Any], student_name: str, to_email: str, course_title: str
) -> bool:
    name = student_name or "there"
    safe_title = course_title or "your course"
    subject = f"You are enrolled — {safe_title}"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {name},</p>
    <p>You have <strong>successfully enrolled</strong> in <strong>{safe_title}</strong>.</p>
    <p>Open <strong>My Enrolled Courses</strong> in your XpertIntern dashboard to access materials, class links, and quizzes.</p>
    <p>We wish you a productive journey — <strong>happy learning!</strong></p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    return send_email(config, to_email, subject, html)


def send_payment_success_email(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    course_title: str,
    amount_display: str,
    payment_ref: str,
    new_enrollment: bool,
) -> bool:
    """Sent once when Razorpay payment is verified (includes enrollment line if we just created enrollment)."""
    name = student_name or "there"
    safe_title = course_title or "your course"
    subject = f"Payment received — {safe_title}"
    enroll_block = (
        "<p>Your enrollment is <strong>active</strong>. Open <strong>My Enrolled Courses</strong> in your dashboard for materials, quizzes, and your certificate path.</p>"
        if new_enrollment
        else "<p>If you were already enrolled, your payment is still recorded on your account.</p>"
    )
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {name},</p>
    <p>We have <strong>successfully received</strong> your payment for <strong>{safe_title}</strong>.</p>
    <p>Amount: <strong>{amount_display}</strong><br/>Payment reference: <strong>{payment_ref}</strong></p>
    {enroll_block}
    <p>Thank you for choosing XpertIntern.</p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    return send_email(config, to_email, subject, html)


def send_certificate_email(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    course_title: str,
    cert_no: str,
    pdf_bytes: bytes,
) -> bool:
    name = student_name or "there"
    safe_title = course_title or "your course"
    subject = f"Your XpertIntern certificate — {safe_title}"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {name},</p>
    <p>Congratulations on completing the quiz for <strong>{safe_title}</strong>.</p>
    <p>Your certificate of completion is attached to this email. Certificate ID: <strong>{cert_no}</strong>.</p>
    <p>Keep learning and building your skills with XpertIntern.</p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    fn = f"XpertIntern-Certificate-{cert_no}.pdf"
    return send_email(
        config,
        to_email,
        subject,
        html,
        attachments=[(fn, pdf_bytes, "application/pdf")],
    )
