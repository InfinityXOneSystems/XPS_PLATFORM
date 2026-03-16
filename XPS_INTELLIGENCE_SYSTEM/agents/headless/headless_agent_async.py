#!/usr/bin/env python3
"""
Headless Agent — Python asyncio parallel implementation
========================================================
Uses asyncio + pyppeteer (Chrome DevTools Protocol) to run multiple
headless browser sessions concurrently.  Exposes the same REST contract
as the Node.js agent (headless_agent.js) on port 3201.

Requirements:
    pip install -r requirements.txt

Quick start:
    python agents/headless/headless_agent_async.py

Environment variables:
    HEADLESS_PYTHON_PORT       (default: 3201)
    HEADLESS_MAX_SESSIONS      (default: 10)
    HEADLESS_API_KEY           (optional bearer token)
"""

import asyncio
import base64
import json
import os
import uuid
from typing import Any

try:
    from aiohttp import web
    import pyppeteer
    from pyppeteer import launch as pp_launch
except ImportError:  # pragma: no cover
    raise SystemExit(
        "Missing dependencies.  Run: pip install aiohttp pyppeteer"
    )

PORT         = int(os.environ.get("HEADLESS_PYTHON_PORT", "3201"))
MAX_SESSIONS = int(os.environ.get("HEADLESS_MAX_SESSIONS", "10"))
API_KEY      = os.environ.get("HEADLESS_API_KEY", "")
IDLE_TIMEOUT = int(os.environ.get("HEADLESS_IDLE_TIMEOUT_SEC", "300"))


# ─────────────────────────── Session Pool ───────────────────────────

class SessionPool:
    def __init__(self):
        self._browser = None
        self._sessions: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def _ensure_browser(self):
        if self._browser is None:
            self._browser = await pp_launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox",
                      "--disable-dev-shm-usage"],
            )
        return self._browser

    async def create_session(self, options: dict = None) -> str:
        options = options or {}
        async with self._lock:
            if len(self._sessions) >= MAX_SESSIONS:
                raise RuntimeError(f"Max sessions reached ({MAX_SESSIONS})")
            browser = await self._ensure_browser()
            page    = await browser.newPage()
            if options.get("userAgent"):
                await page.setUserAgent(options["userAgent"])
            vp = options.get("viewport", {"width": 1280, "height": 800})
            await page.setViewport(vp)

            sid = str(uuid.uuid4())
            task = asyncio.get_event_loop().call_later(
                IDLE_TIMEOUT, lambda: asyncio.ensure_future(self.destroy_session(sid))
            )
            self._sessions[sid] = {"page": page, "idle_handle": task}
            return sid

    def _touch(self, sid: str):
        s = self._sessions.get(sid)
        if not s:
            raise KeyError(f"Session not found: {sid}")
        s["idle_handle"].cancel()
        s["idle_handle"] = asyncio.get_event_loop().call_later(
            IDLE_TIMEOUT, lambda: asyncio.ensure_future(self.destroy_session(sid))
        )
        return s["page"]

    async def destroy_session(self, sid: str) -> bool:
        async with self._lock:
            s = self._sessions.pop(sid, None)
            if not s:
                return False
            s["idle_handle"].cancel()
            try:
                await s["page"].close()
            except Exception:
                pass
            return True

    def list_sessions(self) -> list[dict]:
        return [{"id": sid, "url": s["page"].url} for sid, s in self._sessions.items()]

    async def shutdown(self):
        for sid in list(self._sessions.keys()):
            await self.destroy_session(sid)
        if self._browser:
            await self._browser.close()
            self._browser = None


pool = SessionPool()


# ─────────────────────────── Middleware ───────────────────────────

def require_auth(handler):
    async def wrapper(request):
        if API_KEY:
            auth = request.headers.get("Authorization", "")
            if auth != f"Bearer {API_KEY}":
                return web.json_response({"error": "Unauthorized"}, status=401)
        return await handler(request)
    return wrapper


def json_body(request):
    try:
        return request.json()
    except Exception:
        return {}


# ─────────────────────────── Handlers ───────────────────────────

@require_auth
async def handle_health(request):
    return web.json_response({"status": "ok", "service": "headless-agent-python",
                               "activeSessions": len(pool.list_sessions())})


@require_auth
async def handle_create_session(request):
    opts = await request.json() if request.can_read_body else {}
    try:
        sid = await pool.create_session(opts)
        return web.json_response({"sessionId": sid}, status=201)
    except RuntimeError as e:
        return web.json_response({"error": str(e)}, status=503)


@require_auth
async def handle_destroy_session(request):
    sid = request.match_info["id"]
    ok  = await pool.destroy_session(sid)
    if not ok:
        return web.json_response({"error": "Session not found"}, status=404)
    return web.json_response({"ok": True})


