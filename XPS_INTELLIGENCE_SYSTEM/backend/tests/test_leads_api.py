def test_health_check(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"


def test_list_leads_empty(client):
    resp = client.get("/api/v1/leads")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_create_lead(client):
    payload = {
        "company_name": "Test Epoxy Co",
        "owner_name": "John Doe",
        "email": "john@testepoxy.com",
        "phone": "555-1234",
        "website": "https://testepoxy.com",
        "city": "Austin",
        "state": "TX",
        "industry": "epoxy flooring",
        "rating": 4.5,
        "reviews": 25,
        "source": "test",
    }
    resp = client.post("/api/v1/leads", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["company_name"] == "Test Epoxy Co"
    assert data["lead_score"] == 100.0  # all factors present


def test_get_lead(client):
    # Create first
    payload = {
        "company_name": "Get Test Co",
        "city": "Dallas",
        "state": "TX",
        "source": "test",
    }
    create_resp = client.post("/api/v1/leads", json=payload)
    lead_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/leads/{lead_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == lead_id


def test_get_lead_not_found(client):
    resp = client.get("/api/v1/leads/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_update_lead(client):
    payload = {
        "company_name": "Update Test Co",
        "city": "Houston",
        "state": "TX",
        "source": "test",
    }
    create_resp = client.post("/api/v1/leads", json=payload)
    lead_id = create_resp.json()["id"]

    update_resp = client.put(
        f"/api/v1/leads/{lead_id}", json={"email": "updated@test.com"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["email"] == "updated@test.com"


def test_delete_lead(client):
    payload = {"company_name": "Delete Me Co", "source": "test"}
    create_resp = client.post("/api/v1/leads", json=payload)
    lead_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/leads/{lead_id}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/v1/leads/{lead_id}")
    assert get_resp.status_code == 404


def test_leads_stats(client):
    resp = client.get("/api/v1/leads/stats/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_leads" in data
    assert "average_score" in data


def test_list_leads_with_filters(client):
    resp = client.get("/api/v1/leads?state=TX&min_score=0")
    assert resp.status_code == 200


def test_export_csv(client):
    resp = client.get("/api/v1/leads/export/csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
