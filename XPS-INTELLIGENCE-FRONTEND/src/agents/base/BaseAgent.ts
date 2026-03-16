/**
 * BaseAgent — Abstract base class for all XPS Intelligence agents.
 *
 * Provides lifecycle management, logging, retry logic, and a standard
 * execute() contract that every concrete agent must implement.
 */

import type { AgentRole, AgentTask, TaskStatus } from '@/lib/agentTypes'

export interface AgentContext {
  /** Shared in-memory key/value store for inter-agent communication */
  memory: Map<string, unknown>
  /** Abort signal — agents must respect this and stop processing */
  abortSignal: { aborted: boolean }
}

export interface AgentResult {
  status: TaskStatus
  output?: string
  error?: string
  metadata?: Record<string, unknown>
}

export abstract class BaseAgent {
  readonly role: AgentRole
  protected readonly maxRetries: number
  protected readonly retryDelayMs: number
  protected logs: string[] = []

  constructor(role: AgentRole, maxRetries = 2, retryDelayMs = 500) {
    this.role = role
    this.maxRetries = maxRetries
    this.retryDelayMs = retryDelayMs
  }

  /** Concrete agents implement the core execution logic here */
  protected abstract run(task: AgentTask, ctx: AgentContext): Promise<AgentResult>

  /** Execute a task with built-in retry / abort handling */
  async execute(task: AgentTask, ctx: AgentContext): Promise<AgentResult> {
    this.logs = []
    this.log(`[${this.role}] Starting task: ${task.description}`)

    let lastError: string | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (ctx.abortSignal.aborted) {
        return { status: 'failed', error: 'Aborted by caller' }
      }

      try {
        if (attempt > 0) {
          this.log(`[${this.role}] Retry ${attempt}/${this.maxRetries}`)
          await this.delay(this.retryDelayMs * attempt)
        }
        const result = await this.run(task, ctx)
        this.log(`[${this.role}] Task finished with status: ${result.status}`)
        return result
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        this.log(`[${this.role}] Attempt ${attempt + 1} failed: ${lastError}`)
      }
    }

    return { status: 'failed', error: lastError ?? 'Unknown error' }
  }

  /** Append a message to the agent log buffer */
  protected log(message: string): void {
    this.logs.push(message)
  }

  /** Return collected log lines (snapshot) */
  getLogs(): string[] {
    return [...this.logs]
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
