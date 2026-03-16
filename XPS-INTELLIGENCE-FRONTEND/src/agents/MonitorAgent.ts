/**
 * MonitorAgent — Watches system health, aggregates log streams, and
 * surfaces anomalies to the dashboard.
 */

import { BaseAgent } from './base/BaseAgent'
import type { AgentContext, AgentResult } from './base/BaseAgent'
import type { AgentTask } from '@/lib/agentTypes'

export class MonitorAgent extends BaseAgent {
  constructor() {
    super('MonitoringAgent')
  }

  protected async run(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.log('Collecting system metrics...')
    await this.delay(300)

    if (ctx.abortSignal.aborted) return { status: 'failed', error: 'Aborted' }

    this.log('Checking error rates...')
    await this.delay(300)

    this.log('Aggregating log streams...')
    await this.delay(300)

    this.log('Health check passed')
    return {
      status: 'completed',
      output: `MonitorAgent completed: ${task.description}`,
      metadata: { errorRate: 0.01, p99LatencyMs: 142, healthScore: 98 },
    }
  }
}

export const monitorAgent = new MonitorAgent()
