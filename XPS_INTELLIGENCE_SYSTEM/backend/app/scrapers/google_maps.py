import re
from typing import Any, Dict, List
from urllib.parse import quote_plus

import structlog
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper

logger = structlog.get_logger()


class GoogleMapsScraper(BaseScraper):
    """
    Scrapes business listings from Google Maps search results.
    Note: Google Maps has anti-scraping protections. In production, use
    the Google Places API or a third-party data provider.
    """

    BASE_URL = "https://www.google.com/maps/search/"

    def scrape(
        self, query: str, city: str = "", state: str = ""
    ) -> List[Dict[str, Any]]:
        location = f"{city} {state}".strip() if city or state else ""
        full_query = f"{query} {location}".strip()
        search_url = f"{self.BASE_URL}{quote_plus(full_query)}"

        self.logger.info("scraping_google_maps", query=full_query, url=search_url)

        try:
            response = self.fetch(search_url)
            return self.parse_results(response.text)
        except Exception as e:
            self.logger.error("google_maps_scrape_failed", error=str(e))
            return self._generate_sample_results(query, city, state)

    def parse_results(self, raw_content: str) -> List[Dict[str, Any]]:
        results = []
        soup = BeautifulSoup(raw_content, "html.parser")

        # Google Maps renders content dynamically via JS - parse embedded JSON
        scripts = soup.find_all("script")
        for script in scripts:
            content = script.string or ""
            if "window.APP_INITIALIZATION_STATE" in content or "APP_FLAGS" in content:
                businesses = self._extract_from_js(content)
                results.extend(businesses)

        return results[:50]

    def _extract_from_js(self, js_content: str) -> List[Dict[str, Any]]:
        results = []
        # Extract phone numbers
        phones = re.findall(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", js_content)
        # Extract ratings
        ratings = re.findall(r'"(\d\.\d)"\s*,\s*"(\d+)\s*reviews?"', js_content)

        for i, (rating, reviews) in enumerate(ratings[:20]):
            results.append(
                {
                    "rating": float(rating),
                    "reviews": int(reviews),
                    "phone": phones[i] if i < len(phones) else None,
                    "source": "google_maps",
                }
            )
        return results

    def _generate_sample_results(
        self, query: str, city: str, state: str
    ) -> List[Dict[str, Any]]:
        """Return structured placeholder when scraping is blocked."""
        return [
            {
                "company_name": f"Sample {query.title()} Co #{i}",
                "city": city or "Unknown",
                "state": state or "TX",
                "industry": query,
                "source": "google_maps_sample",
                "rating": round(3.5 + (i % 15) * 0.1, 1),
                "reviews": (i + 1) * 7,
            }
            for i in range(10)
        ]
