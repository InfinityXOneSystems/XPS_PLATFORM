"""
tests/test_agents.py – Unit tests for the LangGraph agent orchestration system.

Tests cover:
  - BaseAgent abstract class and event system
  - PlannerAgent intent detection and plan building
  - ScraperAgent lead deduplication and normalization
  - ValidatorAgent lead/code/plan/result validation
  - MemoryAgent store/recall/get operations
  - BuilderAgent, MediaAgent, DevOpsAgent BaseAgent integration
  - agent_core.orchestrator pipeline

Run with:
    python -m pytest tests/test_agents.py -v
"""

from __future__ import annotations

import asyncio
import unittest


# ---------------------------------------------------------------------------
# BaseAgent tests
# ---------------------------------------------------------------------------


class TestBaseAgent(unittest.TestCase):
    """Tests for agents.base_agent.BaseAgent."""

    def _make_agent(self):
        """Return a minimal concrete BaseAgent subclass."""
        from agents.base_agent import BaseAgent

        class _Agent(BaseAgent):
            agent_name = "test_agent"

            async def execute(self, task, context=None):
                cmd = task.get("command", "")
                if cmd == "fail":
                    raise ValueError("deliberate failure")
                return {"success": True, "echo": cmd}

        return _Agent()

    def test_agent_name(self):
        agent = self._make_agent()
        self.assertEqual(agent.agent_name, "test_agent")

    def test_run_returns_success(self):
        agent = self._make_agent()
        result = asyncio.run(agent.run("hello"))
        self.assertTrue(result["success"])
        self.assertEqual(result["echo"], "hello")

    def test_run_includes_run_id(self):
        agent = self._make_agent()
        result = asyncio.run(agent.run("hello"))
        self.assertIn("run_id", result)
        self.assertIsNotNone(result["run_id"])

    def test_run_includes_agent_name(self):
        agent = self._make_agent()
        result = asyncio.run(agent.run("hello"))
        self.assertEqual(result["agent"], "test_agent")

    def test_run_handles_error_gracefully(self):
        """After max_retries, run returns success=False instead of raising."""
        agent = self._make_agent()
        agent.max_retries = 0
        agent.retry_delay = 0
        result = asyncio.run(agent.run("fail"))
        self.assertFalse(result["success"])
        self.assertIn("error", result)

    def test_health_returns_dict(self):
        agent = self._make_agent()
        h = agent.health()
        self.assertIn("agent", h)
        self.assertEqual(h["agent"], "test_agent")

    def test_capabilities_returns_list(self):
        agent = self._make_agent()
        self.assertIsInstance(agent.capabilities(), list)

    def test_repr(self):
        agent = self._make_agent()
        self.assertIn("test_agent", repr(agent))


class TestEventSystem(unittest.TestCase):
    """Tests for the BaseAgent event bus."""

    def setUp(self):
        from agents.base_agent import _EVENT_LISTENERS
        _EVENT_LISTENERS.clear()

    def test_subscribe_and_emit(self):
        from agents.base_agent import subscribe, emit

        received = []
        subscribe("test.event", lambda e: received.append(e))
        emit({"type": "test.event", "data": 42})
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]["data"], 42)

    def test_wildcard_listener(self):
        from agents.base_agent import subscribe, emit

        received = []
        subscribe("*", lambda e: received.append(e))
        emit({"type": "any.event"})
        self.assertEqual(len(received), 1)

    def test_unsubscribe(self):
        from agents.base_agent import subscribe, unsubscribe, emit

        received = []
        handler = lambda e: received.append(e)
        subscribe("test.event", handler)
        unsubscribe("test.event", handler)
        emit({"type": "test.event"})
        self.assertEqual(len(received), 0)

    def test_agent_emits_start_and_complete(self):
        from agents.base_agent import BaseAgent, subscribe, _EVENT_LISTENERS

        events: list[dict] = []
        subscribe("agent.start", lambda e: events.append(e))
        subscribe("agent.complete", lambda e: events.append(e))

        class _Agent(BaseAgent):
            agent_name = "evt_agent"

            async def execute(self, task, context=None):
                return {"success": True}

        asyncio.run(_Agent().run("test"))
        types = [e["type"] for e in events]
        self.assertIn("agent.start", types)
        self.assertIn("agent.complete", types)


