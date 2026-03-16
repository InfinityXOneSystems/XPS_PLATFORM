"""
app/agents/scraper_agent/scraper.py
=====================================
Scraper agent handler for runtime command dispatch.

Delegates to ShadowScraperHandler (real multi-source scraper, no API keys)
with a fallback to the legacy directory scraper.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ScraperAgentHandler:
    """
    Routes scraping commands to the appropriate scraper module.

    By default all commands are forwarded to :class:`ShadowScraperHandler`
    which uses the Shadow REST API Scraper (real data, no API keys).
    """

    def execute(
        self,
        task_id: str,
        target: Optional[str],
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        from app.agents.scraper_agent.shadow_scraper import ShadowScraperHandler

        return ShadowScraperHandler().execute(
            task_id=task_id,
            target=target,
            parameters=parameters,
        )
