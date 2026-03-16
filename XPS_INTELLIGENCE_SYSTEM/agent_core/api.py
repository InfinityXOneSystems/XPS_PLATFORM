"""
api.py – FastAPI server exposing the gated agent pipeline.

Endpoints:
  POST /agent/run      – run the full PLAN → VALIDATE → EXECUTE pipeline
  POST /agent/chat     – chat interface (natural language → agent execution)
  GET  /agent/stream   – SSE streaming chat response
  GET  /agent/status   – return system / dependency status
  GET  /agent/runs     – list recent run states (for debugging)
  GET  /agent/metrics  – system monitoring metrics
  GET  /agent/settings – current system settings
  POST /agent/settings – update system settings

Start with:
    python -m uvicorn agent_core.api:app --reload
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from .executor import Executor
from .gates import GateError
from .planner import plan
from .state_manager import StateManager
from .validator import ExecutionResult

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "api.log"), encoding="utf-8"),
    ],
)
logger = logging.getLogger("agent_core.api")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="XPS Intelligence Agent API",
    description=(
        "Autonomous AI control platform. "
        "Gated pipeline: PLAN → VALIDATE → EXECUTE. "
        "Full chat interface: POST /agent/chat | Stream: GET /agent/stream"
    ),
    version="2.0.0",
)

# CORS middleware – allow frontend origins
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

# Build the allowed-origins list from environment so Vercel / staging URLs
# are automatically included without changing code.
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3200",
    "http://localhost:8000",
]
# Accept extra origins from env (comma-separated)
for _o in filter(None, os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")):
    _cors_origins.append(_o.strip())
# Legacy single-origin env vars
for _o in filter(None, [
    os.getenv("FRONTEND_URL"),
    os.getenv("CORS_ALLOW_ORIGIN"),
    os.getenv("VERCEL_URL"),
]):
    # Vercel provides the hostname without scheme
    if _o and not _o.startswith("http"):
        _cors_origins.append(f"https://{_o}")
    elif _o:
        _cors_origins.append(_o)

# Deduplicate while preserving order
_cors_origins = list(dict.fromkeys(_cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_state_manager = StateManager()
_executor = Executor(state_manager=_state_manager)

# Lazily initialise the runtime controller (avoids import-time side-effects)
_runtime_controller = None


def _get_runtime_controller():
    global _runtime_controller
    if _runtime_controller is None:
        try:
            from runtime.runtime_controller import RuntimeController
            _runtime_controller = RuntimeController()
        except Exception as exc:
            logger.warning("RuntimeController unavailable: %s", exc)
    return _runtime_controller


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class RunRequest(BaseModel):
    """Input to POST /agent/run."""

    command: str

    @field_validator("command")
    @classmethod
    def command_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("command must not be empty")
        if len(v) > 2000:
            raise ValueError(
                f"command must not exceed 2000 characters (got {len(v)})"
                # 2000 chars allows multi-line code generation prompts
            )
        return v


class ChatRequest(BaseModel):
    """Input to POST /agent/chat."""

    message: str
    session_id: str | None = None

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message must not be empty")
        if len(v) > 2000:
            raise ValueError(
                f"message must not exceed 2000 characters (got {len(v)})"
            )
        return v


class SettingsRequest(BaseModel):
    """Input to POST /agent/settings."""

    settings: Dict[str, Any]


class RunResponse(BaseModel):
    """Output from POST /agent/run."""

    run_id: str
    success: bool
    leads_found: int
    high_value: int
    message: str
    retried: bool
    errors: list


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/agent/run", response_model=RunResponse)
async def run_agent(request: RunRequest) -> RunResponse:
    """
    Execute the full PLAN → VALIDATE → EXECUTE pipeline.

    Example input::

        {"command": "scrape epoxy contractors tampa"}

    Example output::

        {"leads_found": 42, "high_value": 12, ...}
    """
    run_id = str(int(time.time() * 1000))
    logger.info("run_id=%s  command=%s", run_id, request.command)

    # ── 1. Plan ──────────────────────────────────────────────────────
    try:
        agent_plan = plan(request.command)
    except Exception as exc:
        logger.error("Planning failed: %s", exc)
        raise HTTPException(status_code=422, detail=f"Planning error: {exc}") from exc

    logger.info(
        "run_id=%s  plan steps=%s",
        run_id,
        [s.tool for s in agent_plan.steps],
    )

    # ── 2 & 3. Validate + Execute (gates enforced inside executor) ────
    raw_command = agent_plan.command.model_dump()
    result: ExecutionResult = _executor.execute(raw_command, agent_plan, run_id=run_id)

    if not result.success and result.errors:
        first_error = result.errors[0] if result.errors else "unknown error"
        if "gate" in first_error.lower():
            raise HTTPException(status_code=403, detail=first_error)

    return RunResponse(
        run_id=run_id,
        success=result.success,
        leads_found=result.leads_found,
        high_value=result.high_value,
        message=result.message,
        retried=result.retried,
        errors=result.errors,
    )


@app.get("/agent/status")
async def agent_status() -> Dict[str, Any]:
    """Return system / dependency availability status."""
    langgraph_ok = False
    playwright_ok = False
    open_interpreter_ok = False
    redis_ok = False
    qdrant_ok = False
    ollama_ok = False

    try:
        import langgraph  # type: ignore  # noqa: F401
        langgraph_ok = True
    except ImportError:
        pass

    try:
        import playwright  # type: ignore  # noqa: F401
        playwright_ok = True
    except ImportError:
        pass

    try:
        import interpreter  # type: ignore  # noqa: F401
        open_interpreter_ok = True
    except ImportError:
        pass

    try:
        from task_queue.redis_queue import TaskQueue
        redis_ok = TaskQueue().health()["redis_connected"]
    except Exception:
        pass

    try:
        from llm.ollama_client import health_check
        ollama_ok = health_check()
    except Exception:
        pass

    try:
        from memory.memory_manager import MemoryManager
        h = MemoryManager().health()
        qdrant_ok = h.get("qdrant", False)
    except Exception:
        pass

    system_ready = True  # API is reachable → system is ready

    # LLM router status
    llm_provider = None
    groq_ok = False
    try:
        from llm.llm_router import router_status
        llm_stat = router_status()
        llm_provider = llm_stat.get("active_provider")
        groq_ok = llm_stat.get("providers", {}).get("groq", {}).get("available", False)
    except Exception:
        pass

    return {
        "system_ready": system_ready,
        "langgraph": langgraph_ok,
        "playwright": playwright_ok,
        "open_interpreter": open_interpreter_ok,
        "redis": redis_ok,
        "qdrant": qdrant_ok,
        "ollama": ollama_ok,
        "groq": groq_ok,
        "llm_provider": llm_provider,
        "gates_active": True,
    }


@app.get("/agent/runs")
async def list_runs() -> Dict[str, Any]:
    """List all in-memory run states (for debugging)."""
    return {"runs": _state_manager.all_runs()}


# ---------------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------------


@app.post("/agent/chat")
async def chat(request: ChatRequest) -> Dict[str, Any]:
    """
    Natural-language chat interface.

    Routes the message to the appropriate agent and returns a structured
    response. Supports all system commands including scraping, code
    generation, GitHub operations, and more.

    Example input::

        {"message": "scrape epoxy companies near Orlando"}

    Example output::

        {
            "session_id": "...",
            "message_id": "...",
            "response": "✅ Task queued (ID: abc12345…)\\nAgent: scraper ...",
            "action_taken": "scrape",
            "result": {"task_id": "...", "queued": true},
            "suggestions": ["export leads", "run outreach campaign"]
        }
    """
    logger.info("chat: message=%r", request.message)
    try:
        # Route through RuntimeController first (frontend LLM command interface)
        rc = _get_runtime_controller()
        if rc is not None:
            runtime_result = await rc.handle_command(request.message)
            # Build chat-style response envelope
            return {
                "session_id": getattr(request, "session_id", None),
                "message_id": runtime_result.get("run_id"),
                "response": runtime_result.get("message", "Command processed via runtime controller"),
                "action_taken": runtime_result.get("routing", {}).get("type", "unknown"),
                "result": runtime_result,
                "suggestions": [],
            }
        # Fallback to ChatInterpreter when RuntimeController is unavailable
        from .chat_interpreter import ChatInterpreter

        ci = ChatInterpreter()
        result = ci.process(request.message)
        return result
    except Exception as exc:
        logger.error("Chat error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/agent/stream")
async def stream_chat(message: str) -> StreamingResponse:
    """
    Server-Sent Events (SSE) streaming chat endpoint.

    Query parameter: ``message``

    Returns a stream of text chunks as ``data: <chunk>\\n\\n`` SSE events.

    Note: SSE requires GET by the EventSource spec. Message content is
    passed as a URL query parameter and will appear in server access logs.
    For production deployments where privacy is a concern, prefer the
    non-streaming POST /agent/chat endpoint instead.
    """
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="message query param required")

    logger.info("stream: message=%r", message)

    def _event_stream():
        try:
            from .chat_interpreter import ChatInterpreter

            ci = ChatInterpreter()
            for chunk in ci.stream(message):
                if chunk:
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# LLM router status endpoint
# ---------------------------------------------------------------------------


@app.get("/agent/llm/status")
async def llm_status() -> Dict[str, Any]:
    """Return the current state of the smart LLM router."""
    try:
        from llm.llm_router import router_status

        return {"success": True, **router_status()}
    except Exception as exc:
        logger.warning("LLM status error: %s", exc)
        return {"success": False, "error": str(exc)}


@app.post("/agent/llm/complete")
async def llm_complete(request: ChatRequest) -> Dict[str, Any]:
    """
    Direct LLM completion endpoint.

    Routes via the smart LLM router (Groq → Ollama → OpenAI).
    Useful for testing LLM connectivity from the frontend.
    """
    try:
        from llm.llm_router import complete

        text = complete(request.message, task="plan")
        return {"success": bool(text), "text": text}
    except Exception as exc:
        logger.error("LLM complete error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Monitoring
# ---------------------------------------------------------------------------


@app.get("/agent/metrics")
async def metrics() -> Dict[str, Any]:
    """
    System monitoring metrics.

    Returns:
      - worker_count
      - queue_size
      - scraping_rate
      - total_agent_runs
      - memory_mb
      - redis / qdrant / postgres status
    """
    try:
        from agents.shadow.shadow_agent import get_metrics

        data = await get_metrics()
        return {"success": True, "metrics": data}
    except Exception as exc:
        logger.warning("Metrics collection error: %s", exc)
        return {"success": False, "metrics": {}, "error": str(exc)}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

_SETTINGS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config",
    "settings.json",
)

_SETTINGS_DEFAULT_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config",
    "settings.default.json",
)

_DEFAULT_SETTINGS: Dict[str, Any] = {
    "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
    "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    "redis_url": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    "qdrant_url": os.getenv("QDRANT_URL", "http://localhost:6333"),
    "database_url": os.getenv("DATABASE_URL", "postgresql://localhost/xps"),
    "github_repo": os.getenv("GITHUB_REPOSITORY", "InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM"),
    "max_workers": int(os.getenv("MAX_WORKERS", "5")),
    "scraping_rate_limit": int(os.getenv("SCRAPING_RATE_LIMIT", "10")),
    "proxy_enabled": os.getenv("PROXY_ENABLED", "false").lower() == "true",
    "proxy_url": os.getenv("PROXY_URL", ""),
    "llm_provider": os.getenv("LLM_PROVIDER", "auto"),
    "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    "groq_model": os.getenv("GROQ_MODEL", "llama3-8b-8192"),
    "media_output_dir": os.getenv("MEDIA_OUTPUT_DIR", "./media/output"),
    "automation_schedule": os.getenv("AUTOMATION_SCHEDULE", "0 */4 * * *"),
    "agent_timeout_seconds": int(os.getenv("AGENT_TIMEOUT_SECONDS", "120")),
    "supervisor_max_agents": int(os.getenv("SUPERVISOR_MAX_AGENTS", "5")),
}


def _load_settings() -> Dict[str, Any]:
    merged = dict(_DEFAULT_SETTINGS)
    # Layer 1: settings.default.json (repo defaults)
    if os.path.exists(_SETTINGS_DEFAULT_FILE):
        try:
            with open(_SETTINGS_DEFAULT_FILE, "r", encoding="utf-8") as fh:
                defaults = json.load(fh)
            merged.update(defaults)
        except Exception:
            pass
    # Layer 2: settings.json (user overrides, gitignored)
    if os.path.exists(_SETTINGS_FILE):
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as fh:
                stored = json.load(fh)
            merged.update(stored)
        except Exception:
            pass
    # Layer 3: environment variables override all file-based settings
    env_overrides = {
        "ollama_model": os.getenv("OLLAMA_MODEL"),
        "ollama_base_url": os.getenv("OLLAMA_BASE_URL"),
        "redis_url": os.getenv("REDIS_URL"),
        "qdrant_url": os.getenv("QDRANT_URL"),
        "database_url": os.getenv("DATABASE_URL"),
        "llm_provider": os.getenv("LLM_PROVIDER"),
        "openai_model": os.getenv("OPENAI_MODEL"),
        "groq_model": os.getenv("GROQ_MODEL"),
        "groq_api_key_configured": "true" if os.getenv("GROQ_API_KEY") else None,
        "media_output_dir": os.getenv("MEDIA_OUTPUT_DIR"),
        "automation_schedule": os.getenv("AUTOMATION_SCHEDULE"),
        "github_repo": os.getenv("GITHUB_REPOSITORY"),
    }
    for key, val in env_overrides.items():
        if val is not None:
            merged[key] = val
    # Numeric env overrides
    for key, env_var in [
        ("max_workers", "MAX_WORKERS"),
        ("scraping_rate_limit", "SCRAPING_RATE_LIMIT"),
        ("agent_timeout_seconds", "AGENT_TIMEOUT_SECONDS"),
        ("supervisor_max_agents", "SUPERVISOR_MAX_AGENTS"),
    ]:
        val_str = os.getenv(env_var)
        if val_str is not None:
            try:
                merged[key] = int(val_str)
            except ValueError:
                pass
    # Boolean env overrides
    proxy_enabled_str = os.getenv("PROXY_ENABLED")
    if proxy_enabled_str is not None:
        merged["proxy_enabled"] = proxy_enabled_str.lower() == "true"
    proxy_url = os.getenv("PROXY_URL")
    if proxy_url is not None:
        merged["proxy_url"] = proxy_url
    return merged


def _save_settings(settings: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(_SETTINGS_FILE), exist_ok=True)
    merged = _load_settings()
    merged.update(settings)
    # Never persist secrets to disk
    for sensitive_key in ("github_token", "google_api_key", "openai_api_key", "groq_api_key"):
        merged.pop(sensitive_key, None)
    with open(_SETTINGS_FILE, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, indent=2)


@app.get("/agent/settings")
async def get_settings() -> Dict[str, Any]:
    """Return current system configuration (excludes secrets)."""
    return {"success": True, "settings": _load_settings()}


@app.post("/agent/settings")
async def update_settings(request: SettingsRequest) -> Dict[str, Any]:
    """
    Update system settings.

    Accepts a partial settings dict. Secrets (github_token, etc.) are
    accepted but not persisted to disk – they update environment variables
    for the current process only.
    """
    settings = request.settings

    # Apply sensitive keys to environment (not persisted)
    for env_key, env_var in [
        ("github_token", "GITHUB_TOKEN"),
        ("google_api_key", "GOOGLE_API_KEY"),
        ("openai_api_key", "OPENAI_API_KEY"),
        ("groq_api_key", "GROQ_API_KEY"),
    ]:
        if env_key in settings:
            os.environ[env_var] = settings[env_key]
            # Reset LLM router probe cache so new key takes effect immediately
            try:
                from llm.llm_router import reset_errors
                reset_errors()
            except Exception:
                pass

    try:
        _save_settings(settings)
        return {"success": True, "message": "Settings updated"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Runtime Controller endpoints
# ---------------------------------------------------------------------------


@app.post("/agent/runtime/command")
async def runtime_command(request: RunRequest) -> Dict[str, Any]:
    """
    Route a frontend LLM command through the RuntimeController.

    This is the primary entry point for the frontend command interface.
    Commands are routed via the command router, dispatched through the
    task dispatcher, and executed in the worker pool with circuit-breaker
    protection and observability.
    """
    rc = _get_runtime_controller()
    if rc is None:
        raise HTTPException(status_code=503, detail="RuntimeController unavailable")
    result = await rc.handle_command(request.command, run_id=request.run_id)
    return result


@app.get("/agent/runtime/health")
async def runtime_health() -> Dict[str, Any]:
    """Return the runtime controller health snapshot."""
    rc = _get_runtime_controller()
    if rc is None:
        return {"status": "unavailable", "error": "RuntimeController not initialised"}
    return rc.get_health()


@app.get("/agent/runtime/metrics")
async def runtime_metrics() -> Dict[str, Any]:
    """Return runtime observability metrics (commands, latency, errors)."""
    try:
        from runtime.observability import get_metrics
        return {"success": True, "metrics": get_metrics()}
    except Exception as exc:
        return {"success": False, "error": str(exc), "metrics": {}}


@app.get("/agent/runtime/trace")
async def runtime_trace(limit: int = 50) -> Dict[str, Any]:
    """Return the last *limit* runtime trace events."""
    try:
        from runtime.observability import get_trace
        return {"success": True, "events": get_trace(limit=limit)}
    except Exception as exc:
        return {"success": False, "error": str(exc), "events": []}


class AgentLifecycleRequest(BaseModel):
    name: str


@app.post("/agent/runtime/start")
async def runtime_start_agent(request: AgentLifecycleRequest) -> Dict[str, Any]:
    """Start a named agent instance via the RuntimeController."""
    rc = _get_runtime_controller()
    if rc is None:
        raise HTTPException(status_code=503, detail="RuntimeController unavailable")
    return await rc.start_agent(request.name)


@app.post("/agent/runtime/stop")
async def runtime_stop_agent(request: AgentLifecycleRequest) -> Dict[str, Any]:
    """Stop a named agent instance via the RuntimeController."""
    rc = _get_runtime_controller()
    if rc is None:
        raise HTTPException(status_code=503, detail="RuntimeController unavailable")
    return await rc.stop_agent(request.name)


@app.get("/health")
async def system_health() -> Dict[str, Any]:
    """
    Top-level system health endpoint.

    Returns a condensed health snapshot combining the agent API status
    and the runtime controller health.
    """
    try:
        from runtime.observability import health_snapshot
        obs_health = health_snapshot()
    except Exception:
        obs_health = {}

    rc = _get_runtime_controller()
    runtime_health_data = rc.get_health() if rc else {"status": "unavailable"}

    return {
        "status": runtime_health_data.get("status", "ok"),
        "service": "xps-intelligence-platform",
        "observability": obs_health,
        "runtime": runtime_health_data,
    }
