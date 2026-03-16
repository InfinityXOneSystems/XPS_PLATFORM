/**
 * Admin — Universal API Connector Dashboard
 * Route: /admin/hidden/integrations
 *
 * Add, test, and manage external API connections:
 * Google, Railway, Vercel, GitHub, Stripe, Twilio, custom APIs.
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

const PRESETS = [
  {
    api_name: "google",
    display_name: "Google Maps API",
    endpoint: "https://maps.googleapis.com/maps/api",
  },
  {
    api_name: "railway",
    display_name: "Railway Deployments",
    endpoint: "https://backboard.railway.app/graphql/v2",
  },
  {
    api_name: "vercel",
    display_name: "Vercel Deployments",
    endpoint: "https://api.vercel.com",
  },
  {
    api_name: "github",
    display_name: "GitHub API",
    endpoint: "https://api.github.com",
  },
  {
    api_name: "stripe",
    display_name: "Stripe Payments",
    endpoint: "https://api.stripe.com/v1",
  },
  {
    api_name: "twilio",
    display_name: "Twilio Voice/SMS",
    endpoint: "https://api.twilio.com/2010-04-01",
  },
  {
    api_name: "openai",
    display_name: "OpenAI GPT-4",
    endpoint: "https://api.openai.com/v1",
  },
  {
    api_name: "sendgrid",
    display_name: "SendGrid Email",
    endpoint: "https://api.sendgrid.com/v3",
  },
];

export default function AdminIntegrations() {
  const [integrations, setIntegrations] = useState([]);
  const [form, setForm] = useState({
    api_name: "",
    display_name: "",
    endpoint: "",
    credentials: {},
  });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testResults, setTestResults] = useState({});
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch(`${API}/api/v1/admin/hidden/integrations`, { headers: hdrs })
      .then((r) => r.json())
      .then(setIntegrations)
      .catch(() => setMsg("Failed to load integrations"));

  useEffect(() => {
    load();
  }, []);

  const applyPreset = (p) =>
    setForm({
      ...form,
      api_name: p.api_name,
      display_name: p.display_name,
      endpoint: p.endpoint,
    });

  const upsert = async () => {
    const payload = {
      ...form,
      credentials: apiKeyInput ? { api_key: apiKeyInput } : {},
    };
    const resp = await fetch(`${API}/api/v1/admin/hidden/integrations`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      setMsg("Integration saved");
      setApiKeyInput("");
      load();
    } else setMsg("Error saving");
  };

  const test = async (id, name) => {
    setTestResults((p) => ({ ...p, [id]: "testing…" }));
    const resp = await fetch(
      `${API}/api/v1/admin/hidden/integrations/${id}/test`,
      { method: "POST", headers: hdrs },
    );
    if (resp.ok) {
      const d = await resp.json();
      setTestResults((p) => ({
        ...p,
        [id]: d.reachable ? "✅ Connected" : "⚠️ Unreachable",
      }));
    } else setTestResults((p) => ({ ...p, [id]: "❌ Error" }));
  };

  return (
    <>
      <Head>
        <title>Integrations — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>🔌 Universal API Connector</h1>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={presetsRow}>
          {PRESETS.map((p) => (
            <button
              key={p.api_name}
              style={presetBtn}
              onClick={() => applyPreset(p)}
            >
              {p.display_name}
            </button>
          ))}
        </div>

        <div style={cardStyle}>
          <h2 style={h2}>Add / Update Integration</h2>
          <div style={formGrid}>
            <input
              style={inp}
              placeholder="API name (e.g. google)"
              value={form.api_name}
              onChange={(e) => setForm({ ...form, api_name: e.target.value })}
            />
            <input
              style={inp}
              placeholder="Display name"
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
            <input
              style={inp}
              placeholder="Base endpoint URL"
              value={form.endpoint}
              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            />
            <input
              style={inp}
              placeholder="API Key / Token (stored encrypted)"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
          </div>
          <button style={btn} onClick={upsert}>
            Save Integration
          </button>
        </div>

        <h2 style={h2}>Active Integrations</h2>
        <div style={intGrid}>
          {integrations.map((i) => (
            <div key={i.id} style={intCard}>
              <div style={intHeader}>
                <span style={intName}>{i.display_name || i.api_name}</span>
                <span style={statusDot(i.sync_status)}>{i.sync_status}</span>
              </div>
              <div style={intEndpoint}>{i.endpoint || "—"}</div>
              {i.last_synced && (
                <div style={intMeta}>
                  Last synced: {new Date(i.last_synced).toLocaleString()}
                </div>
              )}
              {i.last_error && <div style={errTxt}>⚠️ {i.last_error}</div>}
              <div style={intActions}>
                <button style={smBtn} onClick={() => test(i.id, i.api_name)}>
                  Test
                </button>
                {testResults[i.id] && (
                  <span style={testResult}>{testResults[i.id]}</span>
                )}
              </div>
            </div>
          ))}
          {integrations.length === 0 && (
            <p style={{ color: "#475569" }}>
              No integrations yet. Add one above or select a preset.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

const STATUS_COLORS = {
  connected: "#065f46",
  disconnected: "#1c1917",
  error: "#7f1d1d",
};
const statusDot = (s) => ({
  background: STATUS_COLORS[s] || "#1e293b",
  color: "#fff",
  padding: "0.15rem 0.5rem",
  borderRadius: "0.35rem",
  fontSize: "0.7rem",
});
const pg = {
  minHeight: "100vh",
  background: "#0a0a0f",
  color: "#e2e8f0",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
};
const h1 = { color: "#a78bfa", marginBottom: "1.5rem" };
const h2 = { color: "#94a3b8", margin: "1.5rem 0 1rem", fontSize: "1rem" };
const cardStyle = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  marginBottom: "2rem",
};
const msgBox = {
  background: "#1e3a5f",
  color: "#93c5fd",
  padding: "0.75rem 1rem",
  borderRadius: "0.5rem",
  marginBottom: "1rem",
};
const presetsRow = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  marginBottom: "1.5rem",
};
const presetBtn = {
  background: "#1e1b4b",
  color: "#a78bfa",
  border: "1px solid #312e81",
  padding: "0.35rem 0.8rem",
  borderRadius: "0.5rem",
  cursor: "pointer",
  fontSize: "0.8rem",
};
const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "0.75rem",
  marginBottom: "0.75rem",
};
const inp = {
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#e2e8f0",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  width: "100%",
  boxSizing: "border-box",
};
const btn = {
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  padding: "0.6rem 1.5rem",
  borderRadius: "0.5rem",
  cursor: "pointer",
  fontWeight: 600,
};
const intGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "1rem",
};
const intCard = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};
const intHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.5rem",
};
const intName = { fontWeight: 600, color: "#a78bfa" };
const intEndpoint = {
  color: "#475569",
  fontSize: "0.8rem",
  fontFamily: "monospace",
  marginBottom: "0.5rem",
};
const intMeta = { color: "#334155", fontSize: "0.75rem" };
const errTxt = { color: "#fca5a5", fontSize: "0.8rem", marginTop: "0.4rem" };
const intActions = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginTop: "0.75rem",
};
const smBtn = {
  background: "#1e293b",
  color: "#94a3b8",
  border: "1px solid #334155",
  padding: "0.3rem 0.75rem",
  borderRadius: "0.4rem",
  cursor: "pointer",
  fontSize: "0.8rem",
};
const testResult = { fontSize: "0.8rem", color: "#94a3b8" };
