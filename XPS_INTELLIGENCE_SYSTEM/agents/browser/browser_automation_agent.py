"""
agents/browser/browser_automation_agent.py
===========================================
Browser Automation Agent – executes browser automation tasks via the
sandbox executor and Playwright (or the existing headless agent).

Capabilities supported:
  - scroll        – scroll page or element
  - form_fill     – fill form fields
  - type          – type text with keyboard events
  - navigate      – navigate to URL
  - screenshot    – capture full-page or element screenshot
  - click         – click elements by selector
  - extract       – structured data extraction from current page

The agent wraps the existing SandboxManager (sandbox/sandbox_manager.js)
via HTTP when the headless REST API server is running, and falls back to
a direct Playwright implementation when not available.

Usage::

    agent = BrowserAutomationAgent()
    result = await agent.execute({
        "command": "screenshot https://example.com",
        "url": "https://example.com",
        "action": "screenshot",
    })
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

HEADLESS_AGENT_URL = os.getenv("HEADLESS_AGENT_URL", "http://localhost:3201")
HEADLESS_API_KEY = os.getenv("HEADLESS_API_KEY", "")


class BrowserAutomationAgent(BaseAgent):
    """
    Playwright-backed browser automation agent.

    Supports: navigate, scroll, form_fill, type, click, screenshot, extract.

    Execution path:
      1. Try via the headless REST API agent (sandbox/sandbox_manager.js)
      2. Fall back to direct Playwright if headless agent unreachable
    """

    agent_name = "browser_automation_agent"
    max_retries = 2
    retry_delay = 2.0

    def capabilities(self) -> list[str]:
        return [
            "navigate",
            "scroll",
            "form_fill",
            "type",
            "click",
            "screenshot",
            "extract",
            "page_navigation",
            "structured_extraction",
        ]

    # ------------------------------------------------------------------

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute a browser automation task.

        Task payload keys:
          action   – one of: navigate, scroll, fill, type, click, screenshot, extract
          url      – target URL
          selector – CSS selector for element-level actions
          text     – text to type/fill
          command  – natural-language command (action/url extracted if not explicit)

        :returns: Action result dict.
        """
        command = task.get("command", "")
        action = task.get("action") or _extract_action(command)
        url = task.get("url") or _extract_url(command)

        logger.info("[BrowserAutomationAgent] action=%s url=%s", action, url)
        self.emit_event("browser.start", {"action": action, "url": url})

        try:
            result = await self._execute_action(action, url, task)
            self.emit_event("browser.complete", {"action": action, "url": url})
            return {
                "success": True,
                "action": action,
                "url": url,
                "result": result,
                "agent": self.agent_name,
            }
        except Exception as exc:
            logger.error("[BrowserAutomationAgent] Action %s failed: %s", action, exc)
            self.emit_event("browser.error", {"action": action, "error": str(exc)})
            return {
                "success": False,
                "action": action,
                "url": url,
                "error": str(exc),
                "agent": self.agent_name,
            }

    # ------------------------------------------------------------------

    async def _execute_action(
        self,
        action: str,
        url: str,
        task: dict[str, Any],
    ) -> Any:
        """Route action to headless agent or direct Playwright fallback."""
        # Try headless REST API first
        headless_result = await self._try_headless_api(action, url, task)
        if headless_result is not None:
            return headless_result

        # Direct Playwright fallback
        return await self._direct_playwright(action, url, task)

    # ------------------------------------------------------------------
    # Headless REST API path
    # ------------------------------------------------------------------

    async def _try_headless_api(
        self,
        action: str,
        url: str,
        task: dict[str, Any],
    ) -> Any:
        """Try to execute via headless REST agent. Returns None on failure."""
        try:
            import aiohttp  # type: ignore
            headers = {"Content-Type": "application/json"}
            if HEADLESS_API_KEY:
                headers["Authorization"] = f"Bearer {HEADLESS_API_KEY}"

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5),
                headers=headers,
            ) as session:
                # Health check
                async with session.get(f"{HEADLESS_AGENT_URL}/agent/health") as resp:
                    if resp.status != 200:
                        return None

            # Dispatch to headless agent
            return await self._call_headless(action, url, task)
        except Exception:
            return None

    async def _call_headless(
        self,
        action: str,
        url: str,
        task: dict[str, Any],
    ) -> Any:
        """Call the headless REST API agent for the given action."""
        import aiohttp  # type: ignore
        headers = {"Content-Type": "application/json"}
        if HEADLESS_API_KEY:
            headers["Authorization"] = f"Bearer {HEADLESS_API_KEY}"

        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            # Create session
            async with session.post(
                f"{HEADLESS_AGENT_URL}/agent/session/create"
            ) as resp:
                session_data = await resp.json()
                session_id = session_data.get("sessionId")

            try:
                # Navigate
                async with session.post(
                    f"{HEADLESS_AGENT_URL}/agent/navigate",
                    json={"sessionId": session_id, "url": url},
                ) as resp:
                    await resp.json()

                # Execute the action
                if action == "screenshot":
                    async with session.post(
                        f"{HEADLESS_AGENT_URL}/agent/screenshot",
                        json={"sessionId": session_id, "fullPage": True},
                    ) as resp:
                        data = await resp.json()
                        return {"screenshot_base64": data.get("screenshot", "")}

                elif action in ("fill", "form_fill"):
                    selector = task.get("selector", "input")
                    text = task.get("text", "")
                    async with session.post(
                        f"{HEADLESS_AGENT_URL}/agent/fill",
                        json={"sessionId": session_id, "selector": selector, "value": text},
                    ) as resp:
                        return await resp.json()

                elif action == "type":
                    selector = task.get("selector", "body")
                    text = task.get("text", "")
                    async with session.post(
                        f"{HEADLESS_AGENT_URL}/agent/type",
                        json={"sessionId": session_id, "selector": selector, "text": text},
                    ) as resp:
                        return await resp.json()

                elif action == "scroll":
                    async with session.post(
                        f"{HEADLESS_AGENT_URL}/agent/scroll",
                        json={"sessionId": session_id, "direction": "down", "distance": 500},
                    ) as resp:
                        return await resp.json()

                elif action == "click":
                    selector = task.get("selector", "")
                    async with session.post(
                        f"{HEADLESS_AGENT_URL}/agent/click",
                        json={"sessionId": session_id, "selector": selector},
                    ) as resp:
                        return await resp.json()

                elif action == "extract":
                    js = task.get(
                        "js",
                        "() => ({ title: document.title, text: document.body.innerText.slice(0, 2000) })",
                    )
                    async with session.post(
                        f"{HEADLESS_AGENT_URL}/agent/evaluate",
                        json={"sessionId": session_id, "script": js},
                    ) as resp:
                        return await resp.json()

                else:  # navigate only
                    return {"navigated": True, "url": url}

            finally:
                # Destroy session
                try:
                    await session.delete(f"{HEADLESS_AGENT_URL}/agent/session/{session_id}")
                except Exception:
                    pass

    # ------------------------------------------------------------------
    # Direct Playwright fallback
    # ------------------------------------------------------------------

    async def _direct_playwright(
        self,
        action: str,
        url: str,
        task: dict[str, Any],
    ) -> Any:
        """Execute action directly with Playwright (no server needed)."""
        try:
            from playwright.async_api import async_playwright  # type: ignore
        except ImportError:
            return {"error": "Playwright not installed", "fallback": "stub", "url": url, "action": action}

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (compatible; XPSBot/1.0)",
                viewport={"width": 1280, "height": 800},
            )
            page = await context.new_page()
            try:
                await page.goto(url, timeout=30000, wait_until="domcontentloaded")

                if action == "screenshot":
                    png = await page.screenshot(full_page=True)
                    return {"screenshot_base64": base64.b64encode(png).decode()}

                elif action in ("fill", "form_fill"):
                    await page.fill(task.get("selector", "input"), task.get("text", ""))
                    return {"filled": True}

                elif action == "type":
                    await page.type(task.get("selector", "body"), task.get("text", ""))
                    return {"typed": True}

                elif action == "scroll":
                    await page.evaluate("window.scrollBy(0, 500)")
                    return {"scrolled": True}

                elif action == "click":
                    await page.click(task.get("selector", ""))
                    return {"clicked": True}

                elif action == "extract":
                    js = task.get(
                        "js",
                        "() => ({ title: document.title, text: document.body.innerText.slice(0, 2000) })",
                    )
                    data = await page.evaluate(js)
                    return {"data": data}

                else:
                    title = await page.title()
                    return {"navigated": True, "title": title}

            finally:
                await context.close()
                await browser.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_action(command: str) -> str:
    """Extract browser action from command string."""
    lower = command.lower()
    if "screenshot" in lower or "capture" in lower:
        return "screenshot"
    if "fill" in lower or "form" in lower:
        return "form_fill"
    if "type" in lower:
        return "type"
    if "scroll" in lower:
        return "scroll"
    if "click" in lower:
        return "click"
    if "extract" in lower or "scrape" in lower or "get data" in lower:
        return "extract"
    return "navigate"


def _extract_url(command: str) -> str:
    """Extract the first URL from *command*."""
    match = re.search(r"https?://[^\s]+", command)
    if match:
        return match.group(0).rstrip(".,;)")
    return ""