@require_auth
async def handle_list_sessions(request):
    return web.json_response({"sessions": pool.list_sessions()})


@require_auth
async def handle_navigate(request):
    body = await request.json()
    sid  = body.get("sessionId")
    url  = body.get("url")
    if not sid or not url:
        return web.json_response({"error": "sessionId and url required"}, status=400)
    try:
        page = pool._touch(sid)
        resp = await page.goto(url, {"waitUntil": body.get("waitUntil", "domcontentloaded")})
        return web.json_response({"ok": True, "url": page.url, "status": resp.status if resp else None})
    except (KeyError, Exception) as e:
        return web.json_response({"error": str(e)}, status=500)


# JavaScript for filling a form field safely (no f-string interpolation into JS)
_JS_FILL_FIELD = (
    "(s, v) => { const el = document.querySelector(s); "
    "if (el) { el.value = ''; el.value = v; "
    "el.dispatchEvent(new Event('input', {bubbles:true})); "
    "el.dispatchEvent(new Event('change', {bubbles:true})); } }"
)


@require_auth
async def handle_fill(request):
    body     = await request.json()
    sid      = body.get("sessionId")
    selector = body.get("selector")
    value    = body.get("value", "")
    if not sid or not selector:
        return web.json_response({"error": "sessionId and selector required"}, status=400)
    try:
        page = pool._touch(sid)
        await page.evaluate(_JS_FILL_FIELD, selector, str(value))
        return web.json_response({"ok": True, "selector": selector, "value": value})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@require_auth
async def handle_type(request):
    body     = await request.json()
    sid      = body.get("sessionId")
    selector = body.get("selector")
    text     = body.get("text", "")
    delay    = body.get("delay", 50)
    if not sid or not selector:
        return web.json_response({"error": "sessionId and selector required"}, status=400)
    try:
        page = pool._touch(sid)
        await page.click(selector)
        await page.type(selector, str(text), {"delay": delay})
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@require_auth
async def handle_click(request):
    body     = await request.json()
    sid      = body.get("sessionId")
    selector = body.get("selector")
    if not sid or not selector:
        return web.json_response({"error": "sessionId and selector required"}, status=400)
    try:
        page = pool._touch(sid)
        await page.click(selector)
        return web.json_response({"ok": True, "selector": selector})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@require_auth
async def handle_scroll(request):
    body     = await request.json()
    sid      = body.get("sessionId")
    delta_y  = body.get("deltaY", 500)
    delta_x  = body.get("deltaX", 0)
    if not sid:
        return web.json_response({"error": "sessionId required"}, status=400)
    try:
        page = pool._touch(sid)
        await page.evaluate(f"window.scrollBy({delta_x}, {delta_y})")
        return web.json_response({"ok": True, "deltaX": delta_x, "deltaY": delta_y})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@require_auth
async def handle_screenshot(request):
    body      = await request.json()
    sid       = body.get("sessionId")
    full_page = body.get("fullPage", False)
    if not sid:
        return web.json_response({"error": "sessionId required"}, status=400)
    try:
        page = pool._touch(sid)
        data = await page.screenshot({"fullPage": full_page})
        return web.json_response({
            "ok": True,
            "image": base64.b64encode(data).decode(),
            "mimeType": "image/png",
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@require_auth
async def handle_evaluate(request):
    body       = await request.json()
    sid        = body.get("sessionId")
    expression = body.get("expression")
    if not sid or not expression:
        return web.json_response({"error": "sessionId and expression required"}, status=400)
    try:
        page   = pool._touch(sid)
        result = await page.evaluate(expression)
        return web.json_response({"ok": True, "result": result})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# ─────────────────────────── App setup ───────────────────────────

def build_app():
    app = web.Application()
    app.router.add_get  ("/agent/health",           handle_health)
    app.router.add_post ("/agent/session/create",   handle_create_session)
    app.router.add_delete("/agent/session/{id}",    handle_destroy_session)
    app.router.add_get  ("/agent/sessions",         handle_list_sessions)
    app.router.add_post ("/agent/navigate",         handle_navigate)
    app.router.add_post ("/agent/fill",             handle_fill)
    app.router.add_post ("/agent/type",             handle_type)
    app.router.add_post ("/agent/click",            handle_click)
    app.router.add_post ("/agent/scroll",           handle_scroll)
    app.router.add_post ("/agent/screenshot",       handle_screenshot)
    app.router.add_post ("/agent/evaluate",         handle_evaluate)

    async def on_cleanup(app):
        await pool.shutdown()
    app.on_cleanup.append(on_cleanup)

    return app


if __name__ == "__main__":
    print(f"[HeadlessAgent-Python] Starting on port {PORT} (max sessions: {MAX_SESSIONS})")
    app = build_app()
    web.run_app(app, port=PORT)
