import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contractor import Contractor, OutreachLog

router = APIRouter(prefix="/outreach", tags=["outreach"])

# In-memory campaign store (production: use DB table)
_campaigns: dict = {}


@router.post("/campaigns", status_code=201)
def create_campaign(
    name: str,
    industry: Optional[str] = None,
    min_score: float = 60.0,
    template: str = "default",
    db: Session = Depends(get_db),
):
    campaign_id = str(uuid.uuid4())
    query = db.query(Contractor).filter(Contractor.lead_score >= min_score)
    if industry:
        query = query.filter(Contractor.industry.ilike(f"%{industry}%"))
    target_count = query.count()

    _campaigns[campaign_id] = {
        "id": campaign_id,
        "name": name,
        "industry": industry,
        "min_score": min_score,
        "template": template,
        "target_count": target_count,
        "sent_count": 0,
        "status": "created",
        "created_at": datetime.utcnow().isoformat(),
    }
    return _campaigns[campaign_id]


@router.get("/campaigns")
def list_campaigns():
    return {"campaigns": list(_campaigns.values()), "total": len(_campaigns)}


@router.post("/send")
def send_outreach(
    contractor_ids: List[UUID],
    template: str = "default",
    channel: str = "email",
    db: Session = Depends(get_db),
):
    results = []
    for cid in contractor_ids:
        contractor = db.query(Contractor).filter(Contractor.id == cid).first()
        if not contractor:
            results.append({"id": str(cid), "status": "not_found"})
            continue
        if not contractor.email:
            results.append({"id": str(cid), "status": "no_email"})
            continue

        log = OutreachLog(
            contractor_id=cid,
            channel=channel,
            template_used=template,
            status="sent",
        )
        db.add(log)
        contractor.last_contacted = datetime.utcnow()
        results.append({"id": str(cid), "status": "sent", "email": contractor.email})

    db.commit()
    return {
        "sent": len([r for r in results if r["status"] == "sent"]),
        "results": results,
    }


@router.get("/stats")
def outreach_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(OutreachLog.id)).scalar()
    by_channel = (
        db.query(OutreachLog.channel, func.count(OutreachLog.id))
        .group_by(OutreachLog.channel)
        .all()
    )
    by_status = (
        db.query(OutreachLog.status, func.count(OutreachLog.id))
        .group_by(OutreachLog.status)
        .all()
    )
    recent_30d = (
        db.query(func.count(OutreachLog.id))
        .filter(OutreachLog.sent_at >= datetime.utcnow() - timedelta(days=30))
        .scalar()
    )

    return {
        "total_sent": total,
        "last_30_days": recent_30d,
        "by_channel": [{"channel": r[0], "count": r[1]} for r in by_channel],
        "by_status": [{"status": r[0], "count": r[1]} for r in by_status],
    }
