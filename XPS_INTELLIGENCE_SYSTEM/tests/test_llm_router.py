"""
tests/test_llm_router.py – Unit tests for the smart LLM router and GROQ client.

Run with:
    python -m pytest tests/test_llm_router.py -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# GroqClient tests
# ---------------------------------------------------------------------------


class TestGroqClient(unittest.TestCase):
    """Tests for llm.groq_client."""

    def test_is_available_returns_false_without_key(self):
        """No API key → not available."""
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=False):
            from llm.groq_client import is_available

            # Force re-evaluation (env is read at call time)
            with patch("llm.groq_client.GROQ_API_KEY", ""):
                self.assertFalse(is_available())

    def test_complete_returns_empty_without_key(self):
        """Complete without API key returns empty string, doesn't raise."""
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=False):
            import importlib
            import llm.groq_client as groq_mod

            # Patch the module-level key lookup
            with patch.object(groq_mod, "_api_key", return_value=""):
                result = groq_mod.complete("hello")
        self.assertEqual(result, "")

    def test_complete_with_mock_response(self):
        """Complete with a mocked successful HTTP response."""
        import json
        import llm.groq_client as groq_mod

        mock_resp_body = json.dumps({
            "choices": [{"message": {"content": "Hello from Groq!"}}]
        }).encode()

        mock_resp = MagicMock()
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.read.return_value = mock_resp_body

        with patch.object(groq_mod, "_api_key", return_value="test-key"):
            with patch("urllib.request.urlopen", return_value=mock_resp):
                result = groq_mod.complete("test prompt")

        self.assertEqual(result, "Hello from Groq!")

    def test_complete_handles_http_error(self):
        """HTTP error results in empty string, not exception."""
        import urllib.error
        import llm.groq_client as groq_mod

        with patch.object(groq_mod, "_api_key", return_value="test-key"):
            with patch("urllib.request.urlopen", side_effect=urllib.error.HTTPError(
                url="", code=429, msg="rate limit", hdrs=None, fp=MagicMock(read=lambda: b'{"error":"rate limit"}')
            )):
                result = groq_mod.complete("test")

        self.assertEqual(result, "")

    def test_list_models_returns_list(self):
        """list_models returns a list (empty if no key)."""
        import llm.groq_client as groq_mod

        with patch.object(groq_mod, "_api_key", return_value=""):
            models = groq_mod.list_models()

        self.assertIsInstance(models, list)

    def test_stream_complete_yields_nothing_without_key(self):
        """stream_complete yields nothing if no API key."""
        import llm.groq_client as groq_mod

        with patch.object(groq_mod, "_api_key", return_value=""):
            chunks = list(groq_mod.stream_complete("test"))

        self.assertEqual(chunks, [])

    def test_get_last_latency_returns_none_initially(self):
        """get_last_latency returns None before any call."""
        import llm.groq_client as groq_mod

        groq_mod._model_latency.clear()
        self.assertIsNone(groq_mod.get_last_latency())


# ---------------------------------------------------------------------------
# LLM Router tests
# ---------------------------------------------------------------------------


