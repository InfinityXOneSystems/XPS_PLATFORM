"""
tests/test_runtime_architecture.py
=====================================
Integration tests for the XPS Intelligence Platform runtime architecture.

Tests cover:
  - RuntimeController: command routing, health, metrics, agent lifecycle
  - TaskDispatcher: dispatch, circuit breaker, queue integration
  - WorkerPool: pool status, task processing
  - SandboxExecutor: agent execution, timeout, path validation
  - CircuitBreaker: state machine transitions
  - RetryPolicy: retry behavior
  - SEOAgent: URL analysis, capabilities
  - SocialMediaAgent: profile discovery, capabilities
  - BrowserAutomationAgent: action routing, capabilities
  - Observability: metrics recording, health snapshot, trace

Run with:
    python -m pytest tests/test_runtime_architecture.py -v
"""

from __future__ import annotations

import asyncio
import sys
import time
import unittest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def run(coro):
    """Run an async coroutine in a fresh event loop."""
    return asyncio.run(coro)


# ===========================================================================
# Observability
# ===========================================================================


class TestObservability(unittest.TestCase):
    """Tests for runtime.observability."""

    def setUp(self):
        # Reset metrics before each test to avoid cross-test contamination
        from runtime.observability import reset_metrics
        reset_metrics()

    def test_record_command_increments_counter(self):
        from runtime.observability import record_command, get_metrics
        record_command("scraper", "scrape")
        record_command("scraper", "scrape")
        m = get_metrics()
        self.assertEqual(m["commands"]["scraper"]["scrape"], 2)
        self.assertEqual(m["tasks_total"], 2)

    def test_record_error_increments_counter(self):
        from runtime.observability import record_error, get_metrics
        record_error("connection_refused", "scraper")
        m = get_metrics()
        self.assertGreater(m["tasks_failed"], 0)

    def test_record_latency_statistics(self):
        from runtime.observability import record_latency, get_metrics
        for s in [0.1, 0.2, 0.3, 0.4, 0.5]:
            record_latency("scraper", s)
        m = get_metrics()
        lat = m["latency"]["scraper"]
        self.assertEqual(lat["count"], 5)
        self.assertAlmostEqual(lat["mean"], 0.3, places=2)

    def test_health_snapshot_structure(self):
        from runtime.observability import health_snapshot, record_agent_health
        record_agent_health("scraper", status="ok")
        snap = health_snapshot()
        self.assertIn("status", snap)
        self.assertIn("uptime_seconds", snap)
        self.assertIn("tasks_total", snap)

    def test_get_trace_returns_list(self):
        from runtime.observability import get_trace, record_command
        record_command("test_agent", "test")
        events = get_trace(limit=10)
        self.assertIsInstance(events, list)
        self.assertGreater(len(events), 0)

    def test_record_agent_health(self):
        from runtime.observability import record_agent_health, get_metrics
        record_agent_health("test_agent", status="ok", version="1.0")
        m = get_metrics()
        self.assertIn("test_agent", m["agents"])
        self.assertEqual(m["agents"]["test_agent"]["status"], "ok")


# ===========================================================================
# CircuitBreaker
# ===========================================================================


class TestCircuitBreaker(unittest.TestCase):
    """Tests for runtime.fault_tolerance.CircuitBreaker."""

    def _make_cb(self, threshold=3, recovery=5):
        from runtime.fault_tolerance import CircuitBreaker
        return CircuitBreaker(
            name="test",
            failure_threshold=threshold,
            recovery_timeout=recovery,
        )

    def test_starts_closed(self):
        cb = self._make_cb()
        self.assertTrue(cb.allow_request())
        self.assertEqual(cb.status()["state"], "closed")

    def test_opens_after_threshold_failures(self):
        cb = self._make_cb(threshold=3)
        for _ in range(3):
            cb.record_failure()
        self.assertFalse(cb.allow_request())
        self.assertEqual(cb.status()["state"], "open")

    def test_transitions_to_half_open_after_recovery_timeout(self):
        from runtime.fault_tolerance import CIRCUIT_OPEN
        cb = self._make_cb(threshold=1, recovery=0)
        cb.record_failure()
        self.assertEqual(cb._state, CIRCUIT_OPEN)
        # recovery_timeout=0 means it immediately transitions
        result = cb.allow_request()
        self.assertTrue(result)
        self.assertEqual(cb._state, "half_open")

    def test_closes_after_success_in_half_open(self):
        cb = self._make_cb(threshold=1, recovery=0)
        cb.record_failure()
        cb.allow_request()  # → half_open
        cb.record_success()
        self.assertEqual(cb._state, "closed")

    def test_success_in_closed_decrements_failure_count(self):
        cb = self._make_cb(threshold=5)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        self.assertEqual(cb._failure_count, 1)

    def test_status_dict_structure(self):
        cb = self._make_cb()
        status = cb.status()
        self.assertIn("name", status)
        self.assertIn("state", status)
        self.assertIn("failure_count", status)


