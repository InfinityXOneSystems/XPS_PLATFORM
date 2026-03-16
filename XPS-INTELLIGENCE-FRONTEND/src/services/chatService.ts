import type { AgentRole } from '@/lib/agentTypes'
import { API_BASE } from '@/lib/config'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agentRole?: AgentRole
  timestamp: string
  status?: 'sending' | 'sent' | 'error'
}

export interface AgentStatus {
  role: AgentRole
  status: 'idle' | 'running' | 'error' | 'offline'
  lastActivity?: string
  currentTask?: string
  tasksCompleted: number
  successRate: number
}

export interface SendMessageRequest {
  message: string
  agentRole?: AgentRole
  sessionId?: string
}

export interface SendMessageResponse {
  id: string
  reply: ChatMessage
  agentRole: AgentRole
  sessionId: string
}

const MOCK_HISTORY: ChatMessage[] = [
  {
    id: '1',
    role: 'system',
    content: 'XPS Intelligence Agent System initialized. All 13 agents online.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    role: 'user',
    content: 'Show me the latest scraping results',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: '3',
    role: 'assistant',
    content: 'I found 847 new contractor leads from the last scraping run completed 2 hours ago. Top results include 120 general contractors in Texas, 89 roofing companies in Florida, and 67 electrical contractors in California.',
    agentRole: 'ScraperAgent',
    timestamp: new Date(Date.now() - 1799000).toISOString(),
  },
]

export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  try {
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const sessionId = request.sessionId || crypto.randomUUID()
    return {
      id: crypto.randomUUID(),
      sessionId,
      agentRole: request.agentRole || 'PlannerAgent',
      reply: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `[Mock] Received: "${request.message}". Connect to the backend API to get real agent responses.`,
        agentRole: request.agentRole || 'PlannerAgent',
        timestamp: new Date().toISOString(),
        status: 'sent',
      },
    }
  }
}

export async function getChatHistory(sessionId?: string): Promise<ChatMessage[]> {
  try {
    const url = sessionId ? `${API_BASE}/chat/history?sessionId=${sessionId}` : `${API_BASE}/chat/history`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_HISTORY
  }
}

export async function clearHistory(sessionId?: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/chat/history`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}

export async function getAgentStatus(): Promise<AgentStatus[]> {
  try {
    const res = await fetch(`${API_BASE}/agents/status`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const agents: AgentRole[] = [
      'PlannerAgent', 'ResearchAgent', 'BuilderAgent', 'ScraperAgent', 'MediaAgent',
      'ValidatorAgent', 'DevOpsAgent', 'MonitoringAgent', 'KnowledgeAgent',
      'BusinessAgent', 'PredictionAgent', 'SimulationAgent', 'MetaAgent',
    ]
    return agents.map((role, i) => ({
      role,
      status: i < 6 ? 'idle' : i === 6 ? 'running' : 'idle',
      lastActivity: new Date(Date.now() - i * 600000).toISOString(),
      tasksCompleted: Math.floor(Math.random() * 200),
      successRate: 0.85 + Math.random() * 0.14,
    }))
  }
}

export async function executeAgentCommand(
  agentRole: AgentRole,
  command: string,
  params?: Record<string, unknown>
): Promise<{ taskId: string; status: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/agents/${agentRole}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params }),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return {
      taskId: crypto.randomUUID(),
      status: 'queued',
      message: `Command queued for ${agentRole} (mock)`,
    }
  }
}

export async function getAgentChat(agentRole: AgentRole): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`${API_BASE}/agents/${agentRole}/chat`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_HISTORY.filter(m => !m.agentRole || m.agentRole === agentRole)
  }
}
