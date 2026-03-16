/**
 * Admin — User Management
 * Route: /admin/hidden/users
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const headers = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "viewer",
    subscription_plan: "free",
    hashed_password: "changeme",
  });
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch(`${API}/api/v1/admin/hidden/users`, { headers })
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setMsg("Failed to load users"));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const resp = await fetch(`${API}/api/v1/admin/hidden/users`, {
      method: "POST",
      headers,
      body: JSON.stringify(form),
    });
    if (resp.ok) {
      setMsg("User created");
      load();
    } else {
      const e = await resp.json();
      setMsg(e.detail || "Error");
    }
  };

  const suspend = async (id) => {
    await fetch(`${API}/api/v1/admin/hidden/users/${id}?suspend=true`, {
      method: "DELETE",
      headers,
    });
    setMsg("User suspended");
    load();
  };

  const remove = async (id) => {
    await fetch(`${API}/api/v1/admin/hidden/users/${id}`, {
      method: "DELETE",
      headers,
    });
    setMsg("User deleted");
    load();
  };

  return (
    <>
      <Head>
        <title>Users — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>👥 User Management</h1>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={card}>
          <h2 style={h2}>Add User</h2>
          {["email", "full_name", "role", "subscription_plan"].map((f) => (
            <input
              key={f}
              style={inp}
              placeholder={f}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            />
          ))}
          <button style={btn} onClick={create}>
            Create User
          </button>
        </div>

        <table style={tbl}>
          <thead>
            <tr>
              {["Email", "Name", "Role", "Plan", "Active", "Actions"].map(
                (c) => (
                  <th key={c} style={th}>
                    {c}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.full_name || "—"}</td>
                <td style={td}>
                  <span style={badge(u.role)}>{u.role}</span>
                </td>
                <td style={td}>{u.subscription_plan}</td>
                <td style={td}>{u.is_active ? "✅" : "🚫"}</td>
                <td style={td}>
                  <button style={smBtn("orange")} onClick={() => suspend(u.id)}>
                    Suspend
                  </button>{" "}
                  <button style={smBtn("red")} onClick={() => remove(u.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
const card = {
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
};
const tbl = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: "0.6rem 1rem",
  borderBottom: "1px solid #1e293b",
  color: "#64748b",
  fontSize: "0.85rem",
};
const td = {
  padding: "0.75rem 1rem",
  borderBottom: "1px solid #1e293b",
  fontSize: "0.9rem",
};
const smBtn = (c) => ({
  background: c === "red" ? "#7f1d1d" : "#78350f",
  color: "#fff",
  border: "none",
  padding: "0.3rem 0.75rem",
  borderRadius: "0.4rem",
  cursor: "pointer",
  fontSize: "0.8rem",
});
const ROLE_COLORS = {
  owner: "#7c3aed",
  admin: "#1d4ed8",
  manager: "#0891b2",
  sales: "#059669",
  viewer: "#374151",
};
const badge = (role) => ({
  background: ROLE_COLORS[role] || "#374151",
  color: "#fff",
  padding: "0.15rem 0.5rem",
  borderRadius: "0.35rem",
  fontSize: "0.75rem",
});
