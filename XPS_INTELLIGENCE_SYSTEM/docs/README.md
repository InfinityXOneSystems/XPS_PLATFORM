# LEAD_GEN_INTELLIGENCE

Enterprise-grade lead intelligence platform for discovering, enriching, and engaging contractor businesses at scale.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        NGINX (Port 80)                       │
│                  Reverse Proxy / Load Balancer               │
└──────────────────┬──────────────────────┬───────────────────┘
                   │                      │
        ┌──────────▼──────────┐  ┌────────▼────────┐
        │   FastAPI Backend   │  │ Next.js Frontend │
        │     (Port 8000)     │  │   (Port 3000)    │
        └──────────┬──────────┘  └─────────────────-┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼───────┐   ┌─────────▼───────┐
│  PostgreSQL   │   │     Redis        │
│  (Port 5432)  │   │   (Port 6379)    │
└───────────────┘   └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Celery Workers │
                    │  + Beat Scheduler│
                    └─────────────────┘
```

### Core Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Server | FastAPI + Python 3.11 | REST API, business logic |
| Database | PostgreSQL 15 | Lead storage, job tracking |
| Cache / Queue | Redis 7 | Task queue, caching |
| Task Workers | Celery | Async background processing |
| Frontend | Next.js 14 | Dashboard UI |
| Proxy | Nginx | Routing, SSL termination |

### Intelligent Agents

| Agent | Schedule | Description |
|-------|----------|-------------|
| SCRAPER_AGENT | Every 30s | Processes pending scrape jobs |
| ENRICHMENT_AGENT | Every 60s | Enriches leads with missing data |
| DATABASE_AGENT | Every hour | Deduplication and cleanup |
| OUTREACH_AGENT | Every 5min | Sends outreach to high-score leads |
| HEALTH_AGENT | Every 60s | System health monitoring |

## Quick Start

### Prerequisites
- Docker 24+
- Docker Compose 2.20+

### Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/LEAD_GEN_INTELLIGENCE.git
cd LEAD_GEN_INTELLIGENCE
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Start all services:
```bash
docker compose up -d
```

4. Run database migrations:
```bash
docker compose exec api alembic upgrade head
```

5. Access the platform:
- Dashboard: http://localhost
- API Docs: http://localhost:8000/docs
- API ReDoc: http://localhost:8000/redoc

## API Documentation

### Base URL
`http://localhost:8000/api/v1`

### Endpoints

#### Leads
| Method | Path | Description |
|--------|------|-------------|
| GET | /leads | List leads with pagination and filters |
| GET | /leads/{id} | Get single lead |
| POST | /leads | Create lead manually |
| PUT | /leads/{id} | Update lead |
| DELETE | /leads/{id} | Delete lead |
| GET | /leads/export/csv | Export leads as CSV |
| GET | /leads/stats/summary | Aggregate statistics |

#### Scrapers
| Method | Path | Description |
|--------|------|-------------|
| POST | /scrapers/jobs | Create scraping job |
| GET | /scrapers/jobs | List all jobs |
| GET | /scrapers/jobs/{id} | Get job details |
| POST | /scrapers/jobs/{id}/cancel | Cancel running job |
| GET | /scrapers/status | System-wide scraper status |

#### Agents
| Method | Path | Description |
|--------|------|-------------|
| GET | /agents | List all agents and their status |
| POST | /agents/{name}/start | Start a specific agent |
| POST | /agents/{name}/stop | Stop a specific agent |
| GET | /agents/{name}/logs | Get agent activity logs |

#### Outreach
| Method | Path | Description |
|--------|------|-------------|
| POST | /outreach/campaigns | Create outreach campaign |
| GET | /outreach/campaigns | List campaigns |
| POST | /outreach/send | Send to specific contractors |
| GET | /outreach/stats | Campaign statistics |

#### Natural Language Commands
| Method | Path | Description |
|--------|------|-------------|
| POST | /commands/execute | Execute NL command |

**Example command request:**
```json
{
  "command": "scrape epoxy contractors in Texas with rating above 4"
}
```

**Example response:**
```json
{
  "action": "SCRAPE",
  "parameters": {
    "industry": "epoxy contractors",
    "state": "Texas",
    "min_rating": 4.0
  },
  "job_id": "uuid-here"
}
```

## Configuration Guide

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | - | Redis connection string |
| `SECRET_KEY` | - | JWT signing secret |
| `OPENAI_API_KEY` | - | OpenAI API key (optional) |
| `SENDGRID_API_KEY` | - | SendGrid API key for outreach |
| `GITHUB_TOKEN` | - | GitHub token for health alerts |
| `SCRAPER_CONCURRENCY` | 10 | Parallel scraper threads |
| `MAX_LEADS_PER_DAY` | 100000 | Daily lead processing limit |

## Lead Scoring

Leads are scored 0-100 based on:

| Criteria | Points |
|----------|--------|
| Has email | +20 |
| Has phone | +20 |
| Has website | +20 |
| Reviews > 10 | +20 |
| Rating > 4.0 | +20 |

## Development

### Running locally without Docker

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend  
cd frontend
npm install
npm run dev

# Worker
cd backend
celery -A app.celery_app worker --loglevel=info
```

### Running Tests

```bash
cd backend
pytest tests/ -v --cov=app
```

## License

MIT
