"""
tests/test_intelligence_api.py
================================
Tests for the Intelligence & Discovery API endpoints.

Covers:
- GET /intelligence/discovery
- GET /intelligence/trends
- GET /intelligence/niches
- GET /intelligence/briefing
- GET /intelligence/system/status
- POST /intelligence/vision-cortex/run
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Discovery endpoint
# ---------------------------------------------------------------------------


def test_discovery_default(client):
    """Discovery endpoint returns a report with required keys."""
    resp = client.get("/api/v1/intelligence/discovery")
    assert resp.status_code == 200
    data = resp.json()
    assert "industry" in data
    assert "region" in data
    assert "opportunity_score" in data
    assert isinstance(data["opportunity_score"], int)


def test_discovery_custom_params(client):
    """Discovery endpoint accepts custom industry and region query params."""
    resp = client.get("/api/v1/intelligence/discovery?industry=epoxy&region=Florida")
    assert resp.status_code == 200
    data = resp.json()
    assert data["industry"] == "epoxy"
    assert data["region"] == "Florida"
    assert 0 <= data["opportunity_score"] <= 100


# ---------------------------------------------------------------------------
# Trends endpoint
# ---------------------------------------------------------------------------


def test_trends_returns_list(client):
    """Trends endpoint returns a list of trend objects."""
    resp = client.get("/api/v1/intelligence/trends?industry=flooring&region=Texas")
    assert resp.status_code == 200
    data = resp.json()
    assert "trends" in data
    assert isinstance(data["trends"], list)
    assert "total" in data


def test_trends_emerging_subset(client):
    """Emerging trends are a subset of all trends."""
    resp = client.get("/api/v1/intelligence/trends?industry=epoxy&region=Texas")
    assert resp.status_code == 200
    data = resp.json()
    all_count = data.get("total", 0)
    emerging = data.get("emerging", [])
    assert len(emerging) <= all_count


# ---------------------------------------------------------------------------
# Niches endpoint
# ---------------------------------------------------------------------------


def test_niches_returns_list(client):
    """Niches endpoint returns a non-empty list for known industries."""
    resp = client.get("/api/v1/intelligence/niches?industry=epoxy&region=Texas")
    assert resp.status_code == 200
    data = resp.json()
    assert "niches" in data
    assert isinstance(data["niches"], list)
    assert len(data["niches"]) > 0


def test_niches_opportunity_scores_in_range(client):
    """All returned niches have opportunity_score in 0–100."""
    resp = client.get("/api/v1/intelligence/niches?industry=flooring&region=California")
    assert resp.status_code == 200
    for niche in resp.json()["niches"]:
        score = niche.get("opportunity_score", 0)
        assert 0 <= score <= 100


# ---------------------------------------------------------------------------
# Briefing endpoint
# ---------------------------------------------------------------------------


def test_briefing_json_structure(client):
    """Briefing JSON endpoint returns required top-level keys."""
    resp = client.get("/api/v1/intelligence/briefing")
    assert resp.status_code == 200
    data = resp.json()
    for key in (
        "date",
        "generated_at",
        "total_leads",
        "financial_predictions",
        "market_opportunities",
        "startup_signals",
        "top_leads",
        "system_health",
    ):
        assert key in data, f"Missing key: {key}"


def test_briefing_markdown_returns_string(client):
    """Briefing Markdown endpoint returns a non-empty markdown string."""
    resp = client.get("/api/v1/intelligence/briefing/markdown")
    assert resp.status_code == 200
    data = resp.json()
    assert "markdown" in data
    assert isinstance(data["markdown"], str)
    assert len(data["markdown"]) > 10


# ---------------------------------------------------------------------------
# System status endpoint
# ---------------------------------------------------------------------------


def test_system_status_has_overall(client):
    """System status endpoint returns an 'overall' field."""
    resp = client.get("/api/v1/intelligence/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "overall" in data
    assert data["overall"] in ("healthy", "degraded", "unknown", "error")


# ---------------------------------------------------------------------------
# Vision cortex endpoints
# ---------------------------------------------------------------------------


def test_vision_cortex_status(client):
    """Vision cortex status endpoint returns availability info."""
    resp = client.get("/api/v1/intelligence/vision-cortex/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "available" in data
    assert "status" in data


def test_vision_cortex_run_accepted(client):
    """Vision cortex run endpoint returns 202 and a task_id."""
    payload = {"industry": "epoxy", "region": "Texas", "max_leads": 10}
    resp = client.post("/api/v1/intelligence/vision-cortex/run", json=payload)
    assert resp.status_code == 202
    data = resp.json()
    assert data.get("accepted") is True
    assert "task_id" in data
    assert data["industry"] == "epoxy"
