import { proxyToBackend } from './_proxyHelper.js'

/**
 * GET /api/agents
 *
 * Proxies to the Railway backend's /api/agents endpoint.
 * Falls back to a mock agent roster when the backend is unreachable.
 */

const MOCK_AGENTS = [
  { role: 'PlannerAgent', status: 'idle', tasksCompleted: 42, successRate: 0.95 },
  { role: 'ResearchAgent', status: 'idle', tasksCompleted: 31, successRate: 0.93 },
  { role: 'BuilderAgent', status: 'idle', tasksCompleted: 18, successRate: 0.97 },
  { role: 'ScraperAgent', status: 'running', tasksCompleted: 156, successRate: 0.92 },
  { role: 'MediaAgent', status: 'idle', tasksCompleted: 7, successRate: 0.89 },
  { role: 'ValidatorAgent', status: 'idle', tasksCompleted: 203, successRate: 0.98 },
  { role: 'DevOpsAgent', status: 'idle', tasksCompleted: 64, successRate: 0.96 },
  { role: 'MonitoringAgent', status: 'running', tasksCompleted: 512, successRate: 0.99 },
  { role: 'KnowledgeAgent', status: 'idle', tasksCompleted: 89, successRate: 0.94 },
  { role: 'BusinessAgent', status: 'idle', tasksCompleted: 73, successRate: 0.91 },
  { role: 'PredictionAgent', status: 'idle', tasksCompleted: 45, successRate: 0.88 },
  { role: 'SimulationAgent', status: 'idle', tasksCompleted: 12, successRate: 0.90 },
  { role: 'MetaAgent', status: 'idle', tasksCompleted: 9, successRate: 0.85 },
]

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    return await proxyToBackend('/api/agents', req, res)
  } catch (err) {
    console.warn('Backend agents unreachable, returning mock data:', err.message)
    return res.status(200).json({
      agents: MOCK_AGENTS,
      total: MOCK_AGENTS.length,
      source: 'mock',
      timestamp: new Date().toISOString(),
    })
  }
}