# ---------------------------------------------------------------------------
# PlannerAgent tests
# ---------------------------------------------------------------------------


class TestPlannerAgent(unittest.TestCase):
    """Tests for agents.planner.planner_agent.PlannerAgent."""

    def setUp(self):
        from agents.planner.planner_agent import PlannerAgent
        self.agent = PlannerAgent()

    def test_plan_returns_success(self):
        result = asyncio.run(self.agent.run("scrape epoxy contractors orlando florida"))
        self.assertTrue(result["success"])

    def test_plan_has_tasks(self):
        result = asyncio.run(self.agent.run("scrape epoxy contractors orlando florida"))
        plan = result["plan"]
        self.assertIn("tasks", plan)
        self.assertGreater(len(plan["tasks"]), 0)

    def test_scrape_intent_detected(self):
        result = asyncio.run(self.agent.run("scrape epoxy contractors tampa"))
        self.assertEqual(result["intent"], "scrape")

    def test_export_intent_detected(self):
        result = asyncio.run(self.agent.run("export leads to csv"))
        self.assertEqual(result["intent"], "export")

    def test_status_intent_detected(self):
        result = asyncio.run(self.agent.run("check system status"))
        self.assertEqual(result["intent"], "status")

    def test_entities_extracted(self):
        result = asyncio.run(self.agent.run("scrape epoxy contractors orlando florida"))
        entities = result["entities"]
        self.assertIn("keyword", entities)
        self.assertIn("industry", entities)

    def test_plan_has_command(self):
        result = asyncio.run(self.agent.run("scrape flooring contractors chicago"))
        self.assertIn("command", result["plan"])

    def test_execute_interface(self):
        result = asyncio.run(
            self.agent.execute({"command": "scrape tile contractors seattle"})
        )
        self.assertTrue(result["success"])
        self.assertIn("plan", result)

    def test_capabilities(self):
        caps = self.agent.capabilities()
        self.assertIn("intent_detection", caps)
        self.assertIn("task_decomposition", caps)

    def test_agent_name(self):
        self.assertEqual(self.agent.agent_name, "planner")


# ---------------------------------------------------------------------------
# ScraperAgent tests
# ---------------------------------------------------------------------------


class TestScraperAgent(unittest.TestCase):
    """Tests for agents.scraper.scraper_agent.ScraperAgent."""

    def setUp(self):
        from agents.scraper.scraper_agent import ScraperAgent
        # Limit to google_maps only (no Node.js needed for the test)
        self.agent = ScraperAgent(sources=["google_maps"])

    def test_execute_returns_success(self):
        result = asyncio.run(
            self.agent.execute({"command": "scrape epoxy orlando", "keyword": "epoxy", "city": "Orlando", "state": "FL"})
        )
        self.assertTrue(result["success"])

    def test_execute_returns_leads_list(self):
        result = asyncio.run(
            self.agent.execute({"command": "scrape epoxy orlando", "keyword": "epoxy", "city": "Orlando", "state": "FL"})
        )
        self.assertIn("leads", result)
        self.assertIsInstance(result["leads"], list)

    def test_execute_returns_leads_found_count(self):
        result = asyncio.run(
            self.agent.execute({"command": "scrape epoxy orlando", "keyword": "epoxy", "city": "Orlando", "state": "FL"})
        )
        self.assertEqual(result["leads_found"], len(result["leads"]))

    def test_source_counts_present(self):
        result = asyncio.run(
            self.agent.execute({"command": "scrape tile chicago", "keyword": "tile", "city": "Chicago", "state": "IL"})
        )
        self.assertIn("source_counts", result)

    def test_agent_name(self):
        from agents.scraper.scraper_agent import ScraperAgent
        self.assertEqual(ScraperAgent().agent_name, "scraper")

    def test_capabilities(self):
        from agents.scraper.scraper_agent import ScraperAgent
        caps = ScraperAgent().capabilities()
        self.assertIn("google_maps", caps)
        self.assertIn("deduplication", caps)

    def test_dedup_removes_duplicate_phones(self):
        from agents.scraper.scraper_agent import _dedup_leads

        leads = [
            {"company_name": "A", "phone": "555-1234"},
            {"company_name": "B", "phone": "555-1234"},  # duplicate phone
            {"company_name": "C", "phone": "555-9999"},
        ]
        result = _dedup_leads(leads)
        self.assertEqual(len(result), 2)

    def test_dedup_removes_duplicate_names(self):
        from agents.scraper.scraper_agent import _dedup_leads

        leads = [
            {"company_name": "Epoxy Pros", "phone": ""},
            {"company_name": "Epoxy Pros", "phone": ""},
        ]
        result = _dedup_leads(leads)
        self.assertEqual(len(result), 1)

    def test_normalize_adds_source(self):
        from agents.scraper.scraper_agent import _normalize_lead

        lead = {"company_name": "Test Co", "phone": "555-0000"}
        norm = _normalize_lead(lead, "google_maps")
        self.assertEqual(norm["source"], "google_maps")

    def test_normalize_fills_missing_fields(self):
        from agents.scraper.scraper_agent import _normalize_lead

        lead = {"company_name": "Test Co"}
        norm = _normalize_lead(lead, "yelp")
        self.assertIn("phone", norm)
        self.assertIn("website", norm)
        self.assertIn("email", norm)


