# MCP Tool Servers

Each subdirectory is an isolated MCP tool server. Servers follow a common
interface and are registered in the parent `registry/tool_registry.json`.

## Server Contract

Every server must expose:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness check |
| `/tools` | GET | List tools this server provides |
| `/call` | POST | Execute a tool call |

## Current Servers

| Server | Status | Description |
|--------|--------|-------------|
| `github/` | Stub | GitHub API operations |
| `browser/` | Stub | Playwright browser automation |
| `sandbox/` | Stub | Isolated code execution |
| `memory/` | Stub | Agent memory store |
| `database/` | Stub | DB read/write operations |

## Adding a New Server

1. Create `servers/<name>/server.py`
2. Implement the three required endpoints
3. Add tool definitions to `registry/tool_registry.json`
4. Update `mcp.json` with the server address
