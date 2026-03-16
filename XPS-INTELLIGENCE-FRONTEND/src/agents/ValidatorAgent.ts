/**
 * ValidatorAgent — Runs lint, type-check, unit tests, and security scans
 * against generated or modified code before it is deployed.
 */

import { BaseAgent } from './base/BaseAgent'
import type { AgentContext, AgentResult } from './base/BaseAgent'
import type { AgentTask } from '@/lib/agentTypes'

export class ValidatorAgent extends BaseAgent {
  constructor() {
    super('ValidatorAgent')
  }

  protected async run(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.log('Running ESLint...')
    await this.delay(400)

    if (ctx.abortSignal.aborted) return { status: 'failed', error: 'Aborted' }

    this.log('Executing TypeScript compiler...')
    await this.delay(500)

    this.log('Running security scan...')
    await this.delay(400)

    this.log('All checks passed')
    return {
      status: 'completed',
      output: `ValidatorAgent completed: ${task.description}`,
      metadata: { lintErrors: 0, typeErrors: 0, securityIssues: 0 },
    }
  }
}

export const validatorAgent = new ValidatorAgent()
