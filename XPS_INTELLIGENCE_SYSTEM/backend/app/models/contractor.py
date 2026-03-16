import uuid

from sqlalchemy import (
    ARRAY,
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Contractor(Base):
    __tablename__ = "contractors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    owner_name = Column(String(255))
    phone = Column(String(50))
    email = Column(String(255), index=True)
    website = Column(String(500))
    city = Column(String(100), index=True)
    state = Column(String(50), index=True)
    industry = Column(String(100), index=True)
    keywords = Column(ARRAY(String), default=[])
    services = Column(ARRAY(String), default=[])
    rating = Column(Float)
    reviews = Column(Integer, default=0)
    source = Column(String(100))
    lead_score = Column(Float, default=0.0, index=True)
    last_scraped = Column(DateTime(timezone=True))
    last_contacted = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contacts = relationship(
        "Contact", back_populates="contractor", cascade="all, delete-orphan"
    )
    lead_scores = relationship(
        "LeadScore", back_populates="contractor", cascade="all, delete-orphan"
    )
    outreach_logs = relationship(
        "OutreachLog", back_populates="contractor", cascade="all, delete-orphan"
    )


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contractor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contractors.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(255))
    title = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    linkedin_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contractor = relationship("Contractor", back_populates="contacts")


class Industry(Base):
    __tablename__ = "industries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    keywords = Column(ARRAY(String), default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LeadScore(Base):
    __tablename__ = "lead_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contractor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contractors.id", ondelete="CASCADE"),
        nullable=False,
    )
    score = Column(Float, nullable=False)
    factors = Column(JSON, default={})
    scored_at = Column(DateTime(timezone=True), server_default=func.now())

    contractor = relationship("Contractor", back_populates="lead_scores")


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    query = Column(String(500))
    city = Column(String(100))
    state = Column(String(50))
    industry = Column(String(100))
    status = Column(
        String(20), default="pending", index=True
    )  # pending/running/completed/failed/cancelled
    total_found = Column(Integer, default=0)
    processed = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    error_msg = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OutreachLog(Base):
    __tablename__ = "outreach_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contractor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contractors.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel = Column(String(50))  # email/phone/linkedin
    template_used = Column(String(255))
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default="sent")
    response_received = Column(Text)
    response_at = Column(DateTime(timezone=True))

    contractor = relationship("Contractor", back_populates="outreach_logs")
