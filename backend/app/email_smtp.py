"""
Transactional email: SMTP (Zoho) or Amazon SES via EMAIL_TRANSPORT.

When EMAIL_TRANSPORT=ses, sends through SES (see app/email_ses.py); otherwise SMTP.
"""
from __future__ import annotations

import html as html_module
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
    to_addr = (to_addr or "").strip()
    if not to_addr:
        return False

    if (config.get("EMAIL_TRANSPORT") or "smtp").strip().lower() == "ses":
        from app.email_ses import send_email_via_ses

        return send_email_via_ses(config, to_addr, subject, html_body, text_body, attachments)

    if not smtp_configured(config):
        logger.info("SMTP not configured; skipping email to %s", to_addr)
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
    reply_to = (config.get("MAIL_REPLY_TO") or "").strip()
    if reply_to:
        msg["Reply-To"] = reply_to

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
        timeout = float(config.get("SMTP_TIMEOUT") or 30)
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=timeout, context=context) as server:
                server.login(user, password)
                server.sendmail(envelope_from, [to_addr], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=timeout) as server:
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


def send_company_registration_otp(config: Mapping[str, Any], company_name: str, to_email: str, otp: str) -> bool:
    """OTP email for company registration (contact verification before admin queue)."""
    from app.email_templates import company_registration_otp_bodies

    subject, html_body, text_body = company_registration_otp_bodies(company_name, otp)
    return send_email(config, to_email, subject, html_body, text_body=text_body)


def send_registration_otp(config: Mapping[str, Any], student_name: str, to_email: str, otp: str) -> bool:
    """6-digit email OTP for student registration (branded template)."""
    from app.email_templates import registration_otp_bodies

    subject, html_body, text_body = registration_otp_bodies(student_name, otp)
    return send_email(config, to_email, subject, html_body, text_body=text_body)


def send_password_reset_email(config: Mapping[str, Any], recipient_name: str, to_email: str, reset_url: str) -> bool:
    """Forgot-password flow: single-use link (see auth routes)."""
    from app.email_templates import password_reset_email_bodies

    subject, html_body, text_body = password_reset_email_bodies(recipient_name, reset_url)
    return send_email(config, to_email, subject, html_body, text_body=text_body)


def send_company_approval_email(config: Mapping[str, Any], company_name: str, to_email: str, login_url: str) -> bool:
    """Transactional email after admin approves a company (see admin routes)."""
    from app.email_templates import company_approval_email_bodies

    subject, html_body, text_body = company_approval_email_bodies(company_name, login_url)
    return send_email(config, to_email, subject, html_body, text_body=text_body)


def send_student_welcome(config: Mapping[str, Any], student_name: str, to_email: str) -> bool:
    from app.email_templates import welcome_email_bodies

    subject, html_body, text_body = welcome_email_bodies(student_name)
    return send_email(config, to_email, subject, html_body, text_body=text_body)


def send_enrollment_confirmation(
    config: Mapping[str, Any], student_name: str, to_email: str, course_title: str
) -> bool:
    from app.email_templates import enrollment_confirmation_email_bodies

    subject, html_body, text_body = enrollment_confirmation_email_bodies(student_name, course_title)
    return send_email(config, to_email, subject, html_body, text_body=text_body)


def send_learning_content_published_email(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    course_title: str,
    item_lines: list[str],
) -> bool:
    """Email enrolled learners when an assignment, quiz, or curriculum item is newly published."""
    name = html_module.escape((student_name or "there").strip() or "there")
    raw_title = (course_title or "").strip() or "your course"
    safe_title = html_module.escape(raw_title)
    lines = [x for x in item_lines if str(x).strip()][:50]
    if not lines:
        return False
    items_html = "".join(f"<li>{html_module.escape(str(x).strip())}</li>" for x in lines)
    bullet_text = "\n".join(f"- {str(x).strip()}" for x in lines)
    sub = f"New content in {raw_title} — XpertIntern"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {name},</p>
    <p>New content is available in <strong>{safe_title}</strong>:</p>
    <ul style="margin:12px 0;padding-left:20px;">
    {items_html}
    </ul>
    <p>Open <strong>My Enrolled Courses</strong> in your student dashboard to continue learning.</p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    text_body = (
        f"Hi {student_name or 'there'},\n\n"
        f"New content in {raw_title}:\n{bullet_text}\n\n"
        f"Open My Enrolled Courses in your dashboard.\n\n— Team XpertIntern"
    )
    return send_email(config, to_email, sub, html, text_body=text_body)


