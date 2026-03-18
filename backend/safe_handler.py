"""
Wrapper around wsgi_handler so any exception returns a proper API Gateway response
with CORS instead of Lambda crashing and returning 502.
"""
import json
import traceback

# Module-level state for lazy load
_wsgi_handler = None
_wsgi_load_error = None
_loaded = False


def _load_wsgi():
    global _wsgi_handler, _wsgi_load_error, _loaded
    if _loaded:
        return
    _loaded = True
    try:
        from wsgi_handler import handler as h
        _wsgi_handler = h
    except Exception as e:
        _wsgi_load_error = e
        traceback.print_exc()


def _gateway_response(status_code: int, body: dict, origin: str = ""):
    """API Gateway Lambda proxy response with CORS."""
    allowed = (
        "https://www.xpertintern.com",
        "https://xpertintern.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    }
    if origin and origin in allowed:
        headers["Access-Control-Allow-Origin"] = origin
    else:
        headers["Access-Control-Allow-Origin"] = "https://www.xpertintern.com"
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body),
        "isBase64Encoded": False,
    }


def _get_origin(event: dict) -> str:
    """Extract Origin from API Gateway event."""
    headers = event.get("headers") or {}
    if isinstance(headers, dict):
        return (headers.get("Origin") or headers.get("origin") or "").strip()
    return ""


def handler(event, context):
    _load_wsgi()
    origin = _get_origin(event)
    if _wsgi_load_error is not None:
        err_msg = str(_wsgi_load_error)
        return _gateway_response(503, {
            "error": "Service unavailable",
            "detail": err_msg or "App failed to load. Set MONGODB_URI and JWT_SECRET_KEY in Lambda env.",
        }, origin)
    try:
        result = _wsgi_handler(event, context)
        # Plugin may return list for CLI commands; pass through
        if not isinstance(result, dict):
            return result
        # Ensure CORS on success/error responses from WSGI
        if "headers" not in result:
            result["headers"] = {}
        result.setdefault("headers", {})
        if "Access-Control-Allow-Origin" not in result["headers"] and origin:
            allowed = ("https://www.xpertintern.com", "https://xpertintern.com",
                       "http://localhost:5173", "http://127.0.0.1:5173")
            if origin in allowed:
                result["headers"]["Access-Control-Allow-Origin"] = origin
        result["headers"]["Access-Control-Allow-Credentials"] = "true"
        return result
    except Exception as e:
        traceback.print_exc()
        return _gateway_response(500, {
            "error": "Internal server error",
            "detail": str(e) if str(e) else "Request handling failed",
        }, origin)
