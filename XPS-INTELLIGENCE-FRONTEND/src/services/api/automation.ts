import { api } from '@/lib/api'

export interface Workflow {
  id: string
  name: string
  description: string
  trigger: { type: 'schedule' | 'webhook' | 'manual'; config: Record<string, unknown> }
  actions: { type: string; config: Record<string, unknown> }[]
  enabled: boolean
  lastRun?: string
  nextRun?: string
  status: 'active' | 'paused' | 'error'
}

export const automationApi = {
  list: () => api.get<{ workflows: Workflow[] }>('/automation/workflows/list'),
  create: (data: Omit<Workflow, 'id'>) =>
    api.post<Workflow>('/automation/workflows/create', data),
  execute: (id: string) =>
    api.post<{ executionId: string }>(`/automation/workflows/${id}/execute`, {}),
  schedule: (id: string, cron: string) =>
    api.post<Workflow>(`/automation/workflows/${id}/schedule`, { cron }),
  delete: (id: string) => api.delete<void>(`/automation/workflows/${id}`),
  toggle: (id: string, enabled: boolean) =>
    api.put<Workflow>(`/automation/workflows/${id}`, { enabled }),
}
