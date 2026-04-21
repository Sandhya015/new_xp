"""
Course media (featured images, intro/lesson video, study materials).

On AWS Lambda the deployment package is read-only; local disk under Flask
instance_path is not writable and /tmp is not shared across invocations.
When COURSE_MEDIA_S3_BUCKET is set, uploads go to S3. Small featured images are
streamed through this API (reliable for <img src>); larger intro/lesson/material
files redirect to a short-lived presigned S3 URL to avoid API Gateway size limits.
"""
from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Optional

from flask import Response, abort, current_app, redirect, send_from_directory
from werkzeug.datastructures import FileStorage


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


def save_uploaded_file(kind: str, fn: str, uf: FileStorage) -> None:
    """Persist werkzeug FileStorage to S3 or local instance_path/course_uploads."""
    if uses_s3():
        body = uf.read()
        if not body:
            raise ValueError("empty upload")
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
    uf.save(str(dest))


def make_course_media_response(kind: str, fname: str) -> Optional[Response]:
    """
    Build Flask response for GET /api/courses/media/<kind>/<fname>.
    Returns None if the object does not exist (caller should abort(404)).
    """
    if uses_s3():
        from botocore.exceptions import ClientError

        key = object_key(kind, fname)
        client = _s3()

        def _s3_not_found(exc: BaseException) -> bool:
            return isinstance(exc, ClientError) and (exc.response.get("Error") or {}).get("Code", "") in (
                "404",
                "NoSuchKey",
                "NotFound",
            )

        # Featured images are capped small at upload; stream bytes so browsers never
        # depend on cross-origin redirects or presigned URL quirks for <img src>.
        if kind == "featured":
            try:
                obj = client.get_object(Bucket=_bucket(), Key=key)
            except Exception as e:
                if _s3_not_found(e):
                    return None
                current_app.logger.exception("S3 get_object (featured) failed: %s", e)
                abort(502)
            stream = obj["Body"]
            # Filename is authoritative: matches API Gateway binaryMediaTypes and avoids
            # broken previews when S3 metadata is missing or application/octet-stream.
            ctype = _content_type_for_course_media(kind, fname)

            def generate():
                try:
                    for chunk in stream.iter_chunks(chunk_size=65536):
                        if chunk:
                            yield chunk
                finally:
                    close = getattr(stream, "close", None)
                    if callable(close):
                        close()

            return Response(
                generate(),
                mimetype=ctype,
                headers={
                    "Cache-Control": "public, max-age=600",
                    "Content-Disposition": "inline",
                },
            )

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
    if kind == "featured":
        return send_from_directory(
            str(root),
            fname,
            conditional=True,
            mimetype=_content_type_for_course_media(kind, fname),
        )
    return send_from_directory(str(root), fname, conditional=True)
