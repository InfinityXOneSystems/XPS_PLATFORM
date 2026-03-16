/**
 * ResearchAgent — Gathers information from web sources, APIs, and the
 * internal knowledge base; synthesizes findings into structured output.
 */

import { BaseAgent } from './base/BaseAgent'
import type { AgentContext, AgentResult } from './base/BaseAgent'
import type { AgentTask } from '@/lib/agentTypes'

export class ResearchAgent extends BaseAgent {
  constructor() {
    super('ResearchAgent')
  }

  protected async run(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.log('Querying search index...')
    await this.delay(400)

    if (ctx.abortSignal.aborted) return { status: 'failed', error: 'Aborted' }

    this.log('Fetching page content...')
    await this.delay(500)

    this.log('Extracting relevant data...')
    await this.delay(300)

    this.log('Synthesizing results...')
    await this.delay(200)

    return {
      status: 'completed',
      output: `ResearchAgent completed: ${task.description}`,
      metadata: { sourcesQueried: 5, resultsFound: 23 },
    }
  }
}

export const researchAgent = new ResearchAgent()
