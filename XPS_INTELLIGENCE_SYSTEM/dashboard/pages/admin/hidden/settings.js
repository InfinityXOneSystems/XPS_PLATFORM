/**
 * Admin — Settings Hub
 * Route: /admin/hidden/settings
 *
 * Global key-value configuration store. Supports encrypted secrets.
 * Categories: general / auth / email / sms / database / payments / integrations
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

const CATEGORIES = [
  "general",
  "auth",
  "email",
  "sms",
  "database",
  "payments",
  "integrations",
];

export default function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [activeCategory, setActiveCategory] = useState("general");
  const [form, setForm] = useState({
    key: "",
    value: "",
    category: "general",
    description: "",
    is_encrypted: false,
  });
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch(`${API}/api/v1/admin/hidden/settings`, { headers: hdrs })
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setMsg("Failed to load settings"));

  useEffect(() => {
    load();
  }, []);

  const upsert = async () => {
    const resp = await fetch(
      `${API}/api/v1/admin/hidden/settings/${encodeURIComponent(form.key)}`,
      {
        method: "PUT",
        headers: hdrs,
        body: JSON.stringify({
          value: form.value,
          category: form.category,
          description: form.description,
          is_encrypted: form.is_encrypted,
          updated_by: "owner",
        }),
      },
    );
    if (resp.ok) {
      setMsg("Saved");
      load();
    } else setMsg("Error saving");
  };

  const filtered = settings.filter((s) => s.category === activeCategory);

  return (
    <>
      <Head>
        <title>Settings — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>⚙️ Global Settings</h1>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={tabs}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              style={tab(c === activeCategory)}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={grid}>
          <div style={cardStyle}>
            <h2 style={h2}>Add / Update Setting</h2>
            {[
              ["key", "Setting key (e.g. stripe_public_key)"],
              ["value", "Value"],
              ["description", "Description"],
            ].map(([f, ph]) => (
              <input
                key={f}
                style={inp}
                placeholder={ph}
                value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              />
            ))}
            <select
              style={inp}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label style={chkRow}>
              <input
                type="checkbox"
                checked={form.is_encrypted}
                onChange={(e) =>
                  setForm({ ...form, is_encrypted: e.target.checked })
                }
              />
              <span style={{ marginLeft: "0.5rem" }}>
                Encrypt (store as secret)
              </span>
            </label>
            <button style={btn} onClick={upsert}>
              Save Setting
            </button>
          </div>

          <div>
            <h2 style={h2}>{activeCategory} settings</h2>
            {filtered.length === 0 && (
              <p style={{ color: "#475569" }}>No settings yet.</p>
            )}
            {filtered.map((s) => (
              <div key={s.key} style={settingRow}>
                <div style={settingKey}>{s.key}</div>
                <div style={settingVal}>{s.value}</div>
                {s.is_encrypted && <span style={lock}>🔒</span>}
                {s.description && (
                  <div style={settingDesc}>{s.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const pg = {
  minHeight: "100vh",
  background: "#0a0a0f",
  color: "#e2e8f0",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
};
const h1 = { color: "#a78bfa", marginBottom: "1.5rem" };
const h2 = { color: "#94a3b8", marginBottom: "1rem", fontSize: "1rem" };
const cardStyle = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  marginBottom: "1rem",
};
const msgBox = {
  background: "#1e3a5f",
  color: "#93c5fd",
  padding: "0.75rem 1rem",
  borderRadius: "0.5rem",
  marginBottom: "1rem",
};
const inp = {
  display: "block",
  width: "100%",
  marginBottom: "0.75rem",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#e2e8f0",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
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
  marginTop: "0.5rem",
};
const chkRow = {
  display: "flex",
  alignItems: "center",
  marginBottom: "0.75rem",
  cursor: "pointer",
};
const tabs = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  marginBottom: "1.5rem",
};
const tab = (active) => ({
  background: active ? "#7c3aed" : "#1e293b",
  color: active ? "#fff" : "#94a3b8",
  border: "none",
  padding: "0.4rem 1rem",
  borderRadius: "0.5rem",
  cursor: "pointer",
  fontSize: "0.85rem",
});
const grid = { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" };
const settingRow = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.5rem",
  padding: "0.75rem 1rem",
  marginBottom: "0.5rem",
};
const settingKey = { fontWeight: 600, color: "#a78bfa", fontSize: "0.9rem" };
const settingVal = {
  color: "#e2e8f0",
  fontSize: "0.85rem",
  marginTop: "0.2rem",
  fontFamily: "monospace",
};
const settingDesc = {
  color: "#64748b",
  fontSize: "0.8rem",
  marginTop: "0.25rem",
};
const lock = { fontSize: "0.75rem", marginLeft: "0.25rem" };
