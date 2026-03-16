"""
tests/test_runtime.py
======================
Enterprise test suite for the XPS Intelligence Platform runtime components.

Covers:
  - ObservabilitySystem (metrics, spans, snapshots)
  - CircuitBreaker (closed → open → half-open → closed)
  - RetryPolicy (sync and async)
  - Bulkhead (concurrency limiting)
  - fault_tolerant decorator
  - KernelRuntime (register, lifecycle, health)
  - WorkerPool (submit, execute, DLQ)
  - TaskDispatcher (routing, rate-limiting)
  - RuntimeController (execute, sandbox, circuits, status)
  - SEOAgent (analyse_html, keyword extraction)
  - SocialAgent (extract_social_profiles, score_social_presence)
  - command_router (seo/social route detection)

Run with:
    python -m pytest tests/test_runtime.py -v
or:
    python -m unittest tests/test_runtime.py
"""

from __future__ import annotations

import asyncio
import time
import unittest


# ---------------------------------------------------------------------------
# Observability
# ---------------------------------------------------------------------------


class TestObservability(unittest.TestCase):
    def setUp(self):
        from observability import ObservabilitySystem
        self.obs = ObservabilitySystem()

    def test_counter_increments(self):
        self.obs.increment("test.counter")
        self.obs.increment("test.counter")
        snap = self.obs.snapshot()
        self.assertEqual(snap["counters"].get("test.counter"), 2.0)

    def test_gauge_overwritten(self):
        self.obs.gauge("test.gauge", 10.0)
        self.obs.gauge("test.gauge", 42.0)
        snap = self.obs.snapshot()
        self.assertEqual(snap["gauges"].get("test.gauge"), 42.0)

    def test_histogram_aggregates(self):
        self.obs.histogram("test.hist", 10.0)
        self.obs.histogram("test.hist", 20.0)
        snap = self.obs.snapshot()
        agg = snap["aggregates"]["test.hist"]
        self.assertAlmostEqual(agg["avg"], 15.0)
        self.assertAlmostEqual(agg["min"], 10.0)
        self.assertAlmostEqual(agg["max"], 20.0)

    def test_span_context_manager(self):
        from observability import ObservabilitySystem
        obs = ObservabilitySystem()
        with obs.span("test.op") as span:
            span.set_tag("foo", "bar")
        self.assertIsNotNone(span.end_time)
        self.assertGreater(span.duration_ms, 0)
        self.assertIsNone(span.error)

    def test_span_records_error(self):
        from observability import ObservabilitySystem
        obs = ObservabilitySystem()
        with self.assertRaises(ValueError):
            with obs.span("test.err_op"):
                raise ValueError("boom")

    def test_snapshot_has_required_keys(self):
        snap = self.obs.snapshot()
        for key in ("timestamp", "counters", "gauges", "aggregates", "recent_spans"):
            self.assertIn(key, snap)

    def test_reset_clears_data(self):
        self.obs.increment("reset.test")
        self.obs.reset()
        snap = self.obs.snapshot()
        self.assertEqual(snap["counters"], {})

    def test_module_helpers(self):
        from observability import record_metric, start_span, get_metrics_snapshot
        record_metric("helper.test", 1.0)
        with start_span("helper.span") as span:
            span.set_tag("k", "v")
        snap = get_metrics_snapshot()
        self.assertIn("helper.test", snap["counters"])


# ---------------------------------------------------------------------------
# CircuitBreaker
# ---------------------------------------------------------------------------


