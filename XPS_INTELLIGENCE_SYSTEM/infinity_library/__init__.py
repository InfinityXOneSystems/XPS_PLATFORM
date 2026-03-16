from __future__ import annotations

"""
infinity_library
Persistent knowledge repository for the XPS Intelligence platform.

Stores scraped intelligence, invention ideas, research insights,
experiment results, and generated documents with keyword search
and structured metadata support.
"""

from .library import InfinityLibrary, LibraryEntry, NAMESPACES
from .experiment_tracker import ExperimentTracker
from .knowledge_graph import KnowledgeGraph

__all__ = ["InfinityLibrary", "LibraryEntry", "NAMESPACES", "ExperimentTracker", "KnowledgeGraph"]
