"""Shared-secret bearer-token auth for the SpecScribe REST API and WebSocket hub.

The secret comes from env SPECSCRIBE_API_TOKEN (read per call so it can be rotated
and monkeypatched). Local development may set SPECSCRIBE_AUTH_DISABLED=1 instead.
The token itself is never logged.
"""

import hmac
import logging
import os
from typing import Optional

from fastapi import Header, HTTPException, WebSocket

logger = logging.getLogger("specscribe.auth")

TOKEN_ENV = "SPECSCRIBE_API_TOKEN"
DISABLE_ENV = "SPECSCRIBE_AUTH_DISABLED"
WS_UNAUTHORIZED_CLOSE_CODE = 4401


def _configured_token() -> str:
    return os.environ.get(TOKEN_ENV, "")


def auth_disabled() -> bool:
    """True only when no token is configured and auth is explicitly disabled."""
    return not _configured_token() and os.environ.get(DISABLE_ENV) == "1"


def validate_auth_config() -> None:
    """Startup guard: refuse to run without a token unless auth is explicitly disabled."""
    if _configured_token():
        return
    if os.environ.get(DISABLE_ENV) == "1":
        logger.warning(
            "%s=1 and %s is unset: API and WebSocket authentication is DISABLED. "
            "Never use this setting in production.",
            DISABLE_ENV,
            TOKEN_ENV,
        )
        return
    raise RuntimeError(
        f"{TOKEN_ENV} is not set. Set it to a shared secret, or set {DISABLE_ENV}=1 for local development only."
    )


def _token_matches(candidate: Optional[str]) -> bool:
    expected = _configured_token()
    if not expected or not candidate:
        return False
    return hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8"))


async def require_api_token(authorization: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: require `Authorization: Bearer <token>`."""
    if auth_disabled():
        return
    scheme, _, credentials = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not _token_matches(credentials.strip()):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def ws_token_ok(websocket: WebSocket) -> bool:
    """Validate the `token` query param of a WebSocket handshake (only used for the handshake)."""
    if auth_disabled():
        return True
    return _token_matches(websocket.query_params.get("token"))
