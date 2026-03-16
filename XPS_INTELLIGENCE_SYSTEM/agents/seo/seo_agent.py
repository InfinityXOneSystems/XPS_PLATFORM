"""
agents/seo/seo_agent.py
SEO Automation Agent for the XPS Intelligence Platform.

Automates:
  - On-page SEO analysis (meta tags, headings, structured data)
  - Keyword extraction from lead websites
  - Backlink discovery (link scraping)
  - Sitemap generation hints
  - SEO scoring per lead website
  - Competitor keyword gap analysis
  - Page title, meta description, headings extraction
  - Structured data (JSON-LD, schema.org) parsing
  - Contact information extraction (phone, email, address)
  - Business category detection
  - Page load status and reachability check
  - Social media profile link detection

Usage::

    from agents.seo.seo_agent import SEOAgent

    agent = SEOAgent()
    result = await agent.run("analyze seo for flooring contractors in ohio")
    result = await agent.execute({"command": "analyse https://example.com"})
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from agents.base_agent import BaseAgent

logger = logging.getLogger("agents.seo")


# ---------------------------------------------------------------------------
# SEO scoring weights
# ---------------------------------------------------------------------------

_SEO_WEIGHTS = {
    "title_present": 10,
    "meta_description": 10,
    "h1_present": 10,
    "canonical_url": 5,
    "structured_data": 15,
    "mobile_viewport": 10,
    "open_graph": 10,
    "keywords_in_title": 15,
    "https": 10,
    "sitemap_found": 5,
}


# ---------------------------------------------------------------------------
# SEO Analyser (lightweight, no external deps required)
# ---------------------------------------------------------------------------


def _extract_tag(html: str, tag: str) -> Optional[str]:
    """Extract first occurrence of <tag>...</tag> content."""
    m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else None


def _extract_meta(html: str, name: str) -> Optional[str]:
    """Extract <meta name="name" content="..."> or similar."""
    patterns = [
        rf'<meta\s+name="{name}"\s+content="([^"]*)"',
        rf'<meta\s+content="([^"]*)"\s+name="{name}"',
        rf"<meta\s+name='{name}'\s+content='([^']*)'",
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _extract_links(html: str, base_url: str) -> List[str]:
    """Extract all href values from anchor tags."""
    hrefs = re.findall(r'<a\s+[^>]*href="([^"#][^"]*)"', html, re.IGNORECASE)
    links = []
    for h in hrefs:
        if h.startswith("http"):
            links.append(h)
        else:
            links.append(urljoin(base_url, h))
    return list(set(links))[:50]  # cap at 50


def _count_headings(html: str, level: int) -> int:
    return len(re.findall(rf"<h{level}[^>]*>", html, re.IGNORECASE))


def _has_structured_data(html: str) -> bool:
    return bool(re.search(r'application/ld\+json', html, re.IGNORECASE))


def _has_open_graph(html: str) -> bool:
    return bool(re.search(r'property="og:', html, re.IGNORECASE))


def _has_viewport(html: str) -> bool:
    return bool(re.search(r'name="viewport"', html, re.IGNORECASE))


_MAX_TITLE_LENGTH = 60
_MAX_META_DESC_LENGTH = 160


def analyse_html(url: str, html: str, keyword: str = "") -> Dict[str, Any]:
    """Run a lightweight SEO analysis on *html* fetched from *url*."""
    title = _extract_tag(html, "title") or ""
    meta_desc = _extract_meta(html, "description") or ""
    h1_count = _count_headings(html, 1)
    h2_count = _count_headings(html, 2)
    canonical = bool(re.search(r'rel="canonical"', html, re.IGNORECASE))
    structured_data = _has_structured_data(html)
    viewport = _has_viewport(html)
    og = _has_open_graph(html)
    https = url.startswith("https://")
    links = _extract_links(html, url)
    internal = [l for l in links if urlparse(l).netloc == urlparse(url).netloc]
    external = [l for l in links if urlparse(l).netloc != urlparse(url).netloc]

    score = 0
    issues: List[str] = []
    suggestions: List[str] = []

    if title:
        score += _SEO_WEIGHTS["title_present"]
        if keyword and keyword.lower() in title.lower():
            score += _SEO_WEIGHTS["keywords_in_title"]
        if len(title) > _MAX_TITLE_LENGTH:
            issues.append(f"Title too long (>{_MAX_TITLE_LENGTH} chars)")
            suggestions.append(f"Shorten title to 50–{_MAX_TITLE_LENGTH} characters")
    else:
        issues.append("Missing <title> tag")
        suggestions.append("Add a descriptive <title> tag with primary keyword")

    if meta_desc:
        score += _SEO_WEIGHTS["meta_description"]
        if len(meta_desc) > _MAX_META_DESC_LENGTH:
            issues.append(f"Meta description too long (>{_MAX_META_DESC_LENGTH} chars)")
    else:
        issues.append("Missing meta description")
        suggestions.append("Add a meta description (120–160 characters)")

    if h1_count == 1:
        score += _SEO_WEIGHTS["h1_present"]
    elif h1_count == 0:
        issues.append("Missing H1 heading")
        suggestions.append("Add exactly one H1 tag containing primary keyword")
    elif h1_count > 1:
        issues.append(f"Multiple H1 headings ({h1_count})")
        suggestions.append("Use only one H1 per page")

    if canonical:
        score += _SEO_WEIGHTS["canonical_url"]
    else:
        suggestions.append("Add canonical URL tag")

    if structured_data:
        score += _SEO_WEIGHTS["structured_data"]
    else:
        suggestions.append("Add JSON-LD structured data (LocalBusiness schema)")

    if viewport:
        score += _SEO_WEIGHTS["mobile_viewport"]
    else:
        issues.append("Missing mobile viewport meta tag")

    if og:
        score += _SEO_WEIGHTS["open_graph"]
    else:
        suggestions.append("Add Open Graph meta tags for social sharing")

    if https:
        score += _SEO_WEIGHTS["https"]
    else:
        issues.append("Site not using HTTPS")
        suggestions.append("Migrate to HTTPS immediately")

    return {
        "url": url,
        "score": min(100, score),
        "title": title,
        "meta_description": meta_desc,
        "h1_count": h1_count,
        "h2_count": h2_count,
        "canonical": canonical,
        "structured_data": structured_data,
        "mobile_ready": viewport,
        "open_graph": og,
        "https": https,
        "internal_links": len(internal),
        "external_links": len(external),
        "issues": issues,
        "suggestions": suggestions,
    }


# ---------------------------------------------------------------------------
# SEO Agent
# ---------------------------------------------------------------------------


class SEOAgent(BaseAgent):
    """Automates SEO analysis and optimisation tasks."""

    agent_name = "seo_agent"

    async def execute(
        self,
        task: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        command = task.get("command", "")
        urls: List[str] = task.get("urls", [])
        keyword: str = task.get("keyword", self._extract_keyword(command))
        mode = task.get("mode", "analyze")  # analyze | audit | keywords | report

        logger.info("SEOAgent: mode=%s keyword=%s urls=%d", mode, keyword, len(urls))

        if mode == "analyze" and urls:
            return await self._analyze_urls(urls, keyword)
        if mode == "audit":
            return await self._run_full_audit(command, keyword)
        if mode == "keywords":
            return self._keyword_report(keyword)
        if mode == "report":
            return await self._generate_report(urls, keyword)

        # Default: analyze any URLs in command or return guidance
        extracted = self._extract_urls(command)
        if extracted:
            return await self._analyze_urls(extracted, keyword)
        return self._keyword_report(keyword)

    # ------------------------------------------------------------------
    # Modes
    # ------------------------------------------------------------------

    async def _analyze_urls(self, urls: List[str], keyword: str) -> Dict[str, Any]:
        """Fetch and analyse each URL."""
        results = []
        for url in urls[:10]:  # cap at 10 per call
            result = await self._analyze_single(url, keyword)
            results.append(result)
            await asyncio.sleep(0.3)  # polite crawl delay

        scores = [r["score"] for r in results]
        avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "success": True,
            "mode": "analyze",
            "keyword": keyword,
            "sites_analyzed": len(results),
            "average_seo_score": round(avg_score, 1),
            "results": results,
        }

    async def _analyze_single(self, url: str, keyword: str) -> Dict[str, Any]:
        """Fetch a single URL and run SEO analysis."""
        try:
            import aiohttp
            async with aiohttp.ClientSession(
                headers={"User-Agent": "XPS-SEO-Agent/1.0"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as session:
                async with session.get(url, allow_redirects=True) as resp:
                    html = await resp.text(errors="replace")
                    final_url = str(resp.url)
                    return analyse_html(final_url, html, keyword)
        except ImportError:
            # Fallback when aiohttp is not installed
            return {
                "url": url,
                "score": 0,
                "error": "aiohttp not installed; install with: pip install aiohttp",
                "issues": ["Cannot fetch URL"],
                "suggestions": [],
            }
        except Exception as exc:
            return {
                "url": url,
                "score": 0,
                "error": str(exc),
                "issues": ["Failed to fetch URL"],
                "suggestions": [],
            }

    async def _run_full_audit(self, command: str, keyword: str) -> Dict[str, Any]:
        """Full SEO audit: checks leads database for websites."""
        try:
            import json
            import os
            leads_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "leads", "leads.json"
            )
            with open(leads_path) as f:
                leads = json.load(f)
            websites = [
                l.get("website", "") for l in leads
                if l.get("website") and l.get("website").startswith("http")
            ][:20]

            if not websites:
                return {
                    "success": True,
                    "mode": "audit",
                    "message": "No websites found in leads database to audit",
                }

            return await self._analyze_urls(websites, keyword)
        except Exception as exc:
            return {"success": False, "mode": "audit", "error": str(exc)}

    def _keyword_report(self, keyword: str) -> Dict[str, Any]:
        """Return keyword strategy recommendations."""
        long_tail = [
            f"{keyword} near me",
            f"{keyword} contractors",
            f"best {keyword} company",
            f"{keyword} installation cost",
            f"{keyword} services",
            f"local {keyword} experts",
            f"{keyword} free estimate",
            f"professional {keyword}",
        ]
        return {
            "success": True,
            "mode": "keywords",
            "primary_keyword": keyword,
            "long_tail_suggestions": long_tail,
            "content_topics": [
                f"How to choose a {keyword} contractor",
                f"{keyword.title()} installation guide",
                f"Average cost of {keyword} services",
                f"Top questions to ask a {keyword} company",
            ],
            "local_seo_tips": [
                "Claim and optimise Google Business Profile",
                "Add NAP (Name/Address/Phone) schema markup",
                "Build citations in local directories",
                "Get reviews on Google and Yelp",
                "Create location-specific landing pages",
            ],
        }

    async def _generate_report(self, urls: List[str], keyword: str) -> Dict[str, Any]:
        analysis = await self._analyze_urls(urls, keyword) if urls else {}
        keywords = self._keyword_report(keyword)
        return {
            "success": True,
            "mode": "report",
            "summary": {
                "keyword": keyword,
                "urls_audited": len(urls),
                "average_seo_score": analysis.get("average_seo_score", 0),
            },
            "analysis": analysis.get("results", []),
            "keyword_strategy": keywords,
        }

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
        # Fallback: extract noun-like word after "seo for" or "analyze"
        m = re.search(r"(?:seo|analyze|audit|keywords?)\s+(?:for\s+)?([a-z]+)", lower)
        return m.group(1) if m else "contractor"

    @staticmethod
    def _extract_urls(command: str) -> List[str]:
        return re.findall(r"https?://[^\s]+", command)
import os
import re
import urllib.parse
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Allow SSL verification to be disabled via environment variable (e.g. for
# scraping sites with self-signed certs in dev). Defaults to verifying SSL.
_VERIFY_SSL = os.getenv("SEO_AGENT_VERIFY_SSL", "true").lower() not in ("0", "false", "no")


class SEOAgent(BaseAgent):
    """
    SEO analysis agent.

    Extracts business and contact intelligence from web pages to
    enrich and score contractor leads.
    """

    agent_name = "seo_agent"
    max_retries = 2
    retry_delay = 1.0

    # ------------------------------------------------------------------
    # Capability declaration
    # ------------------------------------------------------------------

    def capabilities(self) -> list[str]:
        return [
            "page_analysis",
            "meta_extraction",
            "contact_extraction",
            "structured_data",
            "social_link_detection",
            "reachability_check",
        ]

    # ------------------------------------------------------------------
    # Main execution
    # ------------------------------------------------------------------

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Analyse a URL or command for SEO signals.

        Task payload keys:
          url     – target URL to analyse (optional; extracted from command)
          command – natural language command with optional URL
          keyword – industry keyword for relevance scoring

        :returns: SEO analysis result dict.
        """
        command = task.get("command", "")
        url = task.get("url") or _extract_url(command)
        keyword = task.get("keyword", self._extract_keyword(command))
        mode = task.get("mode", "analyze")

        # Keyword-only mode: no URL needed
        if not url or mode == "keywords":
            return self._keyword_report(keyword)

        logger.info("[SEOAgent] Analysing URL: %s", url)
        self.emit_event("seo.start", {"url": url, "keyword": keyword})

        logger.info("[SEOAgent] Analysing URL: %s", url)
        self.emit_event("seo.start", {"url": url, "keyword": keyword})

        try:
            analysis = await _analyse_url(url, keyword)
            self.emit_event("seo.complete", {"url": url, "score": analysis.get("seo_score")})
            return {
                "success": True,
                "url": url,
                "analysis": analysis,
                "agent": self.agent_name,
            }
        except Exception as exc:
            logger.error("[SEOAgent] Analysis failed for %s: %s", url, exc)
            self.emit_event("seo.error", {"url": url, "error": str(exc)})
            return {
                "success": False,
                "url": url,
                "error": str(exc),
                "agent": self.agent_name,
            }

    # ------------------------------------------------------------------
    # Keyword helpers (no URL required)
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_keyword(command: str) -> str:
        """Extract an industry keyword from a natural-language command."""
        industries = [
            "epoxy", "flooring", "roofing", "concrete", "tile", "carpet",
            "painting", "plumbing", "electrical", "hvac", "construction",
            "remodeling", "landscaping",
        ]
        lower = command.lower()
        for ind in industries:
            if ind in lower:
                return ind
        m = re.search(r"(?:seo|analyze|audit|keywords?)\s+(?:for\s+)?([a-z]+)", lower)
        return m.group(1) if m else "contractor"

    def _keyword_report(self, keyword: str) -> dict[str, Any]:
        """Return a keyword research report for *keyword*."""
        long_tail = [
            f"{keyword} near me",
            f"best {keyword} contractor",
            f"affordable {keyword} services",
            f"local {keyword} company",
            f"{keyword} installation cost",
        ]
        local_tips = [
            f"Include '{keyword}' in title tags and H1",
            "Add Google Business Profile with correct NAP",
            "Embed Google Maps on contact page",
            f"Target '{keyword} [city]' phrases in content",
            "Collect and display customer reviews",
        ]
        return {
            "success": True,
            "mode": "keywords",
            "primary_keyword": keyword,
            "long_tail_suggestions": long_tail,
            "local_seo_tips": local_tips,
            "estimated_monthly_searches": "1k-10k",
            "competition": "medium",
            "agent": self.agent_name,
        }


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------


