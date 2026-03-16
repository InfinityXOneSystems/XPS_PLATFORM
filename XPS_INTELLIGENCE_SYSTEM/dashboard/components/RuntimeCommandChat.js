// dashboard/components/RuntimeCommandChat.js
// =============================================
// XPS Intelligence – Autonomous LLM Chat Agent  (Enhanced)
//
// Capabilities:
//   ✅ Fully autonomous orchestration (multi-step pipelines)
//   ✅ Parallel instances (N concurrent worker slots)
//   ✅ Tool-call / action-step visualization (Manus-style)
//   ✅ Autonomous coding (generate/edit/deploy code)
//   ✅ Shadow scraping (background enrichment, asyncio REST API scraper)
//   ✅ Live frontend & backend file editing (via /runtime/file)
//   ✅ Access to all connected accounts (connectors API)
//   ✅ GitHub sandbox (create branches, PRs, commit code)
//   ✅ Google Workspace (Gmail, Drive, Calendar, Docs, Sheets)
//   ✅ Vercel deploy trigger
//   ✅ Docker MCP commands
//   ✅ Agent orchestration sidebar (list + start/stop all agents)
//   ✅ Settings sync

import React, { useState, useRef, useEffect, useCallback } from "react";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 120;
const MAX_PARALLEL_SLOTS = 6;

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.__NEXT_PUBLIC_API_URL) ||
    "http://localhost:3099"
  );
}

