"""
agents/social/social_agent.py
================================
Social Media Automation Agent for the XPS Intelligence Platform.

Automates:
  - Social media profile discovery (LinkedIn, Facebook, Instagram)
  - Business page scraping (public info only)
  - Hashtag and keyword monitoring
  - Post scheduling (stub — requires platform API keys)
  - Audience insights aggregation
  - Social lead enrichment (adds social profiles to lead records)

Usage::

    from agents.social.social_agent import SocialAgent

    agent = SocialAgent()
    result = await agent.run("find social profiles for flooring contractors ohio")
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

from agents.base_agent import BaseAgent

logger = logging.getLogger("agents.social")

# ---------------------------------------------------------------------------
# Platform patterns
# ---------------------------------------------------------------------------

_PLATFORM_PATTERNS = {
    "linkedin": [
        r"linkedin\.com/company/([^/\s\"']+)",
        r"linkedin\.com/in/([^/\s\"']+)",
    ],
    "facebook": [
        r"facebook\.com/([^/\s\"'?]+)",
        r"fb\.com/([^/\s\"'?]+)",
    ],
    "instagram": [
        r"instagram\.com/([^/\s\"'?]+)",
    ],
    "twitter": [
        r"twitter\.com/([^/\s\"'?]+)",
        r"x\.com/([^/\s\"'?]+)",
    ],
    "youtube": [
        r"youtube\.com/(?:channel|user|c)/([^/\s\"'?]+)",
    ],
    "yelp": [
        r"yelp\.com/biz/([^/\s\"'?]+)",
    ],
    "houzz": [
        r"houzz\.com/pro/([^/\s\"'?]+)",
    ],
    "angieslist": [
        r"angi\.com/companylist/us/[^/]+/([^/\s\"'?]+)",
    ],
}


def extract_social_profiles(html: str, base_url: str = "") -> Dict[str, List[str]]:
    """Extract social media profile URLs from HTML content."""
    found: Dict[str, List[str]] = {}
    for platform, patterns in _PLATFORM_PATTERNS.items():
        handles = []
        for pattern in patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for m in matches:
                # Filter out generic paths like 'share', 'sharer', 'login'
                if m.lower() not in {"share", "sharer", "login", "signup", "home", "pages"}:
                    handles.append(m)
        if handles:
            found[platform] = list(dict.fromkeys(handles))  # deduplicate, preserve order
    return found


def build_search_url(company: str, platform: str) -> str:
    """Build a search URL for a company on a platform."""
    q = quote_plus(company)
    urls = {
        "linkedin": f"https://www.linkedin.com/search/results/companies/?keywords={q}",
        "facebook": f"https://www.facebook.com/search/pages/?q={q}",
        "instagram": f"https://www.instagram.com/{q.replace('+', '')}",
        "yelp": f"https://www.yelp.com/search?find_desc={q}",
        "houzz": f"https://www.houzz.com/professionals/search?q={q}",
    }
    return urls.get(platform, f"https://www.google.com/search?q={q}+{platform}")


# ---------------------------------------------------------------------------
# Social scoring
# ---------------------------------------------------------------------------


def score_social_presence(profiles: Dict[str, List[str]]) -> int:
    """Score a business's social presence (0–100)."""
    weights = {
        "linkedin": 25,
        "facebook": 20,
        "instagram": 15,
        "yelp": 15,
        "houzz": 15,
        "youtube": 5,
        "twitter": 5,
    }
    score = 0
    for platform, handles in profiles.items():
        if handles:
            score += weights.get(platform, 2)
    return min(100, score)


# ---------------------------------------------------------------------------
# SocialAgent
# ---------------------------------------------------------------------------


