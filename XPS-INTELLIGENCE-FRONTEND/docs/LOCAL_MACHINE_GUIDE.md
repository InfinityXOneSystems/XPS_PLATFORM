# Local Machine Access Guide

XPS Intelligence can control your local machine through the MCP (Machine Control Protocol) backend.

## Setup

1. Ensure the XPS Intelligence backend is running
2. Navigate to **Sandbox** page to access machine controls

## Features

### Command Executor
Run shell commands directly from the UI:
- Type commands in the terminal input
- Use arrow keys for command history
- Quick-access common commands
- Copy output to clipboard

### System Monitor
Real-time system metrics:
- CPU usage
- Memory usage
- Disk usage
- Network activity

### Docker Manager
Manage Docker containers:
- View all containers and their status
- Start/stop containers
- View port mappings

## Security
All commands run in the context of the backend process user.
Ensure proper access controls are configured.

## Troubleshooting
If backend is not connected, components show demo/simulated data.
