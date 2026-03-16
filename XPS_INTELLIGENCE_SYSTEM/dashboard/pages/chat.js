// dashboard/pages/chat.js
// ========================
// XPS Intelligence – Autonomous Agent Control Plane
//
// Full-screen 3-panel Manus-style layout:
//   Left  : System status, agents list, account connectors
//   Center: Chat interface (RuntimeCommandChat)
//   Right : Parallel task monitor, shadow scraper activity

import React, { useState, useEffect } from "react";
import Link from "next/link";
import RuntimeCommandChat from "../components/RuntimeCommandChat";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.__NEXT_PUBLIC_API_URL) ||
    "http://localhost:3099"
  );
}

function statusColor(s) {
  return (
    {
      healthy: "#4ade80",
      running: "#FFD700",
      idle: "#888",
      error: "#f87171",
      configured: "#4ade80",
      unconfigured: "#555",
      active: "#4ade80",
    }[s] || "#888"
  );
}

const SUGGESTIONS = [
  "scrape epoxy contractors in Orlando FL",
  "run parallel 4-agent scrape across FL cities",
  "orchestrate all agents",
  "run full pipeline: scrape → score → dedup → outreach",
  "run seo analysis on xps-intelligence.vercel.app",
  "export leads",
  "trigger vercel deploy",
  "status",
  "help",
];

