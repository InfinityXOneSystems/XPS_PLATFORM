from datetime import datetime, timedelta

import structlog

from app.agents.base import BaseAgent

logger = structlog.get_logger()

DAILY_SEND_LIMIT = 500


class OutreachAgent(BaseAgent):
    def __init__(self):
        super().__init__("outreach_agent")

    def run(self) -> None:
        from app.config import settings
        from app.database import SessionLocal
        from app.models.contractor import Contractor, OutreachLog

        if not settings.SENDGRID_API_KEY:
            self.log("SendGrid API key not configured, skipping outreach", "warning")
            return

        db = SessionLocal()
        try:
            # Count sends in last 24 hours
            sent_today = (
                db.query(OutreachLog)
                .filter(OutreachLog.sent_at >= datetime.utcnow() - timedelta(hours=24))
                .count()
            )

            if sent_today >= DAILY_SEND_LIMIT:
                self.log(
                    f"Daily limit reached ({sent_today}/{DAILY_SEND_LIMIT})", "warning"
                )
                return

            remaining = DAILY_SEND_LIMIT - sent_today

            # Find high-score leads not yet contacted
            candidates = (
                db.query(Contractor)
                .filter(
                    Contractor.lead_score >= 60,
                    Contractor.email.isnot(None),
                    Contractor.last_contacted.is_(None),
                )
                .order_by(Contractor.lead_score.desc())
                .limit(remaining)
                .all()
            )

            self.log(f"Found {len(candidates)} candidates for outreach")

            from app.services.email_service import EmailService

            email_svc = EmailService()

            sent = 0
            for contractor in candidates:
                try:
                    email_svc.send_outreach_email(contractor, "default")
                    log = OutreachLog(
                        contractor_id=contractor.id,
                        channel="email",
                        template_used="default",
                        status="sent",
                    )
                    db.add(log)
                    contractor.last_contacted = datetime.utcnow()
                    sent += 1
                except Exception as e:
                    self.log(f"Failed to send to {contractor.email}: {e}", "warning")

            db.commit()
            self.log(f"Outreach complete: {sent} emails sent")
        finally:
            db.close()
