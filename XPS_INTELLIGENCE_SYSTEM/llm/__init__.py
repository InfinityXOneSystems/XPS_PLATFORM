"""
LLM layer – smart router, Groq client, and Ollama client.

Primary entry points:
  from llm.llm_router import complete, stream_complete, router_status
  from llm.groq_client import complete as groq_complete
  from llm.ollama_client import complete as ollama_complete
"""

from llm.llm_router import complete, stream_complete, router_status  # noqa: F401
