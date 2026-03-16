// automationService.ts — CRUD and trigger operations for Automation Schedules.
// Schedule.taskType is strictly typed as TaskType to prevent string-widening errors.
import type { TaskType } from '@/lib/agentTypes'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface Schedule {
  id: string
  name: string
  description: string
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'
  cronExpression: string
  nextRun: string
  lastRun?: string
  status: 'active' | 'paused' | 'failed' | 'disabled'
  /** Strictly typed as TaskType — prevents 'string' widening errors */
  taskType: TaskType
  config: Record<string, unknown>
  successCount: number
  failureCount: number
}

export interface ScheduleHistoryEntry {
  id: string
  scheduleId: string
  scheduleName: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'failed' | 'running'
  duration?: number
  output?: string
  error?: string
}

const MOCK_SCHEDULES: Schedule[] = [
  {
    id: '1',
    name: 'Daily Lead Scrape',
    description: 'Scrape new contractor leads from major directories',
    frequency: 'daily',
    cronExpression: '0 2 * * *',
    nextRun: new Date(Date.now() + 6 * 3600000).toISOString(),
    lastRun: new Date(Date.now() - 18 * 3600000).toISOString(),
    status: 'active',
    taskType: 'scrape',
    config: { targets: ['yellowpages', 'bbb', 'angie'], maxResults: 500 },
    successCount: 142,
    failureCount: 3,
  },
  {
    id: '2',
    name: 'Weekly Report Generation',
    description: 'Generate pipeline performance and lead quality reports',
    frequency: 'weekly',
    cronExpression: '0 8 * * 1',
    nextRun: new Date(Date.now() + 3 * 86400000).toISOString(),
    lastRun: new Date(Date.now() - 4 * 86400000).toISOString(),
    status: 'active',
    taskType: 'report',
    config: { reportTypes: ['lead_quality', 'pipeline', 'agent_performance'] },
    successCount: 28,
    failureCount: 1,
  },
  {
    id: '3',
    name: 'Hourly System Monitor',
    description: 'Monitor system health and alert on anomalies',
    frequency: 'hourly',
    cronExpression: '0 * * * *',
    nextRun: new Date(Date.now() + 1800000).toISOString(),
    lastRun: new Date(Date.now() - 1800000).toISOString(),
    status: 'active',
    taskType: 'monitor',
    config: { alertThresholds: { cpu: 90, memory: 85, errorRate: 0.05 } },
    successCount: 720,
    failureCount: 12,
  },
  {
    id: '4',
    name: 'Lead Analysis & Scoring',
    description: 'Analyze and re-score leads using prediction model',
    frequency: 'daily',
    cronExpression: '0 6 * * *',
    nextRun: new Date(Date.now() + 10 * 3600000).toISOString(),
    lastRun: new Date(Date.now() - 14 * 3600000).toISOString(),
    status: 'paused',
    taskType: 'analyze_leads',
    config: { model: 'v2.1', minConfidence: 0.7 },
    successCount: 89,
    failureCount: 7,
  },
  {
    id: '5',
    name: 'GitHub Actions Deploy',
    description: 'Trigger deployment workflow on successful build',
    frequency: 'custom',
    cronExpression: '*/30 9-18 * * 1-5',
    nextRun: new Date(Date.now() + 900000).toISOString(),
    lastRun: new Date(Date.now() - 1800000).toISOString(),
    status: 'active',
    taskType: 'github_action',
    config: { workflow: 'deploy.yml', branch: 'main' },
    successCount: 312,
    failureCount: 8,
  },
]

const MOCK_HISTORY: ScheduleHistoryEntry[] = [
  { id: '1', scheduleId: '1', scheduleName: 'Daily Lead Scrape', startedAt: new Date(Date.now() - 18 * 3600000).toISOString(), completedAt: new Date(Date.now() - 16 * 3600000).toISOString(), status: 'success', duration: 7200000, output: 'Collected 847 new leads' },
  { id: '2', scheduleId: '3', scheduleName: 'Hourly System Monitor', startedAt: new Date(Date.now() - 1800000).toISOString(), completedAt: new Date(Date.now() - 1795000).toISOString(), status: 'success', duration: 5000, output: 'All systems nominal' },
  { id: '3', scheduleId: '5', scheduleName: 'GitHub Actions Deploy', startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3300000).toISOString(), status: 'success', duration: 300000, output: 'Deployed v2.4.1 to production' },
  { id: '4', scheduleId: '1', scheduleName: 'Daily Lead Scrape', startedAt: new Date(Date.now() - 42 * 3600000).toISOString(), completedAt: new Date(Date.now() - 40 * 3600000).toISOString(), status: 'failed', duration: 7200000, error: 'Rate limit exceeded on yellowpages' },
]

export async function getSchedules(): Promise<Schedule[]> {
  try {
    const res = await fetch(`${API_BASE}/automation/schedules`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_SCHEDULES
  }
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'successCount' | 'failureCount'>): Promise<Schedule> {
  try {
    const res = await fetch(`${API_BASE}/automation/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { ...schedule, id: crypto.randomUUID(), successCount: 0, failureCount: 0 }
  }
}

export async function updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
  try {
    const res = await fetch(`${API_BASE}/automation/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_SCHEDULES.find(s => s.id === id)
    // Fallback: merge updates onto the found mock entry; throw if the id is unknown
    // to avoid constructing a structurally-incomplete Schedule with a type assertion.
    if (!existing) throw new Error(`Schedule "${id}" not found in mock data`)
    return { ...existing, ...updates }
  }
}

export async function deleteSchedule(id: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/automation/schedules/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}

export async function toggleSchedule(id: string, active: boolean): Promise<Schedule> {
  return updateSchedule(id, { status: active ? 'active' : 'paused' })
}

export async function getScheduleHistory(scheduleId?: string): Promise<ScheduleHistoryEntry[]> {
  try {
    const url = scheduleId
      ? `${API_BASE}/automation/schedules/${scheduleId}/history`
      : `${API_BASE}/automation/history`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return scheduleId ? MOCK_HISTORY.filter(h => h.scheduleId === scheduleId) : MOCK_HISTORY
  }
}

export async function runScheduleNow(id: string): Promise<{ taskId: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/automation/schedules/${id}/run`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { taskId: crypto.randomUUID(), message: 'Schedule triggered immediately (mock)' }
  }
}