class TestCircuitBreaker(unittest.TestCase):
    def _make_cb(self, threshold=3, recovery=0.1):
        from fault_tolerance import CircuitBreaker
        return CircuitBreaker(
            name=f"test_{time.time()}",
            failure_threshold=threshold,
            recovery_timeout=recovery,
        )

    def test_starts_closed(self):
        from fault_tolerance import CircuitState
        cb = self._make_cb()
        self.assertEqual(cb.state, CircuitState.CLOSED)

    def test_opens_after_threshold(self):
        from fault_tolerance import CircuitState
        cb = self._make_cb(threshold=3)
        for _ in range(3):
            cb.record_failure()
        self.assertEqual(cb.state, CircuitState.OPEN)

    def test_allows_request_when_closed(self):
        cb = self._make_cb()
        self.assertTrue(cb.allow_request())

    def test_blocks_request_when_open(self):
        cb = self._make_cb(threshold=1)
        cb.record_failure()
        self.assertFalse(cb.allow_request())

    def test_transitions_to_half_open_after_timeout(self):
        from fault_tolerance import CircuitState
        cb = self._make_cb(threshold=1, recovery=0.05)
        cb.record_failure()
        time.sleep(0.1)
        # allow_request() triggers the half-open transition
        cb.allow_request()
        self.assertEqual(cb.state, CircuitState.HALF_OPEN)

    def test_closes_after_half_open_successes(self):
        from fault_tolerance import CircuitState
        cb = self._make_cb(threshold=1, recovery=0.05)
        cb.record_failure()
        time.sleep(0.1)
        cb.allow_request()  # → HALF_OPEN
        cb.record_success()
        cb.record_success()
        self.assertEqual(cb.state, CircuitState.CLOSED)

    def test_context_manager_success(self):
        from fault_tolerance import CircuitState
        cb = self._make_cb()
        with cb:
            pass
        self.assertEqual(cb.state, CircuitState.CLOSED)

    def test_context_manager_failure(self):
        from fault_tolerance import CircuitState, CircuitOpenError
        cb = self._make_cb(threshold=1)
        with self.assertRaises(RuntimeError):
            with cb:
                raise RuntimeError("fail")
        self.assertEqual(cb.state, CircuitState.OPEN)

    def test_context_manager_raises_when_open(self):
        from fault_tolerance import CircuitBreaker, CircuitOpenError
        cb = CircuitBreaker(f"test_open_{time.time()}", failure_threshold=1)
        cb.record_failure()
        with self.assertRaises(CircuitOpenError):
            with cb:
                pass

    def test_status_dict(self):
        cb = self._make_cb()
        s = cb.status()
        self.assertIn("state", s)
        self.assertIn("failure_count", s)


# ---------------------------------------------------------------------------
# RetryPolicy
# ---------------------------------------------------------------------------


class TestRetryPolicy(unittest.TestCase):
    def test_success_first_try(self):
        from fault_tolerance import RetryPolicy
        rp = RetryPolicy(max_retries=2, base_delay=0)
        result = rp.execute(lambda: 42)
        self.assertEqual(result, 42)

    def test_retries_on_failure_then_succeeds(self):
        from fault_tolerance import RetryPolicy
        attempts = [0]

        def fn():
            attempts[0] += 1
            if attempts[0] < 3:
                raise ValueError("transient")
            return "ok"

        rp = RetryPolicy(max_retries=3, base_delay=0)
        result = rp.execute(fn)
        self.assertEqual(result, "ok")
        self.assertEqual(attempts[0], 3)

    def test_raises_after_exhaustion(self):
        from fault_tolerance import RetryPolicy, RetryExhausted

        def always_fails():
            raise ValueError("always")

        rp = RetryPolicy(max_retries=2, base_delay=0)
        with self.assertRaises(RetryExhausted):
            rp.execute(always_fails)

    def test_async_success(self):
        from fault_tolerance import RetryPolicy

        async def _run():
            rp = RetryPolicy(max_retries=2, base_delay=0)

            async def fn():
                return 99

            return await rp.execute_async(fn)

        result = asyncio.run(_run())
        self.assertEqual(result, 99)

    def test_async_retries(self):
        from fault_tolerance import RetryPolicy

        async def _run():
            attempts = [0]
            rp = RetryPolicy(max_retries=3, base_delay=0)

            async def fn():
                attempts[0] += 1
                if attempts[0] < 2:
                    raise IOError("transient")
                return "done"

            result = await rp.execute_async(fn)
            return result, attempts[0]

        result, attempts = asyncio.run(_run())
        self.assertEqual(result, "done")
        self.assertEqual(attempts, 2)


# ---------------------------------------------------------------------------
# Bulkhead
# ---------------------------------------------------------------------------


