"""
infinity_library/knowledge_graph.py
=====================================
Simple knowledge graph tracking relationships between concepts,
ideas, and entities discovered by the platform.

Nodes represent concepts, entities, or ideas.
Edges represent named relationships between them.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class KnowledgeGraph:
    """In-memory knowledge graph with optional JSON persistence."""

    def __init__(self) -> None:
        # {node_id: {"id": ..., "label": ..., "properties": {...}}}
        self._nodes: Dict[str, dict] = {}
        # list of {"from": id, "to": id, "relationship": str}
        self._edges: List[dict] = []

    # ------------------------------------------------------------------
    # Node operations
    # ------------------------------------------------------------------

    def add_node(
        self,
        node_id: str,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add or update a node in the graph."""
        if node_id in self._nodes:
            self._nodes[node_id]["label"] = label
            self._nodes[node_id]["properties"].update(properties or {})
        else:
            self._nodes[node_id] = {
                "id": node_id,
                "label": label,
                "properties": properties or {},
            }

    def add_edge(
        self,
        from_id: str,
        to_id: str,
        relationship: str,
    ) -> None:
        """Add a directed edge between two nodes.

        Auto-creates stub nodes if either endpoint does not exist.
        """
        for nid in (from_id, to_id):
            if nid not in self._nodes:
                logger.debug("Auto-creating stub node '%s'", nid)
                self._nodes[nid] = {"id": nid, "label": nid, "properties": {}}

        # Avoid exact duplicate edges
        for edge in self._edges:
            if (
                edge["from"] == from_id
                and edge["to"] == to_id
                and edge["relationship"] == relationship
            ):
                return

        self._edges.append(
            {"from": from_id, "to": to_id, "relationship": relationship}
        )

    # ------------------------------------------------------------------
    # Query operations
    # ------------------------------------------------------------------

    def get_related(self, node_id: str, depth: int = 1) -> List[dict]:
        """Return nodes reachable from *node_id* up to *depth* hops away.

        Each result includes the node data and the path taken to reach it.
        """
        if node_id not in self._nodes:
            return []

        visited: Set[str] = {node_id}
        frontier: List[tuple[str, int, List[str]]] = [(node_id, 0, [])]
        results: List[dict] = []

        while frontier:
            current_id, current_depth, path = frontier.pop(0)
            if current_depth >= depth:
                continue

            for edge in self._edges:
                if edge["from"] == current_id and edge["to"] not in visited:
                    neighbour_id = edge["to"]
                    visited.add(neighbour_id)
                    new_path = path + [edge["relationship"]]
                    results.append(
                        {
                            "node": self._nodes[neighbour_id],
                            "relationship": edge["relationship"],
                            "path": new_path,
                            "depth": current_depth + 1,
                        }
                    )
                    frontier.append((neighbour_id, current_depth + 1, new_path))

                elif edge["to"] == current_id and edge["from"] not in visited:
                    neighbour_id = edge["from"]
                    visited.add(neighbour_id)
                    new_path = path + [f"<-{edge['relationship']}"]
                    results.append(
                        {
                            "node": self._nodes[neighbour_id],
                            "relationship": f"<-{edge['relationship']}",
                            "path": new_path,
                            "depth": current_depth + 1,
                        }
                    )
                    frontier.append((neighbour_id, current_depth + 1, new_path))

        return results

    def search_nodes(self, query: str) -> List[dict]:
        """Return nodes whose id, label, or property values match *query*."""
        tokens = query.lower().split()
        results: List[dict] = []
        for node in self._nodes.values():
            haystack = " ".join(
                [node.get("id", ""), node.get("label", "")]
                + [str(v) for v in node.get("properties", {}).values()]
            ).lower()
            if all(tok in haystack for tok in tokens):
                results.append(node)
        return results

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Serialize the entire graph to a plain dict."""
        return {
            "nodes": list(self._nodes.values()),
            "edges": list(self._edges),
        }

    def save(self, path: str | Path) -> None:
        """Persist the graph to a JSON file."""
        dest = Path(path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            dest.write_text(
                json.dumps(self.to_dict(), indent=2, default=str), encoding="utf-8"
            )
            logger.info("Knowledge graph saved to %s", dest)
        except Exception as exc:
            logger.error("Failed to save knowledge graph: %s", exc)

    def load(self, path: str | Path) -> None:
        """Load graph state from a JSON file, merging into current graph."""
        src = Path(path)
        if not src.exists():
            logger.warning("Knowledge graph file not found: %s", src)
            return
        try:
            data = json.loads(src.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error("Failed to load knowledge graph from %s: %s", src, exc)
            return

        for node in data.get("nodes", []):
            self._nodes[node["id"]] = node

        existing_edges = {
            (e["from"], e["to"], e["relationship"]) for e in self._edges
        }
        for edge in data.get("edges", []):
            key = (edge["from"], edge["to"], edge["relationship"])
            if key not in existing_edges:
                self._edges.append(edge)
                existing_edges.add(key)

        logger.info(
            "Knowledge graph loaded from %s (%d nodes, %d edges)",
            src,
            len(self._nodes),
            len(self._edges),
        )
