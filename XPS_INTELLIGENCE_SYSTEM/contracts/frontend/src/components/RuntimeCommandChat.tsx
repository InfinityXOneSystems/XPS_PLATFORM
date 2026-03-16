/**
 * contracts/frontend/src/components/RuntimeCommandChat.tsx
 * =========================================================
 * Copy this file to xps-intelligence-frontend/src/components/RuntimeCommandChat.tsx
 *
 * Chat interface wired directly to the XPS backend runtime API.
 *
 * Uses:
 *   @tanstack/react-query  — mutation + polling
 *   @phosphor-icons/react  — icons
 *   sonner                 — toast notifications
 *   Tailwind CSS           — styling
 *   shadcn/ui              — Button, Badge, ScrollArea
 *
 * Usage in AgentPage or any page:
 *   import { RuntimeCommandChat } from '@/components/RuntimeCommandChat'
 *   <RuntimeCommandChat />
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CircleNotch,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  Clock,
  Terminal,
  Cpu,
  Lightning,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  submitRuntimeCommand,
  getTaskStatus,
  isTerminalStatus,
  commandTypeLabel,
  type RuntimeCommandRequest,
  type RuntimeCommandResponse,
  type TaskStatusResponse,
  type TaskStatus,
} from "@/services/runtimeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  taskId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  pending: <Clock size={12} className="text-white/40" />,
  queued: <Clock size={12} className="text-white/60" />,
  running: (
    <ArrowsClockwise size={12} className="animate-spin text-yellow-400" />
  ),
  completed: <CheckCircle size={12} className="text-green-400" weight="fill" />,
  failed: <XCircle size={12} className="text-red-400" weight="fill" />,
  retrying: <CircleNotch size={12} className="animate-spin text-orange-400" />,
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "text-white/40",
  queued: "text-white/60",
  running: "text-yellow-400",
  completed: "text-green-400",
  failed: "text-red-400",
  retrying: "text-orange-400",
};

// ---------------------------------------------------------------------------
// TaskStatusPanel
// ---------------------------------------------------------------------------

function TaskStatusPanel({ taskId }: { taskId: string }) {
  const { data: task } = useQuery<TaskStatusResponse | null>({
    queryKey: ["runtime-task", taskId],
    queryFn: () => getTaskStatus(taskId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return isTerminalStatus(data.status) ? false : POLL_INTERVAL_MS;
    },
    staleTime: 0,
  });

  if (!task) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
        <CircleNotch size={11} className="animate-spin" />
        <span>Fetching task status…</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border p-2.5 text-xs",
        task.status === "failed" ? "border-red-400/20" : "border-white/10",
      )}
      style={{ background: "rgba(0,0,0,0.35)" }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Cpu size={11} className="shrink-0 text-yellow-400" />
        <span className="flex-1 truncate font-mono text-white/50">
          {task.task_id.slice(0, 8)}…
        </span>
        <span className={cn("font-semibold", STATUS_COLOR[task.status])}>
          {task.status.toUpperCase()}
        </span>
        {STATUS_ICON[task.status]}
      </div>

      {/* Agent + type */}
      {(task.agent || task.command_type) && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <Lightning size={10} className="text-white/30 shrink-0" />
          <span className="text-white/40">
            {task.agent ?? commandTypeLabel(task.command_type)}
          </span>
        </div>
      )}

      {/* Logs */}
      {task.logs.length > 0 && (
        <div className="mb-1.5 max-h-24 overflow-y-auto rounded border border-white/5 bg-black/40 p-1.5">
          {task.logs.map((line, i) => (
            <div
              key={i}
              className="flex gap-1 py-px font-mono text-[10px] text-white/50"
            >
              <Terminal size={9} className="mt-0.5 shrink-0 text-white/20" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {task.status === "completed" && task.result && (
        <pre className="mt-1 max-h-40 overflow-y-auto rounded border border-green-400/10 bg-black/40 p-1.5 font-mono text-[10px] leading-relaxed text-green-400/80">
          {typeof task.result === "string"
            ? task.result
            : JSON.stringify(task.result, null, 2)}
        </pre>
      )}

      {/* Error */}
      {task.status === "failed" && task.error && (
        <div className="mt-1 flex items-start gap-1 text-red-400/80">
          <WarningCircle size={11} className="mt-0.5 shrink-0" />
          <span>{task.error}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
          isUser
            ? "border-yellow-400/50 bg-yellow-400 text-black"
            : "border-white/10 bg-black/60 text-yellow-400",
        )}
      >
        {isUser ? "U" : "⚡"}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5",
          isUser
            ? "rounded-br-sm bg-yellow-400 text-black"
            : "rounded-bl-sm border border-white/8 bg-black/50 text-white",
        )}
      >
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {msg.content}
        </pre>
        {msg.taskId && <TaskStatusPanel taskId={msg.taskId} />}
        <span
          className={cn(
            "mt-1 block text-[10px]",
            isUser ? "text-black/40 text-right" : "text-white/25",
          )}
        >
          {msg.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RuntimeCommandChat — main export
// ---------------------------------------------------------------------------

const QUICK_COMMANDS = [
  "scrape epoxy contractors in Orlando FL",
  "run seo analysis on site.com",
  "export leads to CSV",
  "run outreach campaign",
  "show system status",
];

export function RuntimeCommandChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Hello! I'm your XPS Runtime Agent.\n\n" +
        "I'm wired to the backend runtime API. Every command you send is:\n" +
        "  1. Validated and routed to the right agent\n" +
        "  2. Queued and executed asynchronously\n" +
        "  3. Results streamed back here in real-time\n\n" +
        "Try one of the quick commands below, or type anything naturally.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation<
    RuntimeCommandResponse,
    Error,
    RuntimeCommandRequest
  >({
    mutationFn: submitRuntimeCommand,
    onMutate: () => {
      // Nothing — we handle optimistic UI manually below
    },
    onError: (err) => {
      toast.error(`Command failed: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ ${err.message}`,
          timestamp: new Date(),
        },
      ]);
    },
    onSuccess: (data) => {
      toast.success(`Queued: ${commandTypeLabel(data.command_type)}`, {
        duration: 2000,
      });

      // Prefetch initial task state
      queryClient.prefetchQuery({
        queryKey: ["runtime-task", data.task_id],
        queryFn: () => getTaskStatus(data.task_id),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            `✅ Command accepted\n` +
            `Agent: ${data.agent}  •  Type: ${commandTypeLabel(data.command_type)}\n` +
            `Status: ${data.status}`,
          timestamp: new Date(),
          taskId: data.task_id,
        },
      ]);
    },
  });

  const sendCommand = useCallback(
    (text?: string) => {
      const cmd = (text ?? input).trim();
      if (!cmd || sendMutation.isPending) return;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: cmd,
          timestamp: new Date(),
        },
      ]);
      setInput("");

      sendMutation.mutate({ command: cmd, priority: 5 });
    },
    [input, sendMutation],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    }
  };

  const isPending = sendMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-black/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
          <Lightning size={14} weight="fill" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            Runtime Command Agent
          </p>
          <p className="text-[11px] text-white/40">
            Connected to Railway backend · POST /api/v1/runtime/command
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-green-400/30 bg-green-400/10 text-green-400 text-[10px]"
        >
          LIVE
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isPending && (
            <div className="flex items-end gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 text-xs text-yellow-400">
                ⚡
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-white/8 bg-black/50 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-white/50">
                  <ArrowsClockwise size={12} className="animate-spin" />
                  <span className="text-xs">Dispatching to runtime…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Quick commands */}
      <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-4 py-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => sendCommand(cmd)}
            disabled={isPending}
            className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/40 transition-colors hover:border-yellow-400/30 hover:text-yellow-400 disabled:pointer-events-none disabled:opacity-40"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-white/8 p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={isPending}
          className={cn(
            "flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25",
            "outline-none focus:border-yellow-400/40 focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <Button
          size="icon"
          onClick={() => sendCommand()}
          disabled={isPending || !input.trim()}
          className="h-10 w-10 shrink-0 rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40"
        >
          {isPending ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} weight="bold" />
          )}
        </Button>
      </div>
    </div>
  );
}
