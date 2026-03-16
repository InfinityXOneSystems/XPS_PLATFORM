"""
runtime – XPS Intelligence Platform runtime architecture.

Modules:
  runtime_controller  – central orchestration and command routing
  task_dispatcher     – dispatch tasks to the worker pool
  worker_pool         – async distributed worker execution
  observability       – metrics, tracing, agent logs, health endpoint
  fault_tolerance     – circuit breakers, retry policies, worker recovery
  sandbox_executor    – enforce sandbox execution for all agents
"""