class TestBulkhead(unittest.TestCase):
    def test_allows_within_limit(self):
        from fault_tolerance import Bulkhead
        bh = Bulkhead("test", max_concurrent=5)
        with bh:
            pass  # should not raise

    def test_raises_when_full(self):
        from fault_tolerance import Bulkhead, BulkheadFullError
        import threading

        bh = Bulkhead("test_full", max_concurrent=1, timeout=0.05)
        # Acquire the slot in a background thread
        ready = threading.Event()
        done = threading.Event()

        def hold():
            with bh:
                ready.set()
                done.wait(timeout=1)

        t = threading.Thread(target=hold)
        t.start()
        ready.wait()

        with self.assertRaises(BulkheadFullError):
            with bh:
                pass

        done.set()
        t.join()


# ---------------------------------------------------------------------------
# fault_tolerant decorator
# ---------------------------------------------------------------------------


class TestFaultTolerantDecorator(unittest.TestCase):
    def test_sync_success(self):
        from fault_tolerance import fault_tolerant

        @fault_tolerant(retries=0)
        def fn():
            return "ok"

        self.assertEqual(fn(), "ok")

    def test_sync_fallback(self):
        from fault_tolerance import fault_tolerant

        @fault_tolerant(retries=0, fallback={"data": []})
        def fn():
            raise RuntimeError("fail")

        result = fn()
        self.assertEqual(result, {"data": []})

    def test_async_success(self):
        from fault_tolerance import fault_tolerant

        @fault_tolerant(retries=0)
        async def fn():
            return 42

        self.assertEqual(asyncio.run(fn()), 42)

    def test_async_fallback(self):
        from fault_tolerance import fault_tolerant

        @fault_tolerant(retries=0, fallback=[])
        async def fn():
            raise ValueError("async fail")

        result = asyncio.run(fn())
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# KernelRuntime
# ---------------------------------------------------------------------------


class TestKernelRuntime(unittest.TestCase):
    def _make_kernel(self):
        from kernel import KernelRuntime
        return KernelRuntime(health_interval=999)  # disable health loop in tests

    def test_register_agent(self):
        kernel = self._make_kernel()
        rec = kernel.register("agent_a", object())
        self.assertEqual(rec.name, "agent_a")

    def test_register_duplicate_no_replace(self):
        kernel = self._make_kernel()
        obj1 = object()
        obj2 = object()
        kernel.register("dup", obj1)
        rec = kernel.register("dup", obj2)
        self.assertIs(rec.instance, obj1)

    def test_register_duplicate_with_replace(self):
        kernel = self._make_kernel()
        obj1 = object()
        obj2 = object()
        kernel.register("dup2", obj1)
        rec = kernel.register("dup2", obj2, replace=True)
        self.assertIs(rec.instance, obj2)

    def test_lifecycle_status(self):
        from kernel import AgentStatus
        kernel = self._make_kernel()
        kernel.register("life_agent", object())
        kernel.mark_running("life_agent")
        rec = kernel.get("life_agent")
        self.assertEqual(rec.status, AgentStatus.RUNNING)
        kernel.mark_idle("life_agent")
        self.assertEqual(rec.status, AgentStatus.IDLE)

    def test_mark_error(self):
        from kernel import AgentStatus
        kernel = self._make_kernel()
        kernel.register("err_agent", object())
        kernel.mark_error("err_agent", "connection refused")
        rec = kernel.get("err_agent")
        self.assertEqual(rec.status, AgentStatus.ERROR)
        self.assertEqual(rec.error_count, 1)
        self.assertEqual(rec.last_error, "connection refused")

    def test_deregister(self):
        from kernel import AgentStatus
        kernel = self._make_kernel()
        kernel.register("tmp", object())
        kernel.deregister("tmp")
        self.assertIsNone(kernel.get("tmp"))

    def test_status_summary(self):
        kernel = self._make_kernel()
        kernel.register("s1", object())
        kernel.register("s2", object())
        summary = kernel.status_summary()
        self.assertEqual(summary["total"], 2)

    def test_lifecycle_hook(self):
        kernel = self._make_kernel()
        called = []
        kernel.on("registered", lambda rec: called.append(rec.name))
        kernel.register("hook_agent", object())
        self.assertIn("hook_agent", called)


# ---------------------------------------------------------------------------
# WorkerPool
# ---------------------------------------------------------------------------


