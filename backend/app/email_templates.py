"""
Branded HTML + plain-text bodies for transactional email (SMTP / SES).
Uses table-based layout and inline CSS for broad client support.
"""
from __future__ import annotations

import html
import os
import re
from typing import Tuple


def public_app_url() -> str:
    """Base URL for links in transactional email (override with PUBLIC_FRONTEND_URL)."""
    return (os.environ.get("PUBLIC_FRONTEND_URL") or "https://www.xpertintern.com").rstrip("/")


def _public_app_url() -> str:
    return public_app_url()


def _wrap_brand(inner_html: str, preheader: str) -> str:
    """Outer shell: preheader (hidden), header bar, content card, footer."""
    pre = html.escape(preheader, quote=False)
    base = _public_app_url()
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XpertIntern</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    {pre}
  </span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1d4ed8 100%);border-radius:12px 12px 0 0;padding:20px 24px;">
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">XpertIntern</p>
              <p style="margin:6px 0 0;font-size:12px;color:#bfdbfe;opacity:0.95;">Training &amp; internships — AICTE / UGC aligned learning</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:28px 24px 20px;color:#1e293b;font-size:15px;line-height:1.65;">
              {inner_html}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 8px;text-align:center;font-size:12px;color:#64748b;line-height:1.5;">
              <p style="margin:0 0 8px;">You received this message because of an action on your XpertIntern account.</p>
              <p style="margin:0;">
                <a href="{html.escape(base, quote=True)}" style="color:#2563eb;text-decoration:none;">{html.escape(base, quote=True)}</a>
                &nbsp;·&nbsp;
                <a href="{html.escape(base + '/contact', quote=True)}" style="color:#2563eb;text-decoration:none;">Contact support</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">© XpertIntern. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def welcome_email_bodies(student_name: str) -> Tuple[str, str, str]:
    """Subject, HTML, plain text for post-registration welcome."""
    safe = html.escape(student_name or "there", quote=False)
    base = _public_app_url()
    subject = "Welcome to XpertIntern — your account is ready"
    inner = f"""
<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0f172a;">Hi {safe},</p>
<p style="margin:0 0 16px;">Thank you for joining <strong>XpertIntern</strong>. Your student account is active and ready to use.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
  <tr><td style="padding:16px 18px;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">What you can do next</p>
    <ul style="margin:0;padding-left:20px;color:#334155;">
      <li style="margin:6px 0;">Browse <strong>training programs</strong> matched to your university and goals</li>
      <li style="margin:6px 0;">Enroll securely and track progress from your <strong>dashboard</strong></li>
      <li style="margin:6px 0;">Complete quizzes and earn <strong>verifiable certificates</strong></li>
    </ul>
  </td></tr>
</table>
<p style="margin:0 0 20px;">If you have questions, reply to this email or use <strong>Help &amp; Support</strong> after you sign in.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="border-radius:8px;background:#2563eb;">
      <a href="{html.escape(base + '/login', quote=True)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Sign in to your dashboard</a>
    </td>
  </tr>
</table>
<p style="margin:24px 0 0;font-size:14px;color:#475569;">Happy learning,<br/><strong style="color:#0f172a;">Team XpertIntern</strong></p>
"""
    html_body = _wrap_brand(inner, "Your XpertIntern account is ready.")
    plain = (
        f"Hi {student_name or 'there'},\n\n"
        "Thank you for joining XpertIntern. Your student account is active.\n\n"
        "You can sign in to explore trainings, enroll in courses, and track progress from your dashboard.\n\n"
        f"Sign in: {base}/login\n\n"
        "Questions? Reply to this email or use Help & Support in your dashboard.\n\n"
        "— Team XpertIntern\n"
        f"{base}\n"
    )
    return subject, html_body, plain