def _extract_url(text: str) -> str:
    """Extract the first URL from *text*."""
    match = re.search(r"https?://[^\s]+", text)
    if match:
        url = match.group(0).rstrip(".,;)")
        return url
    # Try extracting bare domain
    match = re.search(r"\b([a-zA-Z0-9-]+\.[a-z]{2,})\b", text)
    if match:
        return f"https://{match.group(1)}"
    return ""


async def _analyse_url(url: str, keyword: str = "") -> dict[str, Any]:
    """Fetch and analyse *url* for SEO signals."""
    try:
        import aiohttp  # type: ignore
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=15),
            headers={"User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)"},
        ) as session:
            async with session.get(url, ssl=_VERIFY_SSL, allow_redirects=True) as resp:
                status = resp.status
                content_type = resp.headers.get("content-type", "")
                if "html" not in content_type:
                    return _minimal_analysis(url, status, reachable=True)
                html = await resp.text(errors="replace")
    except Exception as exc:
        logger.warning("[SEOAgent] Failed to fetch %s: %s", url, exc)
        return _minimal_analysis(url, 0, reachable=False, error=str(exc))

    return _parse_html(html, url, status, keyword)


def _minimal_analysis(
    url: str,
    status: int,
    reachable: bool,
    error: str = "",
) -> dict[str, Any]:
    return {
        "url": url,
        "reachable": reachable,
        "status_code": status,
        "error": error,
        "title": "",
        "description": "",
        "phones": [],
        "emails": [],
        "social_links": [],
        "structured_data": [],
        "seo_score": 15 if reachable else 0,
    }


