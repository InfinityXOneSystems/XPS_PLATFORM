from celery import Celery

from app.config import settings

celery_app = Celery(
    "leadgen",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.celery_app"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "scraper-agent": {
            "task": "app.celery_app.run_scraper_agent",
            "schedule": 30.0,
        },
        "enrichment-agent": {
            "task": "app.celery_app.run_enrichment_agent",
            "schedule": 60.0,
        },
        "database-agent": {
            "task": "app.celery_app.run_database_agent",
            "schedule": 3600.0,
        },
        "outreach-agent": {
            "task": "app.celery_app.run_outreach_agent",
            "schedule": 300.0,
        },
        "health-agent": {
            "task": "app.celery_app.run_health_agent",
            "schedule": 60.0,
        },
    },
)


@celery_app.task(name="app.celery_app.run_scrape_job", bind=True, max_retries=3)
def run_scrape_job(self, job_id: str):
    from app.agents.scraper_agent import ScraperAgent
    from app.database import SessionLocal
    from app.models.contractor import ScrapeJob

    db = SessionLocal()
    try:
        job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
        if job:
            job.status = "pending"
            db.commit()
    finally:
        db.close()

    agent = ScraperAgent()
    agent.run()


@celery_app.task(name="app.celery_app.run_scraper_agent")
def run_scraper_agent():
    from app.agents.scraper_agent import ScraperAgent

    ScraperAgent().run()


@celery_app.task(name="app.celery_app.run_enrichment_agent")
def run_enrichment_agent():
    from app.agents.enrichment_agent import EnrichmentAgent

    EnrichmentAgent().run()


@celery_app.task(name="app.celery_app.run_database_agent")
def run_database_agent():
    from app.agents.database_agent import DatabaseAgent

    DatabaseAgent().run()


@celery_app.task(name="app.celery_app.run_outreach_agent")
def run_outreach_agent():
    from app.agents.outreach_agent import OutreachAgent

    OutreachAgent().run()


@celery_app.task(name="app.celery_app.run_health_agent")
def run_health_agent():
    from app.agents.health_agent import HealthAgent

    HealthAgent().run()


@celery_app.task(name="app.celery_app.trigger_agent")
def trigger_agent(agent_name: str):
    agent_map = {
        "scraper_agent": run_scraper_agent,
        "enrichment_agent": run_enrichment_agent,
        "database_agent": run_database_agent,
        "outreach_agent": run_outreach_agent,
        "health_agent": run_health_agent,
    }
    task = agent_map.get(agent_name)
    if task:
        task.delay()
