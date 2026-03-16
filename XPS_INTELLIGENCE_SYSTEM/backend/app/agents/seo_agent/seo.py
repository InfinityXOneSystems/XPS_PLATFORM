"""
app/agents/seo_agent/seo.py
============================
SEO audit agent handler.

Supports:
  - Page title, meta description extraction
  - Heading structure analysis
  - Basic performance hints
"""

import logging
from typing import Any, Dict, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class SEOAgentHandler:
    """Performs SEO audits on target URLs."""

    def execute(
        self,
        task_id: str,
        target: Optional[str],
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not target:
            return {"success": False, "error": "target URL is required for SEO audit"}

        url = target if target.startswith("http") else f"https://{target}"
        logger.info("SEO audit: %s (task=%s)", url, task_id)

        try:
            resp = requests.get(
                url, timeout=15, headers={"User-Agent": "XPS-SEO-Agent/1.0"}
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            title = soup.find("title")
            title_text = title.get_text(strip=True) if title else None

            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                description = meta_desc.get("content", "").strip()  # type: ignore[union-attr]
            else:
                description = None

            headings: Dict[str, int] = {}
            for level in range(1, 7):
                count = len(soup.find_all(f"h{level}"))
                if count:
                    headings[f"h{level}"] = count

            links = len(soup.find_all("a", href=True))
            images = len(soup.find_all("img"))
            images_without_alt = len(
                [img for img in soup.find_all("img") if not img.get("alt")]
            )

            score = 100
            issues = []
            if not title_text:
                score -= 20
                issues.append("Missing page title")
            elif len(title_text) > 60:
                score -= 5
                issues.append(f"Title too long ({len(title_text)} chars)")

            if not description:
                score -= 15
                issues.append("Missing meta description")
            elif len(description) > 160:
                score -= 5
                issues.append(f"Meta description too long ({len(description)} chars)")

            if "h1" not in headings:
                score -= 10
                issues.append("Missing H1 heading")

            if images_without_alt > 0:
                score -= min(10, images_without_alt)
                issues.append(f"{images_without_alt} image(s) missing alt text")

            return {
                "success": True,
                "url": url,
                "seo_score": max(0, score),
                "title": title_text,
                "meta_description": description,
                "headings": headings,
                "links": links,
                "images": images,
                "images_without_alt": images_without_alt,
                "issues": issues,
                "task_id": task_id,
            }

        except Exception as exc:
            logger.error("SEO audit failed for %s: %s", url, exc)
            return {"success": False, "error": str(exc), "url": url, "task_id": task_id}
