/**
 * Admin — User Analytics
 * Route: /admin/hidden/analytics
 *
 * DAU/MAU, growth, churn, conversion, NPS.
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = { "X-Admin-Token": ADMIN_TOKEN };

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/v1/admin/hidden/analytics`, { headers: hdrs })
      .then((r) => r.json())
      .then(setAnalytics)
      .catch(() => {});
  }, []);

  if (!analytics)
    return (
      <div style={pg}>
        <h1 style={h1}>📊 Analytics</h1>
        <p style={{ color: "#475569" }}>Loading…</p>
      </div>
    );

  const { users, health, analytics: a } = analytics;

  return (
    <>
      <Head>
        <title>Analytics — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>📊 User Analytics</h1>

        <div style={statsGrid}>
          <BigStat label="Total Users" value={users.total} color="#a78bfa" />
          <BigStat label="Active Users" value={users.active} color="#6ee7b7" />
          <BigStat label="DAU" value={a.dau} color="#60a5fa" />
          <BigStat label="MAU" value={a.mau} color="#f472b6" />
          <BigStat
            label="MRR"
            value={`$${((a.revenue_cents || 0) / 100).toFixed(2)}`}
            color="#fcd34d"
          />
          <BigStat
            label="Conversion"
            value={`${((a.conversion_rate || 0) * 100).toFixed(1)}%`}
            color="#fb923c"
          />
        </div>

        <div style={sectionsGrid}>
          <Section title="System Health">
            <KV k="Uptime" v={`${health.uptime_pct ?? 100}%`} />
            <KV
              k="P50 Latency"
              v={health.latency_p50_ms ? `${health.latency_p50_ms}ms` : "—"}
            />
            <KV
              k="P95 Latency"
              v={health.latency_p95_ms ? `${health.latency_p95_ms}ms` : "—"}
            />
            <KV
              k="Error Rate"
              v={`${((health.error_rate || 0) * 100).toFixed(2)}%`}
            />
          </Section>

          <Section title="Growth Metrics">
            <KV k="Inactive Users" v={users.total - users.active} />
            <KV k="Paid Users" v="—" />
            <KV k="NPS Score" v={a.nps_score ?? "—"} />
            <KV
              k="Revenue / User"
              v={
                users.active > 0
                  ? `$${((a.revenue_cents || 0) / 100 / users.active).toFixed(2)}`
                  : "—"
              }
            />
          </Section>
        </div>

        <div style={notice}>
          <strong>📌 Note:</strong> Analytics data is populated by the
          AnalyticsDaily table. Records are written by the monitoring pipeline
          (GitHub Actions or scheduled agent). Historical charts will appear
          once data is available.
        </div>
      </div>
    </>
  );
}

function BigStat({ label, value, color }) {
  return (
    <div style={bigStatCard}>
      <div style={{ ...bigStatVal, color }}>{value}</div>
      <div style={bigStatLbl}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={section}>
      <h2 style={h2}>{title}</h2>
      {children}
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div style={kvRow}>
      <span style={kvKey}>{k}</span>
      <span style={kvVal}>{v}</span>
    </div>
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
const h2 = { color: "#94a3b8", marginBottom: "1rem", fontSize: "0.95rem" };
const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "1rem",
  marginBottom: "2rem",
};
const bigStatCard = {
  background: "#1e1b4b",
  borderRadius: "0.75rem",
  padding: "1.25rem",
  textAlign: "center",
};
const bigStatVal = { fontSize: "2rem", fontWeight: 700 };
const bigStatLbl = {
  fontSize: "0.75rem",
  color: "#94a3b8",
  marginTop: "0.4rem",
};
const sectionsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem",
  marginBottom: "2rem",
};
const section = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.5rem",
};
const kvRow = {
  display: "flex",
  justifyContent: "space-between",
  padding: "0.5rem 0",
  borderBottom: "1px solid #1e293b",
};
const kvKey = { color: "#64748b", fontSize: "0.9rem" };
const kvVal = { color: "#e2e8f0", fontWeight: 600 };
const notice = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "0.75rem",
  padding: "1rem 1.25rem",
  color: "#94a3b8",
  fontSize: "0.85rem",
};
