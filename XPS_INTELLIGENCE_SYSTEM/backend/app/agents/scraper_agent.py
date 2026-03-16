from datetime import datetime

import structlog

from app.agents.base import BaseAgent

logger = structlog.get_logger()


class ScraperAgent(BaseAgent):
    def __init__(self):
        super().__init__("scraper_agent")

    def run(self) -> None:
        from app.database import SessionLocal
        from app.models.contractor import ScrapeJob
        from app.scrapers.directory import DirectoryScraper  # noqa: F401
        from app.scrapers.google_maps import GoogleMapsScraper

        db = SessionLocal()
        try:
            pending = (
                db.query(ScrapeJob)
                .filter(ScrapeJob.status == "pending")
                .order_by(ScrapeJob.created_at)
                .limit(5)
                .all()
            )

            if not pending:
                self.log("No pending jobs found")
                return

            for job in pending:
                self.log(f"Processing job {job.id}: {job.query}")
                job.status = "running"
                job.started_at = datetime.utcnow()
                db.commit()

                try:
                    scraper = GoogleMapsScraper()
                    results = scraper.scrape(
                        query=job.query or "",
                        city=job.city or "",
                        state=job.state or "",
                    )
                    saved = scraper.save_to_db(results, db)

                    job.status = "completed"
                    job.total_found = len(results)
                    job.processed = saved
                    job.completed_at = datetime.utcnow()
                    self.log(f"Job {job.id} completed: {saved}/{len(results)} saved")
                except Exception as e:
                    job.status = "failed"
                    job.error_msg = str(e)
                    job.completed_at = datetime.utcnow()
                    self.log(f"Job {job.id} failed: {e}", "error")

                db.commit()
        finally:
            db.close()
