"""
reasoning_graph/reasoning_graph.py
====================================
Reasoning Graph Engine — Tracks agent decisions, coordinates workflows,
prevents infinite loops, and logs reasoning paths.

All agent tasks pass through this graph before execution.

Architecture:
  - Each task creates a Node in the graph
  - Nodes are connected by directed edges (dependency / causation)
  - Loop detection prevents cyclic execution
  - The graph is persisted in memory and optionally to disk

Usage::

    graph = ReasoningGraph()
    node_id = graph.add_node("CEO_AGENT", "set_objective", {"objective": "expand"})
    child_id = graph.add_node("RESEARCH_AGENT", "research_market", {}, parent_id=node_id)
    graph.complete_node(child_id, result={"success": True})
    graph.visualise()
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from enum import Enum
from pathlib import Path
from threading import Lock, RLock
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class NodeStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ReasoningNode:
    """A single step in the reasoning graph."""

    def __init__(
        self,
        node_id: str,
        agent: str,
        task_type: str,
        payload: Dict[str, Any],
        parent_id: Optional[str] = None,
    ) -> None:
        self.node_id = node_id
        self.agent = agent
        self.task_type = task_type
        self.payload = payload
        self.parent_id = parent_id
        self.children: List[str] = []
        self.status = NodeStatus.PENDING
        self.result: Optional[Any] = None
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.depth: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "agent": self.agent,
            "task_type": self.task_type,
            "payload": self.payload,
            "parent_id": self.parent_id,
            "children": self.children,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "depth": self.depth,
        }


class ReasoningGraph:
    """
    Directed acyclic graph tracking agent reasoning and decisions.

    Features:
      - Loop detection (prevents infinite agent cycles)
      - Depth limiting (configurable max depth)
      - Full audit trail of every decision
      - JSON export for analysis
    """

    MAX_DEPTH = 20  # Prevent runaway recursion
    MAX_NODES = 10_000  # Circuit breaker for graph size

    def __init__(self, graph_id: Optional[str] = None) -> None:
        self.graph_id = graph_id or str(uuid.uuid4())
        self._nodes: Dict[str, ReasoningNode] = {}
        self._roots: List[str] = []
        self._lock = RLock()  # Re-entrant: allows nested acquisition by same thread
        logger.info("[ReasoningGraph] Initialised — graph_id=%s", self.graph_id)

    # ------------------------------------------------------------------
    # Node management
    # ------------------------------------------------------------------

    def add_node(
        self,
        agent: str,
        task_type: str,
        payload: Dict[str, Any],
        parent_id: Optional[str] = None,
    ) -> str:
        """Add a new reasoning node. Returns the node_id."""
        with self._lock:
            if len(self._nodes) >= self.MAX_NODES:
                raise RuntimeError(
                    f"ReasoningGraph exceeded MAX_NODES={self.MAX_NODES}. "
                    "Possible infinite loop detected."
                )

            node_id = str(uuid.uuid4())
            node = ReasoningNode(node_id, agent, task_type, payload, parent_id)

            if parent_id:
                if parent_id not in self._nodes:
                    raise KeyError(f"Parent node '{parent_id}' not found in graph")

                parent = self._nodes[parent_id]

                # Loop detection: check if same agent+task_type already in ancestor chain
                if self._would_create_loop(parent_id, agent, task_type):
                    raise ValueError(
                        f"Adding node would create a reasoning loop: {agent}/{task_type} "
                        f"already in ancestor chain"
                    )

                node.depth = parent.depth + 1
                if node.depth > self.MAX_DEPTH:
                    raise RecursionError(
                        f"ReasoningGraph MAX_DEPTH={self.MAX_DEPTH} exceeded. "
                        f"Agent chain: {self._ancestor_chain(parent_id)}"
                    )

                parent.children.append(node_id)
            else:
                self._roots.append(node_id)

            self._nodes[node_id] = node
            logger.debug(
                "[ReasoningGraph] Node added — id=%s agent=%s task=%s depth=%d",
                node_id, agent, task_type, node.depth,
            )
            return node_id

    def start_node(self, node_id: str) -> None:
        """Mark a node as running."""
        with self._lock:
            node = self._get(node_id)
            node.status = NodeStatus.RUNNING
            node.started_at = time.time()

    def complete_node(self, node_id: str, result: Any = None) -> None:
        """Mark a node as completed with an optional result."""
        with self._lock:
            node = self._get(node_id)
            node.status = NodeStatus.COMPLETED
            node.result = result
            node.completed_at = time.time()

    def fail_node(self, node_id: str, error: str) -> None:
        """Mark a node as failed."""
        with self._lock:
            node = self._get(node_id)
            node.status = NodeStatus.FAILED
            node.error = error
            node.completed_at = time.time()

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_node(self, node_id: str) -> ReasoningNode:
        with self._lock:
            return self._get(node_id)

    def get_path(self, node_id: str) -> List[ReasoningNode]:
        """Return the ancestor path from root to this node."""
        path: List[ReasoningNode] = []
        current_id: Optional[str] = node_id
        while current_id:
            node = self._nodes.get(current_id)
            if node is None:
                break
            path.insert(0, node)
            current_id = node.parent_id
        return path

    def get_pending_nodes(self) -> List[ReasoningNode]:
        return [n for n in self._nodes.values() if n.status == NodeStatus.PENDING]

    def get_failed_nodes(self) -> List[ReasoningNode]:
        return [n for n in self._nodes.values() if n.status == NodeStatus.FAILED]

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            counts = {s.value: 0 for s in NodeStatus}
            for node in self._nodes.values():
                counts[node.status.value] += 1
            return {
                "graph_id": self.graph_id,
                "total_nodes": len(self._nodes),
                "root_count": len(self._roots),
                "status_counts": counts,
            }

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "graph_id": self.graph_id,
                "nodes": {nid: n.to_dict() for nid, n in self._nodes.items()},
                "roots": self._roots,
                "summary": self.summary(),
            }

    def save(self, path: str) -> None:
        """Persist graph to a JSON file."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as fh:
            json.dump(self.to_dict(), fh, indent=2)
        logger.info("[ReasoningGraph] Saved to %s", path)

    def visualise(self) -> str:
        """Return a simple ASCII tree of the graph."""
        lines: List[str] = [f"ReasoningGraph [{self.graph_id[:8]}...]"]
        for root_id in self._roots:
            self._render_node(root_id, lines, prefix="")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get(self, node_id: str) -> ReasoningNode:
        node = self._nodes.get(node_id)
        if node is None:
            raise KeyError(f"Node '{node_id}' not found in ReasoningGraph")
        return node

    def _would_create_loop(self, parent_id: str, agent: str, task_type: str) -> bool:
        """Check if adding this agent+task_type as child of parent_id would create a loop."""
        current: Optional[str] = parent_id
        while current:
            node = self._nodes.get(current)
            if node is None:
                break
            if node.agent == agent and node.task_type == task_type:
                return True
            current = node.parent_id
        return False

    def _would_create_cycle(self, parent_id: str, new_id: str) -> bool:
        """Legacy: check if new_id is already an ancestor of parent_id."""
        visited = set()
        current: Optional[str] = parent_id
        while current:
            if current == new_id:
                return True
            if current in visited:
                return True
            visited.add(current)
            node = self._nodes.get(current)
            current = node.parent_id if node else None
        return False

    def _ancestor_chain(self, node_id: str) -> str:
        """Return a readable string of the ancestor agent chain."""
        parts: List[str] = []
        current: Optional[str] = node_id
        while current:
            node = self._nodes.get(current)
            if node is None:
                break
            parts.insert(0, f"{node.agent}/{node.task_type}")
            current = node.parent_id
        return " → ".join(parts)

    def _render_node(self, node_id: str, lines: List[str], prefix: str) -> None:
        node = self._nodes.get(node_id)
        if node is None:
            return
        marker = "✓" if node.status == NodeStatus.COMPLETED else (
            "✗" if node.status == NodeStatus.FAILED else "○"
        )
        lines.append(f"{prefix}[{marker}] {node.agent}/{node.task_type} ({node.node_id[:8]})")
        for child_id in node.children:
            self._render_node(child_id, lines, prefix=prefix + "  ")
