"""
llm/ollama_client.py
====================
Ollama LLM client for the XPS Intelligence Platform.

Supports:
  - All Ollama models via REST API
  - Automatic model selection based on task type
  - Fallback model capability
  - Streaming and non-streaming modes

Environment variables:
  OLLAMA_BASE_URL   – base URL for Ollama API (default: http://localhost:11434)
  OLLAMA_MODEL      – override default model
  OLLAMA_FALLBACK   – fallback model name
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Generator

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK", "llama3.1")

# Model selection heuristics by task type
_TASK_MODEL_MAP: dict[str, str] = {
    "plan": DEFAULT_MODEL,
    "code": os.getenv("OLLAMA_CODE_MODEL", "codellama"),
    "scrape": DEFAULT_MODEL,
    "analyze": DEFAULT_MODEL,
    "summarize": DEFAULT_MODEL,
    "github": DEFAULT_MODEL,
}


# ---------------------------------------------------------------------------
# Low-level HTTP helpers
# ---------------------------------------------------------------------------


def _post(path: str, payload: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
    """POST to the Ollama REST API and return the JSON response."""
    url = f"{OLLAMA_BASE_URL}{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return json.loads(body) if body else {}
    except urllib.error.URLError as exc:
        logger.warning("Ollama API unavailable (%s) – returning empty response", exc)
        return {"error": str(exc)}
    except Exception as exc:
        logger.error("Ollama request failed: %s", exc)
        return {"error": str(exc)}


def _get(path: str, timeout: int = 10) -> dict[str, Any]:
    """GET from the Ollama REST API."""
    url = f"{OLLAMA_BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return json.loads(body) if body else {}
    except Exception as exc:
        logger.debug("Ollama GET %s failed: %s", path, exc)
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Model management
# ---------------------------------------------------------------------------


def list_models() -> list[str]:
    """Return a list of model names available on the local Ollama instance."""
    result = _get("/api/tags")
    models = result.get("models", [])
    return [m.get("name", "") for m in models if m.get("name")]


def is_model_available(model: str) -> bool:
    """Check whether *model* is pulled and available locally."""
    return model in list_models()


def select_model(task: str = "plan") -> str:
    """
    Select the best model for the given task.

    Falls back to FALLBACK_MODEL if the preferred model is unavailable.
    Falls back to the first available model if fallback is also missing.
    """
    preferred = _TASK_MODEL_MAP.get(task, DEFAULT_MODEL)
    available = list_models()

    if not available:
        logger.warning("No Ollama models available – returning preferred name anyway")
        return preferred

    if preferred in available:
        return preferred
    if FALLBACK_MODEL in available:
        logger.info(
            "Model '%s' not available – using fallback '%s'",
            preferred,
            FALLBACK_MODEL,
        )
        return FALLBACK_MODEL

    # Use whatever is first available
    logger.info(
        "Neither '%s' nor '%s' available – using '%s'",
        preferred,
        FALLBACK_MODEL,
        available[0],
    )
    return available[0]


# ---------------------------------------------------------------------------
# Completion
# ---------------------------------------------------------------------------


def complete(
    prompt: str,
    model: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    task: str = "plan",
) -> str:
    """
    Generate a completion for *prompt* using Ollama.

    :param prompt:      User message.
    :param model:       Force a specific model (otherwise auto-selected).
    :param system:      Optional system prompt.
    :param temperature: Sampling temperature.
    :param max_tokens:  Maximum tokens to generate.
    :param task:        Task type for automatic model selection.
    :returns:           The generated text.
    """
    resolved_model = model or select_model(task)
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload: dict[str, Any] = {
        "model": resolved_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    logger.debug("Ollama complete: model=%s prompt_len=%d", resolved_model, len(prompt))
    result = _post("/api/chat", payload)

    if "error" in result:
        logger.warning("Ollama error: %s", result["error"])
        return ""

    return result.get("message", {}).get("content", "")


def stream_complete(
    prompt: str,
    model: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    task: str = "plan",
) -> Generator[str, None, None]:
    """
    Stream a completion for *prompt* using Ollama.

    Yields chunks of text as they are generated.
    """
    resolved_model = model or select_model(task)
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload: dict[str, Any] = {
        "model": resolved_model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": temperature},
    }

    url = f"{OLLAMA_BASE_URL}/api/chat"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            for raw_line in resp:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                    text = chunk.get("message", {}).get("content", "")
                    if text:
                        yield text
                    if chunk.get("done"):
                        break
                except json.JSONDecodeError:
                    pass
    except Exception as exc:
        logger.error("Ollama stream error: %s", exc)
        yield ""


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------


def health_check() -> bool:
    """Return True if the Ollama service is reachable."""
    result = _get("/api/tags")
    return "error" not in result
