"""
Minimal Lambda handler for OPTIONS preflight. Returns 204 with CORS headers.
Used so preflight never hits the main Flask app (avoids 502 from cold start/DB).
"""
ALLOWED_ORIGINS = {
    "https://www.xpertintern.com",
    "https://xpertintern.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}


def handler(event, context):
    headers = event.get("headers") or {}
    origin = (headers.get("Origin") or headers.get("origin") or "").strip()
    if origin not in ALLOWED_ORIGINS:
        origin = "https://www.xpertintern.com"
    return {
        "statusCode": 204,
        "headers": {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Max-Age": "86400",
        },
        "body": "",
    }