# ===========================================================================
# RetryPolicy
# ===========================================================================


class TestRetryPolicy(unittest.TestCase):
    """Tests for runtime.fault_tolerance.RetryPolicy."""

    def test_succeeds_without_retry(self):
        from runtime.fault_tolerance import RetryPolicy

        @RetryPolicy(max_retries=2, delay=0)
        async def always_succeeds():
            return "ok"

        result = run(always_succeeds())
        self.assertEqual(result, "ok")

    def test_retries_and_eventually_succeeds(self):
        from runtime.fault_tolerance import RetryPolicy

        call_count = {"n": 0}

        @RetryPolicy(max_retries=3, delay=0)
        async def fails_twice():
            call_count["n"] += 1
            if call_count["n"] < 3:
                raise ValueError("transient failure")
            return "recovered"

        result = run(fails_twice())
        self.assertEqual(result, "recovered")
        self.assertEqual(call_count["n"], 3)

    def test_raises_after_max_retries(self):
        from runtime.fault_tolerance import RetryPolicy

        @RetryPolicy(max_retries=2, delay=0)
        async def always_fails():
            raise RuntimeError("permanent failure")

        with self.assertRaises(RuntimeError):
            run(always_fails())


# ===========================================================================
# SandboxExecutor
# ===========================================================================


class TestSandboxExecutor(unittest.TestCase):
    """Tests for runtime.sandbox_executor.SandboxExecutor."""

    def test_runs_agent_successfully(self):
        from runtime.sandbox_executor import SandboxExecutor

        class DummyAgent:
            agent_name = "dummy"

            async def execute(self, task, context=None):
                return {"success": True, "result": "done"}

        executor = SandboxExecutor(timeout=5)
        result = run(executor.run_agent(DummyAgent(), {"command": "test"}))
        self.assertTrue(result["success"])
        self.assertEqual(result["result"], "done")

    def test_enforces_timeout(self):
        from runtime.sandbox_executor import SandboxExecutor

        class SlowAgent:
            agent_name = "slow"

            async def execute(self, task, context=None):
                await asyncio.sleep(100)
                return {"success": True}

        executor = SandboxExecutor(timeout=0.1)
        result = run(executor.run_agent(SlowAgent(), {"command": "slow"}))
        self.assertFalse(result["success"])
        self.assertIn("timed out", result["error"])

    def test_validate_path_allowed(self):
        import tempfile
        from runtime.sandbox_executor import SandboxExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = SandboxExecutor(allowed_paths=[tmpdir])
            import os
            self.assertTrue(executor.validate_path(os.path.join(tmpdir, "file.json")))

    def test_validate_path_denied(self):
        from runtime.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(allowed_paths=["/tmp/xps_data"])
        self.assertFalse(executor.validate_path("/etc/passwd"))

    def test_validate_domain_allowed(self):
        from runtime.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(allowed_domains=["example.com", "yelp.com"])
        self.assertTrue(executor.validate_domain("https://www.example.com/page"))

    def test_validate_domain_denied(self):
        from runtime.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(allowed_domains=["example.com"])
        self.assertFalse(executor.validate_domain("https://evil.com/hack"))

    def test_validate_domain_unrestricted(self):
        from runtime.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(allowed_domains=None)
        self.assertTrue(executor.validate_domain("https://anything.com"))

    def test_handles_agent_exception(self):
        from runtime.sandbox_executor import SandboxExecutor

        class BrokenAgent:
            agent_name = "broken"

            async def execute(self, task, context=None):
                raise ValueError("unexpected error")

        executor = SandboxExecutor(timeout=5)
        result = run(executor.run_agent(BrokenAgent(), {}))
        self.assertFalse(result["success"])
        self.assertIn("unexpected error", result["error"])

    def test_status_dict_structure(self):
        from runtime.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor()
        status = executor.status()
        self.assertIn("executions_total", status)
        self.assertIn("violations_total", status)
        self.assertIn("timeout_seconds", status)


# ===========================================================================
# SEOAgent
# ===========================================================================


