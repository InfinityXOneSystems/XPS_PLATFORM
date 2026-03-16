/**
 * Hidden Admin Dashboard — Main Hub
 * Route: /admin/hidden/dashboard
 *
 * God-mode overview: user count, health, analytics, quick links to all panels.
 */

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";

const PANELS = [
  {
    href: "/admin/hidden/users",
    label: "👥 Users",
    desc: "CRUD, roles & permissions",
  },
  {
    href: "/admin/hidden/features",
    label: "🔧 Features",
    desc: "Toggle platform features",
  },
  {
    href: "/admin/hidden/settings",
    label: "⚙️ Settings",
    desc: "Global configuration",
  },
  {
    href: "/admin/hidden/promotions",
    label: "🎟️ Promotions",
    desc: "Coupons & discounts",
  },
  {
    href: "/admin/hidden/payments",
    label: "💳 Payments",
    desc: "Invoices & subscriptions",
  },
  {
    href: "/admin/hidden/health",
    label: "🩺 Health",
    desc: "Uptime & latency",
  },
  {
    href: "/admin/hidden/analytics",
    label: "📊 Analytics",
    desc: "DAU/MAU & growth",
  },
  {
    href: "/admin/hidden/copilot",
    label: "🤖 Copilot",
    desc: "Prompt editor & spawn",
  },
  {
    href: "/admin/hidden/integrations",
    label: "🔌 Integrations",
    desc: "API connectors",
  },
];

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/v1/admin/hidden/analytics`, {
      headers: { "X-Admin-Token": ADMIN_TOKEN },
    })
      .then((r) => r.json())
      .then(setAnalytics)
      .catch(() => setError("Could not load analytics"));
  }, []);

  return (
    <>
      <Head>
        <title>Admin — XPS Intelligence</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>⚡ XPS Admin Command Center</h1>
          <p style={styles.subtitle}>
            God-mode control panel · Owner access only
          </p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {analytics && (
          <div style={styles.statsRow}>
            <Stat label="Total Users" value={analytics.users?.total ?? 0} />
            <Stat label="Active Users" value={analytics.users?.active ?? 0} />
            <Stat label="DAU" value={analytics.analytics?.dau ?? 0} />
            <Stat
              label="Uptime"
              value={`${analytics.health?.uptime_pct ?? 100}%`}
            />
            <Stat
              label="Error Rate"
              value={`${((analytics.health?.error_rate ?? 0) * 100).toFixed(2)}%`}
            />
          </div>
        )}

        <div style={styles.grid}>
          {PANELS.map((p) => (
            <Link key={p.href} href={p.href} style={styles.card}>
              <div style={styles.cardLabel}>{p.label}</div>
              <div style={styles.cardDesc}>{p.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0f",
    color: "#e2e8f0",
    padding: "2rem",
    fontFamily: "system-ui, sans-serif",
  },
  header: { marginBottom: "2rem" },
  title: { fontSize: "1.8rem", fontWeight: 700, color: "#a78bfa", margin: 0 },
  subtitle: { color: "#64748b", marginTop: "0.25rem" },
  error: {
    background: "#7f1d1d",
    color: "#fca5a5",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    marginBottom: "1rem",
  },
  statsRow: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
    marginBottom: "2rem",
  },
  stat: {
    background: "#1e1b4b",
    borderRadius: "0.75rem",
    padding: "1rem 1.5rem",
    minWidth: "120px",
    textAlign: "center",
  },
  statValue: { fontSize: "1.6rem", fontWeight: 700, color: "#a78bfa" },
  statLabel: { fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "1rem",
  },
  card: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: "0.75rem",
    padding: "1.25rem",
    textDecoration: "none",
    color: "#e2e8f0",
    transition: "border-color 0.2s",
    cursor: "pointer",
    display: "block",
  },
  cardLabel: { fontWeight: 600, marginBottom: "0.4rem", fontSize: "1rem" },
  cardDesc: { color: "#64748b", fontSize: "0.85rem" },
};