class SocialAgent(BaseAgent):
    """Automates social media discovery and analysis for leads."""

    agent_name = "social_agent"

    # Maximum number of URLs / leads to process per execution to keep
    # individual runs bounded and polite.
    _MAX_URLS_PER_RUN: int = 10
    _MAX_LEADS_PER_RUN: int = 20
    _MAX_COMPANIES_PER_RUN: int = 20

    async def execute(
        self,
        task: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        command = task.get("command", "")
        mode = task.get("mode", "discover")
        urls: List[str] = task.get("urls", [])
        companies: List[str] = task.get("companies", [])
        keyword = task.get("keyword", self._extract_keyword(command))

        logger.info(
            "SocialAgent: mode=%s keyword=%s urls=%d companies=%d",
            mode, keyword, len(urls), len(companies),
        )

        if mode == "discover" and urls:
            return await self._discover_from_urls(urls)
        if mode == "enrich":
            return await self._enrich_leads(keyword)
        if mode == "search" and companies:
            return self._build_search_links(companies)
        if mode == "hashtags":
            return self._hashtag_strategy(keyword)
        if mode == "schedule":
            return self._schedule_stub(task)

        # Default: enrich leads in the database
        return await self._enrich_leads(keyword)

    # ------------------------------------------------------------------
    # Modes
    # ------------------------------------------------------------------

    async def _discover_from_urls(self, urls: List[str]) -> Dict[str, Any]:
        """Fetch each URL and extract social profiles."""
        results = []
        for url in urls[:self._MAX_URLS_PER_RUN]:
            result = await self._scrape_profiles(url)
            results.append(result)
            await asyncio.sleep(0.3)

        return {
            "success": True,
            "mode": "discover",
            "sites_processed": len(results),
            "results": results,
        }

    async def _scrape_profiles(self, url: str) -> Dict[str, Any]:
        """Fetch a URL and extract its social media links."""
        try:
            import aiohttp
            async with aiohttp.ClientSession(
                headers={"User-Agent": "XPS-Social-Agent/1.0"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as session:
                async with session.get(url, allow_redirects=True) as resp:
                    html = await resp.text(errors="replace")
                    profiles = extract_social_profiles(html, url)
                    social_score = score_social_presence(profiles)
                    return {
                        "url": url,
                        "social_profiles": profiles,
                        "social_score": social_score,
                        "platform_count": len(profiles),
                    }
        except ImportError:
            return {
                "url": url,
                "error": "aiohttp not installed; install with: pip install aiohttp",
                "social_profiles": {},
                "social_score": 0,
            }
        except Exception as exc:
            return {
                "url": url,
                "error": str(exc),
                "social_profiles": {},
                "social_score": 0,
            }

    async def _enrich_leads(self, keyword: str) -> Dict[str, Any]:
        """Read leads.json, find websites, discover social profiles, update records."""
        try:
            import json
            import os
            leads_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "leads", "leads.json"
            )
            if not os.path.exists(leads_path):
                return {
                    "success": False,
                    "mode": "enrich",
                    "error": "leads.json not found",
                }

            with open(leads_path) as f:
                leads = json.load(f)

            enriched_count = 0
            for lead in leads[:self._MAX_LEADS_PER_RUN]:  # cap enrichment run
                website = lead.get("website", "")
                if not website or not website.startswith("http"):
                    continue
                result = await self._scrape_profiles(website)
                if result.get("social_profiles"):
                    lead["social_profiles"] = result["social_profiles"]
                    lead["social_score"] = result["social_score"]
                    enriched_count += 1
                await asyncio.sleep(0.5)

            # Save back
            with open(leads_path, "w") as f:
                json.dump(leads, f, indent=2)

            return {
                "success": True,
                "mode": "enrich",
                "keyword": keyword,
                "leads_processed": min(self._MAX_LEADS_PER_RUN, len(leads)),
                "leads_enriched": enriched_count,
            }
        except Exception as exc:
            return {"success": False, "mode": "enrich", "error": str(exc)}

    def _build_search_links(self, companies: List[str]) -> Dict[str, Any]:
        """Build search links for companies across platforms."""
        links = []
        for company in companies[:self._MAX_COMPANIES_PER_RUN]:
            company_links = {
                "company": company,
                "search_urls": {
                    platform: build_search_url(company, platform)
                    for platform in ["linkedin", "facebook", "yelp", "houzz"]
                },
            }
            links.append(company_links)

        return {
            "success": True,
            "mode": "search",
            "companies": len(links),
            "results": links,
        }

    def _hashtag_strategy(self, keyword: str) -> Dict[str, Any]:
        """Return a hashtag strategy for the keyword."""
        primary = [
            f"#{keyword}",
            f"#{keyword}contractor",
            f"#{keyword}installation",
            f"#{keyword}services",
        ]
        local = [
            "#localcontractor",
            "#homeimprovement",
            "#construction",
            "#remodeling",
            "#contractor",
        ]
        industry = [
            "#flooring",
            "#tilework",
            "#hardwoodflooring",
            "#epoxyfloor",
            "#concretework",
        ]
        return {
            "success": True,
            "mode": "hashtags",
            "keyword": keyword,
            "primary_hashtags": primary,
            "local_hashtags": local,
            "industry_hashtags": industry,
            "post_template": (
                f"Looking for professional #{keyword} services? "
                "Get a FREE estimate today! "
                f"#{keyword}contractor #homeimprovement #contractor"
            ),
        }

    def _schedule_stub(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Stub for post scheduling — requires platform API keys."""
        return {
            "success": True,
            "mode": "schedule",
            "message": (
                "Post scheduling requires platform API credentials. "
                "Set FACEBOOK_PAGE_TOKEN, INSTAGRAM_TOKEN, or LINKEDIN_TOKEN "
                "environment variables to enable automated posting."
            ),
            "platforms_available": [],
            "platforms_configured": self._check_configured_platforms(),
        }

    def _check_configured_platforms(self) -> List[str]:
        import os
        configured = []
        if os.getenv("FACEBOOK_PAGE_TOKEN"):
            configured.append("facebook")
        if os.getenv("INSTAGRAM_TOKEN"):
            configured.append("instagram")
        if os.getenv("LINKEDIN_TOKEN"):
            configured.append("linkedin")
        return configured

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_keyword(command: str) -> str:
        industries = [
            "epoxy", "flooring", "roofing", "concrete", "tile", "carpet",
            "painting", "plumbing", "electrical", "hvac", "construction",
            "remodeling", "landscaping",
        ]
        lower = command.lower()
        for ind in industries:
            if ind in lower:
                return ind
        return "contractor"
