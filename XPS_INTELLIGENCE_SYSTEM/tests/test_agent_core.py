"""
tests/test_agent_core.py – Unit tests for the agent_core pipeline.

Run with:
    python -m pytest tests/test_agent_core.py -v
or:
    python -m unittest tests/test_agent_core.py
"""

import json
import os
import tempfile
import unittest


class TestValidator(unittest.TestCase):
    """Tests for agent_core.validator."""

    def setUp(self):
        from agent_core.validator import Command, Plan, PlanStep, ExecutionResult
        self.Command = Command
        self.Plan = Plan
        self.PlanStep = PlanStep
        self.ExecutionResult = ExecutionResult

    def test_valid_command(self):
        cmd = self.Command(task="scrape epoxy contractors", industry="epoxy", location="tampa")
        self.assertEqual(cmd.industry, "epoxy")
        self.assertEqual(cmd.location, "tampa")

    def test_command_rejects_empty_task(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="", industry="epoxy", location="tampa")

    def test_command_rejects_empty_industry(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="scrape", industry="", location="tampa")

    def test_command_rejects_invalid_location(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="scrape", industry="epoxy", location="123!!!")

    def test_command_rejects_task_too_long(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="x" * 201, industry="epoxy", location="tampa")

    def test_command_rejects_industry_too_long(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="scrape", industry="e" * 201, location="tampa")

    def test_command_rejects_location_too_long(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="scrape", industry="epoxy", location="t" * 201)

    def test_command_rejects_extra_fields(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            self.Command(task="scrape", industry="epoxy", location="tampa", unexpected="value")

    def test_valid_plan(self):
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        step = self.PlanStep(tool="playwright_scraper", description="Scrape leads")
        plan = self.Plan(command=cmd, steps=[step])
        self.assertEqual(len(plan.steps), 1)

    def test_plan_rejects_empty_steps(self):
        from pydantic import ValidationError
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        with self.assertRaises(ValidationError):
            self.Plan(command=cmd, steps=[])

    def test_plan_rejects_too_many_steps(self):
        from pydantic import ValidationError
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        steps = [
            self.PlanStep(tool="playwright_scraper", description=f"Step {i}")
            for i in range(6)
        ]
        with self.assertRaises(ValidationError):
            self.Plan(command=cmd, steps=steps)

    def test_plan_accepts_max_steps(self):
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        steps = [
            self.PlanStep(tool="playwright_scraper", description=f"Step {i}")
            for i in range(5)
        ]
        plan = self.Plan(command=cmd, steps=steps)
        self.assertEqual(len(plan.steps), 5)

    def test_execution_result_defaults(self):
        result = self.ExecutionResult(success=True)
        self.assertEqual(result.leads_found, 0)
        self.assertEqual(result.high_value, 0)
        self.assertFalse(result.retried)


class TestNormalizeCommand(unittest.TestCase):
    """Tests for agent_core.validator.normalize_command."""

    def setUp(self):
        from agent_core.validator import normalize_command
        self.normalize_command = normalize_command

    def test_scrape_epoxy_tampa(self):
        result = self.normalize_command("scrape epoxy contractors tampa")
        self.assertEqual(result["task"], "scrape")
        self.assertEqual(result["industry"], "epoxy")
        self.assertIn("tampa", result["location"])

    def test_scrape_epoxy_orlando(self):
        result = self.normalize_command("scrape epoxy contractors orlando")
        self.assertEqual(result["task"], "scrape")
        self.assertEqual(result["industry"], "epoxy")
        self.assertIn("orlando", result["location"])

    def test_generate_outreach_emails(self):
        result = self.normalize_command("generate outreach emails")
        self.assertEqual(result["task"], "generate")

    def test_find_flooring_ohio(self):
        result = self.normalize_command("find flooring contractors ohio")
        self.assertEqual(result["task"], "find")
        self.assertEqual(result["industry"], "flooring")
        self.assertIn("ohio", result["location"])

    def test_unsupported_task_raises(self):
        with self.assertRaises(ValueError):
            self.normalize_command("xyz123 gibberish abc")

    def test_empty_command_raises(self):
        with self.assertRaises(ValueError):
            self.normalize_command("")


class TestGates(unittest.TestCase):
    """Tests for agent_core.gates."""

    def setUp(self):
        from agent_core.gates import (
            GateError, command_gate, tool_gate, plan_gate, param_gate,
            run_all_gates, ALLOWED_TOOLS,
        )
        from agent_core.validator import Command, Plan, PlanStep
        self.GateError = GateError
        self.command_gate = command_gate
        self.tool_gate = tool_gate
        self.plan_gate = plan_gate
        self.param_gate = param_gate
        self.run_all_gates = run_all_gates
        self.ALLOWED_TOOLS = ALLOWED_TOOLS
        self.Command = Command
        self.Plan = Plan
        self.PlanStep = PlanStep

    def test_command_gate_valid(self):
        cmd = self.command_gate({"task": "scrape", "industry": "epoxy", "location": "tampa"})
        self.assertIsInstance(cmd, self.Command)

    def test_command_gate_rejects_empty_task(self):
        with self.assertRaises(self.GateError):
            self.command_gate({"task": "", "industry": "epoxy", "location": "tampa"})

    def test_command_gate_rejects_extra_fields(self):
        with self.assertRaises(self.GateError):
            self.command_gate({
                "task": "scrape", "industry": "epoxy",
                "location": "tampa", "extra": "bad",
            })

    def test_tool_gate_allows_valid_tool(self):
        # Should not raise
        self.tool_gate("playwright_scraper")

    def test_tool_gate_rejects_unknown_tool(self):
        with self.assertRaises(self.GateError):
            self.tool_gate("dangerous_tool")

    def test_param_gate_valid(self):
        # Should not raise
        self.param_gate("playwright_scraper", {"industry": "epoxy", "location": "tampa"})

    def test_param_gate_rejects_missing_params(self):
        with self.assertRaises(self.GateError):
            self.param_gate("playwright_scraper", {"task": "scrape"})  # missing industry, location

    def test_param_gate_rejects_missing_location(self):
        with self.assertRaises(self.GateError):
            self.param_gate("playwright_scraper", {"industry": "epoxy"})

    def test_plan_gate_valid(self):
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        step = self.PlanStep(tool="playwright_scraper", description="Scrape")
        plan = self.Plan(command=cmd, steps=[step])
        # Should not raise
        self.plan_gate(plan)

    def test_plan_gate_rejects_disallowed_tool(self):
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        step = self.PlanStep(tool="rm_rf", description="dangerous")
        plan = self.Plan(command=cmd, steps=[step])
        with self.assertRaises(self.GateError):
            self.plan_gate(plan)

    def test_allowed_tools_list(self):
        self.assertIn("playwright_scraper", self.ALLOWED_TOOLS)
        self.assertIn("email_generator", self.ALLOWED_TOOLS)
        self.assertIn("lead_analyzer", self.ALLOWED_TOOLS)
        self.assertIn("calendar_tool", self.ALLOWED_TOOLS)

    def test_run_all_gates_success(self):
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        step = self.PlanStep(tool="playwright_scraper", description="Scrape")
        cmd = self.Command(**cmd_dict)
        plan = self.Plan(command=cmd, steps=[step])
        result = self.run_all_gates(cmd_dict, plan)
        self.assertIsInstance(result, self.Command)

    def test_run_all_gates_blocked_by_tool(self):
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        step = self.PlanStep(tool="bad_tool", description="bad")
        cmd = self.Command(**cmd_dict)
        plan = self.Plan(command=cmd, steps=[step])
        with self.assertRaises(self.GateError):
            self.run_all_gates(cmd_dict, plan)

    def test_gate_error_has_gate_and_reason(self):
        with self.assertRaises(self.GateError) as ctx:
            self.tool_gate("evil_tool")
        err = ctx.exception
        self.assertEqual(err.gate, "tool_gate")
        self.assertIn("evil_tool", err.reason)


class TestPlanner(unittest.TestCase):
    """Tests for agent_core.planner."""

    def setUp(self):
        from agent_core.planner import plan_from_text, plan
        self.plan_from_text = plan_from_text
        self.plan = plan

    def test_basic_scrape_command(self):
        p = self.plan_from_text("scrape epoxy contractors tampa florida")
        self.assertEqual(p.command.industry, "epoxy")
        self.assertIn("tampa", p.command.location)
        self.assertTrue(len(p.steps) > 0)
        self.assertEqual(p.steps[0].tool, "playwright_scraper")

    def test_playwright_scraper_step_has_industry_and_location(self):
        p = self.plan_from_text("scrape epoxy contractors tampa")
        step = p.steps[0]
        self.assertEqual(step.tool, "playwright_scraper")
        self.assertIsNotNone(step.params)
        self.assertIn("industry", step.params)
        self.assertIn("location", step.params)
        self.assertEqual(step.params["industry"], "epoxy")
        self.assertIn("tampa", step.params["location"])

    def test_email_keyword_triggers_email_step(self):
        p = self.plan_from_text("find email for roofing contractors ohio")
        tools = [s.tool for s in p.steps]
        self.assertIn("email_generator", tools)

    def test_scrape_epoxy_tampa_demo_command(self):
        p = self.plan_from_text("scrape epoxy contractors tampa")
        self.assertEqual(p.command.industry, "epoxy")
        self.assertIn("tampa", p.command.location)

    def test_scrape_epoxy_orlando_demo_command(self):
        p = self.plan_from_text("scrape epoxy contractors orlando")
        self.assertEqual(p.command.industry, "epoxy")
        self.assertIn("orlando", p.command.location)

    def test_generate_outreach_emails_demo_command(self):
        p = self.plan_from_text("generate outreach emails")
        tools = [s.tool for s in p.steps]
        self.assertIn("email_generator", tools)

    def test_unknown_command_returns_default_steps(self):
        p = self.plan_from_text("xyz123 gibberish")
        self.assertTrue(len(p.steps) > 0)

    def test_plan_function_returns_plan(self):
        from agent_core.validator import Plan
        p = self.plan("scrape flooring leads chicago")
        self.assertIsInstance(p, Plan)

    def test_plan_steps_do_not_exceed_max(self):
        from agent_core.validator import MAX_PLAN_STEPS
        p = self.plan_from_text("scrape find search email schedule analyze rank")
        self.assertLessEqual(len(p.steps), MAX_PLAN_STEPS)


class TestExecutor(unittest.TestCase):
    """Tests for agent_core.executor."""

    def setUp(self):
        from agent_core.executor import Executor, register_tool
        from agent_core.planner import plan_from_text
        self.Executor = Executor
        self.register_tool = register_tool
        self.plan_from_text = plan_from_text

    def test_gate_blocks_disallowed_command(self):
        from agent_core.validator import Plan, PlanStep, Command
        executor = self.Executor()
        bad_cmd = {"task": "", "industry": "epoxy", "location": "tampa"}
        cmd = Command(task="scrape", industry="epoxy", location="tampa")
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(bad_cmd, plan)
        self.assertFalse(result.success)
        self.assertTrue(len(result.errors) > 0)

    def test_gate_blocks_disallowed_tool(self):
        from agent_core.validator import Plan, PlanStep, Command
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="evil_tool", description="evil")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        self.assertFalse(result.success)

    def test_custom_tool_handler_returns_leads(self):
        from agent_core.validator import Plan, PlanStep, Command
        # Register a mock scraper that returns leads
        self.register_tool("playwright_scraper", lambda p: {"leads_found": 10, "high_value": 3})
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        self.assertTrue(result.success)
        self.assertEqual(result.leads_found, 10)
        # Restore default stub
        from agent_core.executor import _default_playwright_scraper
        self.register_tool("playwright_scraper", _default_playwright_scraper)

    def test_retry_on_insufficient_leads(self):
        from agent_core.validator import Plan, PlanStep, Command
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        # Default stub returns 0 leads → retried must be True
        self.assertTrue(result.retried)

    def test_fallback_message_on_insufficient_leads(self):
        from agent_core.validator import Plan, PlanStep, Command
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        self.assertFalse(result.success)
        self.assertEqual(result.message, "Primary data source unavailable")

    def test_max_retries_constant(self):
        from agent_core.executor import MAX_RETRIES
        self.assertEqual(MAX_RETRIES, 3)

    def test_max_plan_steps_constant(self):
        from agent_core.executor import MAX_PLAN_STEPS
        self.assertEqual(MAX_PLAN_STEPS, 5)

    def test_max_execution_time_constant(self):
        from agent_core.executor import MAX_EXECUTION_TIME
        self.assertEqual(MAX_EXECUTION_TIME, 30)

    def test_sandbox_blocks_dangerous_params(self):
        from agent_core.executor import _sandbox_check
        with self.assertRaises(RuntimeError):
            _sandbox_check("playwright_scraper", {"cmd": "rm -rf /"})

    def test_sandbox_allows_safe_params(self):
        from agent_core.executor import _sandbox_check
        # Should not raise
        _sandbox_check("playwright_scraper", {"industry": "epoxy", "location": "tampa"})

    def test_planner_generated_plan_executes(self):
        """Planner-generated plan should have correct params and execute without param errors."""
        from agent_core.executor import register_tool, _default_playwright_scraper
        register_tool("playwright_scraper", lambda p: {"leads_found": 8, "high_value": 2})
        executor = self.Executor()
        plan = self.plan_from_text("scrape epoxy contractors tampa")
        raw_cmd = plan.command.model_dump()
        result = executor.execute(raw_cmd, plan)
        self.assertTrue(result.success)
        self.assertEqual(result.leads_found, 8)
        register_tool("playwright_scraper", _default_playwright_scraper)


