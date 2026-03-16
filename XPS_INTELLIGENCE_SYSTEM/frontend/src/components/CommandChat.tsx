"use client";

import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Bot, Loader2, Send, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  sendCommand,
  pollTaskUntilDone,
  type TaskStatusResponse,
} from "@/lib/runtimeClient";
import { sendChatMessage, type ChatHistoryMessage } from "@/lib/chatClient";

/** Unique ID generator for chat messages */
function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Chat message shape used internally (with history for Groq/Copilot) */
type LLMChatMessage = {
  role: "user" | "assistant";
  content: string;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  taskId?: string;
  taskStatus?: TaskStatusResponse;
  model?: string;
  timestamp: Date;
}

/**
 * Detect whether the user input is an explicit pipeline/scraper command
 * (vs a conversational message for the LLM).
 */
function isRuntimeCommand(input: string): boolean {
  const lower = input.toLowerCase().trim();
  return (
    lower.startsWith("scrape ") ||
    lower.startsWith("run ") ||
    lower.startsWith("execute ") ||
    lower.includes("run pipeline") ||
    lower.includes("run scraper") ||
    lower.includes("run outreach")
  );
}

function parseRuntimeCommand(input: string) {
  const lower = input.toLowerCase().trim();

  if (
    lower.includes("scrape") ||
    lower.includes("find") ||
    lower.includes("search")
  ) {
    return {
      command: "run_scraper",
      target: input,
      parameters: { query: input },
    };
  }
  if (lower.includes("seo") || lower.includes("audit")) {
    const urlMatch = input.match(/https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]{2,}/i);
    return {
      command: "run_seo_audit",
      target: urlMatch?.[0] ?? input,
      parameters: {},
    };
  }
  if (
    lower.includes("social") ||
    lower.includes("linkedin") ||
    lower.includes("facebook")
  ) {
    const urlMatch = input.match(/https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]{2,}/i);
    return {
      command: "run_social_scan",
      target: urlMatch?.[0] ?? input,
      parameters: {},
    };
  }
  if (
    lower.includes("browse") ||
    lower.includes("navigate") ||
    lower.includes("visit")
  ) {
    const urlMatch = input.match(/https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]{2,}/i);
    return {
      command: "run_browser",
      target: urlMatch?.[0] ?? input,
      parameters: { action: "navigate" },
    };
  }
  return {
    command: "health_check",
    target: null,
    parameters: { original_input: input },
  };
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    queued: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700 animate-pulse",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colours[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

