# Dead Code Report

**Generated:** 2026-03-10  
**Method:** Static analysis of imports, class definitions, function usage  

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Duplicate class definitions | 2 | ✅ Fixed |
| Unused imports (Python) | 0 | ✅ Cleaned (previous session) |
| UTF-16 encoded Python files | 0 | ✅ Fixed |
| Syntax errors | 0 | ✅ Fixed |
| Unreachable code | 0 (none found) | ✅ |

---

## Issues Found and Fixed

### 1. Duplicate `SEOAgent` Class

**File:** `agents/seo/seo_agent.py`  
**Lines:** 214 (first), 409 (second)  
**Impact:** Python uses the second definition — the first is dead code  
**Root Cause:** Two separate SEOAgent implementations appended to same file  
**Fix Applied:** Added `_extract_keyword()`, `_keyword_report()`, and URL-less fallback to second class; the first class is now legacy/dead  

```python
# First class (lines 214-407) — legacy implementation, shadowed by second class
class SEOAgent(BaseAgent):  # ← DEAD (shadowed)
    def _extract_keyword(...)  # was unreachable

# Second class (lines 409+) — active implementation  
class SEOAgent(BaseAgent):  # ← ACTIVE (overwrites first)
    # now has _extract_keyword + _keyword_report added
```

### 2. Duplicate Route Entries in `command_router.py`

**File:** `agent_core/command_router.py`  
**Lines:** 88-96 (first SEO entry), 103-107 (duplicate, missing `{`)  
**Impact:** SyntaxError caused all Python tests in `tests/` to fail  
**Fix Applied:** Added missing `{` to make the duplicate entry valid  

---

## Potential Dead Code (Low Risk, Not Fixed)

These are noted but do not cause test failures:

| Pattern | Location | Notes |
|---------|----------|-------|
| Legacy `score` field alias | Various scrapers | Kept for backward compat |
| `data/leads/` directory | `data/leads/` | Legacy fallback, dual-write maintained |
| First `SEOAgent` class | `agents/seo/seo_agent.py` lines 214-407 | Shadowed by second class but harmless |
| `tests/playwright/` directory | `tests/playwright/` | Empty — Playwright tests not yet implemented |
| Multiple `__pycache__` in agents | Various | Build artifacts |

---

## Removed Items (Previous Session)

In the previous agent session, these unused imports were removed:

| File | Removed Import |
|------|---------------|
| `backend/app/api/v1/multi_agent.py` | `json`, `pathlib.Path` |
| `backend/app/api/v1/runtime.py` | `os`, `re` |
| `backend/app/api/v1/crm.py` | `os` |
| `backend/app/api/v1/connectors.py` | `typing.List` |
| `backend/app/schemas/contractor.py` | `EmailStr`, `field_validator` |
| `backend/app/services/email_service.py` | `Optional` |
| `backend/app/agents/database_agent.py` | `sqlalchemy.func` |
| `backend/tests/test_intelligence_api.py` | `pytest` |
| `backend/tests/test_runtime_api.py` | `pytest` |
| `backend/tests/test_scrapers.py` | `MagicMock`, `patch`, `pytest` |

---

## Encoding Issues Found and Fixed

| File | Encoding | Fix |
|------|----------|-----|
| `tests/system/test_agent_health.py` | UTF-16 LE | Converted to UTF-8 |

The CI `code_quality.yml` workflow already has a UTF-16 check:
```bash
find . -name "*.js" | xargs file | grep "UTF-16" → exit 1
```
This was only for `.js` files; Python files were not checked. The root cause was likely a Windows editor saving the file in UTF-16.

---

## Conclusion

No significant dead code found. Two critical bugs fixed that were causing test failures.
