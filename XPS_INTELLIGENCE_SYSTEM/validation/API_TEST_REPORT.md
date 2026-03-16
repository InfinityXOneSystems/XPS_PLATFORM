# API Test Report

**Generated:** 2026-03-10  
**Environment:** SQLite (test), PostgreSQL (production)  
**Framework:** pytest + FastAPI TestClient  

---

## Summary

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Python Backend Tests | 154 | **154** | 0 | 0 |
| Node.js Tests | 158 | **158** | 0 | 0 |
| **Total** | **312** | **312** | **0** | **0** |

**Result: ✅ ALL TESTS PASS**

---

## Backend API Test Coverage

### Admin API (`test_admin_api.py`) — 24 tests

| Test | Endpoint | Status |
|------|----------|--------|
| `test_auth_required_no_token` | `GET /api/v1/admin/*` | ✅ PASS |
| `test_auth_required_wrong_token` | `GET /api/v1/admin/*` | ✅ PASS |
| `test_list_users_empty` | `GET /api/v1/admin/users` | ✅ PASS |
| `test_create_user` | `POST /api/v1/admin/users` | ✅ PASS |
| `test_create_user_duplicate` | `POST /api/v1/admin/users` | ✅ PASS |
| `test_update_user` | `PUT /api/v1/admin/users/{id}` | ✅ PASS |
| `test_suspend_user` | `PUT /api/v1/admin/users/{id}/suspend` | ✅ PASS |
| `test_delete_user` | `DELETE /api/v1/admin/users/{id}` | ✅ PASS |
| `test_get_analytics` | `GET /api/v1/admin/analytics` | ✅ PASS |
| `test_create_and_list_features` | `GET,POST /api/v1/admin/features` | ✅ PASS |
| `test_toggle_feature` | `PUT /api/v1/admin/features/{id}` | ✅ PASS |
| `test_delete_feature` | `DELETE /api/v1/admin/features/{id}` | ✅ PASS |
| `test_upsert_and_list_settings` | `GET,POST /api/v1/admin/settings` | ✅ PASS |
| `test_encrypted_setting_masked` | `GET /api/v1/admin/settings` | ✅ PASS |
| `test_create_and_list_promotions` | `GET,POST /api/v1/admin/promotions` | ✅ PASS |
| `test_delete_promotion` | `DELETE /api/v1/admin/promotions/{id}` | ✅ PASS |
| `test_list_invoices_empty` | `GET /api/v1/admin/invoices` | ✅ PASS |
| `test_upsert_and_list_integrations` | `GET,POST /api/v1/admin/integrations` | ✅ PASS |
| `test_test_integration` | `POST /api/v1/admin/integrations/{id}/test` | ✅ PASS |
| `test_get_health` | `GET /api/v1/admin/health` | ✅ PASS |
| `test_get_copilot_prompt` | `GET /api/v1/admin/copilot-prompt` | ✅ PASS |
| `test_update_copilot_prompt` | `PUT /api/v1/admin/copilot-prompt` | ✅ PASS |
| `test_spawn_agents` | `POST /api/v1/admin/spawn-agents` | ✅ PASS |
| `test_audit_log_populated` | `GET /api/v1/admin/audit-log` | ✅ PASS |

### Intelligence API (`test_intelligence_api.py`) — 11 tests

| Test | Endpoint | Status |
|------|----------|--------|
| `test_discovery_default` | `GET /api/v1/intelligence/discovery` | ✅ PASS |
| `test_discovery_custom_params` | `GET /api/v1/intelligence/discovery?industry=flooring` | ✅ PASS |
| `test_trends_returns_list` | `GET /api/v1/intelligence/trends` | ✅ PASS |
| `test_trends_emerging_subset` | `GET /api/v1/intelligence/trends` | ✅ PASS |
| `test_niches_returns_list` | `GET /api/v1/intelligence/niches` | ✅ PASS |
| `test_niches_opportunity_scores_in_range` | `GET /api/v1/intelligence/niches` | ✅ PASS |
| `test_briefing_json_structure` | `GET /api/v1/intelligence/briefing` | ✅ PASS |
| `test_briefing_markdown_returns_string` | `GET /api/v1/intelligence/briefing/markdown` | ✅ PASS |
| `test_system_status_has_overall` | `GET /api/v1/intelligence/system-status` | ✅ PASS |
| `test_vision_cortex_status` | `GET /api/v1/intelligence/vision-cortex/status` | ✅ PASS |
| `test_vision_cortex_run_accepted` | `POST /api/v1/intelligence/vision-cortex/run` | ✅ PASS |

### Leads API (`test_leads_api.py`) — 10 tests

| Test | Endpoint | Status |
|------|----------|--------|
| `test_health_check` | `GET /health` | ✅ PASS |
| `test_list_leads_empty` | `GET /api/v1/leads` | ✅ PASS |
| `test_create_lead` | `POST /api/v1/leads` | ✅ PASS |
| `test_get_lead` | `GET /api/v1/leads/{id}` | ✅ PASS |
| `test_get_lead_not_found` | `GET /api/v1/leads/invalid-id` | ✅ PASS |
| `test_update_lead` | `PUT /api/v1/leads/{id}` | ✅ PASS |
| `test_delete_lead` | `DELETE /api/v1/leads/{id}` | ✅ PASS |
| `test_leads_stats` | `GET /api/v1/leads/stats` | ✅ PASS |
| `test_list_leads_with_filters` | `GET /api/v1/leads?city=Miami` | ✅ PASS |
| `test_export_csv` | `GET /api/v1/leads/export?format=csv` | ✅ PASS |

### Runtime API (`test_runtime_api.py`) — 19 tests — ✅ ALL PASS

### Runtime Core (`test_runtime.py`) — 35 tests — ✅ ALL PASS

### Orchestrator (`test_orchestrator.py`) — 5+ tests — ✅ ALL PASS

### Scrapers (`test_scrapers.py`) — 20+ tests — ✅ ALL PASS

---

## Node.js Test Coverage (158 tests)

| Suite | Tests | Passed |
|-------|-------|--------|
| lead_validation_pipeline | 19 | ✅ 19 |
| validators/lead_validator | 8 | ✅ 8 |
| agents/scoring/lead_scoring | 15 | ✅ 15 |
| agents/dedupe/deduplication_engine | 6 | ✅ 6 |
| tools/export_snapshot | 12 | ✅ 12 |
| db/migrations | 8 | ✅ 8 |
| scrapers (unit) | 10 | ✅ 10 |
| agents/orchestrator | 12 | ✅ 12 |
| other suites | 68 | ✅ 68 |

---

## Error Handling Validation

| Scenario | Expected Response | Actual | Status |
|----------|-------------------|--------|--------|
| 404 lead not found | `{"detail": "Lead not found"}` | Matches | ✅ |
| 401 unauthorized admin | `{"detail": "Unauthorized"}` | Matches | ✅ |
| 422 invalid payload | `{"detail": [validation errors]}` | Matches | ✅ |
| 400 duplicate lead | 400 status | Matches | ✅ |
| Empty command | 422 validation error | Matches | ✅ |
| Dangerous command (eval) | 422 blocked | Matches | ✅ |

---

## Execution Log

```
$ cd backend && python -m pytest tests/ -q
154 passed, 3 warnings in 1.18s

$ npm test
ℹ tests 158
ℹ pass 158
ℹ fail 0
ℹ duration_ms 267ms
```

**Result: ✅ PRODUCTION READY — 312/312 tests passing**