class TestWorkerPool(unittest.TestCase):
    def test_submit_and_execute(self):
        from worker_pool import WorkerPool, WorkerPoolConfig, Task

        async def _run():
            pool = WorkerPool(WorkerPoolConfig(min_workers=1, max_workers=2))
            await pool.start()

            async def work():
                return {"done": True}

            task = Task(fn=work, timeout=5.0, max_retries=0)
            await pool.submit(task)
            await asyncio.sleep(0.5)
            await pool.stop(drain=False)
            return task

        task = asyncio.run(_run())
        from worker_pool import TaskStatus
        self.assertEqual(task.status, TaskStatus.COMPLETED)
        self.assertEqual(task.result, {"done": True})

    def test_failed_task_to_dlq(self):
        from worker_pool import WorkerPool, WorkerPoolConfig, Task, TaskStatus

        async def _run():
            pool = WorkerPool(WorkerPoolConfig(min_workers=1))
            await pool.start()

            async def fail():
                raise RuntimeError("always fails")

            task = Task(fn=fail, timeout=5.0, max_retries=0)
            await pool.submit(task)
            await asyncio.sleep(0.5)
            await pool.stop(drain=False)
            return pool, task

        pool, task = asyncio.run(_run())
        self.assertEqual(task.status, TaskStatus.DEAD)
        self.assertEqual(len(pool.dlq), 1)

    def test_stats_returns_dict(self):
        from worker_pool import WorkerPool, WorkerPoolConfig

        async def _run():
            pool = WorkerPool(WorkerPoolConfig(min_workers=1))
            await pool.start()
            stats = pool.stats()
            await pool.stop(drain=False)
            return stats

        stats = asyncio.run(_run())
        self.assertIn("workers", stats)
        self.assertIn("queue_depth", stats)

    def test_deduplication(self):
        from worker_pool import WorkerPool, WorkerPoolConfig, Task

        async def _run():
            pool = WorkerPool(WorkerPoolConfig(min_workers=0))
            # Don't start — just test dedup logic

            async def noop():
                return {}

            t1 = Task(fn=noop, idempotency_key="idem1")
            t2 = Task(fn=noop, idempotency_key="idem1")
            await pool.submit(t1)
            # Manually add t1 to completed to simulate completion
            from worker_pool import TaskStatus
            t1.status = TaskStatus.COMPLETED
            pool._completed[t1.task_id] = t1
            t2b = await pool.submit(t2)
            return t1, t2b

        t1, t2b = asyncio.run(_run())
        # Both references should point to t1 (dedup hit)
        self.assertEqual(t1.task_id, t2b.task_id)


# ---------------------------------------------------------------------------
# TaskDispatcher
# ---------------------------------------------------------------------------


class TestTaskDispatcher(unittest.TestCase):
    def test_dispatch_plan(self):
        from task_dispatcher import TaskDispatcher

        async def _run():
            d = TaskDispatcher()
            # Override the _handle_plan to avoid real agent calls
            async def mock_plan(payload):
                return {"mocked": True}
            d.register_handler("plan", mock_plan)
            result = await d.dispatch({"type": "plan", "command": "test"})
            return result

        result = asyncio.run(_run())
        self.assertTrue(result.success)
        self.assertEqual(result.result, {"mocked": True})

    def test_dispatch_unknown_type_falls_back_to_plan(self):
        from task_dispatcher import TaskDispatcher

        async def _run():
            d = TaskDispatcher()

            async def mock_plan(payload):
                return {"fallback": True}
            d.register_handler("plan", mock_plan)

            result = await d.dispatch({"type": "completely_unknown", "command": "x"})
            return result

        result = asyncio.run(_run())
        self.assertTrue(result.success)

    def test_dispatch_handler_error_returns_failure(self):
        from task_dispatcher import TaskDispatcher

        async def _run():
            d = TaskDispatcher()

            async def bad_handler(payload):
                raise RuntimeError("handler crashed")
            d.register_handler("crash", bad_handler)

            result = await d.dispatch({"type": "crash", "command": "test"})
            return result

        result = asyncio.run(_run())
        self.assertFalse(result.success)
        self.assertIn("handler crashed", result.error)

    def test_rate_limit_applied(self):
        from task_dispatcher.task_dispatcher import _TokenBucket

        bucket = _TokenBucket(rate=0.0, capacity=0.0)  # never allows
        self.assertFalse(bucket.consume())

    def test_dispatch_result_to_dict(self):
        from task_dispatcher import DispatchResult
        r = DispatchResult(success=True, task_type="test", result={"x": 1}, duration_ms=10.5)
        d = r.to_dict()
        self.assertEqual(d["task_type"], "test")
        self.assertAlmostEqual(d["duration_ms"], 10.5)


