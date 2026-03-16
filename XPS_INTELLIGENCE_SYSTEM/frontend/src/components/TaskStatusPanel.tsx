"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import {
  getTaskStatus,
  type TaskStatus,
  type TaskStatusResponse,
} from "@/lib/runtimeClient";

interface TaskStatusPanelProps {
  taskId: string;
  /** Poll interval in ms. Set to 0 to disable polling. */
  pollIntervalMs?: number;
  onComplete?: (task: TaskStatusResponse) => void;
}

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  queued: <Clock className="h-4 w-4 text-gray-400" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

function LogList({ logs }: { logs: string[] }) {
  if (logs.length === 0) return null;
  return (
    <pre className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-gray-900 p-3 text-[11px] text-green-400 whitespace-pre-wrap">
      {logs.join("\n")}
    </pre>
  );
}

export default function TaskStatusPanel({
  taskId,
  pollIntervalMs = 2000,
  onComplete,
}: TaskStatusPanelProps) {
  const [task, setTask] = useState<TaskStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let active = true;

    const fetchStatus = async (): Promise<boolean> => {
      try {
        const data = await getTaskStatus(taskId);
        if (!active) return false;
        setTask(data);
        setError(null);

        const isTerminal =
          data.status === "completed" || data.status === "failed";
        if (isTerminal) {
          onComplete?.(data);
        }
        return isTerminal;
      } catch (err: unknown) {
        if (!active) return false;
        setError(err instanceof Error ? err.message : "Failed to fetch status");
        return false;
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll until terminal state — use a recursive timeout to always check fresh status
    if (pollIntervalMs <= 0) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      timeoutId = setTimeout(async () => {
        if (!active) return;
        const done = await fetchStatus();
        if (!done) scheduleNext(); // reschedule only if not terminal
      }, pollIntervalMs);
    };
    scheduleNext();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [taskId, pollIntervalMs, onComplete]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Error fetching task status</p>
        <p className="mt-1 text-xs">{error}</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading task {taskId.slice(0, 8)}…</span>
      </div>
    );
  }

  const isTerminal = task.status === "completed" || task.status === "failed";

  return (
    <div
      className={`rounded-lg border p-4 ${
        task.status === "completed"
          ? "border-green-200 bg-green-50"
          : task.status === "failed"
            ? "border-red-200 bg-red-50"
            : "border-blue-200 bg-blue-50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {STATUS_ICONS[task.status]}
        <span className="text-sm font-medium text-gray-800">
          {STATUS_LABELS[task.status]}
        </span>
        <span className="ml-auto font-mono text-xs text-gray-500">
          {task.task_id.slice(0, 8)}…
        </span>
      </div>

      {/* Command / target */}
      {task.command && (
        <p className="mt-2 text-xs text-gray-600">
          <span className="font-medium">Command:</span> {task.command}
          {task.target && (
            <span className="ml-2 text-gray-500">→ {task.target}</span>
          )}
        </p>
      )}

      {/* Error */}
      {task.error && (
        <p className="mt-2 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
          {task.error}
        </p>
      )}

      {/* Timestamps */}
      {task.created_at && (
        <p className="mt-1 text-xs text-gray-400">
          Created: {new Date(task.created_at).toLocaleTimeString()}
          {task.updated_at && task.updated_at !== task.created_at && (
            <span className="ml-2">
              Updated: {new Date(task.updated_at).toLocaleTimeString()}
            </span>
          )}
        </p>
      )}

      {/* Logs */}
      <LogList logs={task.logs} />

      {/* Polling indicator */}
      {!isTerminal && (
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Polling…</span>
        </div>
      )}
    </div>
  );
}