// ---------------------------------------------------------------------------
// Left Panel – System + Agents + Connectors
// ---------------------------------------------------------------------------
function LeftPanel({ health, agents, connectors, onOrchestrate }) {
  return (
    <div style={S.leftPanel}>
      {/* Health */}
      <div style={S.sideSection}>
        <div style={S.sideSectionTitle}>🏥 System</div>
        <div style={S.sideRow}>
          <span style={S.sideLabel}>Status</span>
          <span
            style={{
              color: statusColor(health?.status),
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            {health?.status?.toUpperCase() || "—"}
          </span>
        </div>
        <div style={S.sideRow}>
          <span style={S.sideLabel}>Service</span>
          <span style={S.sideValue}>{health?.service || "—"}</span>
        </div>
        <div style={S.sideRow}>
          <span style={S.sideLabel}>Version</span>
          <span style={S.sideValue}>{health?.version || "—"}</span>
        </div>
      </div>

      {/* Agents */}
      <div style={S.sideSection}>
        <div
          style={{
            ...S.sideSectionTitle,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>🤖 Agents</span>
          <button style={S.smallBtn} onClick={onOrchestrate}>
            Run All
          </button>
        </div>
        {agents.length === 0 && (
          <div
            style={{ color: "#444", fontSize: "0.75rem", padding: "0.25rem" }}
          >
            Loading…
          </div>
        )}
        {agents.map((a) => (
          <div key={a.name} style={S.sideRow}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: statusColor(a.status),
                flexShrink: 0,
              }}
            />
            <span style={{ ...S.sideLabel, marginLeft: "0.4rem" }}>
              {a.name?.replace("_agent", "")}
            </span>
            <span style={{ color: statusColor(a.status), fontSize: "0.7rem" }}>
              {a.status}
            </span>
          </div>
        ))}
      </div>

      {/* Connectors */}
      <div style={S.sideSection}>
        <div style={S.sideSectionTitle}>🔌 Connectors</div>
        {connectors.length === 0 && (
          <div
            style={{ color: "#444", fontSize: "0.75rem", padding: "0.25rem" }}
          >
            Loading…
          </div>
        )}
        {connectors.slice(0, 8).map((c) => (
          <div key={c.id} style={S.sideRow}>
            <span style={{ fontSize: "0.85rem", width: "18px" }}>{c.icon}</span>
            <span style={{ ...S.sideLabel, marginLeft: "0.3rem" }}>
              {c.name}
            </span>
            <span style={{ color: statusColor(c.status), fontSize: "0.7rem" }}>
              {c.status}
            </span>
          </div>
        ))}
      </div>

      {/* Nav */}
      <div style={S.sideNav}>
        {[
          { href: "/", label: "🏠 Home" },
          { href: "/leads", label: "📋 Leads" },
          { href: "/crm", label: "🗂️ CRM" },
          { href: "/analytics", label: "📊 Analytics" },
          { href: "/workspace", label: "🖊️ Workspace" },
          { href: "/studio", label: "🎨 Studio" },
          { href: "/connectors", label: "🔌 Connectors" },
          { href: "/settings", label: "⚙️ Settings" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={S.navLink}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right Panel – Task Monitor + Shadow Scraper
// ---------------------------------------------------------------------------
function RightPanel({ shadow }) {
  const running = shadow.filter((t) => t.status === "running");
  const completed = shadow.filter((t) => t.status === "completed").slice(0, 8);
  const failed = shadow.filter((t) => t.status === "failed").slice(0, 4);

  return (
    <div style={S.rightPanel}>
      <div style={S.sideSectionTitle}>⚡ Live Tasks</div>

      {/* Running */}
      {running.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div
            style={{
              color: "#FFD700",
              fontSize: "0.7rem",
              marginBottom: "0.25rem",
              fontWeight: 700,
            }}
          >
            RUNNING ({running.length})
          </div>
          {running.map((t) => (
            <div key={t.task_id} style={S.taskRow}>
              <span style={{ color: "#FFD700", fontSize: "0.7rem" }}>⚡</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    color: "#ddd",
                    fontSize: "0.72rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.agent || t.command_type || "task"}
                </div>
                <div style={{ color: "#555", fontSize: "0.65rem" }}>
                  {t.task_id?.slice(0, 12)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div
            style={{
              color: "#4ade80",
              fontSize: "0.7rem",
              marginBottom: "0.25rem",
              fontWeight: 700,
            }}
          >
            COMPLETED ({completed.length}+)
          </div>
          {completed.map((t) => (
            <div key={t.task_id} style={S.taskRow}>
              <span style={{ color: "#4ade80", fontSize: "0.7rem" }}>✅</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    color: "#888",
                    fontSize: "0.72rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.agent || t.command_type}
                </div>
                <div style={{ color: "#444", fontSize: "0.65rem" }}>
                  {t.task_id?.slice(0, 12)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <div>
          <div
            style={{
              color: "#f87171",
              fontSize: "0.7rem",
              marginBottom: "0.25rem",
              fontWeight: 700,
            }}
          >
            FAILED ({failed.length})
          </div>
          {failed.map((t) => (
            <div key={t.task_id} style={S.taskRow}>
              <span style={{ color: "#f87171", fontSize: "0.7rem" }}>❌</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    color: "#888",
                    fontSize: "0.72rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.agent || t.command_type}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {running.length === 0 &&
        completed.length === 0 &&
        failed.length === 0 && (
          <div
            style={{
              color: "#333",
              fontSize: "0.78rem",
              textAlign: "center",
              marginTop: "2rem",
            }}
          >
            No tasks yet.
            <br />
            Send a command to start.
          </div>
        )}

      {/* Quick parallel launch */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "1rem",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <div
          style={{ color: "#555", fontSize: "0.7rem", marginBottom: "0.4rem" }}
        >
          QUICK LAUNCH
        </div>
        {[
          "scrape epoxy FL",
          "run full pipeline",
          "export leads",
          "trigger vercel deploy",
        ].map((cmd) => (
          <div key={cmd} style={S.quickCmd}>
            {cmd}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ChatPage() {
  const [health, setHealth] = useState(null);
  const [agents, setAgents] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [shadow, setShadow] = useState([]);
  const [collapsed, setCollapsed] = useState({ left: false, right: false });

  useEffect(() => {
    const api = getApiBase();
    const load = () => {
      Promise.all([
        fetch(`${api}/health`)
          .then((r) => r.json())
          .catch(() => null),
        fetch(`${api}/api/v1/agents`)
          .then((r) => r.json())
          .catch(() => null),
        fetch(`${api}/api/v1/connectors`)
          .then((r) => r.json())
          .catch(() => null),
        fetch(`${api}/api/v1/runtime/shadow/status`)
          .then((r) => r.json())
          .catch(() => null),
      ]).then(([h, a, c, s]) => {
        if (h) setHealth(h);
        if (a?.agents) setAgents(a.agents);
        if (c?.connectors) setConnectors(c.connectors);
        if (s?.tasks) setShadow(s.tasks);
      });
    };
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  const handleOrchestrate = async () => {
    const api = getApiBase();
    await fetch(`${api}/api/v1/runtime/agents/run-all`, {
      method: "POST",
    }).catch(() => {});
    setTimeout(() => {
      fetch(`${api}/api/v1/agents`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.agents) setAgents(d.agents);
        })
        .catch(() => {});
    }, 1000);
  };

  return (
    <div style={S.page}>
      {/* Top header */}
      <div style={S.header}>
        <span style={S.logo}>⚡ XPS Intelligence</span>
        <span style={S.subtitle}>Autonomous Agent Control Plane</span>
        <div style={S.headerStatus}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: statusColor(health?.status),
              display: "inline-block",
              marginRight: "0.4rem",
            }}
          />
          <span style={{ color: "#888", fontSize: "0.8rem" }}>
            {health?.status || "connecting…"}
          </span>
        </div>
        <div style={S.headerLinks}>
          <button
            style={S.collapseBtn}
            onClick={() => setCollapsed((v) => ({ ...v, left: !v.left }))}
          >
            {collapsed.left ? "▸" : "◂"} Agents
          </button>
          <button
            style={S.collapseBtn}
            onClick={() => setCollapsed((v) => ({ ...v, right: !v.right }))}
          >
            Tasks {collapsed.right ? "◂" : "▸"}
          </button>
        </div>
      </div>

      {/* 3-panel body */}
      <div style={S.body}>
        {!collapsed.left && (
          <LeftPanel
            health={health}
            agents={agents}
            connectors={connectors}
            onOrchestrate={handleOrchestrate}
          />
        )}

        {/* Center chat */}
        <div style={S.center}>
          <RuntimeCommandChat suggestions={SUGGESTIONS} />
        </div>

        {!collapsed.right && <RightPanel shadow={shadow} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  page: {
    background: "#000",
    minHeight: "100vh",
    height: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.5rem 1.2rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    flexShrink: 0,
  },
  logo: {
    color: "#FFD700",
    fontWeight: 700,
    fontSize: "1rem",
    whiteSpace: "nowrap",
  },
  subtitle: { color: "#555", fontSize: "0.8rem", whiteSpace: "nowrap" },
  headerStatus: { display: "flex", alignItems: "center", marginLeft: "auto" },
  headerLinks: { display: "flex", gap: "0.5rem", marginLeft: "0.75rem" },
  collapseBtn: {
    background: "transparent",
    border: "1px solid #222",
    color: "#555",
    borderRadius: "4px",
    padding: "0.2rem 0.6rem",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },

  // Left panel
  leftPanel: {
    width: "220px",
    flexShrink: 0,
    background: "#080808",
    borderRight: "1px solid #1a1a1a",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sideSection: { borderBottom: "1px solid #111", padding: "0.6rem 0.75rem" },
  sideSectionTitle: {
    color: "#666",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "0.4rem",
  },
  sideRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    padding: "0.15rem 0",
    minHeight: "20px",
  },
  sideLabel: {
    color: "#888",
    fontSize: "0.75rem",
    flex: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  sideValue: { color: "#ccc", fontSize: "0.75rem" },
  smallBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#FFD700",
    borderRadius: "4px",
    padding: "0.1rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.68rem",
  },
  sideNav: {
    marginTop: "auto",
    padding: "0.5rem 0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
    overflowY: "auto",
  },
  navLink: {
    color: "#555",
    textDecoration: "none",
    fontSize: "0.78rem",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
  },

  // Center
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  // Right panel
  rightPanel: {
    width: "200px",
    flexShrink: 0,
    background: "#080808",
    borderLeft: "1px solid #1a1a1a",
    padding: "0.75rem 0.6rem",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontSize: "0.78rem",
  },
  taskRow: {
    display: "flex",
    gap: "0.4rem",
    alignItems: "flex-start",
    padding: "0.25rem 0.3rem",
    borderRadius: "4px",
    marginBottom: "0.15rem",
    background: "#0d0d0d",
  },
  quickCmd: {
    color: "#555",
    fontSize: "0.7rem",
    padding: "0.2rem 0",
    borderBottom: "1px solid #111",
    cursor: "default",
  },
};
