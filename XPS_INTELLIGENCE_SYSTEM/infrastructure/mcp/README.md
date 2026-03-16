# MCP Infrastructure

This directory contains the Model Context Protocol (MCP) tool ecosystem for
the XPS Intelligence Tier-5 platform.

## Structure

```
infrastructure/mcp/
├── mcp.json          # MCP server registry (populated at runtime)
├── gateway/          # Central MCP gateway — routes tool requests
├── servers/          # Individual MCP tool server stubs
└── registry/         # Tool discovery and metadata registry
```

## Gateway

The MCP Gateway (`gateway/mcp_gateway.py`) is the single entry point for all
tool invocations. It:

- Routes requests to the correct MCP server
- Enforces security policies
- Manages credentials via environment variables
- Logs every tool call for auditability
- Exposes `/tools` for dynamic tool discovery

## Tool Categories

| Category | Description |
|----------|-------------|
| `github_tools` | Repository operations, PR management |
| `browser_tools` | Web browsing and scraping via Playwright |
| `scraping_tools` | Structured data extraction |
| `sandbox_tools` | Code execution in isolated containers |
| `memory_tools` | Agent memory read/write |
| `database_tools` | PostgreSQL and vector DB operations |
| `automation_tools` | Workflow and pipeline automation |

## Adding a New Tool Server

1. Create a new directory under `servers/<tool_name>/`
2. Implement `server.py` following the MCP protocol
3. Add an entry to `registry/tool_registry.json`
4. Register in `mcp.json` with the server path and capabilities

## Running

```bash
# Start gateway only
python -m infrastructure.mcp.gateway.mcp_gateway

# Start gateway + all registered servers
python -m infrastructure.mcp.gateway.mcp_gateway --start-all
```
