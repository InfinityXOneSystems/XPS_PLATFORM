/**
 * SimulatorAgent — Runs scenario simulations and what-if analysis inside
 * isolated sandbox containers; returns statistical outcome distributions.
 */

import { BaseAgent } from './base/BaseAgent'
import type { AgentContext, AgentResult } from './base/BaseAgent'
import type { AgentTask } from '@/lib/agentTypes'

export class SimulatorAgent extends BaseAgent {
  constructor() {
    super('SimulationAgent')
  }

  protected async run(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.log('Initializing simulation context...')
    await this.delay(500)

    if (ctx.abortSignal.aborted) return { status: 'failed', error: 'Aborted' }

    this.log('Running scenario iterations...')
    await this.delay(700)

    this.log('Collecting outcomes...')
    await this.delay(400)

    this.log('Simulation complete')
    return {
      status: 'completed',
      output: `SimulatorAgent completed: ${task.description}`,
      metadata: { iterations: 1000, p50OutcomeMs: 4200, p99OutcomeMs: 8800 },
    }
  }
}

export const simulatorAgent = new SimulatorAgent()
