import { api } from '@/lib/api'

export interface AgentCommand {
  command: string
  context?: Record<string, unknown>
}

export interface AgentResult {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: string
  error?: string
  agentId?: string
  duration?: number
}

export const agentsApi = {
  execute: (cmd: AgentCommand) =>
    api.post<AgentResult>('/orchestrator/execute-command', cmd),
  executeParallel: (commands: AgentCommand[]) =>
    api.post<AgentResult[]>('/orchestrator/execute-parallel', { commands }),
  executeSwarm: (task: string) =>
    api.post<AgentResult>('/orchestrator/execute-swarm', { task }),
  getStatus: (id: string) =>
    api.get<AgentResult>(`/orchestrator/status/${id}`),
}
