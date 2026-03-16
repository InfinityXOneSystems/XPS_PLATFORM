from typing import List

import structlog

logger = structlog.get_logger()

EMAIL_TEMPLATES = {
    "default": {
        "subject": "Partnership Opportunity - {company_name}",
        "body": """Hi {owner_name},

I came across {company_name} and was impressed by your work in the {industry} space.

I'd love to connect and discuss how we can help grow your business.

Best regards,
The LeadGen Team

---
To unsubscribe, reply with UNSUBSCRIBE.
""",
    },
    "followup": {
        "subject": "Following up - {company_name}",
        "body": """Hi {owner_name},

Just following up on my previous message about partnership opportunities for {company_name}.

Would love to schedule a quick call.

Best regards,
The LeadGen Team
""",
    },
}


class EmailService:
    def __init__(self):
        from app.config import settings

        self.api_key = settings.SENDGRID_API_KEY
        self.from_email = "outreach@leadgen.io"
        self.from_name = "LeadGen Intelligence"

    def send_outreach_email(self, contractor, template_name: str = "default") -> bool:
        if not self.api_key:
            logger.warning("sendgrid_not_configured")
            return False

        template = EMAIL_TEMPLATES.get(template_name, EMAIL_TEMPLATES["default"])
        subject = template["subject"].format(company_name=contractor.company_name)
        body = template["body"].format(
            company_name=contractor.company_name,
            owner_name=contractor.owner_name or "there",
            industry=contractor.industry or "your industry",
        )

        return self._send(
            to_email=contractor.email,
            to_name=contractor.company_name,
            subject=subject,
            body=body,
        )

    def send_campaign(self, contractor_ids: List[str], template_name: str, db) -> dict:
        from app.models.contractor import Contractor

        sent, failed = 0, 0
        for cid in contractor_ids:
            contractor = db.query(Contractor).filter(Contractor.id == cid).first()
            if contractor and contractor.email:
                ok = self.send_outreach_email(contractor, template_name)
                if ok:
                    sent += 1
                else:
                    failed += 1
        return {"sent": sent, "failed": failed}

    def _send(self, to_email: str, to_name: str, subject: str, body: str) -> bool:
        try:
            import sendgrid
            from sendgrid.helpers.mail import Content, Email, Mail, To

            sg = sendgrid.SendGridAPIClient(api_key=self.api_key)
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email, to_name),
                subject=subject,
                plain_text_content=Content("text/plain", body),
            )
            response = sg.client.mail.send.post(request_body=message.get())
            success = response.status_code in (200, 202)
            if success:
                logger.info("email_sent", to=to_email)
            return success
        except Exception as e:
            logger.error("email_send_failed", to=to_email, error=str(e))
            return False
