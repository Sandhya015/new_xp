"""
Course media (featured images, intro/lesson video, study materials).

On AWS Lambda the deployment package is read-only; local disk under Flask
instance_path is not writable and /tmp is not shared across invocations.
When COURSE_MEDIA_S3_BUCKET is set, uploads go to S3. Featured images are read in
full (≤2MB), normalized to raw JPEG/PNG bytes, then returned through this API;
larger intro/lesson/material files redirect to a short-lived presigned S3 URL.
"""
from __future__ import annotations

import base64
import binascii
import mimetypes
import os
import re
import string
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from flask import Response, abort, current_app, redirect, send_from_directory
from werkzeug.datastructures import FileStorage

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _bucket() -> str:
    return (current_app.config.get("COURSE_MEDIA_S3_BUCKET") or "").strip()


def _prefix() -> str:
    raw = (current_app.config.get("COURSE_MEDIA_S3_PREFIX") or "course-media").strip().strip("/")
    return raw or "course-media"


def object_key(kind: str, fn: str) -> str:
    return f"{_prefix()}/{kind}/{fn}"


def uses_s3() -> bool:
    return bool(_bucket())


def _content_type_for_course_media(kind: str, fname: str) -> str:
    """
    Stable Content-Type from the stored file name.

    S3 PutObject sometimes ends up with application/octet-stream; API Gateway only
    base64-decodes responses whose Content-Type matches configured binaryMediaTypes,
    so featured images must be image/jpeg or image/png here.
    """
    ext = Path(fname).suffix.lower()
    if kind == "featured":
        if ext in (".jpg", ".jpeg"):
            return "image/jpeg"
        if ext == ".png":
            return "image/png"
    if kind in ("intro", "lesson"):
        if ext == ".mp4":
            return "video/mp4"
        if ext == ".mov":
            return "video/quicktime"
        if ext == ".avi":
            return "video/x-msvideo"
    guessed = mimetypes.guess_type(fname)[0]
    return guessed or "application/octet-stream"


def _s3():
    import boto3

    region = (os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-south-1").strip()
    return boto3.client("s3", region_name=region)


def _s3_error_meta(exc: BaseException) -> tuple[str, int]:
    """
    Boto errors are normally botocore.exceptions.ClientError, but avoid
    isinstance(ClientError) — duplicate botocore copies (Lambda zip + layer)
    can make that check fail and turn a normal NoSuchKey into abort(502).
    """
    resp = getattr(exc, "response", None)
    if not isinstance(resp, dict):
        return "", 0
    err = resp.get("Error") or {}
    code = str(err.get("Code") or "")
    try:
        http = int((resp.get("ResponseMetadata") or {}).get("HTTPStatusCode") or 0)
    except (TypeError, ValueError):
        http = 0
    return code, http


def _s3_not_found(exc: BaseException) -> bool:
    code, http = _s3_error_meta(exc)
    if code in ("404", "NoSuchKey", "NotFound"):
        return True
    return http == 404


_COURSE_MEDIA_NAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(jpe?g|png|mp4|mov|avi)$",
    re.IGNORECASE,
)
_STUDY_MATERIAL_NAME_RE = re.compile(
    r"^[a-f0-9]{32}_[a-f0-9]{8}\.(pdf|pptx?|docx?|xlsx?|zip|txt|csv)$",
    re.IGNORECASE,
)


def parse_stored_course_media_url(url: str) -> Optional[tuple[str, str]]:
    """
    If url is our hosted /api/courses/media/{kind}/{fname} (relative or full API URL), return (kind, fname).
    External links (YouTube, CDN) return None.
    """
    raw = (url or "").strip()
    if not raw:
        return None
    path = raw
    if raw.startswith("http://") or raw.startswith("https://"):
        try:
            path = urlparse(raw).path or ""
        except Exception:
            return None
    marker = "/api/courses/media/"
    idx = path.find(marker)
    if idx < 0:
        return None
    rest = path[idx + len(marker) :].strip("/")
    if "/" not in rest:
        return None
    kind, fname = rest.split("/", 1)
    kind = kind.strip().lower()
    fname = fname.strip()
    if not kind or not fname or "/" in fname:
        return None
    if kind not in ("featured", "intro", "lesson", "material"):
        return None
    return (kind, fname)


