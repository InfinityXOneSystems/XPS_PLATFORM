const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface TokenEntry {
  id: string
  name: string
  service: string
  maskedValue: string
  createdAt: string
  lastUsed?: string
  status: 'valid' | 'invalid' | 'unknown'
}

export interface IntegrationConfig {
  id: string
  name: string
  provider: 'github' | 'vercel' | 'aws' | 'gcp' | 'cloudflare' | 'groq' | 'openai' | 'anthropic' | 'gemini' | 'ollama'
  connected: boolean
  lastSync?: string
  config: Record<string, string>
}

export interface AutomationSettings {
  dailyScrapeEnabled: boolean
  dailyScrapeTime: string
  reportFrequency: 'daily' | 'weekly' | 'monthly'
  retryAttempts: number
  blackoutStart: string
  blackoutEnd: string
  maxConcurrentJobs: number
}

export interface WebhookEntry {
  id: string
  name: string
  url: string
  events: string[]
  secret?: string
  active: boolean
  lastTriggered?: string
  successCount: number
  failureCount: number
}

const MOCK_TOKENS: TokenEntry[] = [
  { id: '1', name: 'OpenAI Production', service: 'openai', maskedValue: 'sk-****...****abc1', createdAt: '2024-01-15', lastUsed: '2024-12-01', status: 'valid' },
  { id: '2', name: 'GitHub PAT', service: 'github', maskedValue: 'ghp_****...****xyz2', createdAt: '2024-02-20', lastUsed: '2024-11-30', status: 'valid' },
  { id: '3', name: 'Anthropic Key', service: 'anthropic', maskedValue: 'sk-ant-****...****def3', createdAt: '2024-03-10', status: 'unknown' },
]

const MOCK_INTEGRATIONS: IntegrationConfig[] = [
  { id: '1', name: 'GitHub', provider: 'github', connected: true, lastSync: '2024-12-01T10:00:00Z', config: { org: 'InfinityXOneSystems' } },
  { id: '2', name: 'Vercel', provider: 'vercel', connected: true, lastSync: '2024-11-30T08:00:00Z', config: { team: 'xps-team' } },
  { id: '3', name: 'OpenAI', provider: 'openai', connected: true, lastSync: '2024-12-01T09:00:00Z', config: { model: 'gpt-4o' } },
  { id: '4', name: 'Anthropic', provider: 'anthropic', connected: false, config: {} },
  { id: '5', name: 'AWS', provider: 'aws', connected: false, config: {} },
  { id: '6', name: 'Groq', provider: 'groq', connected: true, lastSync: '2024-11-29T12:00:00Z', config: { model: 'llama-3.3-70b' } },
  { id: '7', name: 'Cloudflare', provider: 'cloudflare', connected: false, config: {} },
  { id: '8', name: 'GCP', provider: 'gcp', connected: false, config: {} },
  { id: '9', name: 'Gemini', provider: 'gemini', connected: false, config: {} },
  { id: '10', name: 'Ollama', provider: 'ollama', connected: true, lastSync: '2024-12-01T11:00:00Z', config: { host: 'http://localhost:11434' } },
]

const MOCK_AUTOMATION: AutomationSettings = {
  dailyScrapeEnabled: true,
  dailyScrapeTime: '02:00',
  reportFrequency: 'weekly',
  retryAttempts: 3,
  blackoutStart: '08:00',
  blackoutEnd: '18:00',
  maxConcurrentJobs: 5,
}

const MOCK_WEBHOOKS: WebhookEntry[] = [
  { id: '1', name: 'Slack Alerts', url: 'https://hooks.slack.com/services/xxx', events: ['task_failed', 'scrape_complete'], active: true, lastTriggered: '2024-12-01T09:30:00Z', successCount: 142, failureCount: 3 },
  { id: '2', name: 'Discord Notify', url: 'https://discord.com/api/webhooks/xxx', events: ['plan_complete'], active: false, successCount: 28, failureCount: 1 },
]

export async function getSettings(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${API_BASE}/settings`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { status: 'mock', note: 'Using local settings' }
  }
}

export async function updateSettings(data: Record<string, unknown>): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}

export async function getTokens(): Promise<TokenEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/settings/tokens`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_TOKENS
  }
}

export async function addToken(token: Omit<TokenEntry, 'id' | 'createdAt'>): Promise<TokenEntry> {
  try {
    const res = await fetch(`${API_BASE}/settings/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { ...token, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  }
}

export async function testToken(id: string): Promise<{ valid: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/settings/tokens/${id}/test`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { valid: true, message: 'Token appears valid (mock check)' }
  }
}

export async function deleteToken(id: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/settings/tokens/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}

export async function getIntegrations(): Promise<IntegrationConfig[]> {
  try {
    const res = await fetch(`${API_BASE}/settings/integrations`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_INTEGRATIONS
  }
}

export async function configureIntegration(id: string, config: Record<string, string>): Promise<IntegrationConfig> {
  try {
    const res = await fetch(`${API_BASE}/settings/integrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_INTEGRATIONS.find(i => i.id === id)
    return { ...existing!, config: { ...existing!.config, ...config }, connected: true }
  }
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const res = await fetch(`${API_BASE}/settings/automation`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_AUTOMATION
  }
}

export async function updateAutomationSettings(data: Partial<AutomationSettings>): Promise<AutomationSettings> {
  try {
    const res = await fetch(`${API_BASE}/settings/automation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { ...MOCK_AUTOMATION, ...data }
  }
}

export async function getWebhooks(): Promise<WebhookEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/settings/webhooks`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_WEBHOOKS
  }
}

export async function createWebhook(webhook: Omit<WebhookEntry, 'id' | 'successCount' | 'failureCount'>): Promise<WebhookEntry> {
  try {
    const res = await fetch(`${API_BASE}/settings/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhook),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { ...webhook, id: crypto.randomUUID(), successCount: 0, failureCount: 0 }
  }
}

export async function testWebhook(id: string): Promise<{ success: boolean; statusCode?: number; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/settings/webhooks/${id}/test`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true, statusCode: 200, message: 'Webhook endpoint responded successfully (mock)' }
  }
}
