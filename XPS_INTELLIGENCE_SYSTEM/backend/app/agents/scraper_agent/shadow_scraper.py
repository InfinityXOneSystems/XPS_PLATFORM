"""
app/agents/scraper_agent/shadow_scraper.py
==========================================
ShadowScraperHandler — integrates the ShadowRestScraper with the runtime
command-dispatch system (CommandRouter / TaskDispatcher / AgentHandler).

Supported commands
------------------
* ``scrape_website``  — scrape by query + optional city/state
* ``scrape_leads``    — alias for ``scrape_website``
* ``scrape_business_directory`` — scrape a named directory/location string
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ShadowScraperHandler:
    """
    Agent handler that dispatches scraping work to :class:`ShadowRestScraper`.

    The handler is designed to be a drop-in replacement for
    :class:`~app.agents.scraper_agent.scraper.ScraperAgentHandler` so that
    no changes to the command router are required.
    """

    def execute(
        self,
        task_id: str,
        target: Optional[str],
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute a scraping task and return structured results.

        :param task_id:    Unique task identifier (used for logging/tracking).
        :param target:     Free-text scraping target / query.
        :param parameters: Extra parameters:
                           ``command``      — sub-command name
                           ``query``        — search keyword / industry
                           ``city``         — optional city
                           ``state``        — optional state
                           ``location``     — free-text location (city, state)
                           ``max_results``  — cap on returned leads
        :returns: ``{"success": bool, "count": int, "results": [...], "task_id": str}``
        """
        command = parameters.get("_command", "scrape_website")
        query = parameters.get("query") or target or ""
        city = parameters.get("city", "")
        state = parameters.get("state", "")
        location = parameters.get("location", "")
        max_results = int(parameters.get("max_results", 50))

        logger.info(
            "[ShadowScraperHandler] task_id=%s command=%s query=%r city=%s state=%s",
            task_id,
            command,
            query,
            city,
            state,
        )

        try:
            if command in (
                "scrape_website",
                "scrape_leads",
                "run_scraper",
                "scrape_maps",
            ):
                return self._scrape_leads(task_id, query, city, state, max_results)
            elif command == "scrape_business_directory":
                return self._scrape_directory(
                    task_id,
                    query,
                    location or f"{city}, {state}".strip(", "),
                    max_results,
                )
            else:
                # Unknown sub-command — default to general lead scrape
                return self._scrape_leads(task_id, query, city, state, max_results)
        except Exception as exc:
            logger.error("[ShadowScraperHandler] task_id=%s error: %s", task_id, exc)
            return {"success": False, "error": str(exc), "task_id": task_id}

    # ------------------------------------------------------------------
    # Internal dispatch
    # ------------------------------------------------------------------

    def _scrape_leads(
        self,
        task_id: str,
        query: str,
        city: str,
        state: str,
        max_results: int,
    ) -> Dict[str, Any]:
        from app.scrapers.shadow_rest_scraper import ShadowRestScraper

        scraper = ShadowRestScraper()
        results = scraper.scrape(
            query=query, city=city, state=state, max_results=max_results
        )
        return {
            "success": True,
            "count": len(results),
            "results": results,
            "task_id": task_id,
            "source": "shadow_rest_scraper",
        }

    def _scrape_directory(
        self,
        task_id: str,
        query: str,
        location: str,
        max_results: int,
    ) -> Dict[str, Any]:
        from app.scrapers.shadow_rest_scraper import ShadowRestScraper

        scraper = ShadowRestScraper()
        results = scraper.scrape_business_directory(
            query=query, location=location, max_results=max_results
        )
        return {
            "success": True,
            "count": len(results),
            "results": results,
            "task_id": task_id,
            "source": "shadow_rest_scraper_directory",
        }
