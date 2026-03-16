from app.scrapers.base import BaseScraper
from app.scrapers.website import WebsiteCrawler
from app.services.lead_scorer import LeadScorer


class ConcreteScraper(BaseScraper):
    def scrape(self, query, city="", state=""):
        return [{"company_name": "Test Co", "city": city, "state": state}]

    def parse_results(self, raw_content):
        return []


def test_base_scraper_random_user_agent():
    scraper = ConcreteScraper()
    ua = scraper.random_user_agent()
    assert isinstance(ua, str)
    assert "Mozilla" in ua


def test_base_scraper_get_headers():
    scraper = ConcreteScraper()
    headers = scraper.get_headers()
    assert "User-Agent" in headers
    assert "Accept" in headers


def test_base_scraper_scrape():
    scraper = ConcreteScraper()
    results = scraper.scrape("test", city="Austin", state="TX")
    assert len(results) == 1
    assert results[0]["company_name"] == "Test Co"


def test_website_crawler_extract_emails():
    crawler = WebsiteCrawler()
    html = "Contact us at info@acme-corp.com or support@mycompany.org for help"
    emails = crawler._extract_emails(html)
    assert "info@acme-corp.com" in emails
    assert "support@mycompany.org" in emails


def test_website_crawler_extract_phones():
    crawler = WebsiteCrawler()
    html = "Call us at (555) 123-4567 or 800-555-9999"
    phones = crawler._extract_phones(html)
    assert len(phones) >= 1


def test_website_crawler_extract_owner_name():
    from bs4 import BeautifulSoup

    crawler = WebsiteCrawler()
    html = "<p>Owner: John Smith runs this business</p>"
    soup = BeautifulSoup(html, "html.parser")
    name = crawler._extract_owner_name(soup)
    assert name == "John Smith"


def test_lead_scorer_full_score():
    scorer = LeadScorer()

    class Lead:
        email = "test@test.com"
        phone = "555-1234"
        website = "https://test.com"
        reviews = 50
        rating = 4.5

    assert scorer.score(Lead()) == 100.0


def test_lead_scorer_empty():
    scorer = LeadScorer()

    class Lead:
        email = None
        phone = None
        website = None
        reviews = 0
        rating = 0.0

    assert scorer.score(Lead()) == 0.0


def test_lead_scorer_partial():
    scorer = LeadScorer()

    class Lead:
        email = "test@test.com"
        phone = None
        website = "https://test.com"
        reviews = 2
        rating = 3.0

    assert scorer.score(Lead()) == 40.0


# ---------------------------------------------------------------------------
# Shadow REST Scraper tests
# ---------------------------------------------------------------------------


def test_shadow_scraper_deduplication():
    """_deduplicate should remove exact name and phone duplicates."""
    from app.scrapers.shadow_rest_scraper import _deduplicate

    leads = [
        {"company_name": "Acme Flooring", "phone": "5551234567", "source": "yelp"},
        {
            "company_name": "Acme Flooring",
            "phone": "5551234567",
            "source": "bbb",
        },  # dup name
        {"company_name": "Best Epoxy", "phone": "5559876543", "source": "yellowpages"},
        {
            "company_name": "best epoxy",
            "phone": "5559876543",
            "source": "manta",
        },  # dup normalised
    ]
    result = _deduplicate(leads)
    assert len(result) == 2
    names = {r["company_name"] for r in result}
    assert "Acme Flooring" in names
    assert "Best Epoxy" in names


def test_shadow_scraper_normalise_phone():
    from app.scrapers.shadow_rest_scraper import _normalise_phone

    assert _normalise_phone("(555) 123-4567") == "5551234567"
    assert _normalise_phone("555.123.4567") == "5551234567"
    assert _normalise_phone("") == ""


def test_shadow_scraper_normalise_name():
    from app.scrapers.shadow_rest_scraper import _normalise_name

    assert _normalise_name("  Acme  FLOORING  ") == "acme flooring"


