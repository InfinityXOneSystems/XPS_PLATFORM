/**
 * Admin — Payment & Subscription Checkout
 * Route: /admin/hidden/payments
 *
 * Lists Stripe invoices. Configure Stripe keys in Settings panel.
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

const PLANS = [
  {
    id: "free",
    label: "Free",
    price: "$0/mo",
    features: ["10 leads/day", "Basic dashboard"],
  },
  {
    id: "starter",
    label: "Starter",
    price: "$49/mo",
    features: ["500 leads/day", "Email outreach", "Lead scoring"],
  },
  {
    id: "pro",
    label: "Pro",
    price: "$149/mo",
    features: [
      "5,000 leads/day",
      "All scrapers",
      "API access",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: "Custom",
    features: ["Unlimited leads", "Dedicated agent", "White label", "SLA"],
  },
];

export default function AdminPayments() {
  const [invoices, setInvoices] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/v1/admin/hidden/payments/invoices`, { headers: hdrs })
      .then((r) => r.json())
      .then(setInvoices)
      .catch(() => setMsg("Failed to load invoices"));
  }, []);

  const totalRevenue = invoices.reduce(
    (s, i) => s + (i.status === "active" ? i.amount_cents : 0),
    0,
  );

  return (
    <>
      <Head>
        <title>Payments — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>💳 Payments & Subscriptions</h1>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={statsRow}>
          <Stat label="Total Invoices" value={invoices.length} />
          <Stat
            label="Active Subscriptions"
            value={invoices.filter((i) => i.status === "active").length}
          />
          <Stat label="MRR" value={`$${(totalRevenue / 100).toFixed(2)}`} />
        </div>

        <h2 style={h2}>Subscription Plans</h2>
        <div style={plansGrid}>
          {PLANS.map((plan) => (
            <div key={plan.id} style={planCard}>
              <div style={planName}>{plan.label}</div>
              <div style={planPrice}>{plan.price}</div>
              <ul style={featureList}>
                {plan.features.map((f) => (
                  <li key={f} style={featureItem}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
              <div style={planNote}>
                Configure Stripe webhook in Settings → payments
              </div>
            </div>
          ))}
        </div>

        <h2 style={h2}>Invoices</h2>
        {invoices.length === 0 ? (
          <p style={{ color: "#475569" }}>
            No invoices yet. Connect Stripe in Settings → payments.
          </p>
        ) : (
          <table style={tbl}>
            <thead>
              <tr>
                {[
                  "Invoice ID",
                  "User",
                  "Plan",
                  "Amount",
                  "Currency",
                  "Status",
                  "Period",
                ].map((c) => (
                  <th key={c} style={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={td}>
                    <code style={code}>{inv.stripe_invoice_id || inv.id}</code>
                  </td>
                  <td style={td}>{inv.user_id}</td>
                  <td style={td}>{inv.plan}</td>
                  <td style={td}>${(inv.amount_cents / 100).toFixed(2)}</td>
                  <td style={td}>{inv.currency?.toUpperCase()}</td>
                  <td style={td}>
                    <span style={statusBadge(inv.status)}>{inv.status}</span>
                  </td>
                  <td style={td}>
                    {inv.period_start
                      ? new Date(inv.period_start).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div style={stat}>
      <div style={statVal}>{value}</div>
      <div style={statLbl}>{label}</div>
    </div>
  );
}

const STATUS_COLORS = {
  active: "#065f46",
  past_due: "#78350f",
  cancelled: "#7f1d1d",
  pending: "#1e3a5f",
  refunded: "#581c87",
};
const statusBadge = (s) => ({
  background: STATUS_COLORS[s] || "#1e293b",
  color: "#fff",
  padding: "0.15rem 0.5rem",
  borderRadius: "0.35rem",
  fontSize: "0.75rem",
});
const pg = {
  minHeight: "100vh",
  background: "#0a0a0f",
  color: "#e2e8f0",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
};
const h1 = { color: "#a78bfa", marginBottom: "1.5rem" };
const h2 = { color: "#94a3b8", margin: "2rem 0 1rem", fontSize: "1rem" };
const msgBox = {
  background: "#1e3a5f",
  color: "#93c5fd",
  padding: "0.75rem 1rem",
  borderRadius: "0.5rem",
  marginBottom: "1rem",
};
const statsRow = {
  display: "flex",
  gap: "1rem",
  marginBottom: "2rem",
  flexWrap: "wrap",
};
const stat = {
  background: "#1e1b4b",
  borderRadius: "0.75rem",
  padding: "1rem 1.5rem",
  minWidth: "130px",
  textAlign: "center",
};
const statVal = { fontSize: "1.6rem", fontWeight: 700, color: "#a78bfa" };
const statLbl = { fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" };
const plansGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: "1rem",
  marginBottom: "2rem",
};
const planCard = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};
const planName = { fontWeight: 700, color: "#a78bfa", marginBottom: "0.25rem" };
const planPrice = {
  fontSize: "1.2rem",
  fontWeight: 600,
  color: "#e2e8f0",
  marginBottom: "0.75rem",
};
const featureList = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 0.75rem",
  color: "#64748b",
  fontSize: "0.85rem",
};
const featureItem = { marginBottom: "0.25rem" };
const planNote = { fontSize: "0.7rem", color: "#334155" };
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
const code = {
  background: "#1e1b4b",
  color: "#a78bfa",
  padding: "0.1rem 0.4rem",
  borderRadius: "0.3rem",
  fontSize: "0.8rem",
};