// ── Task status badge ──────────────────────────────────────────────────────────
function TaskCard({ task }: { task: TaskStatusResponse }) {
  const done = task.status === "completed" || task.status === "failed";
  const colour =
    task.status === "completed"
      ? "#4ade80"
      : task.status === "failed"
        ? "#f87171"
        : "#FFD700";
  return (
    <div
      style={{
        marginTop: 8,
        padding: "4px 8px",
        background: "#111",
        borderRadius: 6,
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: colour,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span style={{ color: "#666" }}>{task.task_id?.slice(0, 12)}…</span>
      <span style={{ color: colour, fontWeight: 600 }}>{task.status}</span>
      {done && task.logs?.length > 0 && (
        <details style={{ marginLeft: 4 }}>
          <summary style={{ cursor: "pointer", color: "#888", fontSize: 10 }}>
            logs
          </summary>
          <pre style={{ color: "#aaa", marginTop: 4, fontSize: 10 }}>
            {task.logs.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Markdown render components (dark theme) ──────────────────────────────────
const MD_TABLE: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  marginTop: 8,
  marginBottom: 8,
  fontSize: 12,
};
const MD_TH: CSSProperties = {
  background: "#111",
  color: "#FFD700",
  padding: "4px 8px",
  textAlign: "left",
  fontWeight: 600,
  border: "1px solid #333",
};
const MD_TD: CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #222",
  color: "#ccc",
};
const MD_CODE: CSSProperties = {
  background: "#1a1a1a",
  color: "#4ade80",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "monospace",
};
const MD_PRE: CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "10px 12px",
  overflowX: "auto",
  margin: "8px 0",
};
const MD_STRONG: CSSProperties = { color: "#FFD700", fontWeight: 700 };
const MD_P: CSSProperties = { margin: "4px 0", lineHeight: 1.6 };
const MD_LI: CSSProperties = { marginBottom: 2 };
const MD_UL: CSSProperties = { paddingLeft: 18, margin: "4px 0" };

const mdComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <table style={MD_TABLE}>{children}</table>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th style={MD_TH}>{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td style={MD_TD}>{children}</td>
  ),
  code: ({
    inline,
    children,
  }: {
    inline?: boolean;
    children?: React.ReactNode;
  }) =>
    inline ? (
      <code style={MD_CODE}>{children}</code>
    ) : (
      <pre style={MD_PRE}>
        <code style={{ ...MD_CODE, background: "none", padding: 0 }}>
          {children}
        </code>
      </pre>
    ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong style={MD_STRONG}>{children}</strong>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={MD_P}>{children}</p>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={MD_LI}>{children}</li>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={MD_UL}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ ...MD_UL, listStyleType: "decimal" }}>{children}</ol>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1
      style={{
        color: "#FFD700",
        margin: "8px 0 4px",
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2
      style={{
        color: "#FFD700",
        margin: "8px 0 4px",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3
      style={{
        color: "#FFD700",
        margin: "6px 0 3px",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </h3>
  ),
  hr: () => (
    <hr
      style={{ border: "none", borderTop: "1px solid #333", margin: "8px 0" }}
    />
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote
      style={{
        borderLeft: "3px solid #FFD700",
        paddingLeft: 10,
        color: "#aaa",
        margin: "6px 0",
      }}
    >
      {children}
    </blockquote>
  ),
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CommandChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-init",
      role: "system",
      content:
        'XPS Intelligence AI ready. Ask me about leads, contractors, or type "scrape epoxy contractors in Ohio" to trigger the pipeline.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildHistory = (): LLMChatMessage[] =>
    messages
      .filter((m) => m.role !== "system")
      .slice(-20)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

  const addMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const full: ChatMessage = { ...msg, id: genId(), timestamp: new Date() };
    setMessages((prev) => [...prev, full]);
    return full.id;
  };

  const updateMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || loading) return;
    setInput("");
    setLoading(true);

    addMessage({ role: "user", content: userText });
    const assistantId = addMessage({ role: "assistant", content: "…" });

    try {
      if (isRuntimeCommand(userText)) {
        // ── Runtime pipeline command (scrape / run) ───────────────────────
        const cmd = parseRuntimeCommand(userText);
        const { task_id } = await sendCommand(cmd);

        const assistantId = addMessage({
          role: "assistant",
          content: `⚙️ Command submitted (${cmd.command}). Polling for results…`,
          taskId: task_id,
          taskStatus: { task_id, status: "queued", logs: [] },
        });

        pollTaskUntilDone(task_id, {
          intervalMs: 2000,
          timeoutMs: 120_000,
          onUpdate: (task) => {
            updateMessage(assistantId, {
              taskStatus: task,
              content:
                task.status === "completed"
                  ? `✅ Task completed (${cmd.command})`
                  : task.status === "failed"
                    ? `❌ Task failed: ${task.error ?? "unknown error"}`
                    : `⏳ Status: ${task.status}…`,
            });
          },
        }).catch((err) => {
          updateMessage(assistantId, {
            content: `⚠️ Polling error: ${err.message}`,
          });
        });
      } else {
        // ── Groq / GitHub Copilot chat (conversational) ───────────────────
        const history: ChatHistoryMessage[] = messages
          .filter(
            (m): m is ChatMessage & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant",
          )
          .map((m) => ({ role: m.role, content: m.content }));

        const assistantId = addMessage({
          role: "assistant",
          content: "⏳ Thinking…",
        });

        const response = await sendChatMessage({
          message: userText,
          agentRole: "LeadAgent",
          sessionId,
          history,
        });

        updateMessage(assistantId, {
          content: response.reply.content,
          model: response.reply.model,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Request failed";
      toast.error(message);
      addMessage({ role: "assistant", content: `❌ Error: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#050505",
        border: "1px solid #222",
        borderRadius: 12,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Bot className="h-4 w-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-700">
          XPS Intelligence Agent
        </h2>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <Zap className="h-3 w-3" /> Groq · Copilot
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "90%",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.5,
                ...(msg.role === "user"
                  ? {
                      background: "#1a1a00",
                      border: "1px solid #FFD700",
                      color: "#FFD700",
                    }
                  : msg.role === "system"
                    ? {
                        background: "#0a0a0a",
                        border: "1px solid #1a1a1a",
                        color: "#666",
                        fontStyle: "italic",
                        fontSize: 12,
                      }
                    : {
                        background: "#0d0d0d",
                        border: "1px solid #222",
                        color: "#ccc",
                      }),
              }}
            >
              {msg.role === "assistant" ? (
                <div style={{ color: "#ccc" }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={
                      mdComponents as Record<
                        string,
                        React.ComponentType<React.HTMLAttributes<HTMLElement>>
                      >
                    }
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              )}
              {msg.taskStatus && <TaskCard task={msg.taskStatus} />}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "#0d0d0d",
                border: "1px solid #222",
                color: "#555",
                fontSize: 13,
              }}
            >
              <span style={{ animation: "pulse 1s infinite" }}>
                ⚡ Thinking…
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 16px",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything — scrape leads, analyze data, run audits…"
          disabled={loading}
          style={{
            flex: 1,
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
            color: "#fff",
            fontSize: "0.875rem",
            outline: "none",
            padding: "0.5rem 0.75rem",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? "#333" : "#FFD700",
            border: "none",
            borderRadius: 8,
            color: loading || !input.trim() ? "#666" : "#000",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
            padding: "0.5rem 1rem",
            transition: "all 0.15s",
          }}
        >
          {loading ? "⌛" : "➤ Send"}
        </button>
      </form>
    </div>
  );
}
