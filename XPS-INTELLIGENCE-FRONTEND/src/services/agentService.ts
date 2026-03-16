import type { AgentRole } from '@/lib/agentTypes'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface AgentConfig {
  role: AgentRole
  enabled: boolean
  concurrencyLimit: number
  timeoutMs: number
  maxRetries: number
  priority: 'low' | 'normal' | 'high'
  description: string
}

export interface AgentMetrics {
  role: AgentRole
  tasksCompleted: number
  tasksFailed: number
  avgDurationMs: number
  successRate: number
  lastActive?: string
  totalTokensUsed?: number
}

const ALL_ROLES: AgentRole[] = [
  'PlannerAgent', 'ResearchAgent', 'BuilderAgent', 'ScraperAgent', 'MediaAgent',
  'ValidatorAgent', 'DevOpsAgent', 'MonitoringAgent', 'KnowledgeAgent',
  'BusinessAgent', 'PredictionAgent', 'SimulationAgent', 'MetaAgent',
]

const MOCK_CONFIGS: AgentConfig[] = ALL_ROLES.map((role, i) => ({
  role,
  enabled: i < 10,
  concurrencyLimit: role === 'ScraperAgent' ? 10 : 3,
  timeoutMs: 30000,
  maxRetries: 3,
  priority: role === 'PlannerAgent' || role === 'MetaAgent' ? 'high' : 'normal',
  description: `${role} autonomous agent`,
}))

const MOCK_METRICS: AgentMetrics[] = ALL_ROLES.map((role) => ({
  role,
  tasksCompleted: Math.floor(Math.random() * 500) + 10,
  tasksFailed: Math.floor(Math.random() * 20),
  avgDurationMs: Math.floor(Math.random() * 5000) + 500,
  successRate: 0.85 + Math.random() * 0.14,
  lastActive: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
  totalTokensUsed: Math.floor(Math.random() * 100000),
}))

export async function getAgents(): Promise<AgentConfig[]> {
  try {
    const res = await fetch(`${API_BASE}/agents`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_CONFIGS
  }
}

export async function toggleAgent(role: AgentRole, enabled: boolean): Promise<AgentConfig> {
  try {
    const res = await fetch(`${API_BASE}/agents/${role}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_CONFIGS.find(c => c.role === role)
    if (!existing) return { role, enabled, concurrencyLimit: 3, timeoutMs: 30000, maxRetries: 3, priority: 'normal', description: '' }
    return { ...existing, enabled }
  }
}

export async function updateAgentConfig(role: AgentRole, config: Partial<AgentConfig>): Promise<AgentConfig> {
  try {
    const res = await fetch(`${API_BASE}/agents/${role}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_CONFIGS.find(c => c.role === role)
    if (!existing) return { role, enabled: true, concurrencyLimit: 3, timeoutMs: 30000, maxRetries: 3, priority: 'normal', description: '', ...config }
    return { ...existing, ...config }
  }
}

export async function getAgentMetrics(): Promise<AgentMetrics[]> {
  try {
    const res = await fetch(`${API_BASE}/agents/metrics`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_METRICS
  }
}
