"""
app/agents/social_agent/social.py
===================================
Social media presence scanner agent handler.

Discovers social media profiles linked from a target website.
"""

import logging
import re
from typing import Any, Dict, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_SOCIAL_PATTERNS = {
    "facebook": re.compile(r"facebook\.com/(?!sharer|share|dialog|tr)[a-zA-Z0-9./_-]+"),
    "twitter": re.compile(r"(?:twitter|x)\.com/(?!share|intent)[a-zA-Z0-9_]+"),
    "instagram": re.compile(r"instagram\.com/[a-zA-Z0-9._]+"),
    "linkedin": re.compile(r"linkedin\.com/(?:company|in)/[a-zA-Z0-9._-]+"),
    "youtube": re.compile(r"youtube\.com/(?:channel|user|@)[a-zA-Z0-9._-]+"),
    "yelp": re.compile(r"yelp\.com/biz/[a-zA-Z0-9_-]+"),
}


class SocialAgentHandler:
    """Scans a website for social media profile links."""

    def execute(
        self,
        task_id: str,
        target: Optional[str],
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not target:
            return {"success": False, "error": "target URL is required for social scan"}

        url = target if target.startswith("http") else f"https://{target}"
        logger.info("social scan: %s (task=%s)", url, task_id)

        try:
            resp = requests.get(
                url, timeout=15, headers={"User-Agent": "XPS-Social-Agent/1.0"}
            )
            resp.raise_for_status()
            html = resp.text
            soup = BeautifulSoup(html, "html.parser")

            # Collect all href values
            hrefs = [
                a.get("href", "")
                for a in soup.find_all("a", href=True)
                if a.get("href")
            ]
            all_text = " ".join(hrefs) + " " + html

            profiles: Dict[str, list] = {}
            for platform, pattern in _SOCIAL_PATTERNS.items():
                matches = list({m.group(0) for m in pattern.finditer(all_text)})
                if matches:
                    profiles[platform] = [f"https://{m}" for m in matches[:3]]

            return {
                "success": True,
                "url": url,
                "profiles_found": len(profiles),
                "profiles": profiles,
                "task_id": task_id,
            }

        except Exception as exc:
            logger.error("social scan failed for %s: %s", url, exc)
            return {"success": False, "error": str(exc), "url": url, "task_id": task_id}