def enrollment_confirmation_email_bodies(student_name: str, course_title: str) -> Tuple[str, str, str]:
    """Subject, HTML, plain text after a student enrolls in a course (matches welcome_email style)."""
    safe_name = html.escape(student_name or "there", quote=False)
    safe_course = html.escape(course_title or "your course", quote=False)
    base = _public_app_url()
    my_courses = html.escape(f"{base}/dashboard/my-courses", quote=True)
    subject_plain = (course_title or "your course").replace("\n", " ").strip() or "your course"
    subject = f"You are enrolled — {subject_plain[:200]}"
    inner = f"""
<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0f172a;">Hi {safe_name},</p>
<p style="margin:0 0 16px;">You have <strong>successfully enrolled</strong> in <strong>{safe_course}</strong> on <strong>XpertIntern</strong>.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
  <tr><td style="padding:16px 18px;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">What to do next</p>
    <ul style="margin:0;padding-left:20px;color:#334155;">
      <li style="margin:6px 0;">Open <strong>My Enrolled Courses</strong> to access curriculum, class links, study materials, and assignments</li>
      <li style="margin:6px 0;">Submit assignments and complete quizzes from your course page</li>
      <li style="margin:6px 0;">Watch for announcements from your trainer in the same course view</li>
    </ul>
  </td></tr>
</table>
<p style="margin:0 0 20px;">We wish you a focused, productive learning journey.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="border-radius:8px;background:#2563eb;">
      <a href="{my_courses}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Go to My Enrolled Courses</a>
    </td>
  </tr>
</table>
<p style="margin:24px 0 0;font-size:14px;color:#475569;">Happy learning,<br/><strong style="color:#0f172a;">Team XpertIntern</strong></p>
"""
    html_body = _wrap_brand(inner, f"You are now enrolled in {subject_plain}.")
    plain = (
        f"Hi {student_name or 'there'},\n\n"
        f"You have successfully enrolled in {course_title or 'your course'} on XpertIntern.\n\n"
        "Open My Enrolled Courses in your dashboard to access materials, class links, assignments, and quizzes.\n\n"
        f"{base}/dashboard/my-courses\n\n"
        "Questions? Reply to this email or use Help & Support after you sign in.\n\n"
        "— Team XpertIntern\n"
        f"{base}\n"
    )
    return subject, html_body, plain


def registration_otp_bodies(student_name: str, otp: str) -> Tuple[str, str, str]:
    """Subject (includes OTP per product spec), HTML, plain text."""
    safe_name = html.escape(student_name or "there", quote=False)
    otp_digits = re.sub(r"\D", "", str(otp or ""))[:6]
    safe_otp = html.escape(otp_digits, quote=False)
    subject = f"Your XpertIntern verification code — {otp_digits}"
    inner = f"""
<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">Verify your email</p>
<p style="margin:0 0 20px;">Hello {safe_name},</p>
<p style="margin:0 0 20px;">Use the one-time code below to complete your XpertIntern registration. This helps us keep your account secure.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
  <tr>
    <td style="background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border:2px dashed #cbd5e1;border-radius:12px;padding:20px 32px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">Your code</p>
      <p style="margin:0;font-family:ui-monospace,'Cascadia Code','Segoe UI Mono',monospace;font-size:28px;font-weight:700;letter-spacing:0.35em;color:#0f172a;">{safe_otp}</p>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:14px;color:#475569;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone — XpertIntern staff will never ask for your code.</p>
<p style="margin:0;font-size:13px;color:#94a3b8;">If you did not request this, you can ignore this email.</p>
<p style="margin:28px 0 0;font-size:14px;color:#475569;">— <strong style="color:#0f172a;">XpertIntern Team</strong></p>
"""
    html_body = _wrap_brand(inner, f"Your code is {otp_digits}. Valid 10 minutes.")
    plain = (
        f"Hello {student_name or 'there'},\n\n"
        f"Your XpertIntern verification code is: {otp_digits}\n\n"
        "This code expires in 10 minutes. Do not share it with anyone.\n\n"
        "If you did not request this, ignore this email.\n\n"
        "— XpertIntern Team\n"
    )
    return subject, html_body, plain


