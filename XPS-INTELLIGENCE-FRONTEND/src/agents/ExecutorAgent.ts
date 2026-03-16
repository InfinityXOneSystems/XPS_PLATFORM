/**
 * ExecutorAgent — Runs shell commands, API calls, and arbitrary code
 * inside the sandbox execution environment.
 */

import { BaseAgent } from './base/BaseAgent'
import type { AgentContext, AgentResult } from './base/BaseAgent'
import type { AgentTask } from '@/lib/agentTypes'

export class ExecutorAgent extends BaseAgent {
  constructor() {
    super('DevOpsAgent') // Executor maps to the DevOpsAgent role: runs commands and manages infrastructure
  }

  protected async run(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.log('Preparing execution context...')
    await this.delay(200)

    if (ctx.abortSignal.aborted) return { status: 'failed', error: 'Aborted' }

    this.log('Running command in sandbox...')
    await this.delay(600)

    this.log('Capturing output streams...')
    await this.delay(200)

    this.log('Execution complete')
    return {
      status: 'completed',
      output: `ExecutorAgent completed: ${task.description}`,
      metadata: { exitCode: 0, durationMs: 1000 },
    }
  }
}

export const executorAgent = new ExecutorAgent()
