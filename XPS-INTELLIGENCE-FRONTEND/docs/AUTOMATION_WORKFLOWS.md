# Automation Workflows Guide

Automate repetitive tasks with the Workflow builder.

## Overview
Workflows run agents and actions automatically on a schedule or trigger.

## Trigger Types
- **Schedule** — Cron expression (e.g., `0 6 * * *` = daily at 6 AM)
- **Webhook** — HTTP webhook endpoint
- **Manual** — Triggered by user or API call

## Common Workflows

### Daily Lead Scraper
Runs every morning, scrapes new contractors, saves to database.

### Lead Notification
Webhook triggered, sends Slack alert when high-score lead found.

### Weekly Report
Every Monday, generates analytics PDF and emails to team.

## Managing Workflows
- Toggle on/off with the switch
- Run immediately with the Run button
- Delete workflows with the trash button

## Cron Reference
```
* * * * *
│ │ │ │ └── Day of week (0-7)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```