class TestStateManager(unittest.TestCase):
    """Tests for agent_core.state_manager."""

    def setUp(self):
        from agent_core.state_manager import StateManager
        self.StateManager = StateManager

    def test_create_and_get(self):
        sm = self.StateManager()
        sm.create("run-001", {"status": "init"})
        state = sm.get("run-001")
        self.assertIsNotNone(state)
        self.assertEqual(state["status"], "init")

    def test_update(self):
        sm = self.StateManager()
        sm.create("run-002", {"status": "init"})
        sm.update("run-002", {"status": "completed", "leads_found": 7})
        state = sm.get("run-002")
        self.assertEqual(state["status"], "completed")
        self.assertEqual(state["leads_found"], 7)

    def test_get_nonexistent_returns_none(self):
        sm = self.StateManager()
        self.assertIsNone(sm.get("does-not-exist"))

    def test_all_runs(self):
        sm = self.StateManager()
        sm.create("run-003", {"status": "init"})
        sm.create("run-004", {"status": "init"})
        runs = sm.all_runs()
        self.assertIn("run-003", runs)
        self.assertIn("run-004", runs)

    def test_audit_log_written(self):
        """Audit log entry must contain all required fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            from agent_core import state_manager as sm_mod
            original_runs_file = sm_mod.RUNS_FILE
            tmp_log = os.path.join(tmpdir, "agent_runs.jsonl")
            sm_mod.RUNS_FILE = tmp_log
            try:
                sm = self.StateManager()
                sm.audit(
                    "audit-run-001",
                    command={"task": "scrape", "industry": "epoxy", "location": "tampa"},
                    plan={"steps": [{"tool": "playwright_scraper"}]},
                    tools_used=["playwright_scraper"],
                    results={"leads_found": 5},
                    errors=[],
                )
                with open(tmp_log) as f:
                    lines = [json.loads(line) for line in f if line.strip()]
                audit_entry = lines[-1]
                self.assertIn("timestamp", audit_entry)
                self.assertIn("run_id", audit_entry)
                self.assertIn("command", audit_entry)
                self.assertIn("plan", audit_entry)
                self.assertIn("tools_used", audit_entry)
                self.assertIn("results", audit_entry)
                self.assertIn("errors", audit_entry)
                self.assertEqual(audit_entry["run_id"], "audit-run-001")
            finally:
                sm_mod.RUNS_FILE = original_runs_file

    def test_log_is_append_only(self):
        """Multiple writes must not overwrite prior lines."""
        with tempfile.TemporaryDirectory() as tmpdir:
            from agent_core import state_manager as sm_mod
            original_runs_file = sm_mod.RUNS_FILE
            tmp_log = os.path.join(tmpdir, "agent_runs.jsonl")
            sm_mod.RUNS_FILE = tmp_log
            try:
                sm = self.StateManager()
                sm.create("run-log-01", {"status": "init"})
                sm.update("run-log-01", {"status": "completed"})
                with open(tmp_log) as f:
                    lines = [l for l in f if l.strip()]
                # Must have at least 2 entries (create + update)
                self.assertGreaterEqual(len(lines), 2)
            finally:
                sm_mod.RUNS_FILE = original_runs_file


class TestValidatePlan(unittest.TestCase):
    """Tests for agent_core.validator.validate_plan."""

    def setUp(self):
        from agent_core.validator import validate_plan, Command, Plan, PlanStep
        self.validate_plan = validate_plan
        self.Command = Command
        self.Plan = Plan
        self.PlanStep = PlanStep

    def test_valid_plan_no_violations(self):
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        step = self.PlanStep(tool="playwright_scraper", description="Scrape")
        plan = self.Plan(command=cmd, steps=[step])
        violations = self.validate_plan(plan, ["playwright_scraper"])
        self.assertEqual(violations, [])

    def test_validate_plan_catches_disallowed_tool(self):
        cmd = self.Command(task="scrape", industry="epoxy", location="tampa")
        step = self.PlanStep(tool="bad_tool", description="bad")
        plan = self.Plan(command=cmd, steps=[step])
        violations = self.validate_plan(plan, ["playwright_scraper"])
        self.assertTrue(len(violations) > 0)
        self.assertIn("bad_tool", violations[0])


class TestNormalizeCommandLength(unittest.TestCase):
    """Tests for command length enforcement in normalize_command."""

    def setUp(self):
        from agent_core.validator import normalize_command
        self.normalize_command = normalize_command

    def test_rejects_command_over_200_chars(self):
        long_cmd = "scrape " + "epoxy " * 40  # well over 200 chars
        with self.assertRaises(ValueError) as ctx:
            self.normalize_command(long_cmd)
        self.assertIn("200", str(ctx.exception))

    def test_accepts_command_at_200_chars(self):
        # Build a valid command that is exactly 200 characters
        base = "scrape epoxy "
        cmd = (base + "x" * (200 - len(base)))
        self.assertEqual(len(cmd), 200)
        # Should not raise (even if location extraction is odd)
        result = self.normalize_command(cmd)
        self.assertEqual(result["task"], "scrape")

    def test_accepts_normal_length_command(self):
        result = self.normalize_command("scrape epoxy contractors tampa")
        self.assertEqual(result["task"], "scrape")


class TestValidateResultValues(unittest.TestCase):
    """Tests for agent_core.validator.validate_result_values."""

    def setUp(self):
        from agent_core.validator import validate_result_values, ExecutionResult
        self.validate_result_values = validate_result_values
        self.ExecutionResult = ExecutionResult

    def test_valid_result_no_violations(self):
        result = self.ExecutionResult(success=True, leads_found=42, high_value=10)
        violations = self.validate_result_values(result)
        self.assertEqual(violations, [])

    def test_valid_result_zero_leads(self):
        result = self.ExecutionResult(success=False, leads_found=0, high_value=0)
        violations = self.validate_result_values(result)
        self.assertEqual(violations, [])

    def test_valid_result_max_leads(self):
        result = self.ExecutionResult(success=True, leads_found=1000, high_value=1000)
        violations = self.validate_result_values(result)
        self.assertEqual(violations, [])

    def test_rejects_leads_found_above_1000(self):
        result = self.ExecutionResult(success=True, leads_found=1001, high_value=0)
        violations = self.validate_result_values(result)
        self.assertTrue(len(violations) > 0)
        self.assertIn("leads_found", violations[0])
        self.assertIn("1001", violations[0])

    def test_rejects_high_value_exceeds_leads_found(self):
        result = self.ExecutionResult(success=True, leads_found=5, high_value=10)
        violations = self.validate_result_values(result)
        self.assertTrue(len(violations) > 0)
        self.assertIn("high_value", violations[0])

    def test_rejects_negative_leads_found(self):
        result = self.ExecutionResult(success=True, leads_found=-1, high_value=0)
        violations = self.validate_result_values(result)
        self.assertTrue(len(violations) > 0)

    def test_multiple_violations_reported(self):
        # leads_found < 0 AND high_value > leads_found
        result = self.ExecutionResult(success=True, leads_found=-5, high_value=10)
        violations = self.validate_result_values(result)
        self.assertGreaterEqual(len(violations), 1)


class TestResultValidationInExecutor(unittest.TestCase):
    """Tests that the executor enforces result validation before returning."""

    def setUp(self):
        from agent_core.executor import Executor, register_tool
        self.Executor = Executor
        self.register_tool = register_tool

    def tearDown(self):
        from agent_core.executor import _default_playwright_scraper
        self.register_tool("playwright_scraper", _default_playwright_scraper)

    def test_executor_rejects_leads_found_above_1000(self):
        from agent_core.validator import Plan, PlanStep, Command
        # Register a tool that returns invalid leads_found > 1000
        self.register_tool("playwright_scraper", lambda p: {"leads_found": 9999, "high_value": 0})
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        self.assertFalse(result.success)
        self.assertTrue(any("leads_found" in e or "Result validation" in e for e in result.errors))

    def test_executor_rejects_high_value_exceeds_leads_found(self):
        from agent_core.validator import Plan, PlanStep, Command
        # Register a tool that returns high_value > leads_found
        self.register_tool("playwright_scraper", lambda p: {"leads_found": 10, "high_value": 50})
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        self.assertFalse(result.success)
        self.assertTrue(any("high_value" in e or "Result validation" in e for e in result.errors))

    def test_executor_accepts_valid_result(self):
        from agent_core.validator import Plan, PlanStep, Command
        # Register a tool that returns valid results
        self.register_tool("playwright_scraper", lambda p: {"leads_found": 10, "high_value": 3})
        executor = self.Executor()
        cmd_dict = {"task": "scrape", "industry": "epoxy", "location": "tampa"}
        cmd = Command(**cmd_dict)
        step = PlanStep(tool="playwright_scraper", description="Scrape")
        plan = Plan(command=cmd, steps=[step])
        result = executor.execute(cmd_dict, plan)
        self.assertTrue(result.success)
        self.assertEqual(result.leads_found, 10)


if __name__ == "__main__":
    unittest.main()

