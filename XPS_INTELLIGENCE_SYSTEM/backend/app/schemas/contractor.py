from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

# ─── Contractor ────────────────────────────────────────────────────────────────


class ContractorBase(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    industry: Optional[str] = None
    keywords: Optional[List[str]] = []
    services: Optional[List[str]] = []
    rating: Optional[float] = Field(None, ge=0.0, le=5.0)
    reviews: Optional[int] = Field(None, ge=0)
    source: Optional[str] = None


class ContractorCreate(ContractorBase):
    pass


class ContractorUpdate(BaseModel):
    company_name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    industry: Optional[str] = None
    keywords: Optional[List[str]] = None
    services: Optional[List[str]] = None
    rating: Optional[float] = Field(None, ge=0.0, le=5.0)
    reviews: Optional[int] = Field(None, ge=0)
    lead_score: Optional[float] = Field(None, ge=0.0, le=100.0)


class ContractorResponse(ContractorBase):
    id: UUID
    lead_score: float
    last_scraped: Optional[datetime] = None
    last_contacted: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Contact ───────────────────────────────────────────────────────────────────


class ContactCreate(BaseModel):
    contractor_id: UUID
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None


class ContactResponse(ContactCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Industry ──────────────────────────────────────────────────────────────────


class IndustryCreate(BaseModel):
    name: str
    slug: str
    keywords: Optional[List[str]] = []


class IndustryResponse(IndustryCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── ScrapeJob ─────────────────────────────────────────────────────────────────


class ScrapeJobCreate(BaseModel):
    query: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    industry: Optional[str] = None


class ScrapeJobResponse(ScrapeJobCreate):
    id: UUID
    status: str
    total_found: int
    processed: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_msg: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── OutreachLog ───────────────────────────────────────────────────────────────


class OutreachLogCreate(BaseModel):
    contractor_id: UUID
    channel: str
    template_used: Optional[str] = None
    status: str = "sent"


class OutreachLogResponse(OutreachLogCreate):
    id: UUID
    sent_at: datetime
    response_received: Optional[str] = None
    response_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── LeadScore ─────────────────────────────────────────────────────────────────


class LeadScoreResponse(BaseModel):
    id: UUID
    contractor_id: UUID
    score: float
    factors: dict
    scored_at: datetime

    model_config = {"from_attributes": True}


# ─── Pagination ────────────────────────────────────────────────────────────────


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List


# ─── Command ───────────────────────────────────────────────────────────────────


class CommandRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=1000)


class CommandResponse(BaseModel):
    action: str
    parameters: dict
    job_id: Optional[str] = None
    message: str
