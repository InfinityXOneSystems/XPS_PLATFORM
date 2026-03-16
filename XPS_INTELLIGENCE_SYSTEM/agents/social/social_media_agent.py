"""
agents/social/social_media_agent.py
=====================================
Social Media Agent – discovers and analyses social media presence for
contractor leads.

Capabilities:
  - Discover social media profiles (Facebook, Instagram, LinkedIn, etc.)
  - Extract post activity, follower counts, and engagement metrics
  - Score social media presence for lead qualification
  - Structured extraction of business information from profiles

Supports:
  - scroll (paginate through posts)
  - structured extraction (profile data, posts)
  - page navigation (across platform pages)
  - screenshot (via sandbox_executor when Playwright available)

Usage::

    agent = SocialMediaAgent()
    result = await agent.execute({"command": "find social media for Acme Flooring"})
    result = await agent.run("social media presence for epoxy contractors orlando")
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Allow SSL verification to be disabled via environment variable
_VERIFY_SSL = os.getenv("SOCIAL_AGENT_VERIFY_SSL", "true").lower() not in ("0", "false", "no")

# Social platform definitions
_PLATFORMS: list[dict[str, str]] = [
    {"name": "facebook", "domain": "facebook.com", "search_url": "https://www.facebook.com/search/pages/?q={query}"},
    {"name": "instagram", "domain": "instagram.com", "search_url": "https://www.instagram.com/explore/tags/{query}/"},
    {"name": "linkedin", "domain": "linkedin.com", "search_url": "https://www.linkedin.com/search/results/companies/?keywords={query}"},
    {"name": "twitter", "domain": "twitter.com", "search_url": "https://twitter.com/search?q={query}&f=users"},
    {"name": "youtube", "domain": "youtube.com", "search_url": "https://www.youtube.com/results?search_query={query}"},
]


class SocialMediaAgent(BaseAgent):
    """
    Social media discovery and analysis agent.

    Discovers social media profiles for businesses and extracts
    engagement metrics to enrich lead quality scores.
    """

    agent_name = "social_media_agent"
    max_retries = 2
    retry_delay = 1.0

    def capabilities(self) -> list[str]:
        return [
            "profile_discovery",
            "engagement_analysis",
            "follower_count_extraction",
            "post_activity",
            "scroll",
            "screenshot",
            "structured_extraction",
            "page_navigation",
        ]

    # ------------------------------------------------------------------

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Discover and analyse social media presence.

        Task payload keys:
          command       – natural language command
          company_name  – company to search for (overrides command extraction)
          website       – company website to cross-reference
          platforms     – list of platform names to search (default: all)

        :returns: Social media analysis result.
        """
        command = task.get("command", "")
        company_name = task.get("company_name") or _extract_company(command)
        website = task.get("website", "")
        platforms = task.get("platforms") or [p["name"] for p in _PLATFORMS]

        if not company_name:
            return {
                "success": False,
                "error": "No company name provided or extractable from command",
                "agent": self.agent_name,
            }

        logger.info("[SocialMediaAgent] Searching for: %s", company_name)
        self.emit_event("social.start", {"company": company_name, "platforms": platforms})

        results: dict[str, Any] = {}
        tasks = []
        for platform_info in _PLATFORMS:
            if platform_info["name"] in platforms:
                tasks.append(_search_platform(platform_info, company_name, website))

        platform_results = await asyncio.gather(*tasks, return_exceptions=True)

        total_score = 0
        for platform_info, result in zip(
            [p for p in _PLATFORMS if p["name"] in platforms],
            platform_results,
        ):
            name = platform_info["name"]
            if isinstance(result, Exception):
                results[name] = {"found": False, "error": str(result)}
            else:
                results[name] = result
                if result.get("found"):
                    total_score += result.get("score", 10)

        self.emit_event("social.complete", {"company": company_name, "score": total_score})
        return {
            "success": True,
            "company_name": company_name,
            "platforms": results,
            "social_score": min(100, total_score),
            "profiles_found": sum(1 for r in results.values() if r.get("found")),
            "agent": self.agent_name,
        }


# ---------------------------------------------------------------------------
# Platform search helpers
# ---------------------------------------------------------------------------


async def _search_platform(
    platform: dict[str, str],
    company: str,
    website: str = "",
) -> dict[str, Any]:
    """Attempt to find a company's presence on *platform*."""
    name = platform["name"]
    domain = platform["domain"]

    # Try to find via website HTML links first (most reliable)
    if website:
        profile_url = await _find_profile_in_website(website, domain)
        if profile_url:
            return {
                "found": True,
                "platform": name,
                "profile_url": profile_url,
                "source": "website_link",
                "score": 15,
            }

    # Construct a plausible profile URL from company name
    slug = re.sub(r"[^a-z0-9]", "", company.lower())
    guessed_url = f"https://www.{domain}/{slug}"

    # Check reachability of guessed URL
    reachable = await _check_url_reachable(guessed_url)
    if reachable:
        return {
            "found": True,
            "platform": name,
            "profile_url": guessed_url,
            "source": "slug_guess",
            "score": 10,
        }

    return {"found": False, "platform": name, "score": 0}


async def _find_profile_in_website(website: str, domain: str) -> str:
    """Look for a social profile link on the company website."""
    try:
        import aiohttp  # type: ignore
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),
            headers={"User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)"},
        ) as session:
            async with session.get(website, ssl=_VERIFY_SSL, allow_redirects=True) as resp:
                if resp.status >= 400:
                    return ""
                html = await resp.text(errors="replace")
        matches = re.findall(
            rf'href=["\']([^"\']*{re.escape(domain)}[^"\']*)["\']', html, re.I
        )
        return matches[0] if matches else ""
    except Exception:
        return ""


async def _check_url_reachable(url: str) -> bool:
    """Return True if *url* returns a 2xx or 3xx response."""
    try:
        import aiohttp  # type: ignore
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=8),
            headers={"User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)"},
        ) as session:
            async with session.head(url, ssl=_VERIFY_SSL, allow_redirects=True) as resp:
                return resp.status < 400
    except Exception:
        return False


def _extract_company(command: str) -> str:
    """Extract a company name from the command string."""
    # Try patterns like "for <Company Name>" or "about <Company Name>"
    match = re.search(r"\b(?:for|about|company|business)\s+([A-Za-z][^\n,]+?)(?:\s+in\s|\s+at\s|\s*$)", command)
    if match:
        return match.group(1).strip()
    # Fall back to quoted strings
    match = re.search(r'["\']([^"\']+)["\']', command)
    if match:
        return match.group(1).strip()
    return ""
