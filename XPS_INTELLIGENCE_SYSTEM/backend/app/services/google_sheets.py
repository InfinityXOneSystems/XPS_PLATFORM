from typing import Any, List

import structlog

logger = structlog.get_logger()


class GoogleSheetsService:
    def __init__(self):
        from app.config import settings

        self.credentials_path = settings.GOOGLE_SHEETS_CREDENTIALS
        self._service = None

    def _get_service(self):
        if self._service:
            return self._service
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            creds = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=["https://www.googleapis.com/auth/spreadsheets"],
            )
            self._service = build("sheets", "v4", credentials=creds)
            return self._service
        except Exception as e:
            logger.error("google_sheets_init_failed", error=str(e))
            raise

    def export_leads_to_sheet(self, sheet_id: str, leads: List[Any]) -> bool:
        try:
            service = self._get_service()
            headers = [
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
            rows = [headers]
            for lead in leads:
                rows.append(
                    [
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
                        str(lead.created_at),
                    ]
                )

            service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range="Sheet1!A1",
                valueInputOption="RAW",
                body={"values": rows},
            ).execute()
            logger.info("sheets_export_success", sheet_id=sheet_id, rows=len(rows))
            return True
        except Exception as e:
            logger.error("sheets_export_failed", error=str(e))
            return False

    def sync_updates(self, sheet_id: str, db) -> int:
        try:
            service = self._get_service()
            result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=sheet_id, range="Sheet1!A2:M")
                .execute()
            )
            rows = result.get("values", [])
            logger.info("sheets_sync", rows=len(rows))
            return len(rows)
        except Exception as e:
            logger.error("sheets_sync_failed", error=str(e))
            return 0
