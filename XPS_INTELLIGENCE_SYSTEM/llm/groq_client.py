"""
llm/groq_client.py
==================
GROQ cloud LLM client for the XPS Intelligence Platform.

Uses the Groq REST API via pure stdlib HTTP (no extra SDK required).

Supported models:
  llama3-8b-8192          – fast, 8 k context
  llama3-70b-8192         – highest quality, 8 k context
  llama-3.1-8b-instant    – ultra-fast
  mixtral-8x7b-32768      – 32 k context, good for code
  gemma2-9b-it            – Google Gemma 2

Environment variables:
  GROQ_API_KEY   – required for all calls
  GROQ_MODEL     – default model (default: llama3-8b-8192)
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Generator

logger = logging.getLogger(__name__)

GROQ_API_BASE = "https://api.groq.com/openai/v1"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama3-8b-8192")

# Available Groq models ordered by speed (fastest first)
GROQ_MODELS = [
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "gemma2-9b-it",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
]

# Latency tracking per model (seconds)
_model_latency: dict[str, float] = {}


def _api_key() -> str:
    """Return the current GROQ API key (checks env at call time)."""
    return os.getenv("GROQ_API_KEY", GROQ_API_KEY)


def is_available() -> bool:
    """Return True if a GROQ API key is configured and the API is reachable."""
    key = _api_key()
    if not key:
        return False
    try:
        req = urllib.request.Request(
            f"{GROQ_API_BASE}/models",
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception as exc:
        logger.debug("Groq availability check failed: %s", exc)
        return False


def list_models() -> list[str]:
    """Return models available on the Groq API."""
    key = _api_key()
    if not key:
        return []
    try:
        req = urllib.request.Request(
            f"{GROQ_API_BASE}/models",
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read())
            return [m["id"] for m in body.get("data", [])]
    except Exception as exc:
        logger.debug("Groq list_models failed: %s", exc)
        return []


def complete(
    prompt: str,
    model: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    task: str = "plan",
) -> str:
    """
    Generate a completion via the Groq API.

    :param prompt:      User message.
    :param model:       Model override (default: GROQ_MODEL env or llama3-8b-8192).
    :param system:      Optional system prompt.
    :param temperature: Sampling temperature.
    :param max_tokens:  Max tokens to generate.
    :param task:        Task hint (not used by Groq, kept for interface compatibility).
    :returns:           Generated text, or empty string on failure.
    """
    key = _api_key()
    if not key:
        logger.debug("Groq: no API key configured")
        return ""

    resolved_model = model or DEFAULT_MODEL
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": resolved_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    t0 = time.monotonic()
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{GROQ_API_BASE}/chat/completions",
            data=data,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())

        latency = time.monotonic() - t0
        _model_latency[resolved_model] = latency
        logger.debug("Groq complete: model=%s latency=%.2fs", resolved_model, latency)

        choices = body.get("choices", [])
        if not choices:
            return ""
        return choices[0].get("message", {}).get("content", "")

    except urllib.error.HTTPError as exc:
        try:
            err_body = json.loads(exc.read())
            logger.warning("Groq HTTP %d: %s", exc.code, err_body)
        except Exception:
            logger.warning("Groq HTTP error %d", exc.code)
        return ""
    except Exception as exc:
        logger.warning("Groq complete failed: %s", exc)
        return ""


def stream_complete(
    prompt: str,
    model: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    task: str = "plan",
) -> Generator[str, None, None]:
    """
    Stream a completion from the Groq API using SSE.

    Yields text chunks as they arrive.
    """
    key = _api_key()
    if not key:
        logger.debug("Groq stream: no API key configured")
        return

    resolved_model = model or DEFAULT_MODEL
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": resolved_model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
    }

    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{GROQ_API_BASE}/chat/completions",
            data=data,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            for raw_line in resp:
                line = raw_line.decode("utf-8").strip()
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    try:
                        chunk = json.loads(line[6:])
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        text = delta.get("content", "")
                        if text:
                            yield text
                    except json.JSONDecodeError:
                        pass
    except Exception as exc:
        logger.warning("Groq stream failed: %s", exc)


def get_last_latency(model: str | None = None) -> float | None:
    """Return the last recorded latency for *model* (or default model)."""
    return _model_latency.get(model or DEFAULT_MODEL)