# ---------------------------------------------------------------------------
# ValidatorAgent tests
# ---------------------------------------------------------------------------


class TestValidatorAgent(unittest.TestCase):
    """Tests for agents.validator.validator_agent.ValidatorAgent."""

    def setUp(self):
        from agents.validator.validator_agent import ValidatorAgent
        self.agent = ValidatorAgent()

    def test_validate_valid_leads(self):
        leads = [{"company_name": "Epoxy Pros", "phone": "555-1234"}]
        result = asyncio.run(self.agent.execute({"type": "leads", "leads": leads}))
        self.assertTrue(result["success"])
        self.assertTrue(result["valid"])

    def test_validate_invalid_leads_missing_name(self):
        leads = [{"company_name": "", "phone": "555-1234"}]
        result = asyncio.run(self.agent.execute({"type": "leads", "leads": leads}))
        self.assertTrue(result["success"])
        self.assertFalse(result["valid"])

    def test_validate_invalid_phone(self):
        leads = [{"company_name": "Good Co", "phone": "not-a-phone!!!"}]
        result = asyncio.run(self.agent.execute({"type": "leads", "leads": leads}))
        self.assertFalse(result["valid"])

    def test_validate_valid_python_code(self):
        result = asyncio.run(self.agent.execute({
            "type": "code",
            "code": "def hello():\n    return 'world'\n",
            "language": "python",
        }))
        self.assertTrue(result["success"])
        self.assertTrue(result["valid"])

    def test_validate_invalid_python_syntax(self):
        result = asyncio.run(self.agent.execute({
            "type": "code",
            "code": "def bad syntax here (",
            "language": "python",
        }))
        self.assertFalse(result["valid"])
        self.assertGreater(len(result["errors"]), 0)

    def test_validate_plan_with_valid_tasks(self):
        plan = {
            "tasks": [
                {"name": "scrape_google_maps", "params": {}},
                {"name": "return_results", "params": {}},
            ]
        }
        result = asyncio.run(self.agent.execute({"type": "plan", "plan": plan}))
        self.assertTrue(result["valid"])

    def test_validate_plan_with_unknown_task(self):
        plan = {"tasks": [{"name": "unknown_task_xyz", "params": {}}]}
        result = asyncio.run(self.agent.execute({"type": "plan", "plan": plan}))
        self.assertFalse(result["valid"])

    def test_validate_empty_plan(self):
        plan = {"tasks": []}
        result = asyncio.run(self.agent.execute({"type": "plan", "plan": plan}))
        self.assertFalse(result["valid"])

    def test_validate_result_values_ok(self):
        result = asyncio.run(self.agent.execute({
            "type": "result",
            "result": {"leads_found": 10, "high_value": 3},
        }))
        self.assertTrue(result["valid"])

    def test_validate_result_values_bad(self):
        result = asyncio.run(self.agent.execute({
            "type": "result",
            "result": {"leads_found": -1, "high_value": 0},
        }))
        self.assertFalse(result["valid"])

    def test_capabilities(self):
        caps = self.agent.capabilities()
        self.assertIn("lead_validation", caps)
        self.assertIn("code_validation", caps)

    def test_agent_name(self):
        self.assertEqual(self.agent.agent_name, "validator")