def course_media_object_exists(kind: str, fname: str) -> bool:
    """
    True if media can be served. For featured images this reads the object and
    verifies valid JPEG/PNG bytes (matches GET). For other kinds, S3 head or file exists only.
    Used for HEAD /api/courses/media/... and admin validation.
    """
    if kind not in ("featured", "intro", "lesson", "material"):
        return False
    if kind == "material":
        if not _STUDY_MATERIAL_NAME_RE.match(fname or ""):
            return False
    elif not _COURSE_MEDIA_NAME_RE.match(fname or ""):
        return False
    key = object_key(kind, fname)
    # Featured images: HEAD must match GET (object may exist in S3 but be corrupt/non-JPEG).
    if kind == "featured":
        _, status = load_featured_servable_body(fname)
        return status == "ok"
    if uses_s3():
        try:
            _s3().head_object(Bucket=_bucket(), Key=key)
            return True
        except Exception as e:
            if _s3_not_found(e):
                return False
            current_app.logger.exception("S3 head_object (exists check) failed: %s", e)
            raise
    root = Path(current_app.instance_path) / "course_uploads" / kind
    try:
        root = root.resolve()
    except OSError:
        return False
    path = (root / fname).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return path.is_file()


_B64_WHITESPACE = re.compile(rb"\s+")
_B64_ALPHABET = frozenset(string.ascii_letters.encode() + string.digits.encode() + b"+/")


def _strip_data_url_to_bytes(body: bytes) -> Optional[bytes]:
    """
    If body looks like data:image/(jpeg|jpg|png);base64,..., return decoded bytes.
    Otherwise return None.
    """
    s = body.lstrip()
    if not s.startswith(b"data:"):
        return None
    head, sep, rest = s.partition(b",")
    if not sep or not rest:
        return None
    meta = head.decode("ascii", errors="ignore").lower()
    if "base64" not in meta:
        return None
    if "image/jpeg" not in meta and "image/jpg" not in meta and "image/png" not in meta:
        return None
    try:
        return base64.b64decode(rest, validate=False)
    except binascii.Error:
        return None