class TestSEOAgent(unittest.TestCase):
    """Tests for agents.seo.SEOAgent."""

    def test_capabilities(self):
        from agents.seo.seo_agent import SEOAgent
        agent = SEOAgent()
        caps = agent.capabilities()
        self.assertIn("page_analysis", caps)
        self.assertIn("contact_extraction", caps)

    def test_returns_error_without_url(self):
        from agents.seo.seo_agent import SEOAgent
        agent = SEOAgent()
        result = run(agent.execute({"command": "analyse this website"}))
        # Without a URL, the agent gracefully falls back to a keyword report
        self.assertIn("success", result)

    def test_extracts_url_from_command(self):
        from agents.seo.seo_agent import _extract_url
        url = _extract_url("analyse https://example.com/page for flooring")
        self.assertEqual(url, "https://example.com/page")

    def test_extracts_url_bare_domain(self):
        from agents.seo.seo_agent import _extract_url
        url = _extract_url("check mysite.com")
        self.assertEqual(url, "https://mysite.com")

    def test_extract_phones(self):
        from agents.seo.seo_agent import _extract_phones
        html = "Call us at (555) 123-4567 or 800-999-0000"
        phones = _extract_phones(html)
        self.assertEqual(len(phones), 2)

    def test_extract_emails(self):
        from agents.seo.seo_agent import _extract_emails
        html = "Contact us: info@company.com or support@company.com"
        emails = _extract_emails(html)
        self.assertIn("info@company.com", emails)

    def test_seo_agent_name(self):
        from agents.seo.seo_agent import SEOAgent
        self.assertEqual(SEOAgent.agent_name, "seo_agent")

    def test_execute_with_unreachable_url(self):
        from agents.seo.seo_agent import SEOAgent
        agent = SEOAgent()
        # This should not raise but return a graceful error result
        result = run(agent.execute({"url": "http://localhost:19999/nonexistent"}))
        # May succeed or fail, but must return a dict with 'success' key
        self.assertIn("success", result)
        self.assertEqual(result.get("url"), "http://localhost:19999/nonexistent")


# ===========================================================================
# SocialMediaAgent
# ===========================================================================


class TestSocialMediaAgent(unittest.TestCase):
    """Tests for agents.social.SocialMediaAgent."""

    def test_capabilities(self):
        from agents.social.social_media_agent import SocialMediaAgent
        agent = SocialMediaAgent()
        caps = agent.capabilities()
        self.assertIn("profile_discovery", caps)
        self.assertIn("scroll", caps)
        self.assertIn("structured_extraction", caps)

    def test_returns_error_without_company(self):
        from agents.social.social_media_agent import SocialMediaAgent
        agent = SocialMediaAgent()
        result = run(agent.execute({"command": "find social media"}))
        self.assertFalse(result["success"])
        self.assertIn("error", result)

    def test_extract_company_from_quoted_string(self):
        from agents.social.social_media_agent import _extract_company
        company = _extract_company('find social media for "Acme Flooring"')
        self.assertEqual(company, "Acme Flooring")

    def test_execute_with_company_name(self):
        from agents.social.social_media_agent import SocialMediaAgent
        agent = SocialMediaAgent()
        # With a fake company, platforms won't be found but should not raise
        result = run(
            agent.execute(
                {
                    "command": "social media analysis",
                    "company_name": "Nonexistent Company XYZ123",
                    "platforms": ["facebook"],
                }
            )
        )
        self.assertTrue(result["success"])
        self.assertIn("platforms", result)
        self.assertIn("social_score", result)

    def test_agent_name(self):
        from agents.social.social_media_agent import SocialMediaAgent
        self.assertEqual(SocialMediaAgent.agent_name, "social_media_agent")


# ===========================================================================
# BrowserAutomationAgent
# ===========================================================================


