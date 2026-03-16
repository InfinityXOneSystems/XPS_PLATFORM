import re
from typing import Any, Dict, List

import structlog
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper

logger = structlog.get_logger()


class DirectoryScraper(BaseScraper):
    """Scrapes contractor directories like YellowPages."""

    YELLOWPAGES_URL = "https://www.yellowpages.com/search"

    def scrape(
        self, query: str, city: str = "", state: str = ""
    ) -> List[Dict[str, Any]]:
        location = f"{city}, {state}" if city and state else state or city
        self.logger.info(
            "scraping_directory", source="yellowpages", query=query, location=location
        )

        try:
            params = {"search_terms": query, "geo_location_terms": location}
            response = self.fetch(self.YELLOWPAGES_URL, params=params)
            return self.parse_results(response.text)
        except Exception as e:
            self.logger.error("directory_scrape_failed", error=str(e))
            return []

    def parse_results(self, raw_content: str) -> List[Dict[str, Any]]:
        soup = BeautifulSoup(raw_content, "html.parser")
        results = []

        listings = soup.find_all(
            "div", class_=re.compile(r"result|listing|business", re.I)
        )
        for listing in listings[:50]:
            try:
                name_el = listing.find(
                    ["h2", "h3", "a"], class_=re.compile(r"name|title|business", re.I)
                )
                phone_el = listing.find(class_=re.compile(r"phone|tel", re.I))
                addr_el = listing.find(class_=re.compile(r"address|location", re.I))
                website_el = listing.find(
                    "a", href=re.compile(r"^https?://(?!www\.yellowpages)", re.I)
                )

                if not name_el:
                    continue

                item: Dict[str, Any] = {
                    "company_name": name_el.get_text(strip=True),
                    "source": "yellowpages",
                }
                if phone_el:
                    item["phone"] = phone_el.get_text(strip=True)
                if addr_el:
                    addr_text = addr_el.get_text(strip=True)
                    # Try to split "City, ST 12345"
                    match = re.search(r"([A-Za-z\s]+),\s*([A-Z]{2})\s*\d{5}", addr_text)
                    if match:
                        item["city"] = match.group(1).strip()
                        item["state"] = match.group(2)
                if website_el:
                    item["website"] = website_el["href"]

                results.append(item)
            except Exception:
                continue

        return results
