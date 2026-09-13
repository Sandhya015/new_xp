"""Storage for admin-generated student document PDFs."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from flask import current_app

_DOC_PDF_RE = re.compile(r"^[a-f0-9]{32}\.pdf$", re.IGNORECASE)


def student_documents_dir() -> Path:
    base = Path(current_app.instance_path) / "student_documents"
    base.mkdir(parents=True, exist_ok=True)
    return base


def save_student_document_pdf(raw: bytes) -> str:
    if not raw or len(raw) < 100:
        raise ValueError("PDF file is empty or too small")
    if raw[:4] != b"%PDF":
        raise ValueError("File does not look like a PDF")
    key = f"{uuid.uuid4().hex}.pdf"
    (student_documents_dir() / key).write_bytes(raw)
    return key


def read_student_document_pdf(key: str) -> bytes | None:
    k = (key or "").strip()
    if not k or not _DOC_PDF_RE.match(k):
        return None
    path = student_documents_dir() / k
    if not path.is_file():
        return None
    return path.read_bytes()


def save_attendance_photo(raw: bytes, *, ext: str = "jpg") -> str:
    if not raw or len(raw) < 100:
        raise ValueError("Photo is empty or too small")
    safe_ext = "jpg" if ext.lower() in ("jpg", "jpeg") else "png" if ext.lower() == "png" else "jpg"
    key = f"{uuid.uuid4().hex}.{safe_ext}"
    photos_dir = Path(current_app.instance_path) / "attendance_photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    (photos_dir / key).write_bytes(raw)
    return key


def read_attendance_photo(key: str) -> bytes | None:
    k = (key or "").strip()
    if not k or ".." in k:
        return None
    path = Path(current_app.instance_path) / "attendance_photos" / k
    if not path.is_file():
        return None
    return path.read_bytes()