def test_shadow_scraper_yellowpages_html_parse():
    """_scrape_yellowpages_html should extract listings from mock HTML."""
    from app.scrapers.shadow_rest_scraper import _scrape_yellowpages_html

    html = """
    <html><body>
    <div class="result">
      <h2 class="n"><a class="business-name">Texas Epoxy Pros</a></h2>
      <div class="phones primary">555-111-2222</div>
      <span class="locality">Austin</span>
      <span class="region">TX</span>
    </div>
    <div class="result">
      <h2 class="n"><a class="business-name">Dallas Flooring Co</a></h2>
      <div class="phones primary">555-333-4444</div>
      <span class="locality">Dallas</span>
      <span class="region">TX</span>
    </div>
    </body></html>
    """
    results = _scrape_yellowpages_html(html)
    assert len(results) >= 2
    names = [r["company_name"] for r in results]
    assert "Texas Epoxy Pros" in names
    assert "Dallas Flooring Co" in names


def test_shadow_scraper_yelp_json_ld():
    """_scrape_yelp should parse JSON-LD embedded in page HTML."""
    import json
    from unittest.mock import patch

    from app.scrapers.shadow_rest_scraper import _scrape_yelp

    json_ld = json.dumps(
        [
            {
                "@type": "LocalBusiness",
                "name": "Houston Floor Masters",
                "telephone": "713-555-0101",
                "url": "https://houstonfloormasters.com",
                "address": {
                    "streetAddress": "123 Main St",
                    "addressLocality": "Houston",
                    "addressRegion": "TX",
                },
                "aggregateRating": {"ratingValue": 4.7, "reviewCount": 312},
            }
        ]
    )
    mock_html = (
        f"<html><body>"
        f'<script type="application/ld+json">{json_ld}</script>'
        f"</body></html>"
    )

    with patch("app.scrapers.shadow_rest_scraper._safe_get", return_value=mock_html):
        results = _scrape_yelp("flooring", "Houston, TX")

    assert len(results) == 1
    assert results[0]["company_name"] == "Houston Floor Masters"
    assert results[0]["phone"] == "713-555-0101"
    assert results[0]["city"] == "Houston"
    assert results[0]["source"] == "yelp"


def test_shadow_scraper_bbb_parse():
    """_scrape_bbb should handle empty/blocked responses gracefully."""
    from unittest.mock import patch

    from app.scrapers.shadow_rest_scraper import _scrape_bbb

    with patch("app.scrapers.shadow_rest_scraper._safe_get", return_value=None):
        results = _scrape_bbb("roofing", "Austin, TX")
    assert results == []


def test_shadow_scraper_scrape_no_network(monkeypatch):
    """ShadowRestScraper.scrape should return empty list gracefully when all sources fail."""
    from app.scrapers.shadow_rest_scraper import ShadowRestScraper

    monkeypatch.setenv("PLAYWRIGHT_ENABLED", "false")
    # Patch all source functions to return empty
    import app.scrapers.shadow_rest_scraper as mod

    monkeypatch.setattr(mod, "_scrape_yellowpages", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_yelp", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_bbb", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_manta", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_google_maps_html", lambda q, loc: [])

    scraper = ShadowRestScraper(playwright_enabled=False)
    results = scraper.scrape("epoxy", city="Austin", state="TX")
    assert results == []


def test_shadow_scraper_scrape_merges_and_dedupes(monkeypatch):
    """ShadowRestScraper.scrape merges sources and deduplicates results."""
    import app.scrapers.shadow_rest_scraper as mod
    from app.scrapers.shadow_rest_scraper import ShadowRestScraper

    source_a = [
        {"company_name": "Acme Flooring", "phone": "5551112222", "source": "yelp"},
        {"company_name": "Best Epoxy", "phone": "5553334444", "source": "yelp"},
    ]
    source_b = [
        {
            "company_name": "Acme Flooring",
            "phone": "5551112222",
            "source": "bbb",
        },  # dup
        {"company_name": "Top Tile Co", "phone": "5555556666", "source": "bbb"},
    ]

    monkeypatch.setattr(mod, "_scrape_yellowpages", lambda q, loc: source_a)
    monkeypatch.setattr(mod, "_scrape_yelp", lambda q, loc: source_b)
    monkeypatch.setattr(mod, "_scrape_bbb", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_manta", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_google_maps_html", lambda q, loc: [])

    scraper = ShadowRestScraper(playwright_enabled=False)
    results = scraper.scrape("flooring", city="Austin", state="TX")
    assert len(results) == 3
    names = {r["company_name"] for r in results}
    assert "Acme Flooring" in names
    assert "Best Epoxy" in names
    assert "Top Tile Co" in names


