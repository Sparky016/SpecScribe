"""Shared pytest setup: run suites with auth disabled unless a test opts into a token."""

import pytest


@pytest.fixture(autouse=True)
def _auth_disabled_by_default(monkeypatch):
    monkeypatch.delenv("SPECSCRIBE_API_TOKEN", raising=False)
    monkeypatch.setenv("SPECSCRIBE_AUTH_DISABLED", "1")
