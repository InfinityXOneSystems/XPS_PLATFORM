// dashboard/pages/connectors.js
// ================================
// XPS Intelligence — Universal Connector Suite
// Connects: GitHub, Google Workspace, Vercel, Docker MCP, Local Machine, LLMs

import React, { useState, useEffect } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099"
    : "http://localhost:3099";

const CATEGORY_ICONS = {
  dev: "💻",
  deploy: "🚀",
  productivity: "📁",
  infrastructure: "🔧",
  llm: "🧠",
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [googleService, setGoogleService] = useState("gmail");
  const [googleAction, setGoogleAction] = useState("list");
  const [googleResult, setGoogleResult] = useState(null);

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/v1/connectors/`)
      .then((r) => r.json())
      .then((d) => {
        setConnectors(d.connectors || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const configure = async (id) => {
    const res = await fetch(`${API}/api/v1/connectors/configure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector_id: id, token }),
    });
    const data = await res.json();
    if (data.success) {
      setMsg({ type: "ok", text: `✅ ${id} configured successfully` });
      setConfiguring(null);
      setToken("");
      load();
    } else {
      setMsg({ type: "err", text: `❌ ${data.detail || "Failed"}` });
    }
  };

  const triggerVercelDeploy = async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch(`${API}/api/v1/connectors/vercel/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setDeployResult(data);
    } catch (e) {
      setDeployResult({ success: false, message: e.message });
    }
    setDeploying(false);
  };

  const runGoogleAction = async () => {
    const res = await fetch(`${API}/api/v1/connectors/google/workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: googleService, action: googleAction }),
    });
    setGoogleResult(await res.json());
  };

  const connected = connectors.filter((c) => c.status === "connected").length;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.logo}>⚡ XPS Intelligence</span>
        <div style={S.links}>
          <Link href="/" style={S.link}>
            Home
          </Link>
          <Link href="/workspace" style={S.link}>
            Workspace
          </Link>
          <Link href="/settings" style={S.link}>
            Settings
          </Link>
        </div>
      </div>

      <div style={S.content}>
        <div style={S.titleRow}>
          <div>
            <h1 style={S.title}>🔌 Universal Connector Suite</h1>
            <p style={S.sub}>
              {connected}/{connectors.length} connectors active
            </p>
          </div>
          <button style={S.refreshBtn} onClick={load}>
            🔄 Refresh
          </button>
        </div>

        {msg && (
          <div
            style={{
              ...S.alert,
              background: msg.type === "ok" ? "#052e16" : "#3b0d0c",
              border: `1px solid ${msg.type === "ok" ? "#4ade80" : "#f87171"}`,
            }}
          >
            {msg.text}
          </div>
        )}

        {/* Vercel Quick Deploy */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>▲ Vercel Frontend — Autonomous Deploy</h2>
          <div style={S.vercelCard}>
            <div style={S.vercelInfo}>
              <div style={S.vercelField}>
                <span style={S.label}>Repo:</span>{" "}
                InfinityXOneSystems/XPS-INTELLIGENCE-FRONTEND
              </div>
              <div style={S.vercelField}>
                <span style={S.label}>Webhook:</span>{" "}
                <code style={S.code}>prj_eNK90PC48eWsMW3O6aHHRWsM4wwI</code>
              </div>
              <div style={S.vercelField}>
                <span style={S.label}>LLM:</span> Groq (via Vercel env vars)
              </div>
              <div style={S.vercelField}>
                <span style={S.label}>Auto-deploy:</span> ✅ On push to main
              </div>
            </div>
            <button
              style={S.deployBtn}
              onClick={triggerVercelDeploy}
              disabled={deploying}
            >
              {deploying ? "⏳ Deploying…" : "🚀 Trigger Deploy"}
            </button>
          </div>
          {deployResult && (
            <div
              style={{
                ...S.resultBox,
                borderColor: deployResult.success ? "#4ade80" : "#f87171",
              }}
            >
              <div
                style={{
                  color: deployResult.success ? "#4ade80" : "#f87171",
                  fontWeight: 700,
                }}
              >
                {deployResult.success
                  ? "✅ Deploy triggered"
                  : "❌ Deploy failed"}
              </div>
              <div
                style={{
                  color: "#888",
                  fontSize: "0.85rem",
                  marginTop: "0.25rem",
                }}
              >
                {deployResult.message}
              </div>
              {deployResult.triggered_at && (
                <div style={{ color: "#555", fontSize: "0.75rem" }}>
                  at {deployResult.triggered_at}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connector Grid */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>🔌 All Connectors</h2>
          {loading ? (
            <div style={S.loading}>Loading connectors…</div>
          ) : (
            <div style={S.grid}>
              {connectors.map((c) => (
                <div
                  key={c.id}
                  style={{
                    ...S.card,
                    borderColor: c.status === "connected" ? "#4ade80" : "#222",
                  }}
                >
                  <div style={S.cardTop}>
                    <span style={S.cardIcon}>{c.icon}</span>
                    <div>
                      <div style={S.cardName}>{c.name}</div>
                      <div
                        style={{
                          ...S.statusBadge,
                          background:
                            c.status === "connected" ? "#052e16" : "#1a1a1a",
                          color: c.status === "connected" ? "#4ade80" : "#888",
                        }}
                      >
                        {c.status === "connected"
                          ? "🟢 Connected"
                          : "⚪ Not configured"}
                      </div>
                    </div>
                  </div>
                  <div style={S.capsRow}>
                    {(c.capabilities || []).map((cap) => (
                      <span key={cap} style={S.cap}>
                        {cap}
                      </span>
                    ))}
                  </div>
                  {configuring === c.id ? (
                    <div style={S.configForm}>
                      <input
                        style={S.tokenInput}
                        type="password"
                        placeholder={`${c.token_key || "Token"}…`}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          style={S.connectBtn}
                          onClick={() => configure(c.id)}
                        >
                          Connect
                        </button>
                        <button
                          style={S.cancelBtn}
                          onClick={() => setConfiguring(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      style={S.configBtn}
                      onClick={() => setConfiguring(c.id)}
                    >
                      {c.status === "connected"
                        ? "🔑 Reconfigure"
                        : "🔗 Connect"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Google Workspace Panel */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>🔵 Google Workspace — Service Console</h2>
          <div style={S.googlePanel}>
            <div style={S.googleServices}>
              {["gmail", "drive", "calendar", "docs", "sheets"].map((svc) => (
                <button
                  key={svc}
                  style={{
                    ...S.svcBtn,
                    ...(googleService === svc ? S.svcActive : {}),
                  }}
                  onClick={() => setGoogleService(svc)}
                >
                  {svc === "gmail"
                    ? "✉️"
                    : svc === "drive"
                      ? "📁"
                      : svc === "calendar"
                        ? "📅"
                        : svc === "docs"
                          ? "📄"
                          : "📊"}{" "}
                  {svc}
                </button>
              ))}
            </div>
            <div style={S.googleActions}>
              <select
                style={S.actionSelect}
                value={googleAction}
                onChange={(e) => setGoogleAction(e.target.value)}
              >
                <option value="list">List</option>
                <option value="read">Read</option>
                <option value="create">Create</option>
                <option value="send">Send</option>
                <option value="update">Update</option>
              </select>
              <button style={S.runBtn} onClick={runGoogleAction}>
                ▶ Execute
              </button>
            </div>
            {googleResult && (
              <div style={S.resultBox}>
                <div
                  style={{
                    color: googleResult.success ? "#4ade80" : "#f87171",
                    fontWeight: 700,
                  }}
                >
                  {googleResult.success
                    ? `✅ ${googleResult.service} / ${googleResult.action}`
                    : `❌ ${googleResult.message}`}
                </div>
                {googleResult.message && (
                  <div style={{ color: "#888", fontSize: "0.85rem" }}>
                    {googleResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
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
  logo: { color: "#FFD700", fontWeight: 700 },
  links: { display: "flex", gap: "1.25rem" },
  link: { color: "#888", textDecoration: "none", fontSize: "0.875rem" },
  content: { padding: "1.5rem 2rem", maxWidth: "1200px", margin: "0 auto" },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.5rem",
  },
  title: {
    color: "#FFD700",
    fontSize: "1.75rem",
    fontWeight: 800,
    margin: "0 0 0.25rem",
  },
  sub: { color: "#666", margin: 0 },
  refreshBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#aaa",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  alert: {
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  section: { marginBottom: "2.5rem" },
  sectionTitle: {
    color: "#888",
    fontSize: "0.9rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "1rem",
  },
  loading: { color: "#555" },
  vercelCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "10px",
    padding: "1.25rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
  },
  vercelInfo: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  vercelField: { color: "#ccc", fontSize: "0.875rem" },
  label: { color: "#555", marginRight: "0.5rem" },
  code: {
    background: "#111",
    padding: "0.1rem 0.4rem",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "0.8rem",
  },
  deployBtn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 700,
  },
  resultBox: {
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "0.75rem",
    marginTop: "0.75rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
    gap: "1rem",
  },
  card: {
    background: "#0a0a0a",
    border: "1px solid #222",
    borderRadius: "10px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  cardTop: { display: "flex", gap: "0.75rem", alignItems: "center" },
  cardIcon: { fontSize: "1.75rem" },
  cardName: { color: "#fff", fontWeight: 700 },
  statusBadge: {
    display: "inline-block",
    padding: "0.15rem 0.5rem",
    borderRadius: "12px",
    fontSize: "0.75rem",
    marginTop: "0.2rem",
  },
  capsRow: { display: "flex", gap: "0.3rem", flexWrap: "wrap" },
  cap: {
    background: "#111",
    border: "1px solid #222",
    color: "#888",
    padding: "0.1rem 0.45rem",
    borderRadius: "10px",
    fontSize: "0.7rem",
  },
  configForm: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  tokenInput: {
    background: "#111",
    border: "1px solid #333",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  connectBtn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
  },
  cancelBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#888",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  configBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#aaa",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    alignSelf: "flex-start",
  },
  googlePanel: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "10px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  googleServices: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  svcBtn: {
    background: "#111",
    border: "1px solid #222",
    color: "#888",
    padding: "0.4rem 0.9rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  svcActive: {
    background: "#1a3a5c",
    border: "1px solid #3b82f6",
    color: "#fff",
  },
  googleActions: { display: "flex", gap: "0.75rem", alignItems: "center" },
  actionSelect: {
    background: "#111",
    border: "1px solid #333",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
  },
  runBtn: {
    background: "#4ade80",
    color: "#000",
    border: "none",
    padding: "0.4rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
  },
};
