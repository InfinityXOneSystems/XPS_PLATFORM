import re
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import structlog
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper

logger = structlog.get_logger()

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
NAME_PATTERNS = [
    re.compile(
        r"(?:Owner|Founder|CEO|President|Principal)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)",
        re.I,
    ),
    re.compile(r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s*[,\-]?\s*(?:Owner|Founder|CEO)", re.I),
]


class WebsiteCrawler(BaseScraper):
    """Crawls a company website to extract contact information."""

    def scrape(self, query: str, city: str = "", state: str = "") -> list:
        return self.crawl(query)

    def parse_results(self, raw_content: str) -> list:
        return []

    def crawl(self, url: str) -> Dict[str, Any]:
        self.logger.info("crawling_website", url=url)
        result: Dict[str, Any] = {"website": url}

        try:
            response = self.fetch(url)
            html = response.text
            soup = BeautifulSoup(html, "html.parser")

            result["emails"] = self._extract_emails(html)
            result["phones"] = self._extract_phones(html)
            result["owner_name"] = self._extract_owner_name(soup)

            # Try About page for more contact info
            about_url = self._find_about_url(soup, url)
            if about_url:
                try:
                    about_resp = self.fetch(about_url)
                    about_soup = BeautifulSoup(about_resp.text, "html.parser")
                    result["emails"] = list(
                        set(result["emails"] + self._extract_emails(about_resp.text))
                    )
                    result["phones"] = list(
                        set(result["phones"] + self._extract_phones(about_resp.text))
                    )
                    if not result["owner_name"]:
                        result["owner_name"] = self._extract_owner_name(about_soup)
                except Exception:
                    pass

        except Exception as e:
            self.logger.error("website_crawl_failed", url=url, error=str(e))

        return result

    def _extract_emails(self, text: str) -> list:
        found = EMAIL_PATTERN.findall(text)
        # Filter out common false positives
        return [
            e
            for e in set(found)
            if not any(
                skip in e
                for skip in ["example.", "domain.", "yoursite.", "sentry.", "w3.org"]
            )
        ]

    def _extract_phones(self, text: str) -> list:
        return list(set(PHONE_PATTERN.findall(text)))[:5]

    def _extract_owner_name(self, soup: BeautifulSoup) -> Optional[str]:
        text = soup.get_text(" ", strip=True)
        for pattern in NAME_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1).strip()
        return None

    def _find_about_url(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        for link in soup.find_all("a", href=True):
            href = link["href"].lower()
            text = link.get_text(strip=True).lower()
            if (
                "about" in href
                or "contact" in href
                or "about" in text
                or "contact" in text
            ):
                return urljoin(base_url, link["href"])
        return None
