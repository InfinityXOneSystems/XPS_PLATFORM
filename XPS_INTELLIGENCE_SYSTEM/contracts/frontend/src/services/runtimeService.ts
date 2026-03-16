/**
 * contracts/frontend/src/services/runtimeService.ts
 * ==================================================
 * Copy this file to xps-intelligence-frontend/src/services/runtimeService.ts
 *
 * Typed API client for the XPS backend runtime command API.
 *
 * Endpoints:
 *   POST  /api/v1/runtime/command        — submit a natural-language command
 *   GET   /api/v1/runtime/task/{task_id} — poll task execution status
 *   GET   /system/health                 — dependency health check
 */

// ---------------------------------------------------------------------------
// Base URL — reads VITE_API_URL from environment (set in Vercel dashboard)
// ---------------------------------------------------------------------------
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandType =
  | "scrape_website"
  | "generate_code"
  | "modify_backend"
  | "modify_frontend"
  | "create_repo"
  | "run_agent"
  | "post_social"
  | "seo_analysis"
  | "export"
  | "outreach"
  | "analytics"
  | "predict"
  | "simulate"
  | "unknown";

export type TaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "retrying";

export interface RuntimeCommandRequest {
  /** Natural-language or structured command text (1–2000 chars) */
  command: string;
  /** Optional explicit command type override (auto-detected if omitted) */
  command_type?: CommandType;
  /** Additional key-value parameters for the command */
  params?: Record<string, unknown>;
  /** Task priority 1 (lowest) – 10 (highest). Default: 5 */
  priority?: number;
  /** Max execution time in seconds (10–3600). Default: 300 */
  timeout_seconds?: number;
}

export interface RuntimeCommandResponse {
  task_id: string;
  status: TaskStatus;
  command_type: CommandType;
  agent: string;
  message: string;
  params: Record<string, unknown>;
}

export interface TaskStatusResponse {
  task_id: string;
  status: TaskStatus;
  command_type?: CommandType;
  agent?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  result?: unknown;
  error?: string;
  logs: string[];
  retries: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Submit a natural-language command to the backend runtime.
 * Returns immediately with a task_id to poll.
 */
export async function submitRuntimeCommand(
  request: RuntimeCommandRequest,
): Promise<RuntimeCommandResponse> {
  const res = await fetch(`${API_BASE}/api/v1/runtime/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const msg =
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail);
    throw new Error(`Runtime command failed (${res.status}): ${msg}`);
  }

  return res.json();
}

/**
 * Poll the status of a previously submitted task.
 * Returns null when the task is not found (404).
 */
export async function getTaskStatus(
  taskId: string,
): Promise<TaskStatusResponse | null> {
  const res = await fetch(`${API_BASE}/api/v1/runtime/task/${taskId}`);

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(
      `Task status fetch failed (${res.status}): ${res.statusText}`,
    );
  }

  return res.json();
}

/** Returns true when a task has reached a terminal state. */
export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "completed" || status === "failed";
}

/** Return a human-readable label for a command type. */
export function commandTypeLabel(type: CommandType | undefined): string {
  const labels: Record<CommandType, string> = {
    scrape_website: "Web Scrape",
    generate_code: "Code Generation",
    modify_backend: "Backend Modify",
    modify_frontend: "Frontend Modify",
    create_repo: "Create Repo",
    run_agent: "Run Agent",
    post_social: "Social Post",
    seo_analysis: "SEO Analysis",
    export: "Export",
    outreach: "Outreach",
    analytics: "Analytics",
    predict: "Prediction",
    simulate: "Simulation",
    unknown: "Unknown",
  };
  return type ? (labels[type] ?? type) : "Unknown";
}
