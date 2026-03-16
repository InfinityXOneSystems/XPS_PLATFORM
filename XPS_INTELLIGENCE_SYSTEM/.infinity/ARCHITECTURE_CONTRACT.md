# XPS PLATFORM ARCHITECTURE CONTRACT

All agents, contributors, and AI coding systems must follow this architecture.

## Runtime Model

Frontend → Gateway → FastAPI Agent Core → Runtime Controller → Workers

## Mandatory Components

runtime_controller
sandbox_runtime
agent_dispatcher
observability
resilience

## Safety

All generated code must run inside sandbox.

## Scaling

Workers must run through Redis queue.

## LLM Layer

Groq
Ollama

## Scraping Layer

Playwright headless agents

## Autonomous Dev Layer

Agents capable of:

- creating repositories
- generating services
- generating CI pipelines
- building APIs
- building UI systems

## SEO Agents

keyword discovery
SERP scraping
competitor analysis
content optimization

## Social Agents

post creation
comment response
ad campaign creation
engagement analysis

## Sandbox

All code generation must execute inside container sandbox.
