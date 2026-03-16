import csv
import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contractor import Contractor
from app.schemas.contractor import (
    ContractorCreate,
    ContractorResponse,
    ContractorUpdate,
)
from app.services.lead_scorer import LeadScorer

router = APIRouter(prefix="/leads", tags=["leads"])
scorer = LeadScorer()


@router.get("", response_model=dict)
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    industry: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Contractor)

    if industry:
        query = query.filter(Contractor.industry.ilike(f"%{industry}%"))
    if city:
        query = query.filter(Contractor.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(Contractor.state.ilike(f"%{state}%"))
    if min_score is not None:
        query = query.filter(Contractor.lead_score >= min_score)
    if max_score is not None:
        query = query.filter(Contractor.lead_score <= max_score)
    if search:
        query = query.filter(
            Contractor.company_name.ilike(f"%{search}%")
            | Contractor.owner_name.ilike(f"%{search}%")
            | Contractor.email.ilike(f"%{search}%")
        )

    total = query.count()
    items = (
        query.order_by(Contractor.lead_score.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [ContractorResponse.model_validate(c) for c in items],
    }


@router.get("/export/csv")
def export_leads_csv(
    industry: Optional[str] = None,
    state: Optional[str] = None,
    min_score: Optional[float] = Query(None, ge=0, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Contractor)
    if industry:
        query = query.filter(Contractor.industry.ilike(f"%{industry}%"))
    if state:
        query = query.filter(Contractor.state.ilike(f"%{state}%"))
    if min_score is not None:
        query = query.filter(Contractor.lead_score >= min_score)

    leads = query.order_by(Contractor.lead_score.desc()).limit(10000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Company",
            "Owner",
            "Phone",
            "Email",
            "Website",
            "City",
            "State",
            "Industry",
            "Rating",
            "Reviews",
            "Lead Score",
            "Source",
            "Created At",
        ]
    )
    for lead in leads:
        writer.writerow(
            [
                str(lead.id),
                lead.company_name,
                lead.owner_name,
                lead.phone,
                lead.email,
                lead.website,
                lead.city,
                lead.state,
                lead.industry,
                lead.rating,
                lead.reviews,
                lead.lead_score,
                lead.source,
                lead.created_at,
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


@router.get("/stats/summary")
def leads_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Contractor.id)).scalar()
    by_industry = (
        db.query(Contractor.industry, func.count(Contractor.id))
        .filter(Contractor.industry.isnot(None))
        .group_by(Contractor.industry)
        .order_by(func.count(Contractor.id).desc())
        .limit(20)
        .all()
    )
    by_state = (
        db.query(Contractor.state, func.count(Contractor.id))
        .filter(Contractor.state.isnot(None))
        .group_by(Contractor.state)
        .order_by(func.count(Contractor.id).desc())
        .limit(20)
        .all()
    )
    avg_score = db.query(func.avg(Contractor.lead_score)).scalar() or 0.0
    high_value = (
        db.query(func.count(Contractor.id)).filter(Contractor.lead_score >= 80).scalar()
    )

    return {
        "total_leads": total,
        "average_score": round(float(avg_score), 2),
        "high_value_leads": high_value,
        "by_industry": [{"industry": r[0], "count": r[1]} for r in by_industry],
        "by_state": [{"state": r[0], "count": r[1]} for r in by_state],
    }


@router.get("/{lead_id}", response_model=ContractorResponse)
def get_lead(lead_id: UUID, db: Session = Depends(get_db)):
    lead = db.query(Contractor).filter(Contractor.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("", response_model=ContractorResponse, status_code=201)
def create_lead(payload: ContractorCreate, db: Session = Depends(get_db)):
    lead = Contractor(**payload.model_dump())
    lead.lead_score = scorer.score(lead)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.put("/{lead_id}", response_model=ContractorResponse)
def update_lead(
    lead_id: UUID, payload: ContractorUpdate, db: Session = Depends(get_db)
):
    lead = db.query(Contractor).filter(Contractor.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    lead.lead_score = scorer.score(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: UUID, db: Session = Depends(get_db)):
    lead = db.query(Contractor).filter(Contractor.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