def company_registration_otp_bodies(company_name: str, otp: str) -> Tuple[str, str, str]:
    """Company registration contact verification (DPIIT flow). Subject includes OTP per spec."""
    safe_name = html.escape(company_name or "your company", quote=False)
    otp_digits = re.sub(r"\D", "", str(otp or ""))[:6]
    safe_otp = html.escape(otp_digits, quote=False)
    subject = f"Verify Your XpertIntern Company Registration — OTP: {otp_digits}"
    inner = f"""
<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">Verify your company registration</p>
<p style="margin:0 0 20px;">Hello,</p>
<p style="margin:0 0 20px;">You are registering <strong>{safe_name}</strong> on XpertIntern. Use the verification code below to confirm this email address and submit your application for <strong>admin review</strong>.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
  <tr>
    <td style="background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border:2px dashed #cbd5e1;border-radius:12px;padding:20px 32px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">Verification code</p>
      <p style="margin:0;font-family:ui-monospace,'Cascadia Code','Segoe UI Mono',monospace;font-size:28px;font-weight:700;letter-spacing:0.35em;color:#0f172a;">{safe_otp}</p>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:14px;color:#475569;">This code expires in <strong>10 minutes</strong>. Do not forward or share this code.</p>
<p style="margin:0;font-size:13px;color:#94a3b8;">After verification, your profile will remain <strong>pending admin approval</strong> before you can post internships.</p>
<p style="margin:28px 0 0;font-size:14px;color:#475569;">— <strong style="color:#0f172a;">XpertIntern Team</strong></p>
"""
    html_body = _wrap_brand(inner, f"Company verification code {otp_digits}. Valid 10 minutes.")
    plain = (
        "Hello,\n\n"
        f"Your XpertIntern company registration verification code is: {otp_digits}\n\n"
        f"Company: {company_name or 'your company'}\n"
        "Valid for 10 minutes. Do not share this code.\n\n"
        "After you verify, your account will still require admin approval before you can sign in.\n\n"
        "— XpertIntern Team\n"
    )
    return subject, html_body, plain


def password_reset_email_bodies(recipient_name: str, reset_url: str) -> Tuple[str, str, str]:
    """Password reset link — single-use token, time-limited."""
    safe_name = html.escape(recipient_name or "there", quote=False)
    safe_url = html.escape(reset_url, quote=True)
    subject = "Reset your XpertIntern password"
    inner = f"""
<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">Password reset</p>
<p style="margin:0 0 20px;">Hi {safe_name},</p>
<p style="margin:0 0 20px;">We received a request to reset the password for your XpertIntern account. Click the button below to choose a new password.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:8px;background:#2563eb;">
      <a href="{safe_url}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Reset password</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:14px;color:#475569;">This link expires in <strong>1 hour</strong> and can be used only once. If you did not request a reset, you can ignore this email — your password will stay the same.</p>
<p style="margin:0;font-size:13px;color:#94a3b8;word-break:break-all;">If the button does not work, copy and paste this URL into your browser:<br/><a href="{safe_url}" style="color:#2563eb;">{safe_url}</a></p>
<p style="margin:28px 0 0;font-size:14px;color:#475569;">— <strong style="color:#0f172a;">XpertIntern Team</strong></p>
"""
    html_body = _wrap_brand(inner, "Reset your XpertIntern password.")
    plain = (
        f"Hi {recipient_name or 'there'},\n\n"
        "We received a request to reset your XpertIntern password.\n\n"
        f"Open this link to set a new password (valid 1 hour, one use only):\n{reset_url}\n\n"
        "If you did not request this, ignore this email.\n\n"
        "— XpertIntern Team\n"
    )
    return subject, html_body, plain


def company_approval_email_bodies(company_name: str, login_url: str) -> Tuple[str, str, str]:
    """Sent when an admin approves a pending company account."""
    safe_name = html.escape(company_name or "your company", quote=False)
    safe_login = html.escape(login_url, quote=True)
    subject = "Congratulations — your XpertIntern company account is approved"
    inner = f"""
<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">Great news</p>
<p style="margin:0 0 20px;">Hello,</p>
<p style="margin:0 0 20px;">Your company registration for <strong>{safe_name}</strong> on <strong>XpertIntern</strong> has been <strong>reviewed and approved</strong> by our team.</p>
<p style="margin:0 0 20px;">You can now sign in with your company email and password, complete your profile if needed, and <strong>post internships</strong> to reach students across our network.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:8px;background:#2563eb;">
      <a href="{safe_login}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Sign in to your company dashboard</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:14px;color:#475569;">If you have questions, reply to this email or use <strong>Contact</strong> on our website.</p>
<p style="margin:0;font-size:13px;color:#94a3b8;">Thank you for partnering with XpertIntern.</p>
<p style="margin:28px 0 0;font-size:14px;color:#475569;">— <strong style="color:#0f172a;">XpertIntern Team</strong></p>
"""
    html_body = _wrap_brand(inner, "Your company account is approved — sign in to get started.")
    plain = (
        "Hello,\n\n"
        f"Congratulations! Your company registration for {company_name or 'your company'} on XpertIntern has been approved.\n\n"
        "You can now sign in with your company email and password, and post internships for students.\n\n"
        f"Sign in: {login_url}\n\n"
        "If you have questions, reply to this email.\n\n"
        "— XpertIntern Team\n"
    )
    return subject, html_body, plain
