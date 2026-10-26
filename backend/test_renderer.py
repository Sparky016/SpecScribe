"""
HeadlessDrawioDaemon hardening tests (DEV_TASK_22).
Uses fake page/browser objects only: no Chromium launch and no network calls.
"""

import asyncio
import base64
import time

import pytest
from playwright._impl._errors import TargetClosedError
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from graph_engine import HeadlessDrawioDaemon

PNG_BYTES = b"\x89PNG\r\n\x1a\nfake-png"
XML = "<mxfile><diagram><mxGraphModel><root/></mxGraphModel></diagram></mxfile>"


class FakeLocator:
    def __init__(self, page):
        self._page = page

    @property
    def first(self):
        return self

    async def screenshot(self, omit_background=False):
        self._page.calls.append("screenshot")
        return PNG_BYTES


class FakePage:
    """Records call order. `crash_on_evaluate` raises TargetClosedError that many times."""

    def __init__(self, *, hang_evaluate=False, hang_wait=False, done_timeout=False,
                 crash_on_evaluate=0, crash_on_close=False):
        self.calls = []
        self.hang_evaluate = hang_evaluate
        self.hang_wait = hang_wait
        self.done_timeout = done_timeout
        self.crash_on_evaluate = crash_on_evaluate
        self.crash_on_close = crash_on_close
        self.closed = False

    async def evaluate(self, script, arg=None):
        self.calls.append("evaluate")
        if self.crash_on_evaluate:
            self.crash_on_evaluate -= 1
            raise TargetClosedError()
        if self.hang_evaluate:
            await asyncio.Event().wait()

    async def wait_for_function(self, expression, arg=None, timeout=None, polling=None):
        self.calls.append("wait_for_function")
        if self.hang_wait:
            await asyncio.Event().wait()
        if self.done_timeout:
            raise PlaywrightTimeoutError(f"Timeout {timeout}ms exceeded.")

    def locator(self, selector):
        return FakeLocator(self)

    async def close(self):
        self.closed = True
        if self.crash_on_close:
            raise TargetClosedError()


class FakeBrowser:
    def __init__(self):
        self.closed = False

    async def close(self):
        self.closed = True


def make_daemon(page):
    daemon = HeadlessDrawioDaemon()
    daemon.page = page
    daemon.browser = FakeBrowser()
    daemon._is_ready = True
    return daemon


def install_fake_start(daemon, page_factory, fail=False):
    """Replace start() with a fake that installs a fresh fake page (or fails)."""
    state = {"calls": 0, "pages": []}

    async def fake_start():
        state["calls"] += 1
        if fail:
            raise PlaywrightError("chromium failed to launch")
        page = page_factory()
        state["pages"].append(page)
        daemon.page = page
        daemon.browser = FakeBrowser()
        daemon._is_ready = True

    daemon.start = fake_start
    return state


def test_is_ready_is_public():
    daemon = HeadlessDrawioDaemon()
    assert daemon.is_ready() is False
    daemon = make_daemon(FakePage())
    assert daemon.is_ready() is True
    daemon._restarting = True
    assert daemon.is_ready() is False


def test_screenshot_only_after_render_complete_signal():
    page = FakePage()
    daemon = make_daemon(page)

    b64 = asyncio.run(daemon.render_b64_png(XML))

    assert base64.b64decode(b64) == PNG_BYTES
    assert page.calls == ["evaluate", "wait_for_function", "screenshot"]


def test_missing_render_signal_raises_timeout_without_screenshot_or_restart():
    page = FakePage(done_timeout=True)
    daemon = make_daemon(page)
    state = install_fake_start(daemon, FakePage)

    with pytest.raises(TimeoutError):
        asyncio.run(daemon.render_b64_png(XML))

    assert "screenshot" not in page.calls
    assert state["calls"] == 0
    assert daemon.is_ready() is True
    assert not daemon._lock.locked()


