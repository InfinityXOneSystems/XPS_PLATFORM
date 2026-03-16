# Settings Guide

This guide covers all configuration options in XPS Intelligence Settings.

## Accessing Settings

Navigate to **Settings** from the sidebar or press `Ctrl+,`.

## Categories

### 1. Profile & Account
- Update display name, email, avatar
- Change password and 2FA settings
- Manage notification preferences

### 2. API Token Vault
Store and manage API keys securely:
- OpenAI, Anthropic, Groq, Gemini
- GitHub, Vercel tokens
- AWS, GCP credentials

To add a token:
1. Click **Add Token**
2. Select service
3. Paste token value
4. Set optional expiry
5. Click **Save**

### 3. GitHub Integration
- Connect GitHub account via OAuth
- Select repositories for BuilderAgent
- Configure webhook endpoints

### 4. Cloud Providers

#### AWS
- Access Key ID
- Secret Access Key
- Default region

#### GCP
- Service account JSON
- Project ID

#### Cloudflare
- API token
- Zone ID

### 5. AI Model Configuration
Configure which AI models power each agent:

| Agent | Default Model |
|-------|--------------|
| PlannerAgent | GPT-4o |
| BuilderAgent | Claude 3.5 Sonnet |
| ResearchAgent | GPT-4o-mini |
| ScraperAgent | Gemini Flash |

### 6. Scraping Configuration
- Max concurrent scrapers (default: 5)
- Request delay range
- Proxy rotation settings
- User agent rotation
- Target categories
- Geographic filters

### 7. Agent Configuration
- Max parallel agents (default: 8)
- Task timeout (default: 300s)
- Retry attempts (default: 3)
- Memory allocation per agent
- Log verbosity level

### 8. Notification Settings
Configure alerts via:
- Email (SMTP)
- Slack webhook
- Discord webhook
- Browser push notifications

Trigger events:
- Scrape job completed
- New high-score lead found
- Agent task failed
- System health alert

### 9. Security Settings
- Two-factor authentication
- IP whitelist/blacklist
- Session timeout
- API rate limiting
- Audit log retention

### 10. Runtime Configuration
Edit `runtime.config.json` directly for advanced settings:
```json
{
  "api": {
    "baseUrl": "http://localhost:3000/api",
    "timeout": 30000
  },
  "agents": {
    "maxParallel": 8,
    "taskTimeout": 300
  }
}
```

### 11. Theme & Display
- Light / Dark / System theme
- Sidebar collapsed state
- Chart color scheme
- Compact mode toggle

## Keyboard Shortcuts
- `Ctrl+K` — Command palette
- `Ctrl+,` — Open settings
- `Ctrl+Shift+L` — Toggle theme
- `Esc` — Close modals

## Troubleshooting

**Settings not saving?**
Ensure backend is running at the configured API URL.

**Token test fails?**
Verify the token has correct permissions for the service.
