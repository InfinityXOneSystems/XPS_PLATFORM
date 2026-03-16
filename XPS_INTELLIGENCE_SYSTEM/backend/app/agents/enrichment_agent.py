import structlog

from app.agents.base import BaseAgent
from app.services.lead_scorer import LeadScorer

logger = structlog.get_logger()


class EnrichmentAgent(BaseAgent):
    def __init__(self):
        super().__init__("enrichment_agent")
        self.scorer = LeadScorer()

    def run(self) -> None:
        from app.database import SessionLocal
        from app.models.contractor import Contractor
        from app.scrapers.website import WebsiteCrawler

        db = SessionLocal()
        try:
            # Find contractors missing email but having a website
            needs_enrichment = (
                db.query(Contractor)
                .filter(
                    Contractor.website.isnot(None),
                    Contractor.email.is_(None),
                )
                .limit(20)
                .all()
            )

            self.log(f"Found {len(needs_enrichment)} contractors needing enrichment")
            crawler = WebsiteCrawler()

            for contractor in needs_enrichment:
                try:
                    result = crawler.crawl(contractor.website)
                    if result.get("emails"):
                        contractor.email = result["emails"][0]
                        self.log(f"Enriched email for {contractor.company_name}")
                    if result.get("phones") and not contractor.phone:
                        contractor.phone = result["phones"][0]
                    if result.get("owner_name") and not contractor.owner_name:
                        contractor.owner_name = result["owner_name"]

                    contractor.lead_score = self.scorer.score(contractor)
                except Exception as e:
                    self.log(
                        f"Failed to enrich {contractor.company_name}: {e}", "warning"
                    )

            db.commit()
            self.log(f"Enrichment complete for {len(needs_enrichment)} contractors")

        finally:
            db.close()