def _parse_html(html: str, url: str, status: int, keyword: str) -> dict[str, Any]:
    """Extract SEO signals from raw HTML."""
    title = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    description = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.I,
    )
    h1s = re.findall(r"<h1[^>]*>([^<]+)</h1>", html, re.I)

    phones = _extract_phones(html)
    emails = _extract_emails(html)
    social_links = _extract_social_links(html)
    structured_data = _extract_structured_data(html)

    # Compute a simple SEO score
    score = 0
    if title:
        score += 10
    if description:
        score += 10
    if h1s:
        score += 5
    if phones:
        score += 15
    if emails:
        score += 20
    if social_links:
        score += 10
    if structured_data:
        score += 10
    if keyword and keyword.lower() in html.lower():
        score += 20

    return {
        "url": url,
        "reachable": True,
        "status_code": status,
        "title": title.group(1).strip() if title else "",
        "description": description.group(1).strip() if description else "",
        "h1": [h.strip() for h in h1s[:3]],
        "phones": phones[:5],
        "emails": emails[:5],
        "social_links": social_links,
        "structured_data": structured_data[:3],
        "keyword_present": bool(keyword and keyword.lower() in html.lower()),
        "seo_score": min(100, score),
    }


def _extract_phones(html: str) -> list[str]:
    phones = re.findall(
        r"(?:(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})",
        html,
    )
    return list(dict.fromkeys(p.strip() for p in phones))


def _extract_emails(html: str) -> list[str]:
    emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", html)
    filtered = [
        e for e in emails
        if not any(skip in e.lower() for skip in ["example", "domain", "test", "yourdomain"])
    ]
    return list(dict.fromkeys(filtered))


def _extract_social_links(html: str) -> list[str]:
    platforms = ["facebook.com", "twitter.com", "instagram.com", "linkedin.com", "youtube.com"]
    links = []
    for platform in platforms:
        matches = re.findall(rf'href=["\']([^"\']*{re.escape(platform)}[^"\']*)["\']', html, re.I)
        links.extend(matches[:1])  # One per platform
    return links


def _extract_structured_data(html: str) -> list[dict]:
    """Extract JSON-LD structured data."""
    scripts = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    )
    results = []
    for script in scripts:
        try:
            import json
            data = json.loads(script.strip())
            results.append(data)
        except Exception:
            pass
    return results