// ---------------------------------------------------------------------------
// Capability command library
// ---------------------------------------------------------------------------
const CAPABILITY_GROUPS = [
  {
    label: "🕷️ Scraping",
    cmds: [
      "scrape epoxy contractors in Pompano Beach FL",
      "scrape flooring contractors in Miami FL",
      "shadow scrape — background enrichment run",
      "run parallel 4-agent scrape across FL cities",
    ],
  },
  {
    label: "🤖 Orchestration",
    cmds: [
      "run full pipeline: scrape → score → dedup → outreach",
      "run autonomous seo + outreach campaign",
      "orchestrate all agents",
      "run full pipeline on 8 parallel workers",
    ],
  },
  {
    label: "💻 Coding",
    cmds: [
      "generate React lead card component",
      "write Python data enrichment script",
      "create REST API endpoint for lead export",
      "generate asyncio scraper for contractor directories",
    ],
  },
  {
    label: "🔌 Accounts",
    cmds: [
      "send outreach email via Gmail",
      "create lead report in Google Sheets",
      "trigger Vercel frontend deploy",
      "push code to GitHub sandbox branch",
    ],
  },
  {
    label: "🎨 UI/Edit",
    cmds: [
      "edit dashboard homepage CSS",
      "generate settings page UI",
      "live edit chat.js — add dark mode toggle",
      "read current workspace.js source",
    ],
  },
  {
    label: "🧠 Intelligence",
    cmds: [
      "run vision cortex intelligence scrape",
      "generate daily briefing report",
      "scan market trends in AI",
      "detect niches in flooring industry",
    ],
  },
  {
    label: "🔬 Invention",
    cmds: [
      "run invention pipeline for construction industry",
      "generate hypothesis: AI automation for small contractors",
      "design experiment for pricing optimization",
      "generate 5 business ideas for flooring market",
    ],
  },
  {
    label: "📈 Predictions",
    cmds: [
      "predict growth for AI sector",
      "model industry growth for construction",
      "score niche opportunity: epoxy flooring in Miami",
      "run discovery scan for emerging markets",
    ],
  },
  {
    label: "🛡️ Guardian",
    cmds: [
      "run system health check",
      "check anomalies",
      "get system status",
      "watchdog scan",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statusColor(s) {
  return (
    {
      queued: "#888",
      pending: "#888",
      running: "#FFD700",
      completed: "#4ade80",
      failed: "#f87171",
      retrying: "#fb923c",
      error: "#f87171",
      idle: "#555",
      starting: "#f59e0b",
    }[s] || "#888"
  );
}

function statusEmoji(s) {
  return (
    {
      queued: "⏳",
      pending: "⏳",
      running: "⚡",
      completed: "✅",
      failed: "❌",
      retrying: "🔄",
      idle: "��",
      starting: "🚀",
      error: "❌",
    }[s] || "❓"
  );
}

function ago(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskStatusPanel({ task }) {
  if (!task) return null;
  return (
    <div style={S.taskPanel}>
      <div style={S.taskHeader}>
        <span
          style={{ ...S.statusDot, background: statusColor(task.status) }}
        />
        <span style={S.taskLabel}>
          Task {task.task_id ? task.task_id.slice(0, 8) : "…"}
        </span>
        <span style={{ ...S.statusText, color: statusColor(task.status) }}>
          {task.status?.toUpperCase()}
        </span>
      </div>
      {task.agent && <div style={S.taskMeta}>agent: {task.agent}</div>}
      {task.logs && task.logs.length > 0 && (
        <div style={S.taskLogs}>
          {task.logs.slice(-4).map((l, i) => (
            <div key={i} style={S.logLine}>
              {l}
            </div>
          ))}
        </div>
      )}
      {task.result && (
        <pre style={S.taskResult}>
          {typeof task.result === "string"
            ? task.result
            : JSON.stringify(task.result, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Manus-style tool call step — shows what the agent is doing
function ToolCallStep({ step, idx }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={S.toolStep}>
      <div style={S.toolStepHeader} onClick={() => setExpanded((v) => !v)}>
        <span style={{ color: statusColor(step.status), fontSize: "0.8rem" }}>
          {statusEmoji(step.status)}
        </span>
        <span style={S.toolStepLabel}>{step.label}</span>
        <span style={{ color: "#555", fontSize: "0.7rem", marginLeft: "auto" }}>
          {ago(step.timestamp)}
        </span>
        <span style={{ color: "#444", marginLeft: "0.4rem" }}>
          {expanded ? "▾" : "▸"}
        </span>
      </div>
      {expanded && step.detail && (
        <pre style={S.toolStepDetail}>{step.detail}</pre>
      )}
    </div>
  );
}

// Parallel worker slot — one of N concurrent task slots
function WorkerSlot({ slot, onStop }) {
  if (!slot) {
    return (
      <div style={{ ...S.workerSlot, borderColor: "#1a1a1a" }}>
        <span style={{ color: "#333", fontSize: "0.75rem" }}>Empty slot</span>
      </div>
    );
  }
  return (
    <div style={{ ...S.workerSlot, borderColor: statusColor(slot.status) }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.25rem",
        }}
      >
        <span
          style={{
            color: statusColor(slot.status),
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          {statusEmoji(slot.status)} {slot.status.toUpperCase()}
        </span>
        <span style={{ color: "#555", fontSize: "0.65rem" }}>
          {slot.task_id?.slice(0, 8)}
        </span>
        {onStop && slot.status === "running" && (
          <button style={S.stopBtn} onClick={() => onStop(slot.task_id)}>
            ■
          </button>
        )}
      </div>
      <div
        style={{
          color: "#aaa",
          fontSize: "0.72rem",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {slot.command?.slice(0, 48)}
      </div>
      {slot.agent && (
        <div
          style={{ color: "#555", fontSize: "0.65rem", marginTop: "0.1rem" }}
        >
          agent: {slot.agent}
        </div>
      )}
    </div>
  );
}

function AgentSidebarItem({ agent, onStart }) {
  return (
    <div style={S.agentItem}>
      <div
        style={{
          ...S.statusDot,
          background: statusColor(agent.status),
          margin: "0 0.4rem 0 0",
        }}
      />
      <span style={{ color: "#ccc", fontSize: "0.78rem", flex: 1 }}>
        {agent.name}
      </span>
      <span
        style={{ color: "#555", fontSize: "0.65rem", marginRight: "0.4rem" }}
      >
        {agent.status}
      </span>
      {agent.status !== "running" && (
        <button style={S.agentStartBtn} onClick={() => onStart(agent.name)}>
          ▶
        </button>
      )}
    </div>
  );
}

function ShadowIndicator({ tasks }) {
  const running = tasks.filter((t) => t.status === "running").length;
  if (running === 0) return null;
  return (
    <div style={S.shadowBadge}>
      <span style={{ color: "#FFD700", marginRight: "0.3rem" }}>⚡</span>
      {running} background task{running > 1 ? "s" : ""}
    </div>
  );
}

function MessageBubble({ msg, onSuggestion }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        ...S.messageRow,
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      {!isUser && <div style={S.avatar}>⚡</div>}
      <div
        style={{
          ...S.bubble,
          background: isUser ? "#FFD700" : "#111",
          color: isUser ? "#000" : "#fff",
          border: isUser ? "none" : "1px solid #222",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        }}
      >
        <pre style={S.bubbleText}>{msg.content}</pre>
        {msg.toolSteps && msg.toolSteps.length > 0 && (
          <div style={{ marginTop: "0.5rem" }}>
            {msg.toolSteps.map((step, i) => (
              <ToolCallStep key={i} step={step} idx={i} />
            ))}
          </div>
        )}
        {msg.taskData && <TaskStatusPanel task={msg.taskData} />}
        {msg.fileEdit && (
          <div style={S.fileEditBadge}>
            📝 File edited:{" "}
            <code style={{ color: "#FFD700" }}>{msg.fileEdit.path}</code>
            <span style={{ color: "#4ade80", marginLeft: "0.5rem" }}>
              {msg.fileEdit.lines_written} lines
            </span>
          </div>
        )}
      </div>
      {isUser && (
        <div style={{ ...S.avatar, background: "#FFD700", color: "#000" }}>
          U
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function RuntimeCommandChat({ suggestions = [] }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Welcome to XPS Intelligence Autonomous Agent!\n\n" +
        "I operate like Manus — fully autonomous, parallel, and self-directing:\n\n" +
        "  🕷️  Shadow scraping — asyncio background REST API scraper\n" +
        "  ⚡  Parallel workers — up to 6 concurrent task slots\n" +
        "  🤖  Autonomous orchestration — multi-step pipelines\n" +
        "  💻  Live coding — generate/edit frontend & backend files\n" +
        "  📝  Live site editing — every page editable in real-time\n" +
        "  🧠  Vision Cortex — 30-source intelligence ingestion\n" +
        "  🔬  Invention Lab — idea generation, scoring, experiment design\n" +
        "  📈  Predictions — market, niche, and industry forecasting\n" +
        "  🛡️  System Guardian — health monitoring and auto-repair\n" +
        "  🐙  GitHub — branches, commits, PRs, Actions\n" +
        "  📧  Gmail, Google Sheets, Vercel deploy, Docker MCP\n\n" +
        "Type any command below or pick one from the suggestions ↓",
      toolSteps: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const [showCaps, setShowCaps] = useState(true);

  // Parallel workers
  const [workers, setWorkers] = useState([]); // [{task_id, command, status, agent}]
  const [showWorkers, setShowWorkers] = useState(false);

  // Agent sidebar
  const [agents, setAgents] = useState([]);
  const [showAgents, setShowAgents] = useState(false);

  // Shadow background tasks
  const [shadowTasks, setShadowTasks] = useState([]);

  // File editor modal
  const [fileEditor, setFileEditor] = useState(null); // {path, content}

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const workerPollRefs = useRef({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll shadow status every 8 seconds
  useEffect(() => {
    const api = getApiBase();
    const fetchShadow = () => {
      fetch(`${api}/api/v1/runtime/shadow/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.tasks) setShadowTasks(d.tasks);
        })
        .catch(() => {});
    };
    fetchShadow();
    const id = setInterval(fetchShadow, 8000);
    return () => clearInterval(id);
  }, []);

  // Fetch agents list once on mount
  useEffect(() => {
    const api = getApiBase();
    fetch(`${api}/api/v1/agents`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.agents) setAgents(d.agents);
      })
      .catch(() => {});
  }, []);

  // Poll a single worker task slot
  const pollWorkerSlot = useCallback((taskId) => {
    const api = getApiBase();
    let attempts = 0;
    const tick = async () => {
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setWorkers((prev) =>
          prev.map((w) =>
            w.task_id === taskId ? { ...w, status: "failed" } : w,
          ),
        );
        return;
      }
      attempts++;
      try {
        const r = await fetch(`${api}/api/v1/runtime/task/${taskId}`);
        if (!r.ok) {
          setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        const d = await r.json();
        setWorkers((prev) =>
          prev.map((w) =>
            w.task_id === taskId
              ? { ...w, status: d.status, agent: d.agent }
              : w,
          ),
        );
        if (!["completed", "failed"].includes(d.status))
          setTimeout(tick, POLL_INTERVAL_MS);
        else delete workerPollRefs.current[taskId];
      } catch {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    workerPollRefs.current[taskId] = true;
    tick();
  }, []);

  // Poll a chat message task
  const pollTask = useCallback(async (taskId, msgIdx) => {
    const apiBase = getApiBase();
    let attempts = 0;
    const tick = async () => {
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setMessages((prev) => {
          const next = [...prev];
          if (next[msgIdx])
            next[msgIdx] = {
              ...next[msgIdx],
              taskData: {
                ...next[msgIdx].taskData,
                status: "failed",
                error: "Polling timeout",
              },
            };
          return next;
        });
        setLoading(false);
        return;
      }
      attempts++;
      try {
        const resp = await fetch(`${apiBase}/api/v1/runtime/task/${taskId}`);
        if (!resp.ok) {
          setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        const data = await resp.json();
        // Build tool steps from logs
        const toolSteps = (data.logs || []).map((log, i) => ({
          label: log,
          status:
            data.status === "failed"
              ? "failed"
              : i < (data.logs || []).length - 1
                ? "completed"
                : data.status,
          timestamp: data.created_at,
          detail: null,
        }));
        setMessages((prev) => {
          const next = [...prev];
          if (next[msgIdx])
            next[msgIdx] = { ...next[msgIdx], taskData: data, toolSteps };
          return next;
        });
        if (!["completed", "failed"].includes(data.status))
          setTimeout(tick, POLL_INTERVAL_MS);
        else setLoading(false);
      } catch {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();
  }, []);

  // Dispatch N commands to the parallel endpoint
  const runParallel = useCallback(
    async (cmds) => {
      const api = getApiBase();
      setShowWorkers(true);
      try {
        const resp = await fetch(`${api}/api/v1/runtime/parallel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commands: cmds.map((c) => ({ command: c, priority: 6 })),
          }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const newSlots = data.tasks.map((t) => ({
          task_id: t.task_id,
          command: t.params?.command || cmds[data.tasks.indexOf(t)] || "…",
          status: t.status,
          agent: t.agent,
        }));
        setWorkers((prev) => {
          const combined = [
            ...prev.filter((w) => ["completed", "failed"].includes(w.status)),
            ...newSlots,
          ];
          return combined.slice(-MAX_PARALLEL_SLOTS);
        });
        newSlots.forEach((s) => pollWorkerSlot(s.task_id));
      } catch {
        /* silent */
      }
    },
    [pollWorkerSlot],
  );

  // Read a file and open the editor modal
  const readFile = useCallback(async (path) => {
    const api = getApiBase();
    try {
      const r = await fetch(
        `${api}/api/v1/runtime/file?path=${encodeURIComponent(path)}`,
      );
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }, []);

  // Write a file and return info
  const writeFile = useCallback(async (path, content) => {
    const api = getApiBase();
    try {
      const r = await fetch(`${api}/api/v1/runtime/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          content,
          message: "agent: live edit via chat",
        }),
      });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }, []);

  // Start an agent from the sidebar
  const startAgent = useCallback(async (name) => {
    const api = getApiBase();
    try {
      const r = await fetch(`${api}/api/v1/agents/${name}/start`, {
        method: "POST",
      });
      if (r.ok) {
        setAgents((prev) =>
          prev.map((a) => (a.name === name ? { ...a, status: "running" } : a)),
        );
      }
    } catch {
      /* silent */
    }
  }, []);

  // Orchestrate all agents
  const orchestrateAll = useCallback(async () => {
    const api = getApiBase();
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "🤖 Orchestrating all backend agents…",
        toolSteps: [
          {
            label: "POST /runtime/agents/run-all",
            status: "running",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    ]);
    try {
      const r = await fetch(`${api}/api/v1/runtime/agents/run-all`, {
        method: "POST",
      });
      const d = r.ok ? await r.json() : null;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last) {
          last.content = `🤖 Orchestrating all backend agents…\n\n${d ? `✅ ${d.total} agents dispatched` : "❌ Failed"}`;
          last.toolSteps = (d?.dispatched || []).map((a) => ({
            label: `${a.agent} → ${a.task_id?.slice(0, 8) || "error"}`,
            status: a.status === "dispatch_error" ? "failed" : "queued",
            timestamp: new Date().toISOString(),
          }));
        }
        return next;
      });
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Orchestrate error: ${e.message}` },
      ]);
    }
  }, []);

  const sendCommand = useCallback(
    async (text) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: msg }]);
      setLoading(true);
      const apiBase = getApiBase();

      // ── Local commands ──────────────────────────────────────────────
      if (msg === "help" || msg === "?") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: [
              "🤖 XPS Agent Commands:",
              "",
              "── Scraping & Pipelines ──",
              "scrape <type> in <city> <state>",
              "run full pipeline",
              "run parallel 4-agent scrape across FL cities",
              "orchestrate all agents",
              "",
              "── Intelligence & Research ──",
              "run vision cortex intelligence scrape",
              "generate daily briefing report",
              "scan market trends in <category>",
              "detect niches in <industry>",
              "predict growth for <sector>",
              "generate hypothesis: <observation>",
              "design experiment for <hypothesis>",
              "run invention pipeline for <industry>",
              "generate 5 business ideas for <market>",
              "",
              "── Analytics & Discovery ──",
              "run seo analysis on <url>",
              "run discovery scan for emerging markets",
              "model industry growth for <industry>",
              "",
              "── System ──",
              "run system health check",
              "get system status",
              "watchdog scan",
              "export leads",
              "",
              "── Coding & Editing ──",
              "generate <component/script>",
              "read file <path>",
              "edit file <path>",
              "",
              "── Accounts ──",
              "send email via gmail",
              "trigger vercel deploy",
              "push to github <branch>",
              "docker list containers",
              "",
              "status  |  help",
            ].join("\n"),
          },
        ]);
        setLoading(false);
        return;
      }

      if (msg === "status") {
        try {
          const [health, shadow] = await Promise.all([
            fetch(`${apiBase}/health`)
              .then((r) => r.json())
              .catch(() => null),
            fetch(`${apiBase}/api/v1/runtime/shadow/status`)
              .then((r) => r.json())
              .catch(() => null),
          ]);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: [
                `🟢 System: ${health?.status || "unknown"}`,
                `Service: ${health?.service || "—"} v${health?.version || "—"}`,
                shadow
                  ? `\n📊 Background Tasks: ${shadow.total} total · ${shadow.running} running · ${shadow.completed} completed · ${shadow.failed} failed`
                  : "",
              ].join("\n"),
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Backend unreachable: ${e.message}`,
            },
          ]);
        }
        setLoading(false);
        return;
      }

      // Orchestrate all agents
      if (msg.toLowerCase().includes("orchestrate all agents")) {
        setLoading(false);
        await orchestrateAll();
        return;
      }

      // Read file command
      const readMatch = msg.match(/read\s+file\s+(.+)/i);
      if (readMatch) {
        const path = readMatch[1].trim();
        const file = await readFile(path);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: file
              ? `📄 ${path} (${file.lines} lines, ${file.size} bytes):\n\n${file.content.slice(0, 2000)}${file.content.length > 2000 ? "\n…(truncated)" : ""}`
              : `❌ Could not read file: ${path}`,
          },
        ]);
        setLoading(false);
        return;
      }

      // Edit file command — open live editor
      const editMatch = msg.match(/edit\s+file\s+(.+)/i);
      if (editMatch) {
        const path = editMatch[1].trim();
        const file = await readFile(path);
        if (file) {
          setFileEditor({ path, content: file.content });
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `📝 Opening live editor for: ${path}\n\nMake edits in the editor panel that appeared below.`,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Cannot open editor — file not found: ${path}`,
            },
          ]);
        }
        setLoading(false);
        return;
      }

      // Parallel scrape command
      if (
        msg.toLowerCase().includes("parallel") &&
        msg.toLowerCase().includes("scrape")
      ) {
        const cities = [
          "Miami FL",
          "Orlando FL",
          "Tampa FL",
          "Jacksonville FL",
        ];
        const keyword = msg.toLowerCase().includes("epoxy")
          ? "epoxy contractors"
          : "flooring contractors";
        const cmds = cities.map((c) => `scrape ${keyword} in ${c}`);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚡ Launching 4 parallel scrape workers:\n${cmds.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}\n\nCheck the Workers panel →`,
            toolSteps: cmds.map((c, i) => ({
              label: `Worker ${i + 1}: ${c}`,
              status: "queued",
              timestamp: new Date().toISOString(),
            })),
          },
        ]);
        await runParallel(cmds);
        setLoading(false);
        return;
      }

      // Gmail
      if (
        msg.toLowerCase().includes("gmail") ||
        msg.toLowerCase().includes("send email")
      ) {
        try {
          const r = await fetch(
            `${apiBase}/api/v1/connectors/google/workspace`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                service: "gmail",
                action: "send",
                payload: { command: msg },
              }),
            },
          );
          const d = await r.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `📧 Gmail: ${d.message || JSON.stringify(d)}`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Gmail error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // Vercel deploy
      if (
        msg.toLowerCase().includes("vercel deploy") ||
        msg.toLowerCase().includes("trigger deploy")
      ) {
        try {
          const r = await fetch(`${apiBase}/api/v1/connectors/vercel/deploy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const d = await r.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `▲ Vercel Deploy\n\n${d.success ? "✅ Triggered" : "❌ Failed"}: ${d.message}\nWebhook: prj_eNK90PC48eWsMW3O6aHHRWsM4wwI`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Vercel error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // Docker
      if (msg.toLowerCase().includes("docker")) {
        try {
          const r = await fetch(`${apiBase}/api/v1/connectors/docker/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list", payload: { command: msg } }),
          });
          const d = await r.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `🐋 Docker: ${d.message || JSON.stringify(d)}`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Docker MCP error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Intelligence / Vision Cortex ─────────────────────────────────
      if (
        msg.toLowerCase().includes("vision cortex") ||
        msg.toLowerCase().includes("intelligence scrape")
      ) {
        try {
          const r = await fetch(
            `${apiBase}/api/v1/intelligence/vision-cortex/run`,
            { method: "POST" },
          );
          const d = r.ok ? await r.json() : null;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: d
                ? `🧠 Vision Cortex\n\nStatus: ${d.status}\nSources queued: ${d.sources_queued || "N/A"}\n\n${d.message || "Intelligence scrape triggered."}`
                : "❌ Could not trigger intelligence scrape.",
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Intelligence error: ${e.message}`,
            },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Daily Briefing ───────────────────────────────────────────────
      if (
        msg.toLowerCase().includes("daily briefing") ||
        msg.toLowerCase().includes("briefing report")
      ) {
        try {
          const r = await fetch(`${apiBase}/api/v1/intelligence/briefing`);
          const d = r.ok ? await r.json() : null;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: d?.briefing_markdown
                ? `📊 Daily Briefing\n\n${d.briefing_markdown.slice(0, 2000)}`
                : `📊 Daily Briefing\n\n${d ? JSON.stringify(d, null, 2).slice(0, 1200) : "❌ Briefing unavailable."}`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Briefing error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Market Scan / Trends ─────────────────────────────────────────
      if (
        msg.toLowerCase().includes("scan market") ||
        msg.toLowerCase().includes("market trends") ||
        msg.toLowerCase().includes("detect niches")
      ) {
        try {
          const [trendsResp, nichesResp] = await Promise.all([
            fetch(`${apiBase}/api/v1/intelligence/trends`)
              .then((r) => r.json())
              .catch(() => null),
            fetch(`${apiBase}/api/v1/intelligence/niches`)
              .then((r) => r.json())
              .catch(() => null),
          ]);
          const trends = trendsResp?.trends || [];
          const niches = nichesResp?.niches || [];
          const trendStr =
            trends
              .slice(0, 5)
              .map((t) => `  📈 ${t.name || t.trend} (${t.category || "—"})`)
              .join("\n") || "  No trends found.";
          const nicheStr =
            niches
              .slice(0, 5)
              .map(
                (n) =>
                  `  🎯 ${n.niche || n.name} — score: ${n.opportunity_score ?? n.score ?? "—"}`,
              )
              .join("\n") || "  No niches found.";
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `📊 Market Intelligence\n\nTop Trends:\n${trendStr}\n\nTop Niches:\n${nicheStr}\n\nVisit /trends for full view`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Market scan error: ${e.message}`,
            },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Invention Pipeline ───────────────────────────────────────────
      if (
        msg.toLowerCase().includes("invention pipeline") ||
        (msg.toLowerCase().includes("generate") &&
          msg.toLowerCase().includes("ideas"))
      ) {
        const industry =
          msg
            .match(/for\s+(\w[\w\s]+?)(?:\s+market|\s+industry|$)/i)?.[1]
            ?.trim() || "construction";
        try {
          const r = await fetch(
            `${apiBase}/api/v1/intelligence/invention/run`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ industry, count: 3 }),
            },
          );
          const d = r.ok ? await r.json() : null;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: d?.report_preview
                ? `🔬 Invention Pipeline — ${industry}\n\n${d.report_preview.slice(0, 2000)}`
                : `🔬 Invention Pipeline — ${industry}\n\n${d ? `Generated ${d.ideas_generated || 0} ideas` : "❌ Pipeline failed."}`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Invention error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Predictions ──────────────────────────────────────────────────
      if (
        msg.toLowerCase().includes("predict") ||
        msg.toLowerCase().includes("forecast") ||
        msg.toLowerCase().includes("growth model")
      ) {
        const sector =
          msg
            .match(/(?:for|in)\s+(\w[\w\s]+?)(?:\s+sector|\s+industry|$)/i)?.[1]
            ?.trim() || "technology";
        try {
          const r = await fetch(
            `${apiBase}/api/v1/intelligence/predictions/${encodeURIComponent(sector)}`,
          );
          const d = r.ok ? await r.json() : null;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: d
                ? `📈 Prediction — ${sector}\n\nGrowth: ${d.growth_prediction ?? "—"}%\nConfidence: ${Math.round((d.confidence ?? 0) * 100)}%\nRecommendation: ${d.recommendation ?? "—"}\n\nBullish signals:\n${(
                    d.bullish_signals || []
                  )
                    .slice(0, 3)
                    .map((s) => `  • ${s}`)
                    .join("\n")}`
                : `❌ Prediction unavailable for sector: ${sector}`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Prediction error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── System Health / Guardian ─────────────────────────────────────
      if (
        msg.toLowerCase().includes("health check") ||
        msg.toLowerCase().includes("system status") ||
        msg.toLowerCase().includes("watchdog") ||
        msg.toLowerCase().includes("anomalies")
      ) {
        try {
          const [healthResp, metricsResp] = await Promise.all([
            fetch(`${apiBase}/api/v1/system/health`)
              .then((r) => r.json())
              .catch(() => null),
            fetch(`${apiBase}/api/v1/system/metrics`)
              .then((r) => r.json())
              .catch(() => null),
          ]);
          const subsystems = healthResp?.checks || {};
          const lines = Object.entries(subsystems).map(
            ([k, v]) =>
              `  ${v?.status === "ok" || v === true ? "✅" : v?.status === "degraded" ? "⚠️" : "❌"} ${k}: ${v?.status || String(v)}`,
          );
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `🛡️ System Guardian\n\nOverall: ${healthResp?.status ?? "unknown"}\n\nSubsystems:\n${lines.join("\n") || "  (no subsystem data)"}\n\nWorkers: ${metricsResp?.workers?.total_workers ?? "—"} total`,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Health check error: ${e.message}`,
            },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Hypothesis Generator ─────────────────────────────────────────
      if (msg.toLowerCase().includes("hypothesis")) {
        const observation =
          msg.replace(/generate hypothesis[:\s]*/i, "").trim() || msg;
        try {
          const r = await fetch(
            `${apiBase}/api/v1/intelligence/hypotheses/generate?observation=${encodeURIComponent(observation)}`,
          );
          const d = r.ok ? await r.json() : null;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: d?.hypothesis
                ? `🔬 Hypothesis Generated\n\n"${d.hypothesis}"\n\nConfidence: ${Math.round((d.confidence ?? 0) * 100)}%\nCategory: ${d.category}\nTestability: ${d.testability}\n\nSuggested experiments:\n${(d.suggested_experiments || []).map((e) => `  • ${e}`).join("\n")}`
                : "❌ Could not generate hypothesis.",
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Hypothesis error: ${e.message}` },
          ]);
        }
        setLoading(false);
        return;
      }

      // ── Default: runtime command API ────────────────────────────────
      try {
        const resp = await fetch(`${apiBase}/api/v1/runtime/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: msg, priority: 5 }),
        });
        if (!resp.ok) {
          const err = await resp
            .json()
            .catch(() => ({ detail: resp.statusText }));
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Error: ${typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)}`,
            },
          ]);
          setLoading(false);
          return;
        }
        const data = await resp.json();
        const taskId = data.task_id || data.id;
        const msgIdx = messages.length + 2;
        setMessages((prev) => {
          const next = [
            ...prev,
            {
              role: "assistant",
              content: `✅ Command accepted\nAgent: ${data.agent || data.command_type}\nTask ID: ${taskId}`,
              taskData: {
                task_id: taskId,
                status: data.status || "queued",
                agent: data.agent,
              },
              toolSteps: [
                {
                  label: `Dispatched to agent: ${data.agent}`,
                  status: "running",
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          ];
          return next;
        });
        pollTask(taskId, msgIdx);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ Connection error: ${err.message}\n\nMake sure the backend is running on ${apiBase}`,
          },
        ]);
        setLoading(false);
      }
    },
    [
      input,
      loading,
      pollTask,
      runParallel,
      orchestrateAll,
      readFile,
      messages.length,
    ],
  );

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    }
  };

  // ---------------------------------------------------------------------------
  // File editor save
  // ---------------------------------------------------------------------------
  const saveFileEdit = useCallback(async () => {
    if (!fileEditor) return;
    const result = await writeFile(fileEditor.path, fileEditor.content);
    if (result) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ File saved: ${fileEditor.path}\n${result.lines_written} lines · ${result.bytes_written} bytes`,
          fileEdit: result,
        },
      ]);
      setFileEditor(null);
    }
  }, [fileEditor, writeFile]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={S.container}>
      {/* Shadow indicator */}
      <ShadowIndicator tasks={shadowTasks} />

      {/* Messages area */}
      <div style={S.messages}>
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} onSuggestion={sendCommand} />
        ))}
        {loading && (
          <div style={{ ...S.messageRow, justifyContent: "flex-start" }}>
            <div style={S.avatar}>⚡</div>
            <div
              style={{
                ...S.bubble,
                background: "#111",
                border: "1px solid #222",
                borderRadius: "18px 18px 18px 4px",
              }}
            >
              <span style={S.typing}>●●●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* File live editor */}
      {fileEditor && (
        <div style={S.fileEditorPanel}>
          <div style={S.fileEditorHeader}>
            <span style={{ color: "#FFD700", fontWeight: 700 }}>
              📝 Live Editor: {fileEditor.path}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button style={S.saveBtnGreen} onClick={saveFileEdit}>
                💾 Save & Deploy
              </button>
              <button style={S.cancelBtn} onClick={() => setFileEditor(null)}>
                ✕ Close
              </button>
            </div>
          </div>
          <textarea
            style={S.fileEditorTextarea}
            value={fileEditor.content}
            onChange={(e) =>
              setFileEditor({ ...fileEditor, content: e.target.value })
            }
            spellCheck={false}
          />
        </div>
      )}

      {/* Parallel Workers Panel */}
      <div style={S.workersBar}>
        <button style={S.capToggle} onClick={() => setShowWorkers((v) => !v)}>
          {showWorkers ? "▾" : "▸"} Workers (
          {workers.filter((w) => w.status === "running").length}/
          {workers.length})
        </button>
        <button style={S.capToggle} onClick={() => setShowAgents((v) => !v)}>
          {showAgents ? "▾" : "▸"} Agents ({agents.length})
        </button>
        <button
          style={{ ...S.capToggle, marginLeft: "auto", color: "#FFD700" }}
          onClick={() => {
            const cities = [
              "Miami FL",
              "Orlando FL",
              "Tampa FL",
              "Jacksonville FL",
            ];
            runParallel(cities.map((c) => `scrape epoxy contractors in ${c}`));
            setShowWorkers(true);
          }}
        >
          ⚡ 4x Parallel
        </button>
        <button
          style={{ ...S.capToggle, color: "#fb923c" }}
          onClick={orchestrateAll}
        >
          🤖 Orchestrate All
        </button>
      </div>

      {showWorkers && (
        <div style={S.workersGrid}>
          {Array.from({ length: Math.max(4, workers.length) }, (_, i) => (
            <WorkerSlot key={i} slot={workers[i] || null} />
          ))}
        </div>
      )}

      {showAgents && agents.length > 0 && (
        <div style={S.agentsList}>
          {agents.map((a) => (
            <AgentSidebarItem key={a.name} agent={a} onStart={startAgent} />
          ))}
        </div>
      )}

      {/* Capability Groups */}
      <div style={S.capBar}>
        <button style={S.capToggle} onClick={() => setShowCaps((v) => !v)}>
          {showCaps ? "▾ Commands" : "▸ Commands"}
        </button>
        {showCaps && (
          <>
            <div style={S.groupTabs}>
              {CAPABILITY_GROUPS.map((g, i) => (
                <button
                  key={i}
                  style={{
                    ...S.groupTab,
                    ...(activeGroup === i ? S.groupTabActive : {}),
                  }}
                  onClick={() => setActiveGroup(i)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div style={S.cmdRow}>
              {CAPABILITY_GROUPS[activeGroup].cmds.map((cmd) => (
                <button
                  key={cmd}
                  style={S.chip}
                  onClick={() => sendCommand(cmd)}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Input */}
      <div style={S.inputRow}>
        <textarea
          ref={inputRef}
          style={S.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type any command… (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...S.sendBtn, opacity: loading ? 0.5 : 1 }}
          onClick={() => sendCommand()}
          disabled={loading}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#000",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "1rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#1a1a1a",
    border: "1px solid #FFD700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.85rem",
    flexShrink: 0,
  },
  bubble: { padding: "0.75rem 1rem", maxWidth: "75%" },
  bubbleText: {
    margin: 0,
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    fontSize: "0.9rem",
  },
  typing: { color: "#FFD700", letterSpacing: "0.15em" },

  // Task panel
  taskPanel: {
    marginTop: "0.75rem",
    background: "#0d0d0d",
    border: "1px solid #222",
    borderRadius: "8px",
    padding: "0.75rem",
    fontSize: "0.8rem",
  },
  taskHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    marginBottom: "0.4rem",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  taskLabel: { color: "#888", flex: 1 },
  statusText: { fontWeight: 700, fontSize: "0.7rem" },
  taskMeta: { color: "#666", marginBottom: "0.4rem" },
  taskLogs: { marginBottom: "0.4rem" },
  logLine: { color: "#666", fontSize: "0.72rem", lineHeight: 1.5 },
  taskResult: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "4px",
    padding: "0.5rem",
    color: "#4ade80",
    fontSize: "0.75rem",
    maxHeight: "200px",
    overflowY: "auto",
    margin: 0,
    whiteSpace: "pre-wrap",
  },

  // Tool call steps
  toolStep: {
    marginTop: "0.3rem",
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "6px",
    overflow: "hidden",
  },
  toolStepHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.3rem 0.6rem",
    cursor: "pointer",
  },
  toolStepLabel: { color: "#aaa", fontSize: "0.75rem", flex: 1 },
  toolStepDetail: {
    background: "#060606",
    color: "#4ade80",
    padding: "0.5rem 0.75rem",
    fontSize: "0.72rem",
    margin: 0,
    whiteSpace: "pre-wrap",
    borderTop: "1px solid #1a1a1a",
  },

  // File edit badge
  fileEditBadge: {
    marginTop: "0.5rem",
    background: "#0a0a0a",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "0.4rem 0.75rem",
    fontSize: "0.78rem",
    color: "#aaa",
  },

  // Parallel workers
  workersBar: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.35rem 0.75rem",
    background: "#0a0a0a",
    borderTop: "1px solid #111",
    flexWrap: "wrap",
  },
  workersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.3rem",
    padding: "0.4rem 0.75rem",
    background: "#070707",
    borderTop: "1px solid #111",
  },
  workerSlot: {
    background: "#0d0d0d",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "0.4rem 0.6rem",
    minHeight: "60px",
  },
  stopBtn: {
    background: "transparent",
    border: "1px solid #f87171",
    color: "#f87171",
    borderRadius: "3px",
    width: "18px",
    height: "18px",
    fontSize: "0.6rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },

  // Agent list
  agentsList: {
    background: "#080808",
    borderTop: "1px solid #111",
    padding: "0.3rem 0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
    maxHeight: "180px",
    overflowY: "auto",
  },
  agentItem: {
    display: "flex",
    alignItems: "center",
    padding: "0.25rem 0.4rem",
    borderRadius: "4px",
    background: "#0d0d0d",
  },
  agentStartBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#FFD700",
    borderRadius: "3px",
    width: "22px",
    height: "18px",
    fontSize: "0.65rem",
    cursor: "pointer",
    padding: 0,
  },

  // Shadow indicator
  shadowBadge: {
    display: "flex",
    alignItems: "center",
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.2rem 1rem",
    fontSize: "0.75rem",
    color: "#888",
  },

  // File live editor
  fileEditorPanel: {
    display: "flex",
    flexDirection: "column",
    background: "#070707",
    border: "1px solid #FFD700",
    borderRadius: "8px",
    margin: "0.5rem",
    maxHeight: "40vh",
    overflow: "hidden",
  },
  fileEditorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem 0.75rem",
    background: "#0d0d0d",
    borderBottom: "1px solid #222",
    flexShrink: 0,
  },
  fileEditorTextarea: {
    flex: 1,
    background: "#080808",
    color: "#e2e8f0",
    border: "none",
    outline: "none",
    padding: "0.75rem",
    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    fontSize: "0.78rem",
    resize: "none",
    lineHeight: 1.5,
    overflowY: "auto",
  },
  saveBtnGreen: {
    background: "#4ade80",
    color: "#000",
    border: "none",
    borderRadius: "4px",
    padding: "0.3rem 0.75rem",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.8rem",
  },
  cancelBtn: {
    background: "#1a1a1a",
    color: "#aaa",
    border: "1px solid #333",
    borderRadius: "4px",
    padding: "0.3rem 0.6rem",
    cursor: "pointer",
    fontSize: "0.8rem",
  },

  // Cap bar
  capBar: {
    borderTop: "1px solid #111",
    padding: "0.5rem 1rem",
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  capToggle: {
    background: "transparent",
    border: "none",
    color: "#555",
    cursor: "pointer",
    fontSize: "0.8rem",
    textAlign: "left",
    padding: "0",
  },
  groupTabs: { display: "flex", gap: "0.3rem", flexWrap: "wrap" },
  groupTab: {
    background: "transparent",
    border: "1px solid #222",
    color: "#555",
    padding: "0.2rem 0.6rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  groupTabActive: {
    background: "#1a1a1a",
    color: "#FFD700",
    borderColor: "#FFD700",
  },
  cmdRow: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  chip: {
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "20px",
    color: "#888",
    padding: "0.3rem 0.75rem",
    fontSize: "0.75rem",
    cursor: "pointer",
    fontFamily: "inherit",
  },

  // Input
  inputRow: {
    display: "flex",
    gap: "0.75rem",
    padding: "1rem 1.5rem",
    borderTop: "1px solid #1a1a1a",
    background: "#0a0a0a",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    background: "#111",
    border: "1px solid #333",
    borderRadius: "12px",
    color: "#fff",
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
  },
  sendBtn: {
    background: "#FFD700",
    border: "none",
    borderRadius: "12px",
    color: "#000",
    width: "48px",
    height: "48px",
    fontSize: "1.2rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
};
