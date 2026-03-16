// dashboard/pages/guardian.js
// ============================
// XPS Intelligence – System Guardian / Health Monitor

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
}

const SUBSYSTEMS = [
  { key: "api", label: "API Gateway", icon: "🌐" },
  { key: "database", label: "Database", icon: "🗄️" },
  { key: "agents", label: "Agent Pool", icon: "🤖" },
  { key: "queue", label: "Task Queue", icon: "📬" },
  { key: "scraper", label: "Scraper Engine", icon: "🕷️" },
  { key: "memory", label: "Memory Layer", icon: "🧠" },
];

function statusColor(v) {
  if (!v) return "#555";
  const s = String(v).toLowerCase();
  if (["healthy", "ok", "running", "alive", "up"].some((x) => s.includes(x)))
    return "#4ade80";
  if (["warn", "degraded", "slow", "partial"].some((x) => s.includes(x)))
    return "#fbbf24";
  return "#f87171";
}

function statusDot(v) {
  return statusColor(v);
}

export default function GuardianPage() {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const intervalRef = useRef(null);

  const runCheck = (quiet = false) => {
    const base = getApiBase();
    if (!quiet) setChecking(true);
    Promise.all([
      fetch(`${base}/api/v1/system/health`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${base}/api/v1/system/metrics`)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(async ([h, m]) => {
        // Fall back to static data if API is unavailable
        if (!h && !m) {
          try {
            const staticBase =
              typeof window !== "undefined"
                ? process.env.NEXT_PUBLIC_BASE_PATH || ""
                : "";
            const res = await fetch(`${staticBase}/data/guardian.json`);
            if (res.ok) {
              const d = await res.json();
              h = d;
              m = d.metrics || null;
            }
          } catch {
            // ignore
          }
        }
        setHealth(h);
        setMetrics(m);
        setLastChecked(new Date());
        if (!quiet) setChecking(false);
      })
      .catch(() => {
        if (!quiet) setChecking(false);
      });
  };

  useEffect(() => {
    runCheck();
    intervalRef.current = setInterval(() => runCheck(true), 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const anomalies = health?.anomalies || metrics?.anomalies || [];
  const repairHistory = health?.auto_repairs || metrics?.auto_repairs || [];
  const overallStatus = health?.status || "unknown";

  const getSubsystemStatus = (key) => {
    if (!health) return "unknown";
    const checks = health.checks || health.subsystems || {};
    if (checks[key]) return checks[key];
    if (key === "api" && health.status) return health.status;
    if (key === "database" && health.database) return health.database;
    if (key === "queue" && metrics?.queue) return metrics.queue.status || "ok";
    if (key === "agents" && health.agents)
      return typeof health.agents === "object" ? "ok" : health.agents;
    return null;
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.logo}>⚡ XPS Intelligence</span>
        <div style={S.headerLinks}>
          <Link href="/" style={S.navLink}>
            Home
          </Link>
          <Link href="/chat" style={S.navLink}>
            Chat
          </Link>
          <Link href="/intelligence" style={S.navLink}>
            Intelligence
          </Link>
          <Link href="/trends" style={S.navLink}>
            Trends
          </Link>
          <Link href="/analytics" style={S.navLink}>
            Analytics
          </Link>
          <Link href="/settings" style={S.navLink}>
            Settings
          </Link>
        </div>
      </div>

      <div style={S.content}>
        <div style={S.titleRow}>
          <div>
            <h1 style={S.title}>🛡️ System Guardian</h1>
            {lastChecked && (
              <div style={S.lastChecked}>
                Last checked: {lastChecked.toLocaleTimeString()} · Auto-refresh
                every 10s
              </div>
            )}
          </div>
          <button
            style={checking ? S.btnDisabled : S.btn}
            onClick={() => runCheck()}
            disabled={checking}
          >
            {checking ? "⏳ Checking…" : "🔍 Run Health Check"}
          </button>
        </div>

        {/* Overall Status Banner */}
        <div style={{ ...S.banner, borderColor: statusColor(overallStatus) }}>
          <span
            style={{ ...S.bannerDot, background: statusColor(overallStatus) }}
          />
          <span
            style={{
              color: statusColor(overallStatus),
              fontWeight: 700,
              fontSize: "1rem",
            }}
          >
            System: {overallStatus.toUpperCase()}
          </span>
          {health?.service && (
            <span style={S.bannerService}>
              {health.service} {health.version || ""}
            </span>
          )}
        </div>

        {/* Subsystem Health Grid */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>🖥️ Subsystem Health</h2>
          <div style={S.subsysGrid}>
            {SUBSYSTEMS.map((sys) => {
              const st = getSubsystemStatus(sys.key);
              const color = statusDot(st || (health ? "ok" : "unknown"));
              return (
                <div key={sys.key} style={S.subsysCard}>
                  <div style={S.subsysHeader}>
                    <span style={S.subsysIcon}>{sys.icon}</span>
                    <span style={{ ...S.statusDot, background: color }} />
                  </div>
                  <div style={S.subsysLabel}>{sys.label}</div>
                  <div style={{ color, fontSize: "0.8rem", fontWeight: 600 }}>
                    {st ? String(st).toUpperCase() : health ? "OK" : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Metrics */}
        {metrics && (
          <div style={S.section}>
            <h2 style={S.sectionTitle}>📊 System Metrics</h2>
            <div style={S.metricsGrid}>
              {metrics.workers != null && (
                <MetricCard
                  label="Workers Alive"
                  value={metrics.workers?.alive ?? metrics.workers}
                  color="#4ade80"
                />
              )}
              {metrics.queue?.total != null && (
                <MetricCard
                  label="Queue Total"
                  value={metrics.queue.total}
                  color="#7dd3fc"
                />
              )}
              {metrics.leads_total != null && (
                <MetricCard
                  label="Total Leads"
                  value={metrics.leads_total}
                  color="#FFD700"
                />
              )}
              {metrics.tasks_completed != null && (
                <MetricCard
                  label="Tasks Done"
                  value={metrics.tasks_completed}
                  color="#a78bfa"
                />
              )}
              {metrics.uptime_seconds != null && (
                <MetricCard
                  label="Uptime (s)"
                  value={metrics.uptime_seconds}
                  color="#fb923c"
                />
              )}
              {metrics.memory_mb != null && (
                <MetricCard
                  label="Memory (MB)"
                  value={metrics.memory_mb}
                  color="#f472b6"
                />
              )}
            </div>
          </div>
        )}

        {/* Anomalies */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>⚠️ Anomalies Detected</h2>
          {anomalies.length === 0 ? (
            <div style={S.okMsg}>✅ No anomalies detected.</div>
          ) : (
            <div style={S.anomalyList}>
              {anomalies.map((a, i) => (
                <div key={i} style={S.anomalyRow}>
                  <span style={S.anomalyDot}>⚠️</span>
                  <span style={S.anomalyText}>
                    {typeof a === "string" ? a : JSON.stringify(a)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Repair History */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>🔧 Auto-Repair History</h2>
          {repairHistory.length === 0 ? (
            <div style={S.emptyMuted}>No auto-repair events recorded.</div>
          ) : (
            <div style={S.repairList}>
              {repairHistory.map((r, i) => (
                <div key={i} style={S.repairRow}>
                  <span style={S.repairTime}>
                    {r.timestamp
                      ? new Date(r.timestamp).toLocaleString()
                      : `Event ${i + 1}`}
                  </span>
                  <span style={S.repairAction}>
                    {r.action || r.message || JSON.stringify(r)}
                  </span>
                  {r.result && (
                    <span
                      style={{
                        ...S.repairResult,
                        color: r.result === "success" ? "#4ade80" : "#f87171",
                      }}
                    >
                      {r.result}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw Health Data */}
        {health && (
          <div style={S.section}>
            <h2 style={S.sectionTitle}>🗂️ Raw Health Response</h2>
            <pre style={S.pre}>{JSON.stringify(health, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={S.metricCard}>
      <div style={{ ...S.metricValue, color }}>{value ?? "—"}</div>
      <div style={S.metricLabel}>{label}</div>
    </div>
  );
}

const S = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
  },
  header: {
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.75rem 1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  logo: { color: "#FFD700", fontWeight: 700, fontSize: "1.1rem" },
  headerLinks: { display: "flex", gap: "1.25rem" },
  navLink: { color: "#888", textDecoration: "none", fontSize: "0.875rem" },
  content: { padding: "1.5rem 2rem", maxWidth: "1200px", margin: "0 auto" },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  title: {
    color: "#FFD700",
    fontSize: "1.75rem",
    fontWeight: 800,
    margin: 0,
    marginBottom: "0.25rem",
  },
  lastChecked: { color: "#555", fontSize: "0.8rem" },
  btn: {
    background: "#FFD700",
    border: "none",
    color: "#000",
    padding: "0.5rem 1.25rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  btnDisabled: {
    background: "#333",
    border: "none",
    color: "#666",
    padding: "0.5rem 1.25rem",
    borderRadius: "6px",
    cursor: "not-allowed",
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  banner: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "0.75rem 1.25rem",
    marginBottom: "1.5rem",
  },
  bannerDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  bannerService: { color: "#555", fontSize: "0.8rem", marginLeft: "0.5rem" },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    color: "#888",
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "1rem",
    letterSpacing: "0.05em",
  },
  subsysGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))",
    gap: "1rem",
  },
  subsysCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
    textAlign: "center",
  },
  subsysHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  subsysIcon: { fontSize: "1.5rem" },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    display: "inline-block",
  },
  subsysLabel: {
    color: "#ccc",
    fontSize: "0.85rem",
    fontWeight: 600,
    marginBottom: "0.25rem",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
    gap: "1rem",
  },
  metricCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1.25rem",
    textAlign: "center",
  },
  metricValue: { fontSize: "2rem", fontWeight: 800 },
  metricLabel: {
    color: "#555",
    fontSize: "0.75rem",
    marginTop: "0.25rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  okMsg: {
    color: "#4ade80",
    background: "#052e16",
    border: "1px solid #14532d",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
  },
  anomalyList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  anomalyRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    background: "#1a0a0a",
    border: "1px solid #3b0101",
    borderRadius: "6px",
    padding: "0.6rem 0.75rem",
  },
  anomalyDot: { fontSize: "0.9rem", flexShrink: 0 },
  anomalyText: { color: "#fca5a5", fontSize: "0.875rem" },
  emptyMuted: { color: "#555", fontStyle: "italic", padding: "0.5rem 0" },
  repairList: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  repairRow: {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
    flexWrap: "wrap",
  },
  repairTime: { color: "#555", fontSize: "0.75rem", minWidth: "130px" },
  repairAction: { color: "#ccc", fontSize: "0.85rem", flex: 1 },
  repairResult: { fontSize: "0.8rem", fontWeight: 600 },
  pre: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "6px",
    padding: "1rem",
    color: "#666",
    fontSize: "0.75rem",
    overflowX: "auto",
    maxHeight: "300px",
    overflow: "auto",
  },
};
