"""
llm/llm_router.py
=================
Smart LLM router for the XPS Intelligence Platform.

Priority order (configurable via LLM_PROVIDER env var):
  1. Groq  – fast cloud API, requires GROQ_API_KEY
  2. Ollama – local inference, requires running Ollama daemon
  3. OpenAI – fallback cloud API, requires OPENAI_API_KEY

The router probes each provider's availability and automatically
routes to the best available provider.  Latency and error counts
are tracked so the router can prefer faster providers.

Configuration:
  LLM_PROVIDER   – preferred provider: "auto" | "groq" | "ollama" | "openai"
                   "auto" tries all in priority order (default)
  GROQ_API_KEY   – enables Groq
  OLLAMA_BASE_URL – Ollama URL (default: http://localhost:11434)
  OPENAI_API_KEY  – enables OpenAI fallback

Usage::

    from llm.llm_router import complete, stream_complete, router_status

    text = complete("List 3 flooring contractor niches", task="plan")
    status = router_status()  # → {"active_provider": "groq", ...}
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Generator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider priority
# ---------------------------------------------------------------------------

_PROVIDER_PRIORITY = ["groq", "ollama", "openai"]

# Cache probe results for N seconds to avoid hammering health endpoints
_PROBE_CACHE_TTL = 30  # seconds
_probe_cache: dict[str, tuple[bool, float]] = {}  # provider → (available, ts)

# Error count per provider (resets after a successful call)
_error_counts: dict[str, int] = {}

# Number of consecutive errors before a provider is deprioritised and re-probed
_ERROR_BACKOFF_THRESHOLD = 3

# Last successful latency per provider
_latency_cache: dict[str, float] = {}


def _effective_provider() -> str:
    """Return the LLM_PROVIDER env setting, defaulting to 'auto'."""
    return os.getenv("LLM_PROVIDER", "auto").lower()


# ---------------------------------------------------------------------------
# Provider availability probes
# ---------------------------------------------------------------------------


def _probe_groq(force: bool = False) -> bool:
    """Return True if the Groq API is reachable and a key is configured."""
    now = time.monotonic()
    if not force and "groq" in _probe_cache:
        available, ts = _probe_cache["groq"]
        if now - ts < _PROBE_CACHE_TTL:
            return available
    try:
        from llm.groq_client import is_available

        result = is_available()
    except Exception:
        result = False
    _probe_cache["groq"] = (result, now)
    return result


def _probe_ollama(force: bool = False) -> bool:
    """Return True if the Ollama daemon is reachable."""
    now = time.monotonic()
    if not force and "ollama" in _probe_cache:
        available, ts = _probe_cache["ollama"]
        if now - ts < _PROBE_CACHE_TTL:
            return available
    try:
        from llm.ollama_client import health_check

        result = health_check()
    except Exception:
        result = False
    _probe_cache["ollama"] = (result, now)
    return result


def _probe_openai(force: bool = False) -> bool:
    """Return True if an OpenAI API key is configured."""
    now = time.monotonic()
    if not force and "openai" in _probe_cache:
        available, ts = _probe_cache["openai"]
        if now - ts < _PROBE_CACHE_TTL:
            return available
    result = bool(os.getenv("OPENAI_API_KEY", ""))
    _probe_cache["openai"] = (result, now)
    return result


_PROBES = {
    "groq": _probe_groq,
    "ollama": _probe_ollama,
    "openai": _probe_openai,
}


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------


def _select_provider() -> str | None:
    """
    Select the best available LLM provider.

    If LLM_PROVIDER is set to a specific provider, use that if available.
    In "auto" mode, try the priority list in order.
    """
    pref = _effective_provider()
    if pref != "auto":
        if pref in _PROBES and _PROBES[pref]():
            return pref
        logger.warning("Preferred provider '%s' unavailable – trying auto-select", pref)

    # Auto: try priority order, skip providers with too many errors
    for provider in _PROVIDER_PRIORITY:
        if _error_counts.get(provider, 0) >= _ERROR_BACKOFF_THRESHOLD:
            # Back-off: re-probe after 3 errors
            if not _PROBES[provider](force=True):
                logger.debug("Provider '%s' skipped (error backoff)", provider)
                continue
            _error_counts[provider] = 0

        if _PROBES[provider]():
            return provider

    # Last resort: return the first that has any credentials/config
    for provider in _PROVIDER_PRIORITY:
        if _PROBES[provider](force=True):
            _error_counts[provider] = 0
            return provider

    return None


# ---------------------------------------------------------------------------
# Unified completion
# ---------------------------------------------------------------------------


def complete(
    prompt: str,
    model: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    task: str = "plan",
    provider: str | None = None,
) -> str:
    """
    Generate a completion using the best available LLM provider.

    Provider selection order (unless *provider* is set):
      Groq → Ollama → OpenAI

    :param prompt:      User message.
    :param model:       Model name override.
    :param system:      System prompt.
    :param temperature: Sampling temperature (0–1).
    :param max_tokens:  Max tokens to generate.
    :param task:        Task type hint for model selection.
    :param provider:    Force a specific provider.
    :returns:           Generated text or empty string on complete failure.
    """
    selected = provider or _select_provider()
    if not selected:
        logger.error("LLM router: no provider available")
        return ""

    t0 = time.monotonic()

    try:
        result = _call_provider(selected, "complete", prompt, model, system, temperature, max_tokens, task)
        if result:
            _latency_cache[selected] = time.monotonic() - t0
            _error_counts[selected] = 0
            logger.debug("LLM router: provider=%s latency=%.2fs", selected, _latency_cache[selected])
            return result
    except Exception as exc:
        _error_counts[selected] = _error_counts.get(selected, 0) + 1
        logger.warning("LLM router: provider '%s' failed (%s) – trying next", selected, exc)

    # Failover: try remaining providers
    for fallback in _PROVIDER_PRIORITY:
        if fallback == selected:
            continue
        if not _PROBES[fallback](force=False):
            continue
        try:
            result = _call_provider(fallback, "complete", prompt, model, system, temperature, max_tokens, task)
            if result:
                _latency_cache[fallback] = time.monotonic() - t0
                _error_counts[fallback] = 0
                logger.info("LLM router: failover to '%s'", fallback)
                return result
        except Exception as exc2:
            _error_counts[fallback] = _error_counts.get(fallback, 0) + 1
            logger.warning("LLM router: fallback '%s' also failed: %s", fallback, exc2)

    return ""


def stream_complete(
    prompt: str,
    model: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    task: str = "plan",
    provider: str | None = None,
) -> Generator[str, None, None]:
    """
    Stream a completion via the best available LLM provider.

    Falls back to non-streaming if streaming is unavailable.
    """
    selected = provider or _select_provider()
    if not selected:
        logger.error("LLM router stream: no provider available")
        return

    try:
        yield from _call_provider_stream(selected, prompt, model, system, temperature, task)
        _error_counts[selected] = 0
        return
    except Exception as exc:
        _error_counts[selected] = _error_counts.get(selected, 0) + 1
        logger.warning("LLM router stream: provider '%s' failed (%s) – falling back", selected, exc)

    # Failover
    for fallback in _PROVIDER_PRIORITY:
        if fallback == selected:
            continue
        if not _PROBES[fallback](force=False):
            continue
        try:
            yield from _call_provider_stream(fallback, prompt, model, system, temperature, task)
            _error_counts[fallback] = 0
            return
        except Exception as exc2:
            logger.warning("LLM router stream fallback '%s' failed: %s", fallback, exc2)


# ---------------------------------------------------------------------------
# Provider dispatch
# ---------------------------------------------------------------------------


def _call_provider(
    provider: str,
    method: str,
    prompt: str,
    model: str | None,
    system: str | None,
    temperature: float,
    max_tokens: int,
    task: str,
) -> str:
    if provider == "groq":
        from llm.groq_client import complete as groq_complete

        return groq_complete(
            prompt, model=model, system=system,
            temperature=temperature, max_tokens=max_tokens, task=task,
        )

    if provider == "ollama":
        from llm.ollama_client import complete as ollama_complete

        return ollama_complete(
            prompt, model=model, system=system,
            temperature=temperature, max_tokens=max_tokens, task=task,
        )

    if provider == "openai":
        return _openai_complete(prompt, model, system, temperature, max_tokens)

    return ""


def _call_provider_stream(
    provider: str,
    prompt: str,
    model: str | None,
    system: str | None,
    temperature: float,
    task: str,
) -> Generator[str, None, None]:
    if provider == "groq":
        from llm.groq_client import stream_complete as groq_stream

        yield from groq_stream(prompt, model=model, system=system, temperature=temperature, task=task)
        return

    if provider == "ollama":
        from llm.ollama_client import stream_complete as ollama_stream

        yield from ollama_stream(prompt, model=model, system=system, temperature=temperature, task=task)
        return

    if provider == "openai":
        # OpenAI streaming: fall back to non-streaming
        text = _openai_complete(prompt, model, system, temperature, 2048)
        if text:
            yield text
        return


def _openai_complete(
    prompt: str,
    model: str | None,
    system: str | None,
    temperature: float,
    max_tokens: int,
) -> str:
    """Call the OpenAI-compatible chat completions API."""
    import json
    import urllib.request

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return ""

    resolved_model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": resolved_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())
        return body["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.warning("OpenAI call failed: %s", exc)
        return ""


# ---------------------------------------------------------------------------
# Status / diagnostics
# ---------------------------------------------------------------------------


def router_status() -> dict[str, Any]:
    """
    Return current router state: which providers are available and
    their last latency.
    """
    selected = _select_provider()
    return {
        "active_provider": selected,
        "preferred_provider": _effective_provider(),
        "providers": {
            p: {
                "available": bool(_probe_cache.get(p, (False, 0))[0]),
                "last_latency_s": _latency_cache.get(p),
                "error_count": _error_counts.get(p, 0),
            }
            for p in _PROVIDER_PRIORITY
        },
    }


def reset_errors(provider: str | None = None) -> None:
    """Reset error counters (all providers or a specific one)."""
    if provider:
        _error_counts.pop(provider, None)
        _probe_cache.pop(provider, None)
    else:
        _error_counts.clear()
        _probe_cache.clear()
