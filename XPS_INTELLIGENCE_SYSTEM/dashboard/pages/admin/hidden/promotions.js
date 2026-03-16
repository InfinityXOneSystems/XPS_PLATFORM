/**
 * Admin — Promotion & Coupon System
 * Route: /admin/hidden/promotions
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

export default function AdminPromotions() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({
    code: "",
    type: "percentage",
    discount: 10,
    description: "",
    max_uses: "",
  });
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch(`${API}/api/v1/admin/hidden/promotions`, { headers: hdrs })
      .then((r) => r.json())
      .then(setPromos)
      .catch(() => setMsg("Failed to load promotions"));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const payload = {
      ...form,
      discount: parseFloat(form.discount),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      created_by: "admin",
    };
    const resp = await fetch(`${API}/api/v1/admin/hidden/promotions`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      setMsg("Promotion created");
      load();
    } else {
      const e = await resp.json();
      setMsg(e.detail || "Error");
    }
  };

  const remove = async (id) => {
    await fetch(`${API}/api/v1/admin/hidden/promotions/${id}`, {
      method: "DELETE",
      headers: hdrs,
    });
    setMsg("Deleted");
    load();
  };

  const exportCSV = () => {
    const rows = [["Code", "Type", "Discount", "Uses", "Max Uses", "Active"]];
    promos.forEach((p) =>
      rows.push([
        p.code,
        p.type,
        p.discount,
        p.usage_count,
        p.max_uses ?? "∞",
        p.is_active ? "Yes" : "No",
      ]),
    );
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "promotions.csv";
    a.click();
  };

  return (
    <>
      <Head>
        <title>Promotions — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <div style={row}>
          <h1 style={h1}>🎟️ Promotion & Coupon System</h1>
          <button style={btnGray} onClick={exportCSV}>
            Export CSV
          </button>
        </div>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={cardStyle}>
          <h2 style={h2}>Create Promotion</h2>
          <div style={formGrid}>
            <input
              style={inp}
              placeholder="Code (e.g. EPOXY20)"
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase() })
              }
            />
            <select
              style={inp}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="percentage">Percentage %</option>
              <option value="fixed">Fixed $</option>
              <option value="trial_days">Trial Days</option>
            </select>
            <input
              style={inp}
              placeholder="Discount amount"
              type="number"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
            <input
              style={inp}
              placeholder="Max uses (blank = unlimited)"
              type="number"
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            />
          </div>
          <input
            style={{ ...inp, width: "100%" }}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button style={btn} onClick={create}>
            Create
          </button>
        </div>

        <table style={tbl}>
          <thead>
            <tr>
              {[
                "Code",
                "Type",
                "Discount",
                "Uses",
                "Max",
                "Active",
                "Actions",
              ].map((c) => (
                <th key={c} style={th}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td style={td}>
                  <code style={codeStyle}>{p.code}</code>
                </td>
                <td style={td}>{p.type}</td>
                <td style={td}>
                  {p.type === "percentage"
                    ? `${p.discount}%`
                    : p.type === "fixed"
                      ? `$${p.discount}`
                      : `${p.discount} days`}
                </td>
                <td style={td}>{p.usage_count}</td>
                <td style={td}>{p.max_uses ?? "∞"}</td>
                <td style={td}>{p.is_active ? "✅" : "🚫"}</td>
                <td style={td}>
                  <button style={delBtn} onClick={() => remove(p.id)}>
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
const h1 = { color: "#a78bfa", margin: 0 };
const h2 = { color: "#94a3b8", marginBottom: "1rem", fontSize: "1rem" };
const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1.5rem",
};
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
const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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
const btnGray = {
  background: "#1e293b",
  color: "#94a3b8",
  border: "1px solid #334155",
  padding: "0.5rem 1rem",
  borderRadius: "0.5rem",
  cursor: "pointer",
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
const delBtn = {
  background: "#7f1d1d",
  color: "#fca5a5",
  border: "none",
  padding: "0.3rem 0.75rem",
  borderRadius: "0.4rem",
  cursor: "pointer",
  fontSize: "0.8rem",
};
const codeStyle = {
  background: "#1e1b4b",
  color: "#a78bfa",
  padding: "0.1rem 0.4rem",
  borderRadius: "0.3rem",
};