class TestLLMRouter(unittest.TestCase):
    """Tests for llm.llm_router."""

    # A cache-expiry timestamp far in the future so probes appear "fresh"
    _FAR_FUTURE = float("inf")

    def setUp(self):
        """Reset router state before each test."""
        from llm.llm_router import reset_errors, _probe_cache, _error_counts, _latency_cache

        _probe_cache.clear()
        _error_counts.clear()
        _latency_cache.clear()

    def test_router_status_returns_dict(self):
        """router_status returns a dict with required keys."""
        from llm.llm_router import router_status

        status = router_status()
        self.assertIn("active_provider", status)
        self.assertIn("providers", status)
        self.assertIn("preferred_provider", status)

    def test_router_status_providers_have_expected_keys(self):
        """Each provider entry has available, last_latency_s, error_count."""
        from llm.llm_router import router_status

        status = router_status()
        for provider_data in status["providers"].values():
            self.assertIn("available", provider_data)
            self.assertIn("last_latency_s", provider_data)
            self.assertIn("error_count", provider_data)

    def test_complete_returns_string(self):
        """complete() always returns a string, never raises."""
        from llm.llm_router import complete

        result = complete("hello")
        self.assertIsInstance(result, str)

    def test_complete_falls_back_gracefully_no_providers(self):
        """With no providers available, complete returns empty string."""
        from llm.llm_router import complete, _probe_cache

        _probe_cache["groq"] = (False, self._FAR_FUTURE)
        _probe_cache["ollama"] = (False, self._FAR_FUTURE)
        _probe_cache["openai"] = (False, self._FAR_FUTURE)

        with patch.dict(os.environ, {"GROQ_API_KEY": "", "OPENAI_API_KEY": ""}, clear=False):
            result = complete("test")

        self.assertIsInstance(result, str)

    def test_select_provider_with_groq_available(self):
        """When Groq is available and LLM_PROVIDER=auto, groq is selected."""
        from llm.llm_router import _select_provider, _probe_cache

        _probe_cache["groq"] = (True, self._FAR_FUTURE)

        with patch.dict(os.environ, {"LLM_PROVIDER": "auto"}, clear=False):
            provider = _select_provider()

        self.assertEqual(provider, "groq")

    def test_select_provider_prefers_explicit_setting(self):
        """LLM_PROVIDER=ollama overrides auto-select."""
        from llm.llm_router import _select_provider, _probe_cache

        _probe_cache["groq"] = (True, self._FAR_FUTURE)
        _probe_cache["ollama"] = (True, self._FAR_FUTURE)

        with patch.dict(os.environ, {"LLM_PROVIDER": "ollama"}, clear=False):
            provider = _select_provider()

        self.assertEqual(provider, "ollama")

    def test_select_provider_falls_back_when_preferred_unavailable(self):
        """Falls back to next provider when preferred is down."""
        from llm.llm_router import _select_provider, _probe_cache

        # groq down, ollama up
        _probe_cache["groq"] = (False, self._FAR_FUTURE)
        _probe_cache["ollama"] = (True, self._FAR_FUTURE)
        _probe_cache["openai"] = (False, self._FAR_FUTURE)

        with patch.dict(os.environ, {"LLM_PROVIDER": "auto"}, clear=False):
            provider = _select_provider()

        self.assertEqual(provider, "ollama")

    def test_error_backoff_increments(self):
        """Error counter increments on failure."""
        from llm.llm_router import _error_counts, _probe_cache

        _probe_cache["groq"] = (True, self._FAR_FUTURE)

        with patch("llm.llm_router._call_provider", side_effect=RuntimeError("fail")):
            with patch("llm.llm_router._call_provider_stream"):
                from llm.llm_router import complete

                complete("test", provider="groq")

        self.assertGreater(_error_counts.get("groq", 0), 0)

    def test_reset_errors_clears_state(self):
        """reset_errors clears error counts and probe cache."""
        from llm.llm_router import reset_errors, _error_counts, _probe_cache

        _error_counts["groq"] = 5
        _probe_cache["groq"] = (False, 0.0)

        reset_errors("groq")

        self.assertNotIn("groq", _error_counts)
        self.assertNotIn("groq", _probe_cache)

    def test_reset_errors_all(self):
        """reset_errors() without args clears all state."""
        from llm.llm_router import reset_errors, _error_counts, _probe_cache

        _error_counts["groq"] = 3
        _error_counts["ollama"] = 2
        _probe_cache["groq"] = (False, 0.0)

        reset_errors()

        self.assertEqual(len(_error_counts), 0)
        self.assertEqual(len(_probe_cache), 0)

    def test_stream_complete_returns_generator(self):
        """stream_complete returns a generator."""
        import inspect
        from llm.llm_router import stream_complete

        result = stream_complete("test")
        self.assertTrue(inspect.isgenerator(result))

    def test_complete_uses_specified_provider(self):
        """provider= arg bypasses auto-select."""
        from llm.llm_router import complete, _probe_cache

        _probe_cache["groq"] = (True, self._FAR_FUTURE)

        mock_text = "mocked response"
        with patch("llm.llm_router._call_provider", return_value=mock_text) as mock_call:
            result = complete("hello", provider="groq")

        self.assertEqual(result, mock_text)
        mock_call.assert_called_once()
        self.assertEqual(mock_call.call_args[0][0], "groq")


# ---------------------------------------------------------------------------
# LLM __init__ re-exports
# ---------------------------------------------------------------------------


class TestLLMInit(unittest.TestCase):
    """Verify llm/__init__.py re-exports are accessible."""

    def test_complete_importable(self):
        from llm import complete

        self.assertTrue(callable(complete))

    def test_stream_complete_importable(self):
        from llm import stream_complete

        self.assertTrue(callable(stream_complete))

    def test_router_status_importable(self):
        from llm import router_status

        self.assertTrue(callable(router_status))


# ---------------------------------------------------------------------------
# Gateway health endpoint (Node.js – quick smoke test via child process)
# ---------------------------------------------------------------------------


class TestGatewayDefaultPort(unittest.TestCase):
    """Verify gateway.js defaults to port 3000."""

    def test_default_port_is_3000(self):
        """The first PORT assignment in gateway.js should default to 3000."""
        gateway_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "api", "gateway.js",
        )
        with open(gateway_path, "r") as f:
            content = f.read()
        # Should contain 'process.env.PORT || 3000'
        self.assertIn("process.env.PORT || 3000", content)

    def test_health_endpoint_defined(self):
        """gateway.js must define a GET /api route."""
        gateway_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "api", "gateway.js",
        )
        with open(gateway_path, "r") as f:
            content = f.read()
        self.assertIn('"/api"', content)


if __name__ == "__main__":
    unittest.main()
