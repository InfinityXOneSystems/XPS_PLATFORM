import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contractor import ScrapeJob
from app.schemas.contractor import CommandRequest, CommandResponse
from app.services.command_parser import CommandParser

router = APIRouter(prefix="/commands", tags=["commands"])
parser = CommandParser()


@router.post("/execute", response_model=CommandResponse)
def execute_command(payload: CommandRequest, db: Session = Depends(get_db)):
    result = parser.parse(payload.command)

    if result["action"] == "SCRAPE":
        params = result["parameters"]
        job = ScrapeJob(
            id=uuid.uuid4(),
            query=params.get("industry", params.get("query", payload.command)),
            city=params.get("city"),
            state=params.get("state"),
            industry=params.get("industry"),
            status="pending",
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        try:
            from app.celery_app import run_scrape_job

            run_scrape_job.delay(str(job.id))
        except Exception:
            pass

        return CommandResponse(
            action=result["action"],
            parameters=result["parameters"],
            job_id=str(job.id),
            message=f"Scrape job created: {job.id}",
        )

    return CommandResponse(
        action=result["action"],
        parameters=result["parameters"],
        message=result.get("message", "Command processed"),
    )