def send_payment_success_email(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    course_title: str,
    amount_display: str,
    payment_ref: str,
    new_enrollment: bool,
    *,
    invoice_number: str | None = None,
    pdf_bytes: bytes | None = None,
    pdf_filename: str | None = None,
    html_invoice_bytes: bytes | None = None,
    html_filename: str | None = None,
) -> bool:
    """Sent once when Razorpay payment is verified (includes enrollment line if we just created enrollment)."""
    name = student_name or "there"
    safe_title = course_title or "your course"
    inv_raw = (invoice_number or "").strip()
    inv_safe = html_module.escape(inv_raw) if inv_raw else ""
    if inv_raw:
        subject = f"Welcome to XpertIntern — Your tax invoice & course access (Invoice #{inv_raw})"
    else:
        subject = f"Payment received — {safe_title}"
    enroll_block = (
        "<p>Your enrollment is <strong>active</strong>. Open <strong>My Enrolled Courses</strong> in your dashboard for materials, quizzes, and your certificate path.</p>"
        if new_enrollment
        else "<p>If you were already enrolled, your payment is still recorded on your account.</p>"
    )
    inv_line = ""
    if inv_safe:
        inv_line = f"<p>Your tax invoice number: <strong>{inv_safe}</strong>. A PDF copy is attached to this email.</p>"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {name},</p>
    <p>We have <strong>successfully received</strong> your payment for <strong>{safe_title}</strong>.</p>
    <p>Amount: <strong>{amount_display}</strong><br/>Payment reference: <strong>{payment_ref}</strong></p>
    {inv_line}
    {enroll_block}
    <p>Thank you for choosing XpertIntern.</p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    attachments: list[tuple[str, bytes, str]] = []
    if pdf_bytes and pdf_filename:
        attachments.append((pdf_filename, pdf_bytes, "application/pdf"))
    if html_invoice_bytes and html_filename:
        attachments.append((html_filename, html_invoice_bytes, "text/html"))
    return send_email(config, to_email, subject, html, attachments=attachments or None)


def send_support_ticket_staff_reply(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    ticket_id: str,
    subject: str,
    reply_excerpt: str,
) -> bool:
    """Notify student when support staff replies to their ticket."""
    import html as html_module

    name = student_name or "there"
    safe_subj = html_module.escape((subject or "Support").strip() or "Support")
    safe_tid = html_module.escape((ticket_id or "").strip())
    excerpt = (reply_excerpt or "").strip()
    if len(excerpt) > 2000:
        excerpt = excerpt[:2000] + "…"
    safe_body = html_module.escape(excerpt).replace("\n", "<br/>")
    sub = f"Re: Your support ticket {ticket_id} — XpertIntern"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {html_module.escape(name)},</p>
    <p>Our team has replied to your support request <strong>{safe_tid}</strong>
    ({safe_subj}).</p>
    <div style="border-left:4px solid #2563eb;padding:12px 16px;background:#f8fafc;margin:16px 0;">
    {safe_body}
    </div>
    <p>Open <strong>Help &amp; Support</strong> in your student dashboard to view the full thread and send a follow-up.</p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    return send_email(config, to_email, sub, html, text_body=excerpt)


def send_support_ticket_status_update(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    ticket_id: str,
    subject: str,
    status_label: str,
) -> bool:
    import html as html_module

    name = student_name or "there"
    safe_tid = html_module.escape((ticket_id or "").strip())
    safe_subj = html_module.escape((subject or "Support").strip() or "Support")
    label = html_module.escape((status_label or "").strip())
    sub = f"Ticket {ticket_id} — {status_label} — XpertIntern"
    html = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1a2b4d;">
    <p>Hi {html_module.escape(name)},</p>
    <p>Your support ticket <strong>{safe_tid}</strong> ({safe_subj}) is now marked
    as <strong>{label}</strong>.</p>
    <p>Visit <strong>Help &amp; Support</strong> in your dashboard for details.</p>
    <p>— Team XpertIntern</p>
    </body></html>
    """
    return send_email(config, to_email, sub, html, text_body=f"Ticket {ticket_id} is now {status_label}.")


def send_certificate_email(
    config: Mapping[str, Any],
    student_name: str,
    to_email: str,
    course_title: str,
    cert_no: str,
    pdf_bytes: bytes,
    *,
    resent: bool = False,
) -> bool:
    from app.email_templates import course_certificate_email_bodies

    subject, html, text_body = course_certificate_email_bodies(
        student_name, course_title, cert_no, resent=resent
    )
    safe_fn = "".join(ch for ch in (cert_no or "cert") if ch.isalnum() or ch in "-_") or "cert"
    fn = f"XpertIntern-Certificate-{safe_fn}.pdf"
    return send_email(
        config,
        to_email,
        subject,
        html,
        text_body=text_body,
        attachments=[(fn, pdf_bytes, "application/pdf")],
    )
