// dashboard/pages/intelligence.js
// ================================
// XPS Intelligence – Vision Cortex Intelligence Dashboard

import React, { useState, useEffect } from "react";
import Link from "next/link";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
}

function getStaticBase() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

export default function IntelligencePage() {
  const [status, setStatus] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [niches, setNiches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState(null);

  const load = () => {
    const base = getApiBase();
    const staticBase = getStaticBase();
    setLoading(true);
    Promise.all([
      fetch(`${base}/api/v1/intelligence/vision-cortex/status`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${base}/api/v1/intelligence/briefing`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${base}/api/v1/intelligence/niches`)
        .then((r) => r.json())
        .catch(() => null),
    ]).then(async ([s, b, n]) => {
      // Fall back to static data if API is unavailable
      if (!s && !b && !n) {
        try {
          const res = await fetch(`${staticBase}/data/intelligence.json`);
          if (res.ok) {
            const d = await res.json();
            s = d.status || null;
            b = d.briefing || null;
            n = { niches: d.niches || [] };
          }
        } catch {
          // ignore
        }
      }
      setStatus(s);
      setBriefing(b);
      setNiches(n);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const runScrape = () => {
    const base = getApiBase();
    setRunning(true);
    setRunMsg(null);
    fetch(`${base}/api/v1/intelligence/vision-cortex/run`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => setRunMsg(d?.message || "Scrape started"))
      .catch(() => setRunMsg("API unavailable — running in static mode"))
      .finally(() => setRunning(false));
  };

  const cards = status?.sources
    ? Object.entries(status.sources).map(([k, v]) => ({ name: k, ...v }))
    : [];
  const nicheList = Array.isArray(niches?.niches)
    ? niches.niches
    : Array.isArray(niches)
      ? niches
      : [];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.logo}>⚡ XPS Intelligence</span>
        <div style={S.headerLinks}>
          <Link href="/" style={S.navLink}>
            Home
          </Link>
          <Link href="/chat" style={S.navLink}>
            Chat
          </Link>
          <Link href="/leads" style={S.navLink}>
            Leads
          </Link>
          <Link href="/trends" style={S.navLink}>
            Trends
          </Link>
          <Link href="/guardian" style={S.navLink}>
            Guardian
          </Link>
          <Link href="/analytics" style={S.navLink}>
            Analytics
          </Link>
        </div>
      </div>

      <div style={S.content}>
        <div style={S.titleRow}>
          <h1 style={S.title}>🧠 Vision Cortex Intelligence</h1>
          <div
            style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
          >
            <button style={S.refreshBtn} onClick={load}>
              🔄 Refresh
            </button>
            <button
              style={running ? S.btnDisabled : S.btn}
              onClick={runScrape}
              disabled={running}
            >
              {running ? "⏳ Running…" : "▶ Run Intelligence Scrape"}
            </button>
          </div>
        </div>

        {runMsg && <div style={S.runMsg}>{runMsg}</div>}

        {loading ? (
          <div style={S.loading}>Loading intelligence data…</div>
        ) : (
          <>
            {/* Status Panel */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>📡 Scrape Status</h2>
              <div style={S.statGrid}>
                <StatCard
                  label="Last Scrape"
                  value={
                    status?.last_run
                      ? new Date(status.last_run).toLocaleString()
                      : "Never"
                  }
                  color="#7dd3fc"
                />
                <StatCard
                  label="Sources Active"
                  value={status?.sources_count ?? cards.length}
                  color="#FFD700"
                />
                <StatCard
                  label="Items Collected"
                  value={status?.items_collected ?? "—"}
                  color="#4ade80"
                />
                <StatCard
                  label="Status"
                  value={status?.status ?? "—"}
                  color={status?.status === "running" ? "#fbbf24" : "#4ade80"}
                />
              </div>
            </div>

            {/* Intelligence Source Cards */}
            {cards.length > 0 && (
              <div style={S.section}>
                <h2 style={S.sectionTitle}>🔎 Intelligence Sources</h2>
                <div style={S.cardGrid}>
                  {cards.map((c) => (
                    <div key={c.name} style={S.intelCard}>
                      <div style={S.intelCardName}>{c.name}</div>
                      <div style={S.intelCardMeta}>
                        Items:{" "}
                        <span style={{ color: "#FFD700" }}>
                          {c.count ?? "—"}
                        </span>
                      </div>
                      <div style={S.intelCardMeta}>
                        Updated:{" "}
                        <span style={{ color: "#aaa" }}>
                          {c.updated_at
                            ? new Date(c.updated_at).toLocaleTimeString()
                            : "—"}
                        </span>
                      </div>
                      {c.status && (
                        <div
                          style={{
                            ...S.badge,
                            background:
                              c.status === "ok" ? "#052e16" : "#3b0101",
                            color: c.status === "ok" ? "#4ade80" : "#f87171",
                          }}
                        >
                          {c.status}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Briefing */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>📰 Daily Briefing</h2>
              {briefing ? (
                <div style={S.briefingBox}>
                  {briefing.date && (
                    <div style={S.briefingDate}>
                      {new Date(briefing.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  <div style={S.briefingText}>
                    {briefing.summary ||
                      briefing.content ||
                      JSON.stringify(briefing, null, 2)}
                  </div>
                  {Array.isArray(briefing.highlights) && (
                    <ul style={S.bulletList}>
                      {briefing.highlights.map((h, i) => (
                        <li key={i} style={S.bullet}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div style={S.empty}>
                  No briefing available. Run an intelligence scrape to generate
                  one.
                </div>
              )}
            </div>

            {/* Market Opportunities */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>💡 Market Opportunities</h2>
              {nicheList.length === 0 ? (
                <div style={S.empty}>
                  No opportunities found yet. Run a scrape to discover niches.
                </div>
              ) : (
                <div style={S.cardGrid}>
                  {nicheList.slice(0, 12).map((n, i) => (
                    <div key={i} style={S.opportunityCard}>
                      <div style={S.opportunityTitle}>
                        {n.title || n.name || n.niche || `Opportunity ${i + 1}`}
                      </div>
                      {n.description && (
                        <div style={S.opportunityDesc}>{n.description}</div>
                      )}
                      <div style={S.opportunityMeta}>
                        {n.opportunity_score != null && (
                          <span style={{ color: "#FFD700" }}>
                            Score: {n.opportunity_score}
                          </span>
                        )}
                        {n.industry && (
                          <span
                            style={{ color: "#888", marginLeft: "0.75rem" }}
                          >
                            {n.industry}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={S.statCard}>
      <div style={{ ...S.statValue, color }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
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
  logo: { color: "#FFD700", fontWeight: 700, fontSize: "1.1rem" },
  headerLinks: { display: "flex", gap: "1.25rem" },
  navLink: { color: "#888", textDecoration: "none", fontSize: "0.875rem" },
  content: { padding: "1.5rem 2rem", maxWidth: "1200px", margin: "0 auto" },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  title: { color: "#FFD700", fontSize: "1.75rem", fontWeight: 800, margin: 0 },
  refreshBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#aaa",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  btn: {
    background: "#FFD700",
    border: "none",
    color: "#000",
    padding: "0.5rem 1.25rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  btnDisabled: {
    background: "#555",
    border: "none",
    color: "#000",
    padding: "0.5rem 1.25rem",
    borderRadius: "6px",
    cursor: "not-allowed",
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  runMsg: {
    background: "#0d1f0d",
    border: "1px solid #1a3a1a",
    color: "#4ade80",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    marginBottom: "1rem",
    fontSize: "0.875rem",
  },
  loading: { color: "#666", fontSize: "1.1rem", padding: "2rem" },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    color: "#888",
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "1rem",
    letterSpacing: "0.05em",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
    gap: "1rem",
  },
  statCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1.25rem",
    textAlign: "center",
  },
  statValue: { fontSize: "1.5rem", fontWeight: 800 },
  statLabel: {
    color: "#555",
    fontSize: "0.75rem",
    marginTop: "0.25rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))",
    gap: "1rem",
  },
  intelCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
    position: "relative",
  },
  intelCardName: {
    color: "#FFD700",
    fontWeight: 600,
    marginBottom: "0.5rem",
    fontSize: "0.95rem",
  },
  intelCardMeta: { color: "#666", fontSize: "0.8rem", marginBottom: "0.25rem" },
  badge: {
    display: "inline-block",
    padding: "0.2rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
    marginTop: "0.5rem",
  },
  briefingBox: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  briefingDate: {
    color: "#FFD700",
    fontSize: "0.85rem",
    marginBottom: "0.75rem",
    fontWeight: 600,
  },
  briefingText: {
    color: "#ccc",
    lineHeight: 1.7,
    fontSize: "0.9rem",
    whiteSpace: "pre-wrap",
  },
  bulletList: { paddingLeft: "1.25rem", marginTop: "1rem" },
  bullet: {
    color: "#aaa",
    marginBottom: "0.4rem",
    lineHeight: 1.5,
    fontSize: "0.875rem",
  },
  empty: { color: "#555", fontStyle: "italic", padding: "1rem 0" },
  opportunityCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
  },
  opportunityTitle: {
    color: "#fff",
    fontWeight: 600,
    marginBottom: "0.4rem",
    fontSize: "0.95rem",
  },
  opportunityDesc: {
    color: "#777",
    fontSize: "0.8rem",
    marginBottom: "0.5rem",
    lineHeight: 1.5,
  },
  opportunityMeta: { fontSize: "0.8rem" },
};