# ---------------------------------------------------------------------------
# MemoryAgent tests
# ---------------------------------------------------------------------------


class TestMemoryAgent(unittest.TestCase):
    """Tests for agents.memory.memory_agent.MemoryAgent."""

    def setUp(self):
        from agents.memory.memory_agent import MemoryAgent, _IN_PROCESS_KV
        _IN_PROCESS_KV.clear()
        self.agent = MemoryAgent()

    def test_store_and_get(self):
        asyncio.run(self.agent.execute({"operation": "store", "key": "k1", "value": "v1"}))
        result = asyncio.run(self.agent.execute({"operation": "get", "key": "k1"}))
        self.assertTrue(result["success"])
        self.assertTrue(result["found"])

    def test_get_missing_key(self):
        result = asyncio.run(self.agent.execute({"operation": "get", "key": "no_such_key"}))
        self.assertFalse(result["found"])

    def test_delete(self):
        asyncio.run(self.agent.execute({"operation": "store", "key": "del_key", "value": "x"}))
        asyncio.run(self.agent.execute({"operation": "delete", "key": "del_key"}))
        result = asyncio.run(self.agent.execute({"operation": "get", "key": "del_key"}))
        self.assertFalse(result["found"])

    def test_health_returns_dict(self):
        result = asyncio.run(self.agent.execute({"operation": "health"}))
        self.assertTrue(result["success"])
        self.assertIn("health", result)

    def test_save_lead(self):
        lead = {"company_name": "Test Co", "phone": "555-0001"}
        result = asyncio.run(self.agent.execute({"operation": "save_lead", "lead": lead}))
        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["saved"], 1)

    def test_recall_returns_list(self):
        asyncio.run(self.agent.execute({
            "operation": "store",
            "key": "mem1",
            "value": "epoxy flooring orlando",
            "text": "epoxy flooring orlando",
        }))
        result = asyncio.run(self.agent.execute({"operation": "recall", "query": "epoxy"}))
        self.assertTrue(result["success"])
        self.assertIsInstance(result["memories"], list)

    def test_summary(self):
        asyncio.run(self.agent.execute({"operation": "store", "key": "a", "value": "1"}))
        result = asyncio.run(self.agent.execute({"operation": "summary"}))
        self.assertTrue(result["success"])

    def test_detect_operation_from_command(self):
        result = asyncio.run(self.agent.execute({"command": "store this value", "key": "x", "value": "y"}))
        self.assertTrue(result["success"])

    def test_agent_name(self):
        self.assertEqual(self.agent.agent_name, "memory")

    def test_capabilities(self):
        caps = self.agent.capabilities()
        self.assertIn("store", caps)
        self.assertIn("recall", caps)


# ---------------------------------------------------------------------------
# BuilderAgent BaseAgent integration
# ---------------------------------------------------------------------------


class TestBuilderAgentBase(unittest.TestCase):
    """Verify BuilderAgent extends BaseAgent correctly."""

    def test_is_base_agent(self):
        from agents.base_agent import BaseAgent
        from agents.builder.builder_agent import BuilderAgent
        self.assertTrue(issubclass(BuilderAgent, BaseAgent))

    def test_agent_name(self):
        from agents.builder.builder_agent import BuilderAgent
        self.assertEqual(BuilderAgent.agent_name, "builder")

    def test_execute_returns_dict(self):
        from agents.builder.builder_agent import BuilderAgent
        result = asyncio.run(BuilderAgent().execute({"command": "generate module"}))
        self.assertIn("success", result)

    def test_run_via_base_agent(self):
        from agents.builder.builder_agent import BuilderAgent
        result = asyncio.run(BuilderAgent().run("generate service"))
        self.assertIn("success", result)


# ---------------------------------------------------------------------------
# MediaAgent BaseAgent integration
# ---------------------------------------------------------------------------


