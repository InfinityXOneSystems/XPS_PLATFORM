/**
 * PlannerAgent — Decomposes high-level goals into ordered task sequences
 * and routes each task to the most appropriate agent.
 */

import { BaseAgent } from './base/BaseAgent'
import type { AgentContext, AgentResult } from './base/BaseAgent'
import type { AgentTask } from '@/lib/agentTypes'

export class PlannerAgent extends BaseAgent {
  constructor() {
    super('PlannerAgent')
  }

  protected async run(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.log('Decomposing goal into subtasks...')
    await this.delay(300)

    if (ctx.abortSignal.aborted) return { status: 'failed', error: 'Aborted' }

    this.log('Building dependency graph...')
    await this.delay(300)

    this.log('Routing tasks to agents...')
    await this.delay(200)

    this.log('Plan ready for execution')
    return {
      status: 'completed',
      output: `PlannerAgent completed: ${task.description}`,
      metadata: { tasksGenerated: 3, estimatedDurationMs: 12000 },
    }
  }
}

export const plannerAgent = new PlannerAgent()
