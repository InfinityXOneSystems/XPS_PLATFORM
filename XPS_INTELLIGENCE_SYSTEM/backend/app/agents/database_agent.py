from datetime import datetime, timedelta

import structlog

from app.agents.base import BaseAgent

logger = structlog.get_logger()


class DatabaseAgent(BaseAgent):
    def __init__(self):
        super().__init__("database_agent")

    def run(self) -> None:

        from app.database import SessionLocal
        from app.models.contractor import Contractor, ScrapeJob
        from app.services.lead_scorer import LeadScorer

        db = SessionLocal()
        scorer = LeadScorer()
        try:
            self.log("Starting database maintenance")

            # 1. Remove duplicate contractors (same company_name + city)
            seen = set()
            dupes = 0
            contractors = db.query(Contractor).order_by(Contractor.created_at).all()
            for c in contractors:
                key = (c.company_name.lower().strip(), (c.city or "").lower().strip())
                if key in seen:
                    db.delete(c)
                    dupes += 1
                else:
                    seen.add(key)
            self.log(f"Removed {dupes} duplicate contractors")

            # 2. Refresh lead scores for all contractors
            all_contractors = db.query(Contractor).all()
            for c in all_contractors:
                c.lead_score = scorer.score(c)
            self.log(f"Refreshed scores for {len(all_contractors)} contractors")

            # 3. Archive old completed/failed scrape jobs (> 30 days)
            cutoff = datetime.utcnow() - timedelta(days=30)
            old_jobs = (
                db.query(ScrapeJob)
                .filter(
                    ScrapeJob.status.in_(["completed", "failed", "cancelled"]),
                    ScrapeJob.completed_at < cutoff,
                )
                .delete(synchronize_session=False)
            )
            self.log(f"Archived {old_jobs} old scrape jobs")

            db.commit()
            self.log("Database maintenance complete")
        finally:
            db.close()
