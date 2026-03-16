import uuid
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contractor import Contractor, ScrapeJob
from app.schemas.contractor import ScrapeJobCreate, ScrapeJobResponse

router = APIRouter(prefix="/scrapers", tags=["scrapers"])


@router.post("/jobs", response_model=ScrapeJobResponse, status_code=201)
def create_scrape_job(payload: ScrapeJobCreate, db: Session = Depends(get_db)):
    job = ScrapeJob(
        id=uuid.uuid4(),
        query=payload.query,
        city=payload.city,
        state=payload.state,
        industry=payload.industry,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue via Celery
    try:
        from app.celery_app import run_scrape_job

        run_scrape_job.delay(str(job.id))
    except Exception:
        pass  # Worker may not be running; job stays pending

    return job


@router.get("/jobs", response_model=dict)
def list_scrape_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ScrapeJob)
    if status:
        query = query.filter(ScrapeJob.status == status)

    total = query.count()
    jobs = (
        query.order_by(ScrapeJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [ScrapeJobResponse.model_validate(j) for j in jobs],
    }


@router.get("/jobs/{job_id}", response_model=ScrapeJobResponse)
def get_scrape_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/jobs/{job_id}/cancel", response_model=ScrapeJobResponse)
def cancel_scrape_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ("pending", "running"):
        raise HTTPException(
            status_code=400, detail=f"Cannot cancel job with status '{job.status}'"
        )
    job.status = "cancelled"
    job.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


@router.get("/status")
def scraper_status(db: Session = Depends(get_db)):
    counts = (
        db.query(ScrapeJob.status, func.count(ScrapeJob.id))
        .group_by(ScrapeJob.status)
        .all()
    )
    status_map = {row[0]: row[1] for row in counts}
    total_leads = db.query(func.count(Contractor.id)).scalar()

    return {
        "jobs": status_map,
        "total_leads_in_db": total_leads,
        "running": status_map.get("running", 0),
        "pending": status_map.get("pending", 0),
        "completed": status_map.get("completed", 0),
        "failed": status_map.get("failed", 0),
    }