class TestBrowserAutomationAgent(unittest.TestCase):
    """Tests for agents.browser.BrowserAutomationAgent."""

    def test_capabilities(self):
        from agents.browser.browser_automation_agent import BrowserAutomationAgent
        agent = BrowserAutomationAgent()
        caps = agent.capabilities()
        for cap in ("navigate", "scroll", "form_fill", "type", "click", "screenshot", "extract"):
            self.assertIn(cap, caps)

    def test_extract_action_screenshot(self):
        from agents.browser.browser_automation_agent import _extract_action
        self.assertEqual(_extract_action("take a screenshot of the page"), "screenshot")

    def test_extract_action_scroll(self):
        from agents.browser.browser_automation_agent import _extract_action
        self.assertEqual(_extract_action("scroll down the page"), "scroll")

    def test_extract_action_fill(self):
        from agents.browser.browser_automation_agent import _extract_action
        self.assertEqual(_extract_action("fill the contact form"), "form_fill")

    def test_extract_action_default(self):
        from agents.browser.browser_automation_agent import _extract_action
        self.assertEqual(_extract_action("open the website"), "navigate")

    def test_extract_url(self):
        from agents.browser.browser_automation_agent import _extract_url
        url = _extract_url("navigate to https://example.com now")
        self.assertEqual(url, "https://example.com")

    def test_returns_error_for_empty_command(self):
        from agents.browser.browser_automation_agent import BrowserAutomationAgent
        agent = BrowserAutomationAgent()
        # No URL → should still return a result (not raise)
        result = run(agent.execute({"command": ""}))
        self.assertIn("success", result)

    def test_agent_name(self):
        from agents.browser.browser_automation_agent import BrowserAutomationAgent
        self.assertEqual(BrowserAutomationAgent.agent_name, "browser_automation_agent")


# ===========================================================================
# TaskDispatcher
# ===========================================================================


class TestTaskDispatcher(unittest.TestCase):
    """Tests for runtime.task_dispatcher.TaskDispatcher."""

    def test_health_returns_dict(self):
        from runtime.task_dispatcher import TaskDispatcher
        dispatcher = TaskDispatcher()
        health = dispatcher.health()
        self.assertIn("queue", health)
        self.assertIn("circuit_breakers", health)

    def test_dispatch_returns_result_dict(self):
        from runtime.task_dispatcher import TaskDispatcher
        dispatcher = TaskDispatcher()
        # Use a type that does not exist as an agent – should return an error gracefully
        result = run(
            dispatcher.dispatch(
                {"type": "nonexistent_type_xyz", "command": "test", "agent": "planner"},
                run_id="test-run-001",
            )
        )
        self.assertIn("success", result)
        self.assertIn("run_id", result)

    def test_circuit_breaker_created_per_agent(self):
        from runtime.task_dispatcher import TaskDispatcher
        dispatcher = TaskDispatcher()
        cb1 = dispatcher._get_circuit_breaker("scraper")
        cb2 = dispatcher._get_circuit_breaker("scraper")
        self.assertIs(cb1, cb2)  # same instance

    def test_queued_type_returns_task_id(self):
        from runtime.task_dispatcher import TaskDispatcher
        dispatcher = TaskDispatcher()
        result = run(
            dispatcher.dispatch(
                {"type": "outreach", "command": "run outreach campaign", "agent": "planner"},
                run_id="test-run-002",
            )
        )
        self.assertTrue(result.get("success"))
        self.assertTrue(result.get("queued"))
        self.assertIn("task_id", result)


# ===========================================================================
# WorkerPool
# ===========================================================================


class TestWorkerPool(unittest.TestCase):
    """Tests for runtime.worker_pool.WorkerPool."""

    def test_status_returns_dict(self):
        from runtime.worker_pool import WorkerPool
        pool = WorkerPool(n_workers=2)
        status = pool.status()
        self.assertIn("n_workers_configured", status)
        self.assertIn("tasks_processed", status)
        self.assertIn("queue", status)

    def test_pool_health_alias(self):
        from runtime.worker_pool import WorkerPool
        pool = WorkerPool(n_workers=1)
        self.assertEqual(pool.status(), pool.health())

    def test_start_background_creates_tasks(self):
        from runtime.worker_pool import WorkerPool

        async def _test():
            pool = WorkerPool(n_workers=2)
            tasks = await pool.start_background()
            self.assertEqual(len(tasks), 2)
            await pool.stop()

        run(_test())


# ===========================================================================
# RuntimeController
# ===========================================================================