class TestMediaAgentBase(unittest.TestCase):
    """Verify MediaAgent extends BaseAgent correctly."""

    def test_is_base_agent(self):
        from agents.base_agent import BaseAgent
        from agents.media.media_agent import MediaAgent
        self.assertTrue(issubclass(MediaAgent, BaseAgent))

    def test_agent_name(self):
        from agents.media.media_agent import MediaAgent
        self.assertEqual(MediaAgent.agent_name, "media")

    def test_execute_returns_dict(self):
        from agents.media.media_agent import MediaAgent
        result = asyncio.run(MediaAgent().execute({"command": "generate image"}))
        self.assertIn("success", result)


# ---------------------------------------------------------------------------
# DevOpsAgent BaseAgent integration
# ---------------------------------------------------------------------------


class TestDevOpsAgentBase(unittest.TestCase):
    """Verify DevOpsAgent extends BaseAgent correctly."""

    def test_is_base_agent(self):
        from agents.base_agent import BaseAgent
        from agents.devops.devops_agent import DevOpsAgent
        self.assertTrue(issubclass(DevOpsAgent, BaseAgent))

    def test_agent_name(self):
        from agents.devops.devops_agent import DevOpsAgent
        self.assertEqual(DevOpsAgent.agent_name, "devops")

    def test_execute_returns_dict(self):
        from agents.devops.devops_agent import DevOpsAgent
        result = asyncio.run(DevOpsAgent().execute({"command": "check status"}))
        self.assertIn("success", result)


# ---------------------------------------------------------------------------
# agent_core.orchestrator tests
# ---------------------------------------------------------------------------


class TestOrchestratorPipeline(unittest.TestCase):
    """Tests for agent_core.orchestrator."""

    def test_run_pipeline_returns_dict(self):
        from agent_core.orchestrator import run_pipeline
        result = asyncio.run(run_pipeline("scrape epoxy contractors orlando"))
        self.assertIsInstance(result, dict)

    def test_run_pipeline_has_required_keys(self):
        from agent_core.orchestrator import run_pipeline
        result = asyncio.run(run_pipeline("scrape epoxy contractors orlando"))
        for key in ("run_id", "success", "leads_found", "high_value", "message", "errors"):
            self.assertIn(key, result)

    def test_run_pipeline_sync(self):
        from agent_core.orchestrator import run_pipeline_sync
        result = run_pipeline_sync("check system status")
        self.assertIsInstance(result, dict)
        self.assertIn("run_id", result)

    def test_run_pipeline_has_plan(self):
        from agent_core.orchestrator import run_pipeline
        result = asyncio.run(run_pipeline("scrape tile contractors chicago"))
        self.assertIn("plan", result)

    def test_run_pipeline_errors_is_list(self):
        from agent_core.orchestrator import run_pipeline
        result = asyncio.run(run_pipeline("scrape epoxy contractors tampa"))
        self.assertIsInstance(result["errors"], list)

    def test_run_pipeline_with_run_id(self):
        from agent_core.orchestrator import run_pipeline
        result = asyncio.run(run_pipeline("export leads", run_id="test-run-001"))
        self.assertEqual(result["run_id"], "test-run-001")

    def test_state_to_result(self):
        from agent_core.orchestrator import _state_to_result
        state = {
            "run_id": "r1",
            "command": "test",
            "plan": {},
            "leads": [],
            "results": [],
            "errors": [],
            "leads_found": 5,
            "high_value": 2,
            "intent": "scrape",
            "done": True,
        }
        result = _state_to_result(state, "r1")
        self.assertEqual(result["leads_found"], 5)
        self.assertEqual(result["high_value"], 2)
        self.assertTrue(result["success"])


# ---------------------------------------------------------------------------
# Inter-agent delegation
# ---------------------------------------------------------------------------


class TestInterAgentDelegation(unittest.TestCase):
    """Verify agents can delegate work to each other."""

    def test_delegate_to_validator(self):
        from agents.base_agent import BaseAgent
        from agents.validator.validator_agent import ValidatorAgent

        class _Delegator(BaseAgent):
            agent_name = "delegator"

            async def execute(self, task, context=None):
                return await self.delegate(
                    ValidatorAgent,
                    {"type": "leads", "leads": [{"company_name": "Epoxy Co", "phone": "555-0000"}]},
                )

        result = asyncio.run(_Delegator().run("validate"))
        self.assertTrue(result["success"])
        self.assertTrue(result["valid"])


if __name__ == "__main__":
    unittest.main()