# ---------------------------------------------------------------------------
# RuntimeController
# ---------------------------------------------------------------------------


class TestRuntimeController(unittest.TestCase):
    def _make_controller(self, sandbox=True):
        from runtime_controller import RuntimeController
        return RuntimeController(
            circuit_failure_threshold=10,
            circuit_recovery_timeout=999,
            bulkhead_max_concurrent=50,
            sandbox_enabled=sandbox,
        )

    def test_sandbox_blocks_dangerous_command(self):
        from runtime_controller import RuntimeController, ExecutionRequest
        controller = self._make_controller(sandbox=True)

        async def _run():
            req = ExecutionRequest(command="rm -rf /home/user")
            return await controller.execute(req)

        resp = asyncio.run(_run())
        self.assertFalse(resp.success)
        self.assertIn("Sandbox violation", resp.error)

    def test_sandbox_allows_safe_command(self):
        from runtime_controller import RuntimeController, ExecutionRequest

        async def _run():
            controller = RuntimeController(sandbox_enabled=True)
            # Patch the dispatcher to avoid real agent calls
            from task_dispatcher import get_dispatcher, DispatchResult
            orig = controller._dispatcher.dispatch

            async def mock_dispatch(payload):
                return DispatchResult(success=True, task_type="plan", result={"ok": True})

            controller._dispatcher.dispatch = mock_dispatch
            req = ExecutionRequest(command="scrape flooring contractors florida")
            return await controller.execute(req)

        resp = asyncio.run(_run())
        self.assertTrue(resp.success)

    def test_circuit_breaker_opens_after_failures(self):
        from runtime_controller import RuntimeController, ExecutionRequest
        from fault_tolerance import CircuitState

        async def _run():
            controller = RuntimeController(
                circuit_failure_threshold=2,
                circuit_recovery_timeout=999,
                sandbox_enabled=False,
            )
            # Make dispatcher always fail
            from task_dispatcher import DispatchResult

            async def failing_dispatch(payload):
                return DispatchResult(success=False, task_type="plan", error="fail")

            controller._dispatcher.dispatch = failing_dispatch

            req = ExecutionRequest(command="test command")
            for _ in range(2):
                await controller.execute(req)

            circuit = controller._get_circuit("plan")
            return circuit.state

        state = asyncio.run(_run())
        self.assertEqual(state, CircuitState.OPEN)

    def test_status_returns_dict(self):
        controller = self._make_controller()

        async def _run():
            return controller.status()

        status = asyncio.run(_run())
        self.assertIn("sandbox_enabled", status)
        self.assertIn("circuits", status)

    def test_execution_response_to_dict(self):
        from runtime_controller import ExecutionResponse
        resp = ExecutionResponse(
            success=True,
            correlation_id="abc123",
            result={"leads": 5},
            task_type="scrape",
            duration_ms=250.0,
        )
        d = resp.to_dict()
        self.assertEqual(d["correlation_id"], "abc123")
        self.assertEqual(d["task_type"], "scrape")

    def test_sandbox_disabled_allows_everything(self):
        from runtime_controller import RuntimeController, ExecutionRequest
        from task_dispatcher import DispatchResult

        async def _run():
            controller = RuntimeController(sandbox_enabled=False)

            async def mock_dispatch(payload):
                return DispatchResult(success=True, task_type="plan", result={})

            controller._dispatcher.dispatch = mock_dispatch
            req = ExecutionRequest(command="rm -rf /tmp")  # would be blocked with sandbox
            return await controller.execute(req)

        resp = asyncio.run(_run())
        self.assertTrue(resp.success)


# ---------------------------------------------------------------------------
# SEOAgent
# ---------------------------------------------------------------------------


