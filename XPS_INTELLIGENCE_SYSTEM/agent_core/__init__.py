"""
agent_core – Gated autonomous agent system for XPS Lead Intelligence Platform.

Pipeline: PLAN → VALIDATE → EXECUTE

Modules:
  planner        – converts natural language commands into structured plans
  validator      – Pydantic-based command / plan / result validation
  gates          – execution gates that must pass before tools run
  executor       – runs allowed tools after gates pass
  state_manager  – persists and retrieves agent run state
  api            – FastAPI server exposing POST /agent/run
"""

from .validator import Command, Plan, ExecutionResult, normalize_command  # noqa: F401
