import abc
import random
import time
from typing import Any, Dict, List, Optional

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15",
]


class BaseScraper(abc.ABC):
    def __init__(self, concurrency: int = 5, rate_limit_delay: float = 1.0):
        self.concurrency = concurrency
        self.rate_limit_delay = rate_limit_delay
        self.logger = structlog.get_logger(scraper=self.__class__.__name__)

    def random_user_agent(self) -> str:
        return random.choice(USER_AGENTS)

    def random_delay(self, min_s: float = 0.5, max_s: float = 2.5) -> None:
        time.sleep(random.uniform(min_s, max_s))

    def get_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": self.random_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def fetch(
        self, url: str, params: Optional[Dict] = None, timeout: int = 30
    ) -> httpx.Response:
        with httpx.Client(
            headers=self.get_headers(), follow_redirects=True, timeout=timeout
        ) as client:
            self.random_delay()
            response = client.get(url, params=params)
            response.raise_for_status()
            return response

    @abc.abstractmethod
    def scrape(
        self, query: str, city: str = "", state: str = ""
    ) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    def parse_results(self, raw_content: str) -> List[Dict[str, Any]]:
        pass

    def save_to_db(self, results: List[Dict[str, Any]], db_session) -> int:
        from app.models.contractor import Contractor
        from app.services.lead_scorer import LeadScorer

        scorer = LeadScorer()
        saved = 0

        for item in results:
            company_name = item.get("company_name", "").strip()
            city = item.get("city", "").strip()
            if not company_name:
                continue

            existing = (
                db_session.query(Contractor)
                .filter(
                    Contractor.company_name == company_name,
                    Contractor.city == city,
                )
                .first()
            )
            if existing:
                for key, val in item.items():
                    if val and not getattr(existing, key, None):
                        setattr(existing, key, val)
                existing.lead_score = scorer.score(existing)
                continue

            contractor = Contractor(
                **{k: v for k, v in item.items() if hasattr(Contractor, k)}
            )
            contractor.lead_score = scorer.score(contractor)
            db_session.add(contractor)
            saved += 1

        db_session.commit()
        return saved