class TestSEOAgent(unittest.TestCase):
    def test_analyse_html_basic(self):
        from agents.seo.seo_agent import analyse_html

        html = """
        <html>
        <head>
            <title>Best Epoxy Flooring Tampa FL</title>
            <meta name="description" content="Professional epoxy flooring services in Tampa, FL.">
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body><h1>Epoxy Flooring</h1><h2>Services</h2></body>
        </html>
        """
        result = analyse_html("https://example.com", html, keyword="epoxy")
        self.assertIn("score", result)
        self.assertGreater(result["score"], 0)
        self.assertEqual(result["title"], "Best Epoxy Flooring Tampa FL")
        self.assertIn("https", result)

    def test_analyse_html_missing_title(self):
        from agents.seo.seo_agent import analyse_html
        html = "<html><body><h1>Content</h1></body></html>"
        result = analyse_html("https://example.com", html)
        self.assertIn("Missing <title> tag", result["issues"])

    def test_analyse_html_missing_h1(self):
        from agents.seo.seo_agent import analyse_html
        html = "<html><head><title>Test</title></head><body><p>No heading</p></body></html>"
        result = analyse_html("https://example.com", html)
        self.assertIn("Missing H1 heading", result["issues"])

    def test_analyse_html_https_score(self):
        from agents.seo.seo_agent import analyse_html
        html = "<html><head><title>Test</title></head><body><h1>Hi</h1></body></html>"
        https_result = analyse_html("https://example.com", html)
        http_result = analyse_html("http://example.com", html)
        self.assertGreater(https_result["score"], http_result["score"])

    def test_analyse_html_structured_data(self):
        from agents.seo.seo_agent import analyse_html
        html = """
        <html>
        <head>
            <title>Test</title>
            <script type="application/ld+json">{"@type":"LocalBusiness"}</script>
        </head>
        <body><h1>Test</h1></body>
        </html>
        """
        result = analyse_html("https://example.com", html)
        self.assertTrue(result["structured_data"])

    def test_extract_keyword(self):
        from agents.seo.seo_agent import SEOAgent
        agent = SEOAgent()
        self.assertEqual(agent._extract_keyword("analyze seo for epoxy contractors"), "epoxy")
        self.assertEqual(agent._extract_keyword("seo audit for flooring"), "flooring")
        self.assertEqual(agent._extract_keyword("random text"), "contractor")

    def test_keyword_report(self):
        from agents.seo.seo_agent import SEOAgent
        agent = SEOAgent()
        result = agent._keyword_report("epoxy")
        self.assertEqual(result["primary_keyword"], "epoxy")
        self.assertIn("long_tail_suggestions", result)
        self.assertIn("local_seo_tips", result)

    def test_run_keyword_mode(self):
        from agents.seo.seo_agent import SEOAgent
        result = asyncio.run(SEOAgent().run("seo keywords for flooring"))
        self.assertTrue(result["success"])

    def test_extract_links(self):
        from agents.seo.seo_agent import _extract_links
        html = '<a href="https://example.com/page">link</a><a href="/relative">rel</a>'
        links = _extract_links(html, "https://example.com")
        self.assertIn("https://example.com/page", links)


# ---------------------------------------------------------------------------
# SocialAgent
# ---------------------------------------------------------------------------


