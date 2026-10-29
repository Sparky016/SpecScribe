"""Tests for get_session_manager fail-loud behaviour (task 26)."""
import os
import sys

import pytest
from fastapi import FastAPI, Request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from session_manager import SessionManager, get_session_manager


def _request_for(app: FastAPI) -> Request:
    scope = {"type": "http", "app": app, "headers": [], "method": "GET", "path": "/"}
    return Request(scope)


def test_missing_app_state_session_manager_raises_runtime_error():
    app = FastAPI()
    with pytest.raises(RuntimeError, match="SessionManager not configured on app.state"):
        get_session_manager(_request_for(app))


def test_configured_app_state_session_manager_is_returned():
    app = FastAPI()
    mgr = SessionManager()
    app.state.session_manager = mgr
    assert get_session_manager(_request_for(app)) is mgr
