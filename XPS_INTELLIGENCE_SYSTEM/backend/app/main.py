from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.responses import Response

from app.config import settings

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"]
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "HTTP request latency", ["endpoint"]
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting_application")
    try:
        from app.database import Base, engine
        from app.models import admin_models  # noqa: F401 - register admin models
        from app.models import contractor  # noqa: F401 - register models

        Base.metadata.create_all(bind=engine)
        logger.info("database_tables_created")
    except Exception as e:
        logger.error("startup_failed", error=str(e))

    # Start background worker pool for runtime command execution
    try:
        from app.runtime.command_router import _register_defaults
        from app.workers.worker_runtime import start_worker_runtime

        _register_defaults()
        start_worker_runtime()
        logger.info("worker_pool_started")
    except Exception as e:
        logger.error("worker_pool_start_failed", error=str(e))

    yield


app = FastAPI(
    title="LEAD_GEN_INTELLIGENCE API",
    description="Enterprise-grade lead intelligence platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "leadgen-api",
        "version": "1.0.0",
    }


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Include routers
from app.api.v1 import outreach  # noqa: E402
from app.api.v1 import (  # noqa: E402
    admin,
    agents,
    commands,
    connectors,
    crm,
    intelligence,
    leads,
    multi_agent,
    runtime,
    scrapers,
    system,
)

app.include_router(leads.router, prefix="/api/v1")
app.include_router(scrapers.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(outreach.router, prefix="/api/v1")
app.include_router(commands.router, prefix="/api/v1")
app.include_router(runtime.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(connectors.router, prefix="/api/v1")
app.include_router(crm.router, prefix="/api/v1")
app.include_router(multi_agent.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
