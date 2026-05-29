"""Secure local storage for uploaded internship certificate PDFs (admin upload)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from flask import current_app

_CERT_PDF_RE = re.compile(r"^[a-f0-9]{32}\.pdf$", re.IGNORECASE)


def certificate_pdfs_dir() -> Path:
    base = Path(current_app.instance_path) / "certificate_pdfs"
    base.mkdir(parents=True, exist_ok=True)
    return base


def save_certificate_pdf(raw: bytes, *, cert_no: str = "") -> str:
    """Persist PDF bytes; returns storage key (filename only)."""
    if not raw or len(raw) < 100:
        raise ValueError("PDF file is empty or too small")
    if raw[:4] != b"%PDF":
        raise ValueError("File does not look like a PDF")
    key = f"{uuid.uuid4().hex}.pdf"
    path = certificate_pdfs_dir() / key
    path.write_bytes(raw)
    return key


def read_certificate_pdf(key: str) -> bytes | None:
    k = (key or "").strip()
    if not k or not _CERT_PDF_RE.match(k):
        return None
    path = certificate_pdfs_dir() / k
    if not path.is_file():
        return None
    return path.read_bytes()


def delete_certificate_pdf(key: str) -> None:
    k = (key or "").strip()
    if not k or not _CERT_PDF_RE.match(k):
        return
    path = certificate_pdfs_dir() / k
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
