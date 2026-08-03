"""
Attachment safety for admin outbound messages (Rev 2).

On Lambda, ClamAV is usually unavailable. We always run magic-byte + malicious
magic checks; if CLAMAV_ENABLED=1 and clamscan is on PATH we run it (ops opt-in).
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Signature starts (prefix)
_ALLOWED_MAGIC = (
    (b"%PDF", "pdf"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"PK\x03\x04", "zip_or_office"),  # zip, docx, xlsx, pptx
    (b"\xd0\xcf\x11\xe0", "ole"),  # legacy .doc/.xls/.ppt
)

# Reject obvious executables / scripts even if extension is renamed
_REJECT_MAGIC = (
    b"MZ",  # PE / Windows exe
    b"\x7fELF",  # ELF
    b"#!",  # shell script
    b"<?php",
    b"<script",
)


class AttachmentScanError(ValueError):
    pass


def _ext(name: str) -> str:
    return Path(name or "").suffix.lower()


def scan_attachment_bytes(filename: str, raw: bytes) -> None:
    """Raise AttachmentScanError if the payload is not safe to forward."""
    if not raw:
        raise AttachmentScanError(f"{filename}: empty file")

    head = raw[:512]
    head_l = head[:64].lower()

    for bad in _REJECT_MAGIC:
        if head.startswith(bad) or head_l.startswith(bad.lower()):
            raise AttachmentScanError(f"{filename}: blocked content type")

    # PE often starts with MZ later only — also check common
    if b"\x00\x00\x00\x00" in head[:8] and head[0:2] == b"MZ":
        raise AttachmentScanError(f"{filename}: executable content blocked")

    ext = _ext(filename)
    ok_magic = False
    for magic, kind in _ALLOWED_MAGIC:
        if head.startswith(magic):
            ok_magic = True
            if kind == "zip_or_office" and ext not in (
                ".zip",
                ".docx",
                ".xlsx",
                ".pptx",
                ".doc",
                ".xls",
                ".ppt",
            ):
                # PK header with non-office ext still ok for allowed zip ext only
                if ext != ".zip":
                    raise AttachmentScanError(f"{filename}: content does not match extension")
            if kind == "pdf" and ext != ".pdf":
                raise AttachmentScanError(f"{filename}: content does not match extension")
            if kind == "png" and ext != ".png":
                raise AttachmentScanError(f"{filename}: content does not match extension")
            if kind == "jpg" and ext not in (".jpg", ".jpeg"):
                raise AttachmentScanError(f"{filename}: content does not match extension")
            if kind == "ole" and ext not in (".doc", ".xls", ".ppt"):
                raise AttachmentScanError(f"{filename}: content does not match extension")
            break

    # Some JPEG tools / Office variants still valid by ext alone if small OLE miss
    if not ok_magic and ext in {".pdf", ".png", ".jpg", ".jpeg"}:
        raise AttachmentScanError(f"{filename}: invalid or unrecognized file content")

    # Optional ClamAV when operators install it (not on stock Lambda)
    if os.environ.get("CLAMAV_ENABLED", "").strip().lower() in ("1", "true", "yes"):
        clam = shutil.which("clamscan")
        if clam:
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".bin") as tmp:
                tmp.write(raw)
                path = tmp.name
            try:
                proc = subprocess.run(
                    [clam, "--no-summary", "--infected", path],
                    capture_output=True,
                    text=True,
                    timeout=20,
                    check=False,
                )
                # exit 1 = infected, 0 = clean, 2 = error
                if proc.returncode == 1:
                    raise AttachmentScanError(f"{filename}: malware detected by ClamAV")
                if proc.returncode not in (0, 1):
                    logger.warning("clamscan error rc=%s for %s: %s", proc.returncode, filename, (proc.stderr or "")[:200])
            except subprocess.TimeoutExpired:
                logger.warning("clamscan timeout for %s", filename)
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
