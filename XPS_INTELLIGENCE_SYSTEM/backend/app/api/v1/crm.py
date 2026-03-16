"""
backend/app/api/v1/crm.py
===========================
Enterprise CRM API — contacts, pipeline stages, outreach tracking,
follow-ups, notes, activity log, bulk operations.

CRM Pipeline Stages:
  new → contacted → interested → proposal_sent → negotiating → closed_won | closed_lost | nurture

Outreach channels: email | email_campaign | sms | voice_call | follow_up
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/crm", tags=["crm"])

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LEADS_DIR = REPO_ROOT / "leads"
CRM_FILE = LEADS_DIR / "crm_contacts.json"

CRM_STAGES = [
    "new",
    "contacted",
    "interested",
    "proposal_sent",
    "negotiating",
    "closed_won",
    "closed_lost",
    "nurture",
]
OUTREACH_CHANNELS = [
    "email",
    "email_campaign",
    "sms",
    "voice_call",
    "follow_up",
    "manual",
]


# ── In-memory cache ───────────────────────────────────────────────────────────


def _load_crm() -> List[Dict]:
    LEADS_DIR.mkdir(parents=True, exist_ok=True)
    if CRM_FILE.exists():
        try:
            return json.loads(CRM_FILE.read_text())
        except Exception:
            return []
    return []


def _save_crm(contacts: List[Dict]) -> None:
    LEADS_DIR.mkdir(parents=True, exist_ok=True)
    CRM_FILE.write_text(json.dumps(contacts, indent=2))


def _find_contact(contacts: List[Dict], contact_id: str) -> Optional[int]:
    for i, c in enumerate(contacts):
        if c.get("id") == contact_id:
            return i
    return None


def _generate_id(name: str, city: str) -> str:
    import hashlib

    raw = f"{name.lower().strip()}:{city.lower().strip()}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


# ── Schemas ───────────────────────────────────────────────────────────────────


class ContactUpdate(BaseModel):
    crm_stage: Optional[str] = None
    outreach_status: Optional[str] = None
    outreach_channel: Optional[str] = None
    assigned_to: Optional[str] = None
    next_follow_up: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None  # add a note


class NoteCreate(BaseModel):
    text: str
    author: Optional[str] = "system"


class OutreachRecord(BaseModel):
    channel: str
    subject: Optional[str] = None
    body: Optional[str] = None
    outcome: Optional[str] = None


class BulkStageUpdate(BaseModel):
    contact_ids: List[str]
    stage: str


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/", summary="List all CRM contacts with filters")
def list_contacts(
    stage: Optional[str] = None,
    tier: Optional[str] = None,
    city: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    contacts = _load_crm()

    if stage:
        contacts = [c for c in contacts if c.get("crm_stage") == stage]
    if tier:
        contacts = [c for c in contacts if c.get("tier") == tier.upper()]
    if city:
        contacts = [
            c for c in contacts if city.lower() in (c.get("city") or "").lower()
        ]
    if priority:
        contacts = [c for c in contacts if c.get("outreach_priority") == priority]
    if search:
        s = search.lower()
        contacts = [
            c
            for c in contacts
            if (
                s in (c.get("company_name") or "").lower()
                or s in (c.get("phone") or "").lower()
                or s in (c.get("email") or "").lower()
            )
        ]

    total = len(contacts)
    start = (page - 1) * per_page
    paginated = contacts[start : start + per_page]

    return {
        "contacts": paginated,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/stats", summary="CRM pipeline statistics")
def crm_stats() -> Dict[str, Any]:
    contacts = _load_crm()
    stage_counts = {s: 0 for s in CRM_STAGES}
    tier_counts = {"HOT": 0, "WARM": 0, "COLD": 0}
    channel_counts: Dict[str, int] = {}
    priority_counts: Dict[str, int] = {}

    for c in contacts:
        s = c.get("crm_stage", "new")
        if s in stage_counts:
            stage_counts[s] += 1
        t = c.get("tier", "COLD")
        if t in tier_counts:
            tier_counts[t] += 1
        ch = c.get("outreach_channel")
        if ch:
            channel_counts[ch] = channel_counts.get(ch, 0) + 1
        pri = c.get("outreach_priority")
        if pri:
            priority_counts[pri] = priority_counts.get(pri, 0) + 1

    return {
        "total": len(contacts),
        "stages": stage_counts,
        "tiers": tier_counts,
        "channels": channel_counts,
        "priorities": priority_counts,
        "pending_outreach": sum(
            1 for c in contacts if c.get("outreach_status") == "pending"
        ),
        "contacted": sum(
            1 for c in contacts if c.get("outreach_status") == "contacted"
        ),
        "follow_ups_due": sum(
            1 for c in contacts if c.get("outreach_status") == "follow_up_due"
        ),
    }


@router.get("/{contact_id}", summary="Get a single CRM contact")
def get_contact(contact_id: str) -> Dict[str, Any]:
    contacts = _load_crm()
    idx = _find_contact(contacts, contact_id)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
    return contacts[idx]


@router.patch("/{contact_id}", summary="Update a CRM contact")
def update_contact(contact_id: str, update: ContactUpdate) -> Dict[str, Any]:
    contacts = _load_crm()
    idx = _find_contact(contacts, contact_id)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

    contact = contacts[idx]
    now = datetime.now(timezone.utc).isoformat()

    if update.crm_stage:
        if update.crm_stage not in CRM_STAGES:
            raise HTTPException(
                status_code=400, detail=f"Invalid stage. Valid: {CRM_STAGES}"
            )
        contact["crm_stage"] = update.crm_stage
    if update.outreach_status:
        contact["outreach_status"] = update.outreach_status
    if update.outreach_channel:
        contact["outreach_channel"] = update.outreach_channel
    if update.assigned_to is not None:
        contact["assigned_to"] = update.assigned_to
    if update.next_follow_up is not None:
        contact["next_follow_up"] = update.next_follow_up
    if update.tags is not None:
        contact["tags"] = update.tags
    if update.notes:
        if "notes" not in contact:
            contact["notes"] = []
        contact["notes"].append(
            {
                "text": update.notes,
                "created_at": now,
                "author": "user",
            }
        )

    contact["updated_at"] = now
    contacts[idx] = contact
    _save_crm(contacts)
    return contact


@router.post("/{contact_id}/note", summary="Add a note to a contact")
def add_note(contact_id: str, note: NoteCreate) -> Dict[str, Any]:
    contacts = _load_crm()
    idx = _find_contact(contacts, contact_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Contact not found")

    now = datetime.now(timezone.utc).isoformat()
    if "notes" not in contacts[idx]:
        contacts[idx]["notes"] = []
    contacts[idx]["notes"].append(
        {
            "text": note.text,
            "author": note.author,
            "created_at": now,
        }
    )
    contacts[idx]["updated_at"] = now
    _save_crm(contacts)
    return {"success": True, "note_count": len(contacts[idx]["notes"])}


@router.post("/{contact_id}/outreach", summary="Log an outreach activity")
def log_outreach(contact_id: str, outreach: OutreachRecord) -> Dict[str, Any]:
    contacts = _load_crm()
    idx = _find_contact(contacts, contact_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Contact not found")

    now = datetime.now(timezone.utc).isoformat()
    contact = contacts[idx]

    if "activity_log" not in contact:
        contact["activity_log"] = []

    contact["activity_log"].append(
        {
            "type": "outreach",
            "channel": outreach.channel,
            "subject": outreach.subject,
            "outcome": outreach.outcome,
            "timestamp": now,
        }
    )

    contact["outreach_channel"] = outreach.channel
    contact["last_contact"] = now
    contact["follow_up_count"] = (contact.get("follow_up_count") or 0) + 1

    if outreach.outcome == "interested":
        contact["crm_stage"] = "interested"
        contact["outreach_status"] = "follow_up_due"
    elif outreach.outcome == "no_answer":
        contact["outreach_status"] = "follow_up_due"
    elif outreach.outcome == "not_interested":
        contact["crm_stage"] = "closed_lost"
        contact["outreach_status"] = "closed"
    else:
        contact["crm_stage"] = "contacted"
        contact["outreach_status"] = "contacted"

    contact["updated_at"] = now
    contacts[idx] = contact
    _save_crm(contacts)
    return {"success": True, "contact": contact}


@router.post("/bulk/stage", summary="Bulk update pipeline stage")
def bulk_stage_update(req: BulkStageUpdate) -> Dict[str, Any]:
    if req.stage not in CRM_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {req.stage}")

    contacts = _load_crm()
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    for i, c in enumerate(contacts):
        if c.get("id") in req.contact_ids:
            contacts[i]["crm_stage"] = req.stage
            contacts[i]["updated_at"] = now
            updated += 1

    _save_crm(contacts)
    return {"success": True, "updated": updated, "stage": req.stage}


@router.get("/export/csv", summary="Export CRM contacts as CSV")
def export_crm_csv(stage: Optional[str] = None) -> Any:
    import csv
    import io

    from fastapi.responses import StreamingResponse

    contacts = _load_crm()
    if stage:
        contacts = [c for c in contacts if c.get("crm_stage") == stage]

    columns = [
        "company_name",
        "phone",
        "email",
        "website",
        "address",
        "city",
        "state",
        "rating",
        "reviews",
        "tier",
        "lead_score",
        "industry",
        "estimated_size",
        "outreach_priority",
        "crm_stage",
        "outreach_status",
        "outreach_channel",
        "follow_up_count",
        "last_contact",
        "assigned_to",
        "crm_added_at",
    ]

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for c in contacts:
        writer.writerow({k: (c.get(k) or "") for k in columns})

    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=crm_contacts.csv"},
    )


@router.delete("/{contact_id}", summary="Delete a CRM contact")
def delete_contact(contact_id: str) -> Dict[str, Any]:
    contacts = _load_crm()
    idx = _find_contact(contacts, contact_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    removed = contacts.pop(idx)
    _save_crm(contacts)
    return {"success": True, "removed": removed.get("company_name")}
