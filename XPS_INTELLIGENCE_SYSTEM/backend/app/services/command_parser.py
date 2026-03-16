import re
from typing import Any, Dict

import structlog

logger = structlog.get_logger()

US_STATES = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
}

STATE_ABBREVS = {v: v for v in US_STATES.values()}

INDUSTRY_KEYWORDS = [
    "epoxy",
    "flooring",
    "roofing",
    "plumbing",
    "electrical",
    "hvac",
    "landscaping",
    "concrete",
    "painting",
    "fencing",
    "windows",
    "doors",
    "contractor",
    "construction",
    "remodeling",
    "renovation",
    "insulation",
    "solar",
    "paving",
    "masonry",
    "carpentry",
    "drywall",
    "siding",
]


class CommandParser:
    SCRAPE_PATTERNS = [
        re.compile(r"\b(scrape|find|get|search|discover|collect)\b", re.I),
    ]
    EXPORT_PATTERNS = [
        re.compile(r"\b(export|download|save|csv|excel|sheet)\b", re.I),
    ]
    STATS_PATTERNS = [
        re.compile(r"\b(stats|statistics|summary|count|how many|report)\b", re.I),
    ]
    SEARCH_PATTERNS = [
        re.compile(r"\b(show|list|display|lookup|query)\b", re.I),
    ]

    def parse(self, command: str) -> Dict[str, Any]:
        command_lower = command.lower().strip()
        action = self._detect_action(command_lower)
        parameters = self._extract_parameters(command, command_lower)
        return {
            "action": action,
            "parameters": parameters,
            "message": f"Parsed as {action} with parameters: {parameters}",
            "original_command": command,
        }

    def _detect_action(self, command: str) -> str:
        for pattern in self.SCRAPE_PATTERNS:
            if pattern.search(command):
                return "SCRAPE"
        for pattern in self.EXPORT_PATTERNS:
            if pattern.search(command):
                return "EXPORT"
        for pattern in self.STATS_PATTERNS:
            if pattern.search(command):
                return "STATS"
        for pattern in self.SEARCH_PATTERNS:
            if pattern.search(command):
                return "SEARCH"
        return "SCRAPE"  # default

    def _extract_parameters(self, command: str, command_lower: str) -> Dict[str, Any]:
        params: Dict[str, Any] = {}

        # Extract industry
        for keyword in INDUSTRY_KEYWORDS:
            if keyword in command_lower:
                params["industry"] = keyword
                break

        # Extract state (full name or abbreviation)
        for state_name, abbrev in US_STATES.items():
            if state_name in command_lower:
                params["state"] = abbrev
                break
        if "state" not in params:
            for abbrev in STATE_ABBREVS:
                pattern = re.compile(r"\b" + abbrev + r"\b", re.I)
                if pattern.search(command):
                    params["state"] = abbrev
                    break

        # Extract city (word before "in" or after "in")
        city_match = re.search(r"\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", command)
        if city_match:
            candidate = city_match.group(1)
            if candidate.lower() not in US_STATES:
                params["city"] = candidate

        # Extract numeric count (e.g. "50 plumbing contractors" or "50 contractors")
        count_match = re.search(
            r"\b(\d+)\s+(?:\w+\s+)*(?:leads?|results?|records?|contractors?)\b",
            command_lower,
        )
        if count_match:
            params["count"] = int(count_match.group(1))

        # Extract min rating
        rating_match = re.search(
            r"rating\s+(?:above|over|>|>=)?\s*(\d+(?:\.\d+)?)", command_lower
        )
        if rating_match:
            params["min_rating"] = float(rating_match.group(1))

        # Fallback: use full command as query
        if "industry" not in params:
            params["query"] = command

        return params
