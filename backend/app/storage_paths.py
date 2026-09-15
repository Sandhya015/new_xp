"""Writable local storage root for generated PDFs and uploads.

AWS Lambda deployment packages are read-only; Flask instance_path points there
by default, so mkdir/write under instance_path fails with PermissionError.
"""
from __future__ import annotations

import os
from pathlib import Path

from flask import current_app

_LAMBDA_STORAGE = Path("/tmp/xpertintern-storage")


def local_storage_root() -> Path:
    """Directory for certificate/document PDFs and other local file blobs."""
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        _LAMBDA_STORAGE.mkdir(parents=True, exist_ok=True)
        return _LAMBDA_STORAGE
    return Path(current_app.instance_path)