def _looks_like_ascii_base64(payload: bytes) -> bool:
    """True if payload is mostly standard base64 characters (handles newlines)."""
    if len(payload) < 24:
        return False
    compact = _B64_WHITESPACE.sub(b"", payload)
    if len(compact) < 24:
        return False
    bad = 0
    for i, c in enumerate(compact):
        if c in _B64_ALPHABET:
            continue
        if c == 61 and all(x == 61 for x in compact[i:]):  # padding '=' only at end
            break
        bad += 1
        if bad > max(8, len(compact) // 10000):
            return False
    return True


def featured_image_bytes_are_raster(body: bytes) -> bool:
    """True if bytes look like raw JPEG or PNG (after any leading BOM stripped)."""
    if not body or len(body) < 12:
        return False
    b = body
    if b.startswith(b"\xef\xbb\xbf"):
        b = b[3:]
    if b.startswith(b"\xff\xd8\xff") or b.startswith(_PNG_MAGIC):
        return True
    return False


def load_featured_servable_body(fname: str) -> tuple[Optional[bytes], str]:
    """
    Load featured image from S3 or local disk; normalize; validate JPEG/PNG.

    Returns (bytes, 'ok') to serve.
    Returns (None, 'missing') if the object/file is absent or empty.
    Returns (None, 'invalid') if bytes exist but are not valid raster image data after normalization.
    """
    if not _COURSE_MEDIA_NAME_RE.match(fname or ""):
        return None, "missing"
    key = object_key("featured", fname)
    if uses_s3():
        client = _s3()
        try:
            obj = client.get_object(Bucket=_bucket(), Key=key)
        except Exception as e:
            if _s3_not_found(e):
                return None, "missing"
            current_app.logger.exception("S3 get_object (featured load) failed: %s", e)
            abort(502)
        try:
            raw = obj["Body"].read()
        finally:
            close = getattr(obj["Body"], "close", None)
            if callable(close):
                close()
        if not raw:
            return None, "missing"
        body = normalize_featured_image_body(raw)
        if not body:
            return None, "invalid"
        if not featured_image_bytes_are_raster(body):
            current_app.logger.warning(
                "Featured object %s/%s is not a valid JPEG/PNG after normalization; "
                "re-upload the cover image from the admin panel.",
                _bucket(),
                key,
            )
            return None, "invalid"
        return body, "ok"

    root = Path(current_app.instance_path) / "course_uploads" / "featured"
    try:
        root = root.resolve()
    except OSError:
        return None, "missing"
    path = (root / fname).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return None, "missing"
    if not path.is_file():
        return None, "missing"
    body = normalize_featured_image_body(path.read_bytes())
    if not featured_image_bytes_are_raster(body):
        current_app.logger.warning(
            "Featured file on disk is not valid JPEG/PNG after normalization: %s", path
        )
        return None, "invalid"
    return body, "ok"


def _decode_ascii_base64_to_image(body: bytes) -> Optional[bytes]:
    """If body is ASCII base64 of a JPEG/PNG, return decoded bytes; else None."""
    if not _looks_like_ascii_base64(body):
        return None
    compact = _B64_WHITESPACE.sub(b"", body.strip())
    pad = (-len(compact)) % 4
    if pad:
        compact += b"=" * pad
    try:
        raw = base64.b64decode(compact, validate=True)
    except binascii.Error:
        try:
            raw = base64.b64decode(compact, validate=False)
        except binascii.Error:
            return None
    if len(raw) < 12:
        return None
    if raw.startswith(b"\xff\xd8\xff"):
        return raw
    if raw.startswith(_PNG_MAGIC):
        return raw
    return None


def normalize_featured_image_body(body: bytes) -> bytes:
    """
    Coerce featured image uploads / S3 objects to raw JPEG or PNG bytes.

    Some clients stored base64 text (or a data: URL) in S3 while Content-Type was
    image/jpeg; browsers then cannot render the object. Decoding here fixes new
    saves and legacy GETs when the payload is still valid base64 of an image.
    Leading UTF-8 BOM and ascii whitespace are stripped (common when text tools
    touched binary).
    """
    if not body:
        return body
    body = body.lstrip(b" \t\r\n")
    if body.startswith(b"\xef\xbb\xbf"):
        body = body[3:]
    body = body.lstrip(b" \t\r\n")
    from_data = _strip_data_url_to_bytes(body)
    if from_data is not None:
        return from_data
    if body.startswith(b"\xff\xd8\xff") or body.startswith(_PNG_MAGIC):
        return body
    decoded = _decode_ascii_base64_to_image(body)
    if decoded is not None:
        return decoded
    return body


def save_uploaded_file(kind: str, fn: str, uf: FileStorage) -> None:
    """Persist werkzeug FileStorage to S3 or local instance_path/course_uploads."""
    if uses_s3():
        body = uf.read()
        if not body:
            raise ValueError("empty upload")
        if kind == "featured":
            body = normalize_featured_image_body(body)
            if not featured_image_bytes_are_raster(body):
                raise ValueError(
                    "Featured image is not valid JPEG/PNG bytes after processing. Choose a real .jpg or .png file."
                )
        ctype = _content_type_for_course_media(kind, fn)
        try:
            _s3().put_object(Bucket=_bucket(), Key=object_key(kind, fn), Body=body, ContentType=ctype)
        except Exception as e:
            current_app.logger.exception("S3 put_object failed: %s", e)
            raise
        return
    root = Path(current_app.instance_path) / "course_uploads" / kind
    root.mkdir(parents=True, exist_ok=True)
    dest = root / fn
    uf.seek(0)
    if kind == "featured":
        body = uf.read()
        if not body:
            raise ValueError("empty upload")
        body = normalize_featured_image_body(body)
        if not featured_image_bytes_are_raster(body):
            raise ValueError(
                "Featured image is not valid JPEG/PNG bytes after processing. Choose a real .jpg or .png file."
            )
        dest.write_bytes(body)
        return
    uf.save(str(dest))


def featured_s3_object_head_exists(fname: str) -> bool:
    """
    True if an object exists at the featured S3 key (does not validate JPEG/PNG bytes).

    Public GET uses presigned S3 redirects; HEAD uses this so validators avoid full reads.
    Admin checks still use course_media_object_exists / load_featured_servable_body for strict validation.
    """
    if not _COURSE_MEDIA_NAME_RE.match(fname or ""):
        return False
    if not uses_s3():
        return False
    key = object_key("featured", fname)
    try:
        _s3().head_object(Bucket=_bucket(), Key=key)
        return True
    except Exception as e:
        if _s3_not_found(e):
            return False
        raise


def make_course_media_response(kind: str, fname: str) -> Optional[Response]:
    """
    Build Flask response for GET /api/courses/media/<kind>/<fname>.
    Returns None if the object does not exist (caller should return 404 JSON).

    On S3, featured images redirect to a presigned GetObject URL (same pattern as intro/lesson)
    so bytes are not proxied through API Gateway/Lambda, avoiding binary handling edge cases.
    Local featured images are still served from disk in routes/courses.py via load_featured_servable_body.
    """
    if kind == "featured":
        if not uses_s3():
            return None
        key = object_key(kind, fname)
        client = _s3()
        try:
            client.head_object(Bucket=_bucket(), Key=key)
        except Exception as e:
            if _s3_not_found(e):
                return None
            current_app.logger.exception("S3 head_object failed (featured): %s", e)
            abort(502)
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=3600,
        )
        r = redirect(url, code=302)
        r.headers["Cache-Control"] = "public, max-age=300"
        return r

    if uses_s3():
        key = object_key(kind, fname)
        client = _s3()

        try:
            client.head_object(Bucket=_bucket(), Key=key)
        except Exception as e:
            if _s3_not_found(e):
                return None
            current_app.logger.exception("S3 head_object failed: %s", e)
            abort(502)
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=3600,
        )
        return redirect(url, code=302)

    root = Path(current_app.instance_path) / "course_uploads" / kind
    try:
        root = root.resolve()
    except OSError:
        return None
    path = (root / fname).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return None
    if not path.is_file():
        return None
    return send_from_directory(str(root), fname, conditional=True)
