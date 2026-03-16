/**
 * Admin — Site Health Monitor
 * Route: /admin/hidden/health
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = { "X-Admin-Token": ADMIN_TOKEN };

export default function AdminHealth() {
  const [data, setData] = useState(null);
  const [backendAlive, setBackendAlive] = useState(null);

  const load = () =>
    fetch(`${API}/api/v1/admin/hidden/health`, { headers: hdrs })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));

  const pingBackend = () =>
    fetch(`${API}/health`)
      .then((r) => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));

  useEffect(() => {
    load();
    pingBackend();
    const t = setInterval(() => {
      load();
      pingBackend();
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const latest = data?.snapshots?.[0];

  return (
    <>
      <Head>
        <title>Health — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>🩺 Site Health Monitor</h1>
        <p style={sub}>Auto-refreshes every 30 seconds</p>

        <div style={statsRow}>
          <Stat
            label="Backend"
            value={
              backendAlive === null
                ? "…"
                : backendAlive
                  ? "✅ Online"
                  : "❌ Down"
            }
            color={backendAlive ? "#6ee7b7" : "#fca5a5"}
          />
          <Stat label="Uptime" value={latest ? `${latest.uptime_pct}%` : "—"} />
          <Stat
            label="P50 Latency"
            value={latest?.latency_p50_ms ? `${latest.latency_p50_ms}ms` : "—"}
          />
          <Stat
            label="P95 Latency"
            value={latest?.latency_p95_ms ? `${latest.latency_p95_ms}ms` : "—"}
          />
          <Stat
            label="Error Rate"
            value={latest ? `${(latest.error_rate * 100).toFixed(2)}%` : "—"}
          />
          <Stat
            label="Req/min"
            value={latest?.requests_per_min?.toFixed(1) ?? "—"}
          />
        </div>

        <h2 style={h2}>Health History (last 10 snapshots)</h2>
        {!data || data.snapshots.length === 0 ? (
          <p style={{ color: "#475569" }}>
            No health data yet. Data is populated by the monitor agent.
          </p>
        ) : (
          <table style={tbl}>
            <thead>
              <tr>
                {[
                  "Time",
                  "Service",
                  "Uptime %",
                  "P50 ms",
                  "P95 ms",
                  "P99 ms",
                  "Error Rate",
                  "Req/min",
                ].map((c) => (
                  <th key={c} style={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.snapshots.map((s, i) => (
                <tr key={i}>
                  <td style={td}>
                    {new Date(s.recorded_at).toLocaleTimeString()}
                  </td>
                  <td style={td}>{s.service}</td>
                  <td style={td}>
                    <span style={uptimeColor(s.uptime_pct)}>
                      {s.uptime_pct}%
                    </span>
                  </td>
                  <td style={td}>{s.latency_p50_ms ?? "—"}</td>
                  <td style={td}>{s.latency_p95_ms ?? "—"}</td>
                  <td style={td}>{s.latency_p99_ms ?? "—"}</td>
                  <td style={td}>
                    {s.error_rate
                      ? `${(s.error_rate * 100).toFixed(2)}%`
                      : "0%"}
                  </td>
                  <td style={td}>{s.requests_per_min?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={stat}>
      <div style={{ ...statVal, color: color || "#a78bfa" }}>{value}</div>
      <div style={statLbl}>{label}</div>
    </div>
  );
}

const uptimeColor = (pct) => ({
  color: pct >= 99.9 ? "#6ee7b7" : pct >= 99 ? "#fcd34d" : "#fca5a5",
});
const pg = {
  minHeight: "100vh",
  background: "#0a0a0f",
  color: "#e2e8f0",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
};
const h1 = { color: "#a78bfa", marginBottom: "0.25rem" };
const sub = { color: "#475569", marginBottom: "1.5rem", fontSize: "0.85rem" };
const h2 = { color: "#94a3b8", margin: "2rem 0 1rem", fontSize: "1rem" };
const statsRow = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap",
  marginBottom: "2rem",
};
const stat = {
  background: "#1e1b4b",
  borderRadius: "0.75rem",
  padding: "1rem 1.5rem",
  minWidth: "120px",
  textAlign: "center",
};
const statVal = { fontSize: "1.4rem", fontWeight: 700 };
const statLbl = { fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" };
const tbl = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: "0.6rem 1rem",
  borderBottom: "1px solid #1e293b",
  color: "#64748b",
  fontSize: "0.85rem",
};
const td = {
  padding: "0.6rem 1rem",
  borderBottom: "1px solid #0f172a",
  fontSize: "0.85rem",
};