@pytest.mark.parametrize("hang", ["hang_evaluate", "hang_wait"])
def test_hung_render_times_out_within_budget_and_releases_lock(hang):
    page = FakePage(**{hang: True})
    daemon = make_daemon(page)

    async def scenario():
        t0 = time.perf_counter()
        with pytest.raises(TimeoutError):
            await daemon.render_b64_png(XML)
        elapsed = time.perf_counter() - t0
        assert not daemon._lock.locked()
        # Lock released: the next render proceeds on a healthy page
        daemon.page = FakePage()
        b64 = await daemon.render_b64_png(XML)
        return elapsed, b64

    elapsed, b64 = asyncio.run(scenario())
    assert 1.5 <= elapsed < 3.0
    assert base64.b64decode(b64) == PNG_BYTES
    assert daemon.is_ready() is True


def test_crash_triggers_single_restart_and_render_succeeds():
    crashed_page = FakePage(crash_on_evaluate=1, crash_on_close=True)
    daemon = make_daemon(crashed_page)
    old_browser = daemon.browser
    state = install_fake_start(daemon, FakePage)

    b64 = asyncio.run(daemon.render_b64_png(XML))

    assert base64.b64decode(b64) == PNG_BYTES
    assert state["calls"] == 1
    assert crashed_page.closed and old_browser.closed  # page.close() failing didn't leak the browser
    assert state["pages"][0].calls == ["evaluate", "wait_for_function", "screenshot"]
    assert daemon.is_ready() is True
    assert not daemon._lock.locked()


def test_restart_happens_at_most_once_per_failing_render():
    daemon = make_daemon(FakePage(crash_on_evaluate=1))
    state = install_fake_start(daemon, lambda: FakePage(crash_on_evaluate=1))

    with pytest.raises(PlaywrightError):
        asyncio.run(daemon.render_b64_png(XML))

    assert state["calls"] == 1
    assert not daemon._lock.locked()


def test_failed_restart_marks_not_ready_and_fails_fast_afterwards():
    daemon = make_daemon(FakePage(crash_on_evaluate=1))
    state = install_fake_start(daemon, FakePage, fail=True)

    async def scenario():
        with pytest.raises(PlaywrightError):
            await daemon.render_b64_png(XML)
        assert daemon.is_ready() is False
        assert daemon.page is None
        with pytest.raises(RuntimeError):
            await daemon.render_b64_png(XML)

    asyncio.run(scenario())
    assert state["calls"] == 1  # no restart storm
    assert not daemon._lock.locked()


def test_concurrent_renders_during_crash_restart_only_once():
    daemon = make_daemon(FakePage(crash_on_evaluate=1))
    state = install_fake_start(daemon, FakePage)

    async def scenario():
        return await asyncio.gather(*(daemon.render_b64_png(XML) for _ in range(3)))

    results = asyncio.run(scenario())
    assert all(base64.b64decode(r) == PNG_BYTES for r in results)
    assert state["calls"] == 1
    assert len(state["pages"][0].calls) == 3 * 3


def test_cancelled_render_releases_lock():
    daemon = make_daemon(FakePage(hang_evaluate=True))

    async def scenario():
        task = asyncio.create_task(daemon.render_b64_png(XML))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert not daemon._lock.locked()

    asyncio.run(scenario())


def test_stop_prevents_restart():
    daemon = make_daemon(FakePage(crash_on_evaluate=1))
    state = install_fake_start(daemon, FakePage)

    async def scenario():
        # Simulate stop() racing in after the render passed its readiness check.
        daemon._stopped = True
        with pytest.raises(RuntimeError):
            await daemon.render_b64_png(XML)

    asyncio.run(scenario())
    assert state["calls"] == 0
    assert daemon.is_ready() is False


def test_stop_closes_everything_even_if_page_close_fails():
    page = FakePage(crash_on_close=True)
    daemon = make_daemon(page)
    browser = daemon.browser

    asyncio.run(daemon.stop())

    assert page.closed and browser.closed
    assert daemon.page is None and daemon.browser is None
    assert daemon.is_ready() is False
