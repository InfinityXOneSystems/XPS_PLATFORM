const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface Integration {
  id: string
  name: string
  type: 'api' | 'oauth' | 'webhook' | 'sdk'
  provider: string
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  lastSync?: string
  config: Record<string, string>
  scopes?: string[]
  metadata?: Record<string, unknown>
}

export interface IntegrationLog {
  id: string
  integrationId: string
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  details?: Record<string, unknown>
}

const MOCK_INTEGRATIONS: Integration[] = [
  { id: '1', name: 'GitHub', type: 'oauth', provider: 'github', status: 'connected', lastSync: new Date(Date.now() - 3600000).toISOString(), config: { org: 'InfinityXOneSystems' }, scopes: ['repo', 'workflow', 'read:org'] },
  { id: '2', name: 'Vercel', type: 'api', provider: 'vercel', status: 'connected', lastSync: new Date(Date.now() - 7200000).toISOString(), config: { team: 'xps-team' } },
  { id: '3', name: 'OpenAI', type: 'api', provider: 'openai', status: 'connected', lastSync: new Date(Date.now() - 1800000).toISOString(), config: { model: 'gpt-4o', orgId: 'org-xxx' } },
  { id: '4', name: 'Anthropic', type: 'api', provider: 'anthropic', status: 'disconnected', config: {} },
  { id: '5', name: 'Groq', type: 'api', provider: 'groq', status: 'connected', lastSync: new Date(Date.now() - 900000).toISOString(), config: { model: 'llama-3.3-70b-versatile' } },
  { id: '6', name: 'AWS S3', type: 'sdk', provider: 'aws', status: 'disconnected', config: {} },
  { id: '7', name: 'Cloudflare R2', type: 'api', provider: 'cloudflare', status: 'disconnected', config: {} },
  { id: '8', name: 'Google Cloud', type: 'oauth', provider: 'gcp', status: 'error', config: {}, metadata: { error: 'OAuth token expired' } },
  { id: '9', name: 'Ollama Local', type: 'api', provider: 'ollama', status: 'connected', lastSync: new Date(Date.now() - 300000).toISOString(), config: { host: 'http://localhost:11434', model: 'llama3.2' } },
  { id: '10', name: 'Gemini', type: 'api', provider: 'gemini', status: 'disconnected', config: {} },
]

const MOCK_LOGS: IntegrationLog[] = [
  { id: '1', integrationId: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'info', message: 'Successfully synced repository list', details: { reposCount: 12 } },
  { id: '2', integrationId: '3', timestamp: new Date(Date.now() - 1800000).toISOString(), level: 'info', message: 'API call successful: chat completion', details: { model: 'gpt-4o', tokens: 1247 } },
  { id: '3', integrationId: '8', timestamp: new Date(Date.now() - 900000).toISOString(), level: 'error', message: 'OAuth token expired, please reconnect', details: { errorCode: 'TOKEN_EXPIRED' } },
  { id: '4', integrationId: '5', timestamp: new Date(Date.now() - 600000).toISOString(), level: 'info', message: 'Groq inference completed', details: { model: 'llama-3.3-70b-versatile', latency: '342ms' } },
]

export async function getIntegrations(): Promise<Integration[]> {
  try {
    const res = await fetch(`${API_BASE}/integrations`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_INTEGRATIONS
  }
}

export async function connectIntegration(
  id: string,
  config: Record<string, string>
): Promise<Integration> {
  try {
    const res = await fetch(`${API_BASE}/integrations/${id}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_INTEGRATIONS.find(i => i.id === id)
    if (!existing) return { id, name: id, type: 'api', provider: id, status: 'connected', config, lastSync: new Date().toISOString() }
    return { ...existing, config: { ...existing.config, ...config }, status: 'connected', lastSync: new Date().toISOString() }
  }
}

export async function disconnectIntegration(id: string): Promise<Integration> {
  try {
    const res = await fetch(`${API_BASE}/integrations/${id}/disconnect`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_INTEGRATIONS.find(i => i.id === id)
    if (!existing) return { id, name: id, type: 'api', provider: id, status: 'disconnected', config: {} }
    return { ...existing, status: 'disconnected', config: {} }
  }
}

export async function testConnection(id: string): Promise<{ success: boolean; latency?: number; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/integrations/${id}/test`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const integration = MOCK_INTEGRATIONS.find(i => i.id === id)
    const isConnected = integration?.status === 'connected'
    return {
      success: isConnected,
      latency: isConnected ? Math.floor(Math.random() * 200) + 50 : undefined,
      message: isConnected ? 'Connection successful (mock)' : 'Not connected',
    }
  }
}

export async function getIntegrationLogs(integrationId?: string): Promise<IntegrationLog[]> {
  try {
    const url = integrationId
      ? `${API_BASE}/integrations/${integrationId}/logs`
      : `${API_BASE}/integrations/logs`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return integrationId ? MOCK_LOGS.filter(l => l.integrationId === integrationId) : MOCK_LOGS
  }
}
