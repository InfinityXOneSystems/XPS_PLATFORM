"""
memory/memory_manager.py
========================
Persistent memory layer for the XPS Intelligence Platform.

Architecture::

    Redis   → short-term (session) memory
    Qdrant  → vector embeddings for semantic recall
    Postgres→ structured long-term storage

Each backend is optional; the manager gracefully falls back to
in-process storage when external services are unavailable.

Environment variables:
  REDIS_URL       – redis:// URL (default: redis://localhost:6379/0)
  QDRANT_URL      – Qdrant HTTP URL (default: http://localhost:6333)
  DATABASE_URL    – Postgres DSN (default: postgresql://localhost/xps)
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/xps")

_COLLECTION = "xps_memory"
_VECTOR_DIM = 384  # sentence-transformers all-MiniLM-L6-v2 default


# ---------------------------------------------------------------------------
# In-process fallback stores
# ---------------------------------------------------------------------------

_LOCAL_KV: dict[str, str] = {}
_LOCAL_DOCS: list[dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------


def _get_redis():
    try:
        import redis  # type: ignore

        c = redis.from_url(REDIS_URL, socket_timeout=3, socket_connect_timeout=3)
        c.ping()
        return c
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Embedding helper (lightweight fallback)
# ---------------------------------------------------------------------------


def _embed(text: str) -> list[float]:
    """
    Return an embedding vector for *text*.

    Uses sentence-transformers when available; falls back to a
    simple character-frequency vector so the system can run without
    heavy ML dependencies.
    """
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        model = SentenceTransformer("all-MiniLM-L6-v2")
        vec = model.encode(text, normalize_embeddings=True).tolist()
        return vec
    except Exception:
        pass

    # Minimal fallback: 384-dim vector with hash-based distribution across all dimensions
    vec = [0.0] * _VECTOR_DIM
    for i, ch in enumerate(text):
        # Distribute across all dimensions using multiple hash positions
        idx1 = (i * 31 + ord(ch)) % _VECTOR_DIM
        idx2 = (i * 37 + ord(ch) * 7) % _VECTOR_DIM
        idx3 = (i * 41 + ord(ch) * 13) % _VECTOR_DIM
        vec[idx1] += ord(ch) / 1000.0
        vec[idx2] += ord(ch) / 2000.0
        vec[idx3] += ord(ch) / 3000.0
    mag = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / mag for v in vec]


# ---------------------------------------------------------------------------
# MemoryManager
# ---------------------------------------------------------------------------


class MemoryManager:
    """
    Unified interface for all memory backends.

    Short-term (Redis)::

        mgr.set("last_command", "scrape epoxy orlando")
        mgr.get("last_command")  # → "scrape epoxy orlando"

    Vector search (Qdrant)::

        mgr.remember("User asked to scrape epoxy companies in Tampa")
        results = mgr.recall("epoxy companies")

    Structured (Postgres)::

        mgr.save_lead({"company_name": "Epoxy Pros", ...})
    """

    def __init__(self) -> None:
        self._redis = _get_redis()
        self._qdrant = self._init_qdrant()
        self._pg = self._init_postgres()

    # ------------------------------------------------------------------
    # Qdrant setup
    # ------------------------------------------------------------------

    def _init_qdrant(self):
        try:
            from qdrant_client import QdrantClient  # type: ignore
            from qdrant_client.models import Distance, VectorParams  # type: ignore

            client = QdrantClient(url=QDRANT_URL, timeout=5)
            collections = [c.name for c in client.get_collections().collections]
            if _COLLECTION not in collections:
                client.create_collection(
                    _COLLECTION,
                    vectors_config=VectorParams(size=_VECTOR_DIM, distance=Distance.COSINE),
                )
            return client
        except Exception as exc:
            logger.debug("Qdrant unavailable: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Postgres setup
    # ------------------------------------------------------------------

    def _init_postgres(self):
        try:
            import psycopg2  # type: ignore

            conn = psycopg2.connect(DATABASE_URL, connect_timeout=3)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS xps_memory (
                        id TEXT PRIMARY KEY,
                        key TEXT,
                        value TEXT,
                        created_at DOUBLE PRECISION
                    );
                    """
                )
            conn.commit()
            return conn
        except Exception as exc:
            logger.debug("Postgres unavailable: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Short-term (Redis) KV
    # ------------------------------------------------------------------

    def set(self, key: str, value: str, ttl: int = 3600) -> None:
        """Store a key-value pair in short-term memory."""
        if self._redis:
            try:
                self._redis.setex(key, ttl, value)
                return
            except Exception:
                pass
        _LOCAL_KV[key] = value

    def get(self, key: str) -> str | None:
        """Retrieve a value from short-term memory."""
        if self._redis:
            try:
                val = self._redis.get(key)
                return val.decode() if val else None
            except Exception:
                pass
        return _LOCAL_KV.get(key)

    def delete(self, key: str) -> None:
        """Delete a key from short-term memory."""
        if self._redis:
            try:
                self._redis.delete(key)
                return
            except Exception:
                pass
        _LOCAL_KV.pop(key, None)

    # ------------------------------------------------------------------
    # Vector memory (Qdrant)
    # ------------------------------------------------------------------

    def remember(self, text: str, metadata: dict[str, Any] | None = None) -> str:
        """
        Store *text* as a vector embedding in long-term memory.

        :returns: The ID assigned to this memory.
        """
        doc_id = str(uuid.uuid4())
        vec = _embed(text)
        payload = {"text": text, "created_at": time.time(), **(metadata or {})}

        if self._qdrant:
            try:
                from qdrant_client.models import PointStruct  # type: ignore

                self._qdrant.upsert(
                    collection_name=_COLLECTION,
                    points=[PointStruct(id=doc_id, vector=vec, payload=payload)],
                )
                return doc_id
            except Exception as exc:
                logger.debug("Qdrant upsert failed: %s", exc)

        _LOCAL_DOCS.append({"id": doc_id, "text": text, "vec": vec, **payload})
        return doc_id

    def recall(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """
        Semantic search over stored memories.

        :returns: List of matching memory dicts sorted by relevance.
        """
        vec = _embed(query)

        if self._qdrant:
            try:
                hits = self._qdrant.search(
                    collection_name=_COLLECTION,
                    query_vector=vec,
                    limit=top_k,
                )
                return [{"id": h.id, "score": h.score, **h.payload} for h in hits]
            except Exception as exc:
                logger.debug("Qdrant search failed: %s", exc)

        # Cosine similarity fallback on in-process store
        def cosine(a: list[float], b: list[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b))
            na = sum(x * x for x in a) ** 0.5
            nb = sum(x * x for x in b) ** 0.5
            return dot / (na * nb) if na * nb else 0.0

        scored = [
            {**doc, "score": cosine(vec, doc["vec"])}
            for doc in _LOCAL_DOCS
        ]
        scored.sort(key=lambda d: d["score"], reverse=True)
        return scored[:top_k]

    # ------------------------------------------------------------------
    # Structured storage (Postgres)
    # ------------------------------------------------------------------

    def save_lead(self, lead: dict[str, Any]) -> None:
        """Persist a lead dict to Postgres."""
        if self._pg:
            try:
                lead_id = lead.get("id", str(uuid.uuid4()))
                with self._pg.cursor() as cur:
                    cur.execute(
                        "INSERT INTO xps_memory (id, key, value, created_at) VALUES (%s, %s, %s, %s) "
                        "ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value",
                        (lead_id, "lead", json.dumps(lead), time.time()),
                    )
                self._pg.commit()
                return
            except Exception as exc:
                logger.debug("Postgres save_lead failed: %s", exc)
        # Fallback: store as a short-term KV entry
        self.set(f"lead:{lead.get('company_name', uuid.uuid4())}", json.dumps(lead))

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        redis_ok = False
        qdrant_ok = False
        pg_ok = False

        if self._redis:
            try:
                self._redis.ping()
                redis_ok = True
            except Exception:
                pass

        if self._qdrant:
            try:
                self._qdrant.get_collections()
                qdrant_ok = True
            except Exception:
                pass

        if self._pg:
            try:
                self._pg.cursor().execute("SELECT 1")
                pg_ok = True
            except Exception:
                pass

        return {
            "redis": redis_ok,
            "qdrant": qdrant_ok,
            "postgres": pg_ok,
            "local_docs": len(_LOCAL_DOCS),
        }
