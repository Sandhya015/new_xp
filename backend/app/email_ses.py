"""
Amazon SES outbound mail (Lambda-friendly: fast, no SMTP to Zoho from AWS).

Requires verified identity in SES (same region as Lambda by default) and IAM
ses:SendRawEmail (or SendEmail). Configure EMAIL_TRANSPORT=ses and SES_FROM_EMAIL.
"""
from __future__ import annotations

import logging
import os
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Mapping, Optional

logger = logging.getLogger(__name__)


def ses_configured(config: Mapping[str, Any]) -> bool:
    if (config.get("EMAIL_TRANSPORT") or "").strip().lower() != "ses":
        return False
    from_addr = (config.get("SES_FROM_EMAIL") or config.get("MAIL_FROM") or "").strip()
    return bool(from_addr)


def _ses_region(config: Mapping[str, Any]) -> str:
    r = (config.get("SES_REGION") or os.environ.get("AWS_REGION") or "ap-south-1").strip()
    return r or "ap-south-1"


def _strip_html_simple(html: str) -> str:
    import re

    t = re.sub(r"<[^>]+>", " ", html)
    return " ".join(t.split())


def send_email_via_ses(
    config: Mapping[str, Any],
    to_addr: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    attachments: Optional[list[tuple[str, bytes, str]]] = None,
) -> bool:
    if not ses_configured(config):
        logger.info("SES not configured; skipping email to %s", to_addr)
        return False
    to_addr = (to_addr or "").strip()
    if not to_addr:
        return False

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        logger.error("boto3 required for SES; install locally or run on AWS Lambda")
        return False

    from_email = (config.get("SES_FROM_EMAIL") or config.get("MAIL_FROM") or "").strip()
    name = (config.get("MAIL_FROM_NAME") or "XpertIntern").strip()
    source = f"{name} <{from_email}>" if name else from_email
    text_body = text_body or _strip_html_simple(html_body)

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = source
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
        sub = mime.split("/")[-1] if "/" in mime else "octet-stream"
        part = MIMEApplication(data, _subtype=sub)
        part.add_header("Content-Disposition", "attachment", filename=fn)
        msg.attach(part)

    region = _ses_region(config)
    try:
        client = boto3.client("ses", region_name=region)
        client.send_raw_email(
            Source=from_email,
            Destinations=[to_addr],
            RawMessage={"Data": msg.as_bytes()},
        )
        logger.info("SES: sent mail to %s (region=%s)", to_addr, region)
        return True
    except ClientError as e:
        logger.error("SES send failed for %s: %s", to_addr, e.response.get("Error", {}).get("Message", e))
        return False
    except BotoCoreError as e:
        logger.error("SES client error for %s: %s", to_addr, e)
        return False
    except Exception:
        logger.exception("SES unexpected error sending to %s", to_addr)
        return False