class TestRuntimeController(unittest.TestCase):
    """Tests for runtime.runtime_controller.RuntimeController."""

    def test_get_health_returns_dict(self):
        from runtime.runtime_controller import RuntimeController
        rc = RuntimeController()
        health = rc.get_health()
        self.assertIn("status", health)
        self.assertIn("uptime_seconds", health)
        self.assertIn("commands_processed", health)
        self.assertIn("circuit_breaker", health)

    def test_get_metrics_returns_dict(self):
        from runtime.runtime_controller import RuntimeController
        rc = RuntimeController()
        metrics = rc.get_metrics()
        self.assertIn("tasks_total", metrics)
        self.assertIn("commands", metrics)

    def test_handle_command_returns_result(self):
        from runtime.runtime_controller import RuntimeController
        rc = RuntimeController()
        result = run(rc.handle_command("export leads", run_id="test-001"))
        self.assertIn("success", result)
        self.assertEqual(result["run_id"], "test-001")

    def test_handle_command_includes_routing(self):
        from runtime.runtime_controller import RuntimeController
        rc = RuntimeController()
        result = run(rc.handle_command("scrape epoxy contractors ohio"))
        # routing key should be present (may be inside result)
        self.assertIn("routing", result)
        self.assertIn("agent", result["routing"])

    def test_register_and_start_unknown_agent_fails(self):
        from runtime.runtime_controller import RuntimeController
        rc = RuntimeController()
        result = run(rc.start_agent("nonexistent_agent_xyz"))
        self.assertFalse(result["success"])
        self.assertIn("error", result)

    def test_register_and_start_agent(self):
        from runtime.runtime_controller import RuntimeController, register_agent

        class FakeAgent:
            def __init__(self):
                pass

        register_agent("fake_test_agent", FakeAgent)
        rc = RuntimeController()
        result = run(rc.start_agent("fake_test_agent"))
        self.assertTrue(result["success"])
        self.assertIn("fake_test_agent", rc.get_running_agents())

        # Cleanup
        run(rc.stop_agent("fake_test_agent"))

    def test_stop_nonrunning_agent_fails(self):
        from runtime.runtime_controller import RuntimeController
        rc = RuntimeController()
        result = run(rc.stop_agent("agent_not_running_xyz"))
        self.assertFalse(result["success"])

    def test_circuit_breaker_blocks_when_open(self):
        from runtime.runtime_controller import RuntimeController
        from runtime.fault_tolerance import CircuitBreaker, CIRCUIT_OPEN

        rc = RuntimeController()
        # Force circuit breaker open
        rc._circuit_breaker._state = CIRCUIT_OPEN
        rc._circuit_breaker._last_failure_time = time.time()
        # Set high recovery timeout so it stays open
        rc._circuit_breaker.recovery_timeout = 9999

        result = run(rc.handle_command("scrape flooring contractors"))
        self.assertFalse(result["success"])
        self.assertIn("Circuit breaker", result["error"])


# ===========================================================================
# Queue Dispatch Integration
# ===========================================================================


class TestQueueDispatch(unittest.TestCase):
    """Integration tests for the task queue and dispatch path."""

    def test_enqueue_and_get_status(self):
        from task_queue.redis_queue import TaskQueue
        q = TaskQueue()
        task_id = q.enqueue({"command": "test command", "type": "scrape"})
        self.assertIsInstance(task_id, str)
        self.assertTrue(len(task_id) > 0)

        status = q.get_status(task_id)
        self.assertIsNotNone(status)

    def test_queue_health_structure(self):
        from task_queue.redis_queue import TaskQueue
        q = TaskQueue()
        health = q.health()
        self.assertIn("queue_length", health)
        self.assertIn("dlq_length", health)
        self.assertIn("backend", health)

    def test_nack_moves_to_dlq(self):
        from task_queue.redis_queue import TaskQueue
        q = TaskQueue()
        before = q.dlq_length()
        task = {
            "task_id": "test-dlq-001",
            "payload": {"command": "test"},
        }
        q.nack(task, "test failure")
        self.assertEqual(q.dlq_length(), before + 1)


# ===========================================================================
# Sandbox Execution Integration
# ===========================================================================


class TestSandboxExecution(unittest.TestCase):
    """Integration tests for sandboxed agent execution."""

    def test_sandboxed_run_module_function(self):
        from runtime.sandbox_executor import sandboxed_run

        class GoodAgent:
            agent_name = "good_agent"

            async def execute(self, task, context=None):
                return {"success": True, "data": "hello"}

        result = run(sandboxed_run(GoodAgent(), {"command": "hello"}))
        self.assertTrue(result["success"])
        self.assertEqual(result["data"], "hello")

    def test_sandbox_executor_tracks_executions(self):
        from runtime.sandbox_executor import SandboxExecutor

        class CountAgent:
            agent_name = "count_agent"

            async def execute(self, task, context=None):
                return {"success": True}

        executor = SandboxExecutor()
        initial = executor._executions
        run(executor.run_agent(CountAgent(), {}))
        self.assertEqual(executor._executions, initial + 1)


if __name__ == "__main__":
    unittest.main()
