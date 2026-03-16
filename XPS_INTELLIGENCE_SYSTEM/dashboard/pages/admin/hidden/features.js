/**
 * Admin — Feature Control
 * Route: /admin/hidden/features
 *
 * Toggle features on/off, set role access, configure per-feature options.
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

export default function AdminFeatures() {
  const [features, setFeatures] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    enabled: true,
    cost_monthly: 0,
  });
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch(`${API}/api/v1/admin/hidden/features`, { headers: hdrs })
      .then((r) => r.json())
      .then(setFeatures)
      .catch(() => setMsg("Failed to load features"));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const resp = await fetch(`${API}/api/v1/admin/hidden/features`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({
        ...form,
        cost_monthly: parseFloat(form.cost_monthly) || 0,
      }),
    });
    if (resp.ok) {
      setMsg("Feature created");
      setForm({ name: "", description: "", enabled: true, cost_monthly: 0 });
      load();
    } else {
      const e = await resp.json();
      setMsg(e.detail || "Error");
    }
  };

  const toggle = async (id, current) => {
    await fetch(`${API}/api/v1/admin/hidden/features/${id}`, {
      method: "PUT",
      headers: hdrs,
      body: JSON.stringify({ enabled: !current }),
    });
    load();
  };

  const remove = async (id) => {
    await fetch(`${API}/api/v1/admin/hidden/features/${id}`, {
      method: "DELETE",
      headers: hdrs,
    });
    setMsg("Feature deleted");
    load();
  };

  return (
    <>
      <Head>
        <title>Features — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>🔧 Feature Control</h1>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={cardStyle}>
          <h2 style={h2}>Add Feature</h2>
          <input
            style={inp}
            placeholder="Feature name (slug)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            style={inp}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            style={inp}
            placeholder="Monthly cost ($)"
            type="number"
            value={form.cost_monthly}
            onChange={(e) => setForm({ ...form, cost_monthly: e.target.value })}
          />
          <label style={chkRow}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span style={{ marginLeft: "0.5rem" }}>Enabled</span>
          </label>
          <button style={btn} onClick={create}>
            Add Feature
          </button>
        </div>

        <div style={grid}>
          {features.map((f) => (
            <div
              key={f.id}
              style={{ ...featureCard, opacity: f.enabled ? 1 : 0.5 }}
            >
              <div style={fHeader}>
                <span style={fName}>{f.name}</span>
                <button
                  style={toggleBtn(f.enabled)}
                  onClick={() => toggle(f.id, f.enabled)}
                >
                  {f.enabled ? "ON" : "OFF"}
                </button>
              </div>
              {f.description && <p style={fDesc}>{f.description}</p>}
              <div style={fMeta}>
                <span>Roles: {(f.role_access || []).join(", ")}</span>
                {f.cost_monthly > 0 && <span>${f.cost_monthly}/mo</span>}
              </div>
              <button style={delBtn} onClick={() => remove(f.id)}>
                Delete
              </button>
            </div>
          ))}
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
  marginBottom: "2rem",
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
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "1rem",
};
const featureCard = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};
const fHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.5rem",
};
const fName = { fontWeight: 600, color: "#a78bfa" };
const fDesc = {
  color: "#64748b",
  fontSize: "0.85rem",
  margin: "0.25rem 0 0.75rem",
};
const fMeta = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "0.75rem",
  color: "#475569",
  marginBottom: "0.75rem",
};
const toggleBtn = (on) => ({
  background: on ? "#065f46" : "#1c1917",
  color: on ? "#6ee7b7" : "#a8a29e",
  border: `1px solid ${on ? "#059669" : "#44403c"}`,
  padding: "0.2rem 0.6rem",
  borderRadius: "0.35rem",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "0.75rem",
});
const delBtn = {
  background: "#7f1d1d",
  color: "#fca5a5",
  border: "none",
  padding: "0.3rem 0.75rem",
  borderRadius: "0.4rem",
  cursor: "pointer",
  fontSize: "0.8rem",
};
