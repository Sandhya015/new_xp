"""
Flask app instance for Lambda. Referenced by serverless-wsgi as app_wsgi.app
to avoid circular import (plugin's generated wsgi_handler imports this module).
If create_app() or any import fails, expose a raw WSGI fallback (no Flask deps)
so Lambda always returns 503 + CORS instead of 502.
"""
import os
import json

# Raw WSGI callable: no Flask required. Use when create_app fails so we never 502.
ALLOWED_ORIGINS = {
    "https://www.xpertintern.com",
    "https://xpertintern.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
BODY_503 = b'{"error":"Service temporarily unavailable. Set MONGODB_URI and JWT_SECRET_KEY in Lambda env."}'


def _origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    if origin in ALLOWED_ORIGINS:
        return True
    lo = origin.rstrip("/").lower()
    host = lo.split("//", 1)[-1].split("/", 1)[0]
    if host.endswith(".vercel.app") or host.endswith(".amplifyapp.com"):
        return True
    return False


def _raw_wsgi_fallback(environ, start_response):
    """Minimal WSGI app: 503 + CORS, no Flask."""
    origin = (environ.get("HTTP_ORIGIN") or "").strip()
    headers = [
        ("Content-Type", "application/json"),
        ("Access-Control-Allow-Credentials", "true"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"),
    ]
    if origin and _origin_allowed(origin):
        headers.append(("Access-Control-Allow-Origin", origin))
    start_response("503 Service Unavailable", headers)
    return [BODY_503]


# Store load error for fallback to show in response
_load_error = None


def _load_app():
    global _load_error
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass
    try:
        from app import create_app
        return create_app()
    except Exception as e:
        _load_error = e
        import traceback
        traceback.print_exc()
        return _raw_wsgi_fallback


def _fallback_with_error(environ, start_response):
    """Same as _raw_wsgi_fallback but include load error in body."""
    origin = (environ.get("HTTP_ORIGIN") or "").strip()
    headers = [
        ("Content-Type", "application/json"),
        ("Access-Control-Allow-Credentials", "true"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"),
    ]
    if origin and _origin_allowed(origin):
        headers.append(("Access-Control-Allow-Origin", origin))
    detail = str(_load_error) if _load_error else "App failed to load."
    body = json.dumps({"error": "Service temporarily unavailable", "detail": detail}).encode()
    start_response("503 Service Unavailable", headers)
    return [body]


try:
    app = _load_app()
    if _load_error is not None:
        app = _fallback_with_error
except Exception:
    import traceback
    traceback.print_exc()
    app = _raw_wsgi_fallback
