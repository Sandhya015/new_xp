"""JWT session epoch helpers (admin password reset invalidates earlier tokens)."""
from __future__ import annotations

from datetime import datetime


def session_epoch_of(user: dict | None) -> int:
    if not user:
        return 0
    try:
        return int(user.get("sessionEpoch") or 0)
    except (TypeError, ValueError):
        return 0


def new_session_epoch() -> int:
    return int(datetime.utcnow().timestamp())


def jwt_claims_for_user(user: dict, **extra) -> dict:
    """Additional JWT claims including session epoch."""
    claims = {
        "email": user.get("email") or "",
        "role": user.get("role") or "student",
        "se": session_epoch_of(user),
        "leadRole": user.get("leadRole") or "",
        "adminPortalAccess": bool(user.get("adminPortalAccess")),
    }
    claims.update(extra)
    return claims
