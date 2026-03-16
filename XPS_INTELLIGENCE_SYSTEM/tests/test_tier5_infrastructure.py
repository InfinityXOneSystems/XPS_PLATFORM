"""
tests/test_tier5_infrastructure.py
====================================
Tests for the Tier-5 bootstrap infrastructure.

Validates:
  - ReasoningGraph engine
  - InfinityLibrary knowledge store
  - ValidationEngine self-validation
  - MonitoringEngine health checks
  - SelfHealingEngine (dry-run)
  - SandboxExecutor
  - MCP registry loading
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ===========================================================================
# ReasoningGraph
# ===========================================================================

class TestReasoningGraph:
    def test_add_root_node(self):
        from reasoning_graph import ReasoningGraph, NodeStatus

        g = ReasoningGraph()
        nid = g.add_node("CEO_AGENT", "set_objective", {"objective": "test"})
        assert nid is not None
        node = g.get_node(nid)
        assert node.agent == "CEO_AGENT"
        assert node.task_type == "set_objective"
        assert node.status == NodeStatus.PENDING
        assert node.depth == 0

    def test_add_child_node(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        parent = g.add_node("CEO_AGENT", "set_objective", {})
        child = g.add_node("RESEARCH_AGENT", "research_market", {}, parent_id=parent)
        child_node = g.get_node(child)
        assert child_node.depth == 1
        assert child_node.parent_id == parent

    def test_complete_node(self):
        from reasoning_graph import ReasoningGraph, NodeStatus

        g = ReasoningGraph()
        nid = g.add_node("CEO_AGENT", "status", {})
        g.start_node(nid)
        g.complete_node(nid, result={"success": True})
        node = g.get_node(nid)
        assert node.status == NodeStatus.COMPLETED
        assert node.result == {"success": True}

    def test_fail_node(self):
        from reasoning_graph import ReasoningGraph, NodeStatus

        g = ReasoningGraph()
        nid = g.add_node("AGENT", "task", {})
        g.fail_node(nid, "something went wrong")
        node = g.get_node(nid)
        assert node.status == NodeStatus.FAILED
        assert node.error == "something went wrong"

    def test_cycle_detection(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        a = g.add_node("CEO_AGENT", "set_objective", {})
        b = g.add_node("RESEARCH_AGENT", "research_market", {}, parent_id=a)
        # Adding same agent+task combination already in ancestor chain should raise
        with pytest.raises(ValueError, match="loop"):
            g.add_node("CEO_AGENT", "set_objective", {}, parent_id=b)

    def test_max_depth_protection(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        g.MAX_DEPTH = 3  # lower limit for testing
        parent = g.add_node("AGENT_A", "task_a", {})
        parent = g.add_node("AGENT_B", "task_b", {}, parent_id=parent)
        parent = g.add_node("AGENT_C", "task_c", {}, parent_id=parent)
        parent = g.add_node("AGENT_D", "task_d", {}, parent_id=parent)
        with pytest.raises(RecursionError):
            g.add_node("AGENT_E", "task_e", {}, parent_id=parent)

    def test_summary(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        g.add_node("A", "task", {})
        s = g.summary()
        assert s["total_nodes"] == 1

    def test_visualise(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        nid = g.add_node("CEO_AGENT", "status", {})
        g.add_node("RESEARCH_AGENT", "research_market", {}, parent_id=nid)
        viz = g.visualise()
        assert "CEO_AGENT" in viz
        assert "RESEARCH_AGENT" in viz

    def test_to_dict(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        g.add_node("A", "task", {})
        d = g.to_dict()
        assert "graph_id" in d
        assert "nodes" in d
        assert len(d["nodes"]) == 1

    def test_get_path(self):
        from reasoning_graph import ReasoningGraph

        g = ReasoningGraph()
        a = g.add_node("A", "task", {})
        b = g.add_node("B", "task", {}, parent_id=a)
        c = g.add_node("C", "task", {}, parent_id=b)
        path = g.get_path(c)
        assert [n.agent for n in path] == ["A", "B", "C"]


# ===========================================================================
# InfinityLibrary
# ===========================================================================

class TestInfinityLibrary:
    def test_store_and_retrieve(self, tmp_path):
        from infinity_library import InfinityLibrary

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        lib.store("research", "key1", {"data": "value"})
        result = lib.retrieve("research", "key1")
        assert result == {"data": "value"}

    def test_retrieve_missing_returns_none(self, tmp_path):
        from infinity_library import InfinityLibrary

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        assert lib.retrieve("research", "nonexistent") is None

    def test_search(self, tmp_path):
        from infinity_library import InfinityLibrary

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        lib.store("research", "flooring_trends", {"text": "flooring market growing"})
        lib.store("research", "construction_news", {"text": "construction declined"})
        results = lib.search("flooring", namespace="research")
        assert any("flooring" in r["key"] for r in results)

    def test_delete(self, tmp_path):
        from infinity_library import InfinityLibrary

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        lib.store("research", "temp", "value")
        assert lib.retrieve("research", "temp") == "value"
        lib.delete("research", "temp")
        assert lib.retrieve("research", "temp") is None

    def test_persistence(self, tmp_path):
        from infinity_library import InfinityLibrary

        path = tmp_path / "library.json"
        lib1 = InfinityLibrary(storage_path=path)
        lib1.store("general", "key", "persistent_value")

        lib2 = InfinityLibrary(storage_path=path)
        assert lib2.retrieve("general", "key") == "persistent_value"

    def test_stats(self, tmp_path):
        from infinity_library import InfinityLibrary

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        lib.store("research", "k1", "v")
        lib.store("general", "k2", "v")
        stats = lib.stats()
        assert stats["total_entries"] == 2

    def test_list_namespaces(self, tmp_path):
        from infinity_library import InfinityLibrary, NAMESPACES

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        ns = lib.list_namespaces()
        assert set(ns) == set(NAMESPACES)

    def test_update_existing_entry(self, tmp_path):
        from infinity_library import InfinityLibrary

        lib = InfinityLibrary(storage_path=tmp_path / "library.json")
        lib.store("general", "key", "original")
        lib.store("general", "key", "updated")
        assert lib.retrieve("general", "key") == "updated"


# ===========================================================================
# ValidationEngine
# ===========================================================================

class TestValidationEngine:
    def test_run_returns_report(self):
        from validation_engine import ValidationEngine

        engine = ValidationEngine()
        report = engine.run()
        assert hasattr(report, "results")
        assert hasattr(report, "passed")
        assert len(report.results) > 0

    def test_report_has_summary(self):
        from validation_engine import ValidationEngine

        engine = ValidationEngine()
        report = engine.run()
        summary = report.summary()
        assert "passed" in summary
        assert "total_checks" in summary
        assert "error_count" in summary

    def test_report_to_dict(self):
        from validation_engine import ValidationEngine

        engine = ValidationEngine()
        report = engine.run()
        d = report.to_dict()
        assert "summary" in d
        assert "results" in d
        assert isinstance(d["results"], list)

    def test_mcp_registry_check(self, monkeypatch):
        """MCP registry check should pass when registry file exists."""
        from validation_engine import ValidationEngine

        engine = ValidationEngine()
        # The registry should be present in the bootstrapped repo
        result = engine._check_mcp_registry()
        # If registry exists, it should pass; if not, it should be a warning
        assert result.check_name == "mcp_registry"

    def test_leads_data_check(self):
        from validation_engine import ValidationEngine

        engine = ValidationEngine()
        result = engine._check_leads_data()
        assert result.check_name == "leads_data"


# ===========================================================================
# SandboxExecutor
# ===========================================================================

class TestSandboxExecutor:
    def test_run_python_hello(self):
        from sandbox.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(enable_guard=False)
        result = executor.run_python("print('hello sandbox')")
        assert result.success
        assert "hello sandbox" in result.stdout

    def test_run_python_guard_blocks_forbidden(self):
        from sandbox.sandbox_executor import SandboxExecutor, SandboxViolationError

        executor = SandboxExecutor(enable_guard=True)
        with pytest.raises(SandboxViolationError):
            executor.run_python("import os\nprint(os.getcwd())")

    def test_run_python_timeout(self):
        from sandbox.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(timeout_s=1, enable_guard=False)
        result = executor.run_python("import time\ntime.sleep(10)")
        assert result.timed_out
        assert not result.success

    def test_result_to_dict(self):
        from sandbox.sandbox_executor import SandboxExecutor

        executor = SandboxExecutor(enable_guard=False)
        result = executor.run_python("x = 1 + 1")
        d = result.to_dict()
        assert "success" in d
        assert "exit_code" in d
        assert "duration_ms" in d


# ===========================================================================
# MCP Registry
# ===========================================================================

class TestMCPRegistry:
    def test_registry_json_valid(self):
        path = Path("infrastructure/mcp/registry/tool_registry.json")
        assert path.exists(), "tool_registry.json not found"
        with open(path) as fh:
            registry = json.load(fh)
        assert "tools" in registry
        assert "categories" in registry
        assert len(registry["tools"]) > 0

    def test_mcp_json_valid(self):
        path = Path("infrastructure/mcp/mcp.json")
        assert path.exists(), "mcp.json not found"
        with open(path) as fh:
            config = json.load(fh)
        assert "mcpServers" in config

    def test_registry_module(self):
        from infrastructure.mcp.registry import list_tools, list_categories, find_tool

        tools = list_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0

        categories = list_categories()
        assert isinstance(categories, dict)

        tool = find_tool("sandbox_run_python")
        assert tool is not None
        assert tool["name"] == "sandbox_run_python"

    def test_find_missing_tool_returns_none(self):
        from infrastructure.mcp.registry import find_tool

        assert find_tool("nonexistent_tool_xyz") is None

    def test_gateway_list_tools(self):
        from infrastructure.mcp.gateway.mcp_gateway import MCPGateway

        gateway = MCPGateway()
        tools = gateway.list_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0

    def test_gateway_call_builtin_tool(self):
        from infrastructure.mcp.gateway.mcp_gateway import MCPGateway

        gateway = MCPGateway()
        result = gateway.call_tool("memory_store", {
            "namespace": "test",
            "key": "testkey",
            "value": "testvalue",
        })
        assert result["status"] == "success"

    def test_gateway_call_missing_tool(self):
        from infrastructure.mcp.gateway.mcp_gateway import MCPGateway

        gateway = MCPGateway()
        with pytest.raises(KeyError):
            gateway.call_tool("nonexistent_tool", {})

    def test_gateway_call_missing_params(self):
        from infrastructure.mcp.gateway.mcp_gateway import MCPGateway

        gateway = MCPGateway()
        with pytest.raises(ValueError):
            gateway.call_tool("memory_store", {})  # missing required params


# ===========================================================================
# MonitoringEngine
# ===========================================================================

class TestMonitoringEngine:
    def test_check_all_returns_report(self):
        from monitoring_engine import MonitoringEngine

        engine = MonitoringEngine(services=[])
        report = engine.check_all()
        assert "timestamp" in report
        assert "healthy" in report
        assert "services" in report

    def test_check_all_no_services(self):
        from monitoring_engine import MonitoringEngine

        # Pass an explicit non-empty list; use a placeholder that will be unreachable
        engine = MonitoringEngine(services=[{"name": "test_svc", "url": "http://nonexistent.local/health"}])
        report = engine.check_all()
        assert report["services_total"] == 1
        assert report["healthy"] is False  # unreachable service

    def test_get_metrics(self):
        from monitoring_engine import MonitoringEngine

        engine = MonitoringEngine(services=[])
        metrics = engine.get_metrics()
        assert "xps_services_total" in metrics
        assert "xps_services_healthy" in metrics


# ===========================================================================
# SelfHealingEngine
# ===========================================================================

class TestSelfHealingEngine:
    def test_heal_healthy_report(self):
        from self_healing_engine import SelfHealingEngine

        engine = SelfHealingEngine(dry_run=True)
        report = {
            "healthy": True,
            "services": [{"name": "backend", "healthy": True}],
        }
        actions = engine.heal(report)
        assert len(actions) == 0

    def test_heal_dry_run(self):
        from self_healing_engine import SelfHealingEngine

        engine = SelfHealingEngine(dry_run=True)
        report = {
            "healthy": False,
            "services": [{"name": "backend", "healthy": False}],
        }
        actions = engine.heal(report)
        assert len(actions) == 1
        assert actions[0].service == "backend"
        assert actions[0].success is True  # dry run always succeeds

    def test_diagnose(self):
        from self_healing_engine import SelfHealingEngine

        engine = SelfHealingEngine(dry_run=True)
        diag = engine.diagnose()
        assert "total_healing_actions" in diag
        assert "restart_counts" in diag

    def test_max_restart_attempts(self):
        from self_healing_engine import SelfHealingEngine

        engine = SelfHealingEngine(dry_run=True, max_restart_attempts=1)
        # Bypass cooldown by setting last_restart to old time
        engine._last_restart["backend"] = 0.0
        engine._restart_counts["backend"] = 1  # already at max

        report = {"healthy": False, "services": [{"name": "backend", "healthy": False}]}
        actions = engine.heal(report)
        # Should escalate instead of restart
        assert any(a.action == "escalate" for a in actions)
