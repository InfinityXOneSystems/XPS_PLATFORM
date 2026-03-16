"""
playwright_gateway/playwright_gateway.py
==========================================
Playwright Automation Gateway — Centralised browser automation service.

Capabilities:
  - UI testing via Playwright
  - Web scraping with stealth mode
  - Screenshot capture
  - Form filling and interaction
  - Network request interception

Exposes an MCP-compatible API for integration with the tool registry.

Usage::

    gateway = PlaywrightGateway()
    result = await gateway.navigate("https://example.com")
    screenshot = await gateway.screenshot()
    text = await gateway.extract_text("h1")
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_SCREENSHOT_DIR = Path(os.environ.get("PLAYWRIGHT_SCREENSHOT_DIR", "logs/screenshots"))

try:
    from playwright.async_api import async_playwright, Browser, Page
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False
    logger.warning(
        "[PlaywrightGateway] playwright package not installed. "
        "Run: pip install playwright && playwright install chromium"
    )


class PlaywrightGateway:
    """
    Playwright-backed browser automation gateway.

    Manages a single browser instance (headless Chromium by default)
    and exposes high-level methods for navigation, scraping, and testing.
    """

    def __init__(
        self,
        headless: bool = True,
        viewport_width: int = 1280,
        viewport_height: int = 800,
        timeout_ms: int = 30_000,
    ) -> None:
        self.headless = headless
        self.viewport_width = viewport_width
        self.viewport_height = viewport_height
        self.timeout_ms = timeout_ms
        self._browser: Optional[Any] = None
        self._page: Optional[Any] = None
        self._playwright: Optional[Any] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the browser instance."""
        if not _PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("playwright is not installed. Run: pip install playwright && playwright install chromium")

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        self._page = await self._browser.new_page()
        await self._page.set_viewport_size({
            "width": self.viewport_width,
            "height": self.viewport_height,
        })
        self._page.set_default_timeout(self.timeout_ms)
        logger.info("[PlaywrightGateway] Browser started (headless=%s)", self.headless)

    async def stop(self) -> None:
        """Stop the browser instance."""
        try:
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[PlaywrightGateway] Error during stop: %s", exc)
        finally:
            self._browser = None
            self._page = None
            self._playwright = None
            logger.info("[PlaywrightGateway] Browser stopped")

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    async def navigate(self, url: str, wait_for: str = "networkidle") -> Dict[str, Any]:
        """Navigate to a URL."""
        self._require_started()
        logger.info("[PlaywrightGateway] Navigating to %s", url)
        response = await self._page.goto(url, wait_until=wait_for)
        return {
            "url": url,
            "status": response.status if response else None,
            "title": await self._page.title(),
        }

    async def screenshot(
        self,
        full_page: bool = False,
        path: Optional[str] = None,
        selector: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Take a screenshot of the current page."""
        self._require_started()

        _SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        if path is None:
            import time
            path = str(_SCREENSHOT_DIR / f"screenshot_{int(time.time())}.png")

        if selector:
            element = await self._page.query_selector(selector)
            if element:
                await element.screenshot(path=path)
            else:
                raise ValueError(f"Selector '{selector}' not found")
        else:
            await self._page.screenshot(path=path, full_page=full_page)

        logger.info("[PlaywrightGateway] Screenshot saved: %s", path)
        return {"path": path, "full_page": full_page}

    async def click(self, selector: str) -> Dict[str, Any]:
        """Click an element."""
        self._require_started()
        await self._page.click(selector)
        return {"action": "click", "selector": selector}

    async def type_text(self, selector: str, text: str) -> Dict[str, Any]:
        """Type text into an element."""
        self._require_started()
        await self._page.fill(selector, text)
        return {"action": "type", "selector": selector}

    async def extract_text(self, selector: str = "body") -> str:
        """Extract text content from an element."""
        self._require_started()
        element = await self._page.query_selector(selector)
        if element is None:
            return ""
        return await element.inner_text()

    async def extract_links(self) -> List[str]:
        """Extract all links from the current page."""
        self._require_started()
        handles = await self._page.query_selector_all("a[href]")
        links: List[str] = []
        for handle in handles:
            href = await handle.get_attribute("href")
            if href:
                links.append(href)
        return links

    async def get_html(self, selector: str = "body") -> str:
        """Get the HTML content of an element."""
        self._require_started()
        element = await self._page.query_selector(selector)
        if element is None:
            return ""
        return await element.inner_html()

    async def wait_for_selector(self, selector: str, timeout_ms: Optional[int] = None) -> bool:
        """Wait for a selector to appear. Returns True if found."""
        self._require_started()
        try:
            await self._page.wait_for_selector(
                selector, timeout=timeout_ms or self.timeout_ms
            )
            return True
        except Exception:  # noqa: BLE001
            return False

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "PlaywrightGateway":
        await self.start()
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.stop()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _require_started(self) -> None:
        if self._page is None:
            raise RuntimeError(
                "PlaywrightGateway not started. Call await gateway.start() first "
                "or use it as an async context manager."
            )
