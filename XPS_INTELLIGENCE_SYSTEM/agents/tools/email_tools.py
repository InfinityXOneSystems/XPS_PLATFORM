"""
agents/tools/email_tools.py
===========================
Email outreach tools for the AI agent pipeline.

Generates personalised outreach emails and schedules follow-ups.
Uses Nodemailer-compatible SMTP config via environment variables.
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

logger = logging.getLogger(__name__)

# SMTP configuration (set via .env / environment variables)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_NAME = os.getenv("FROM_NAME", "XPS Intelligence")


def generate_outreach_email(lead: dict[str, Any], template: str = "default") -> dict[str, str]:
    """
    Generate a personalised outreach email for *lead*.

    Returns a dict with keys: subject, body, to (if email present).
    """
    company = lead.get("company_name", "your company")
    city = lead.get("city", "")
    industry = lead.get("industry", "flooring")
    to_email = lead.get("email", "")

    subject = f"Partnership Opportunity — {company}"

    body = (
        f"Hi {company} Team,\n\n"
        f"I came across your business in {city} and wanted to reach out about a "
        f"potential partnership opportunity in the {industry} sector.\n\n"
        "Our platform helps contractors like you connect with high-value commercial "
        "and residential clients looking for quality work.\n\n"
        "Would you be open to a quick 15-minute call this week?\n\n"
        "Best regards,\n"
        f"{FROM_NAME}\n"
        "XPS Intelligence System"
    )

    return {"subject": subject, "body": body, "to": to_email}


def send_email(to: str, subject: str, body: str) -> dict[str, Any]:
    """
    Send a plain-text email via SMTP.

    Returns a result dict with success/error information.
    """
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP credentials not configured — email not sent")
        return {"success": False, "error": "SMTP credentials not configured"}

    try:
        msg = MIMEMultipart()
        msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to, msg.as_string())

        logger.info("Email sent to %s", to)
        return {"success": True, "to": to, "subject": subject}
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return {"success": False, "error": str(exc)}


def send_outreach_batch(
    leads: list[dict[str, Any]], template: str = "default", dry_run: bool = True
) -> dict[str, Any]:
    """
    Send outreach emails to a list of leads.

    Set *dry_run=False* to actually transmit emails.
    Returns a summary dict.
    """
    results: list[dict[str, Any]] = []
    queued = 0
    sent = 0
    errors = 0

    for lead in leads:
        email = lead.get("email")
        if not email:
            continue

        queued += 1
        payload = generate_outreach_email(lead, template)

        if dry_run:
            results.append({"lead": lead.get("company_name"), "status": "queued (dry-run)"})
        else:
            result = send_email(email, payload["subject"], payload["body"])
            if result.get("success"):
                sent += 1
                results.append({"lead": lead.get("company_name"), "status": "sent"})
            else:
                errors += 1
                results.append({"lead": lead.get("company_name"), "status": "error", "error": result.get("error")})

    return {
        "queued": queued,
        "sent": sent,
        "errors": errors,
        "dry_run": dry_run,
        "results": results,
    }