def test_shadow_scraper_handler_routes_to_shadow(monkeypatch):
    """ScraperAgentHandler.execute should delegate to ShadowScraperHandler."""
    import app.scrapers.shadow_rest_scraper as mod
    from app.agents.scraper_agent.scraper import ScraperAgentHandler

    monkeypatch.setattr(
        mod,
        "_scrape_yellowpages",
        lambda q, loc: [
            {
                "company_name": "Shadow Lead",
                "phone": "5550001234",
                "source": "yellowpages",
            }
        ],
    )
    monkeypatch.setattr(mod, "_scrape_yelp", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_bbb", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_manta", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_google_maps_html", lambda q, loc: [])

    handler = ScraperAgentHandler()
    result = handler.execute(
        task_id="t-001",
        target="epoxy contractors",
        parameters={"_command": "scrape_website", "city": "Dallas", "state": "TX"},
    )
    assert result["success"] is True
    assert result["count"] >= 1
    assert result["results"][0]["company_name"] == "Shadow Lead"
    assert "source" in result


def test_shadow_scraper_handler_directory_command(monkeypatch):
    """ShadowScraperHandler scrape_business_directory command returns results."""
    import app.scrapers.shadow_rest_scraper as mod
    from app.agents.scraper_agent.shadow_scraper import ShadowScraperHandler

    monkeypatch.setattr(
        mod,
        "_scrape_yellowpages",
        lambda q, loc: [
            {"company_name": "Dir Lead", "phone": "5550009876", "source": "yellowpages"}
        ],
    )
    monkeypatch.setattr(mod, "_scrape_yelp", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_bbb", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_manta", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_google_maps_html", lambda q, loc: [])

    handler = ShadowScraperHandler()
    result = handler.execute(
        task_id="t-002",
        target="roofing",
        parameters={
            "_command": "scrape_business_directory",
            "location": "Houston, TX",
        },
    )
    assert result["success"] is True
    assert result["count"] >= 1


def test_shadow_scraper_handler_error_handling():
    """ShadowScraperHandler should return success=False on unexpected errors."""
    from unittest.mock import patch

    from app.agents.scraper_agent.shadow_scraper import ShadowScraperHandler

    with patch(
        "app.scrapers.shadow_rest_scraper.ShadowRestScraper.scrape",
        side_effect=RuntimeError("network down"),
    ):
        handler = ShadowScraperHandler()
        result = handler.execute(
            task_id="t-003",
            target="test",
            parameters={"_command": "scrape_website"},
        )
    assert result["success"] is False
    assert "network down" in result["error"]


def test_shadow_scraper_max_results_respected(monkeypatch):
    """ShadowRestScraper.scrape should honour max_results cap."""
    import app.scrapers.shadow_rest_scraper as mod
    from app.scrapers.shadow_rest_scraper import ShadowRestScraper

    big_list = [
        {"company_name": f"Co {i}", "phone": f"555{i:07d}", "source": "yelp"}
        for i in range(100)
    ]

    monkeypatch.setattr(mod, "_scrape_yellowpages", lambda q, loc: big_list)
    monkeypatch.setattr(mod, "_scrape_yelp", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_bbb", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_manta", lambda q, loc: [])
    monkeypatch.setattr(mod, "_scrape_google_maps_html", lambda q, loc: [])

    scraper = ShadowRestScraper(playwright_enabled=False)
    results = scraper.scrape("flooring", max_results=10)
    assert len(results) <= 10


def test_config_has_playwright_and_timeout_settings():
    """Settings object should expose PLAYWRIGHT_ENABLED and SCRAPER_TIMEOUT."""
    from app.config import Settings

    s = Settings()
    assert hasattr(s, "PLAYWRIGHT_ENABLED")
    assert hasattr(s, "SCRAPER_TIMEOUT")
    assert isinstance(s.SCRAPER_TIMEOUT, int)
    assert s.SCRAPER_TIMEOUT > 0
