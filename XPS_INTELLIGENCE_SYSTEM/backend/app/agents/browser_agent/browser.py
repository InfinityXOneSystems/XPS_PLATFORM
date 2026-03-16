"""
app/agents/browser_agent/browser.py
=====================================
Browser automation agent handler.

Provides structured web interactions:
  scroll, click, type, form fill, navigation, screenshots, extraction.

Uses requests + BeautifulSoup for lightweight operations.
Playwright integration is available when PLAYWRIGHT_ENABLED=true.
"""

import logging
import os
from typing import Any, Dict, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_PLAYWRIGHT_ENABLED = os.environ.get("PLAYWRIGHT_ENABLED", "false").lower() == "true"


class BrowserAgentHandler:
    """
    Executes browser automation tasks.

    Supported actions (via 'action' parameter):
      navigate   - Fetch a page and return HTML/text
      extract    - Extract structured data from a page
      screenshot - Take a screenshot (requires Playwright)
      fill_form  - Fill and submit a form (requires Playwright)
    """

    def execute(
        self,
        task_id: str,
        target: Optional[str],
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        action = parameters.get("action", "navigate")
        url = (
            target
            if target and target.startswith("http")
            else f"https://{target or ''}"
        )

        logger.info("browser_agent: action=%s url=%s task=%s", action, url, task_id)

        if action == "navigate":
            return self._navigate(url, task_id, parameters)
        elif action == "extract":
            return self._extract(url, task_id, parameters)
        elif action == "screenshot":
            return self._screenshot(url, task_id, parameters)
        elif action == "fill_form":
            return self._fill_form(url, task_id, parameters)
        else:
            return {"success": False, "error": f"Unknown browser action: '{action}'"}

    def _navigate(
        self, url: str, task_id: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fetch a URL and return title + text content."""
        try:
            resp = requests.get(
                url,
                timeout=parameters.get("timeout", 15),
                headers={"User-Agent": "XPS-Browser/1.0"},
            )
            soup = BeautifulSoup(resp.text, "html.parser")
            title = soup.title.get_text(strip=True) if soup.title else ""
            # Return truncated text
            text = soup.get_text(separator=" ", strip=True)[:2000]
            return {
                "success": True,
                "url": url,
                "status_code": resp.status_code,
                "title": title,
                "content_preview": text,
                "task_id": task_id,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "task_id": task_id}

    def _extract(
        self, url: str, task_id: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract structured data using CSS selectors."""
        selector = parameters.get("selector", "body")
        # Validate selector to prevent overly complex/malicious inputs
        if not isinstance(selector, str) or len(selector) > 200:
            return {
                "success": False,
                "error": "Invalid selector: must be a non-empty string ≤ 200 characters",
                "task_id": task_id,
            }
        try:
            resp = requests.get(
                url, timeout=15, headers={"User-Agent": "XPS-Browser/1.0"}
            )
            soup = BeautifulSoup(resp.text, "html.parser")
            elements = soup.select(selector)
            extracted = [el.get_text(strip=True) for el in elements[:50]]
            return {
                "success": True,
                "url": url,
                "selector": selector,
                "count": len(extracted),
                "items": extracted,
                "task_id": task_id,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "task_id": task_id}

    def _screenshot(
        self, url: str, task_id: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Take a screenshot (requires Playwright)."""
        if not _PLAYWRIGHT_ENABLED:
            return {
                "success": False,
                "error": "Playwright not enabled. Set PLAYWRIGHT_ENABLED=true to use screenshots.",
                "task_id": task_id,
            }
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.goto(url, timeout=30000)
                data = page.screenshot()
                browser.close()
            import base64

            return {
                "success": True,
                "url": url,
                "screenshot_base64": base64.b64encode(data).decode(),
                "task_id": task_id,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "task_id": task_id}

    def _fill_form(
        self, url: str, task_id: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fill and submit a form (requires Playwright)."""
        if not _PLAYWRIGHT_ENABLED:
            return {
                "success": False,
                "error": "Playwright not enabled. Set PLAYWRIGHT_ENABLED=true to fill forms.",
                "task_id": task_id,
            }
        fields = parameters.get("fields", {})
        submit_selector = parameters.get("submit_selector", "[type=submit]")
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.goto(url, timeout=30000)
                for selector, value in fields.items():
                    page.fill(selector, str(value))
                page.click(submit_selector)
                page.wait_for_load_state("networkidle", timeout=10000)
                final_url = page.url
                browser.close()
            return {
                "success": True,
                "url": url,
                "final_url": final_url,
                "fields_filled": list(fields.keys()),
                "task_id": task_id,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "task_id": task_id}