class TestSocialAgent(unittest.TestCase):
    def test_extract_social_profiles(self):
        from agents.social.social_agent import extract_social_profiles
        html = """
        <a href="https://linkedin.com/company/acme-flooring">LinkedIn</a>
        <a href="https://www.facebook.com/acmeflooring">Facebook</a>
        <a href="https://www.instagram.com/acmeflooring">Instagram</a>
        """
        profiles = extract_social_profiles(html)
        self.assertIn("linkedin", profiles)
        self.assertIn("facebook", profiles)
        self.assertIn("instagram", profiles)

    def test_extract_filters_generic_paths(self):
        from agents.social.social_agent import extract_social_profiles
        html = '<a href="https://www.facebook.com/share">Share</a>'
        profiles = extract_social_profiles(html)
        # "share" should be filtered out
        self.assertNotIn("facebook", profiles)

    def test_score_social_presence_empty(self):
        from agents.social.social_agent import score_social_presence
        self.assertEqual(score_social_presence({}), 0)

    def test_score_social_presence_full(self):
        from agents.social.social_agent import score_social_presence
        profiles = {
            "linkedin": ["acme"],
            "facebook": ["acme"],
            "instagram": ["acme"],
            "yelp": ["acme"],
            "youtube": ["acme"],
        }
        score = score_social_presence(profiles)
        self.assertGreater(score, 50)
        self.assertLessEqual(score, 100)

    def test_hashtag_strategy(self):
        from agents.social.social_agent import SocialAgent
        agent = SocialAgent()
        result = agent._hashtag_strategy("flooring")
        self.assertEqual(result["keyword"], "flooring")
        self.assertIn("#flooring", result["primary_hashtags"])

    def test_build_search_links(self):
        from agents.social.social_agent import SocialAgent
        agent = SocialAgent()
        result = agent._build_search_links(["Acme Flooring", "Top Tile"])
        self.assertEqual(result["companies"], 2)
        self.assertIn("linkedin", result["results"][0]["search_urls"])

    def test_run_hashtags_mode(self):
        from agents.social.social_agent import SocialAgent
        result = asyncio.run(SocialAgent().run("social hashtags for epoxy"))
        # command dispatches to _hashtag_strategy via _extract_keyword
        self.assertIn("success", result)

    def test_build_search_url(self):
        from agents.social.social_agent import build_search_url
        url = build_search_url("Acme Flooring", "linkedin")
        self.assertIn("linkedin.com", url)
        self.assertIn("Acme", url)


# ---------------------------------------------------------------------------
# CommandRouter — SEO and social routes
# ---------------------------------------------------------------------------


class TestCommandRouterExtended(unittest.TestCase):
    def _load_router(self):
        """Load command_router directly, bypassing agent_core/__init__.py (requires pydantic)."""
        import importlib.util
        import os
        path = os.path.join(
            os.path.dirname(__file__), "..", "agent_core", "command_router.py"
        )
        spec = importlib.util.spec_from_file_location("_command_router_raw", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_routes_seo_command(self):
        mod = self._load_router()
        result = mod.route("analyze seo for flooring contractors")
        self.assertEqual(result["type"], "seo")
        self.assertEqual(result["agent"], "seo")

    def test_routes_social_command(self):
        mod = self._load_router()
        result = mod.route("find social media profiles linkedin flooring")
        self.assertEqual(result["type"], "social")
        self.assertEqual(result["agent"], "social")

    def test_existing_scrape_route_unchanged(self):
        mod = self._load_router()
        result = mod.route("scrape epoxy contractors ohio")
        self.assertEqual(result["type"], "scrape")

    def test_existing_predict_route_unchanged(self):
        mod = self._load_router()
        result = mod.route("predict lead growth trend")
        self.assertEqual(result["type"], "predict")


# ---------------------------------------------------------------------------
# Sandbox check (runtime_controller level)
# ---------------------------------------------------------------------------


class TestRuntimeSandboxCheck(unittest.TestCase):
    def test_blocks_rm_command(self):
        from runtime_controller.runtime_controller import _sandbox_check
        with self.assertRaises(PermissionError):
            _sandbox_check("rm -rf /var/data")

    def test_blocks_subprocess(self):
        from runtime_controller.runtime_controller import _sandbox_check
        with self.assertRaises(PermissionError):
            _sandbox_check("run subprocess call here")

    def test_blocks_eval(self):
        from runtime_controller.runtime_controller import _sandbox_check
        with self.assertRaises(PermissionError):
            _sandbox_check("eval(dangerous_code())")

    def test_allows_safe_command(self):
        from runtime_controller.runtime_controller import _sandbox_check
        # Should not raise
        _sandbox_check("scrape epoxy contractors in ohio")
        _sandbox_check("find flooring companies near Tampa FL")


# ---------------------------------------------------------------------------
# Singleton helpers
# ---------------------------------------------------------------------------


class TestSingletons(unittest.TestCase):
    def test_get_observability_singleton(self):
        from observability import get_observability
        a = get_observability()
        b = get_observability()
        self.assertIs(a, b)

    def test_get_dispatcher_singleton(self):
        from task_dispatcher import get_dispatcher
        a = get_dispatcher()
        b = get_dispatcher()
        self.assertIs(a, b)

    def test_get_pool_singleton(self):
        from worker_pool import get_pool
        a = get_pool()
        b = get_pool()
        self.assertIs(a, b)


if __name__ == "__main__":
    unittest.main()
