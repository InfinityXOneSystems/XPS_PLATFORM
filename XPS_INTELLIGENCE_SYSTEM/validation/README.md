# Validation Foundation

This directory contains the validation pipeline for XPS Intelligence.

## Validation Stages

| Stage | File | Description |
|-------|------|-------------|
| Deduplication | `dedupe.js` | Remove duplicate leads |
| Lead Validation | `lead_validation_pipeline.js` | Schema and field validation |
| Lint Validation | (CI: flake8/eslint) | Code style checks |
| Type Validation | (CI: mypy/tsc) | Type correctness |
| Unit Tests | `tests/*.test.js` | Functional correctness |
| Integration Tests | `tests/integration/` | End-to-end pipeline tests |
| System Validation | `validation_engine/` | Self-validation engine |
| Security Tests | (CI: CodeQL) | Vulnerability scanning |

## Running Validation

```bash
# Lead data validation
node validation/lead_validation_pipeline.js

# Deduplication
npm run dedup

# Full test suite
npm test
npm run test:integration

# Python validation
cd backend && pytest tests/

# Self-validation engine
python -c "from validation_engine import ValidationEngine; e=ValidationEngine(); r=e.run(); print(r.summary())"
```

## Lead Validation Rules

Leads are validated against the schema in `contracts/lead_schema.json`.

Required fields:
- `company_name` or `name`
- At least one contact method (`phone` OR `email` OR `website`)

Scoring:
- Leads below `lead_score: 0` are rejected
- Leads marked `duplicate: true` are filtered

## Extending Validation

To add a new validation check:

1. Add a method `_check_<name>` to `validation_engine/validation_engine.py`
2. Register it in `ValidationEngine.__init__` checks list
3. Add a corresponding test in `tests/`
