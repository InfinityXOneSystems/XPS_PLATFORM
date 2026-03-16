import pytest

from app.services.command_parser import CommandParser


@pytest.fixture
def parser():
    return CommandParser()


def test_parse_scrape_command(parser):
    result = parser.parse("scrape epoxy contractors in Texas")
    assert result["action"] == "SCRAPE"
    assert result["parameters"].get("state") == "TX"
    assert result["parameters"].get("industry") == "epoxy"


def test_parse_export_command(parser):
    result = parser.parse("export leads to CSV")
    assert result["action"] == "EXPORT"


def test_parse_stats_command(parser):
    result = parser.parse("show me stats for this week")
    assert result["action"] == "STATS"


def test_parse_find_command(parser):
    result = parser.parse("find roofing contractors in Florida")
    assert result["action"] == "SCRAPE"
    assert result["parameters"].get("state") == "FL"
    assert result["parameters"].get("industry") == "roofing"


def test_parse_state_abbreviation(parser):
    result = parser.parse("scrape contractors in CA")
    assert result["parameters"].get("state") == "CA"


def test_parse_count(parser):
    result = parser.parse("find 50 plumbing contractors in Ohio")
    assert result["parameters"].get("count") == 50


def test_parse_rating(parser):
    result = parser.parse("scrape contractors with rating above 4.5")
    assert result["parameters"].get("min_rating") == 4.5


def test_parse_fallback_action(parser):
    result = parser.parse("concrete contractors New York")
    assert result["action"] in ("SCRAPE", "SEARCH", "STATS", "EXPORT")


def test_parse_returns_original_command(parser):
    cmd = "scrape epoxy in Texas"
    result = parser.parse(cmd)
    assert result["original_command"] == cmd


def test_parse_search_command(parser):
    result = parser.parse("show me all contractors in California")
    assert result["action"] in ("SEARCH", "SCRAPE")
