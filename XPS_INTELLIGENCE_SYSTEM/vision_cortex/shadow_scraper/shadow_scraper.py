"""
vision_cortex/shadow_scraper/shadow_scraper.py
===============================================
Shadow Scraper — Stealth intelligence ingestion for Vision Cortex.

Ingests daily intelligence from seed list sources using:
  - Random delays between requests
  - Rotating user agents
  - Proxy rotation (if configured)
  - Deduplication against existing lead database
  - Automatic storage in Infinity Library

This module is designed to run as a daily cron job or GitHub Action.
"""

from __future__ import annotations

import json
import logging
import random
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_SEED_LIST_PATH = Path(__file__).parent.parent / "seed_list" / "sources.json"

# Rotating user agents for stealth requests
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]


class ShadowScraper:
    """
    Stealth scraper that ingests intelligence from Vision Cortex seed sources.

    Features:
      - Loads sources from seed_list/sources.json
      - Applies random delays (3–15s between requests) to avoid detection
      - Rotates user agents
      - Deduplicates against stored data
      - Returns structured intelligence records
    """

    def __init__(
        self,
        seed_list_path: Optional[Path] = None,
        min_delay_s: float = 3.0,
        max_delay_s: float = 15.0,
    ) -> None:
        self.seed_list_path = seed_list_path or _SEED_LIST_PATH
        self.min_delay_s = min_delay_s
        self.max_delay_s = max_delay_s
        self._sources: List[Dict[str, Any]] = []
        self._load_sources()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Run the shadow scraper against all enabled sources.

        Returns a list of raw intelligence records.
        """
        records: List[Dict[str, Any]] = []
        enabled = [s for s in self._sources if s.get("enabled", False)]

        logger.info(
            "[ShadowScraper] Starting run — %d enabled sources, limit=%d",
            len(enabled), limit,
        )

        for source in enabled:
            if len(records) >= limit:
                break
            try:
                batch = self._scrape_source(source, remaining=limit - len(records))
                records.extend(batch)
                self._random_delay()
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "[ShadowScraper] Error scraping source '%s': %s",
                    source.get("id"), exc,
                )

        logger.info("[ShadowScraper] Run complete — %d records collected", len(records))
        return records

    def get_sources(self) -> List[Dict[str, Any]]:
        """Return all seed list sources."""
        return self._sources

    def get_user_agent(self) -> str:
        """Return a random user agent string."""
        return random.choice(_USER_AGENTS)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _load_sources(self) -> None:
        if self.seed_list_path.exists():
            with open(self.seed_list_path) as fh:
                self._sources = json.load(fh)
            logger.info("[ShadowScraper] Loaded %d sources from seed list", len(self._sources))
        else:
            logger.warning("[ShadowScraper] Seed list not found at %s", self.seed_list_path)
            self._sources = []

    def _scrape_source(
        self, source: Dict[str, Any], remaining: int
    ) -> List[Dict[str, Any]]:
        """
        Scrape a single source. Returns structured records.

        This is a stub — real implementation delegates to the appropriate
        scraper (google_maps_scraper.js, yelp_scraper.js, etc.) via
        the MCP gateway or subprocess call.
        """
        source_type = source.get("type", "unknown")
        source_id = source.get("id", "unknown")

        logger.info(
            "[ShadowScraper] Scraping source=%s type=%s",
            source_id, source_type,
        )

        # Stub: return empty list — replace with real scraper invocation
        return []

    def _random_delay(self) -> None:
        """Apply a random delay to reduce detection risk."""
        delay = random.uniform(self.min_delay_s, self.max_delay_s)
        logger.debug("[ShadowScraper] Waiting %.1fs", delay)
        time.sleep(delay)
