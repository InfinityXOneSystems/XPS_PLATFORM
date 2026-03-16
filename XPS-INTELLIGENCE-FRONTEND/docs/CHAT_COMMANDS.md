# Chat Commands Reference

The XPS Intelligence chat interface commands the entire platform.

## Basic Commands

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `status` | Show system status |
| `agents` | List all agents and their status |
| `clear` | Clear chat history |

## Agent Commands

### Planner
```
plan: build a lead generation pipeline for flooring contractors in Texas
```

### Scraper
```
scrape: flooring contractors in Los Angeles limit 100
scrape: plumbers in Chicago category:residential
```

### Builder
```
build: create a CSV export function for contractors
build: add phone number validation to lead form
```

### Research
```
research: top epoxy flooring trends 2024
research: competitor pricing for flooring leads
```

## Workflow Commands

```
run workflow: Daily Lead Scraper
pause workflow: Weekly Report
create workflow: scrape every Monday at 8am
```

## Data Commands

```
export leads csv
export contractors excel
show stats last 30 days
filter leads status:qualified
```

## System Commands

```
system info
docker status
restart agent: ScraperAgent
clear task queue
show logs last 100
```

## Multi-Agent Swarm

```
swarm: find all epoxy flooring contractors in California and qualify them
```

This triggers the full agent pipeline:
1. PlannerAgent decomposes the task
2. ScraperAgent collects leads
3. ResearchAgent enriches data
4. ValidatorAgent scores leads
5. BusinessAgent creates report

## Natural Language

The system understands natural language:
- "Find me 50 contractors in Phoenix"
- "What's my conversion rate this month?"
- "Run the daily scraper now"
- "Show me all qualified leads in California"
