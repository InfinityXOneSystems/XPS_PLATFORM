// dashboard/pages/trends.js
// ==========================
// XPS Intelligence – Market Trends & Discovery

import React, { useState, useEffect } from "react";
import Link from "next/link";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
}

const CATEGORIES = [
  "All",
  "AI",
  "Construction",
  "Flooring",
  "Finance",
  "Startups",
];

const GROWTH_ICON = { up: "↑", down: "↓", flat: "→" };
const GROWTH_COLOR = { up: "#4ade80", down: "#f87171", flat: "#fbbf24" };

function growthDir(v) {
  if (v == null) return "flat";
  if (typeof v === "string") {
    if (v === "up" || v === "rising" || v === "growing") return "up";
    if (v === "down" || v === "falling" || v === "declining") return "down";
    return "flat";
  }
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
}

export default function TrendsPage() {
  const [trends, setTrends] = useState([]);
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("All");

  const load = () => {
    const base = getApiBase();
    setLoading(true);
    Promise.all([
      fetch(`${base}/api/v1/intelligence/trends`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${base}/api/v1/intelligence/niches`)
        .then((r) => r.json())
        .catch(() => null),
    ]).then(async ([t, n]) => {
      let tList = Array.isArray(t?.trends)
        ? t.trends
        : Array.isArray(t)
          ? t
          : [];
      let nList = Array.isArray(n?.niches)
        ? n.niches
        : Array.isArray(n)
          ? n
          : [];

      // Fall back to static data if API is unavailable
      if (tList.length === 0 && nList.length === 0) {
        try {
          const staticBase =
            typeof window !== "undefined"
              ? process.env.NEXT_PUBLIC_BASE_PATH || ""
              : "";
          const res = await fetch(`${staticBase}/data/trends.json`);
          if (res.ok) {
            const d = await res.json();
            tList = Array.isArray(d.trends) ? d.trends : [];
            nList = Array.isArray(d.niches) ? d.niches : [];
          }
        } catch {
          // ignore
        }
      }
      setTrends(tList);
      setNiches(nList);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const runScan = () => {
    const base = getApiBase();
    setScanning(true);
    setScanMsg(null);
    fetch(`${base}/api/v1/intelligence/trends/scan`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => setScanMsg(d?.message || "Discovery scan started"))
      .catch(() => setScanMsg("Scan initiated (API queued)"))
      .finally(() => setScanning(false));
  };

  const filtered =
    activeTab === "All"
      ? trends
      : trends.filter((t) => {
          const cats = [t.category, t.industry, t.tag, t.sector]
            .join(" ")
            .toLowerCase();
          return cats.includes(activeTab.toLowerCase());
        });

  const competitionColor = (v) => {
    if (!v) return "#888";
    const low = ["low", "minimal", "weak"].some((x) =>
      String(v).toLowerCase().includes(x),
    );
    const high = ["high", "intense", "strong"].some((x) =>
      String(v).toLowerCase().includes(x),
    );
    return high ? "#f87171" : low ? "#4ade80" : "#fbbf24";
  };

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
          <Link href="/intelligence" style={S.navLink}>
            Intelligence
          </Link>
          <Link href="/invention-lab" style={S.navLink}>
            Invention Lab
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
          <h1 style={S.title}>📈 Market Trends & Discovery</h1>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button style={S.refreshBtn} onClick={load}>
              🔄 Refresh
            </button>
            <button
              style={scanning ? S.btnDisabled : S.btn}
              onClick={runScan}
              disabled={scanning}
            >
              {scanning ? "⏳ Scanning…" : "🔍 Run Discovery Scan"}
            </button>
          </div>
        </div>

        {scanMsg && <div style={S.runMsg}>{scanMsg}</div>}

        {loading ? (
          <div style={S.loading}>Loading market data…</div>
        ) : (
          <>
            {/* Category Tabs */}
            <div style={S.tabs}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  style={activeTab === cat ? S.tabActive : S.tab}
                  onClick={() => setActiveTab(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Trend Cards */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>
                🌡️ Market Trends
                {activeTab !== "All" && (
                  <span style={{ color: "#FFD700", marginLeft: "0.5rem" }}>
                    — {activeTab}
                  </span>
                )}
                <span style={S.count}> ({filtered.length})</span>
              </h2>
              {filtered.length === 0 ? (
                <div style={S.empty}>
                  No trend data available
                  {activeTab !== "All" ? ` for "${activeTab}"` : ""}. Run a
                  discovery scan to populate trends.
                </div>
              ) : (
                <div style={S.trendGrid}>
                  {filtered.slice(0, 12).map((t, i) => {
                    const dir = growthDir(
                      t.growth || t.growth_rate || t.direction,
                    );
                    return (
                      <div key={i} style={S.trendCard}>
                        <div style={S.trendHeader}>
                          <span style={S.trendName}>
                            {t.name || t.title || t.trend || `Trend ${i + 1}`}
                          </span>
                          <span
                            style={{
                              color: GROWTH_COLOR[dir],
                              fontSize: "1.25rem",
                              fontWeight: 700,
                            }}
                          >
                            {GROWTH_ICON[dir]}
                          </span>
                        </div>
                        {t.description && (
                          <div style={S.trendDesc}>{t.description}</div>
                        )}
                        <div style={S.trendMeta}>
                          {t.score != null && (
                            <span style={S.scoreChip}>Score: {t.score}</span>
                          )}
                          {t.category && (
                            <span style={S.catChip}>{t.category}</span>
                          )}
                          {t.growth_rate != null && (
                            <span
                              style={{
                                color: GROWTH_COLOR[dir],
                                fontSize: "0.8rem",
                              }}
                            >
                              {dir === "up" ? "+" : dir === "down" ? "-" : ""}
                              {typeof t.growth_rate === "number"
                                ? `${Math.abs(t.growth_rate)}%`
                                : t.growth_rate}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Niche Opportunities Table */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>
                🎯 Discovered Niches ({niches.length})
              </h2>
              {niches.length === 0 ? (
                <div style={S.empty}>No niches discovered yet.</div>
              ) : (
                <div style={S.tableWrapper}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {[
                          "Niche / Title",
                          "Industry",
                          "Region",
                          "Opp. Score",
                          "Competition",
                        ].map((h) => (
                          <th key={h} style={S.th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {niches.slice(0, 30).map((n, i) => (
                        <tr key={i} style={S.tr}>
                          <td style={S.td}>
                            {n.title || n.name || n.niche || "—"}
                          </td>
                          <td style={S.td}>{n.industry || "—"}</td>
                          <td style={S.td}>{n.region || n.location || "—"}</td>
                          <td
                            style={{
                              ...S.td,
                              color: "#FFD700",
                              fontWeight: 600,
                            }}
                          >
                            {n.opportunity_score != null
                              ? n.opportunity_score
                              : "—"}
                          </td>
                          <td
                            style={{
                              ...S.td,
                              color: competitionColor(n.competition),
                            }}
                          >
                            {n.competition || n.competition_level || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
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
    background: "#333",
    border: "none",
    color: "#666",
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
  tabs: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },
  tab: {
    background: "#111",
    border: "1px solid #222",
    color: "#888",
    padding: "0.4rem 1rem",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  tabActive: {
    background: "#1a1000",
    border: "1px solid #FFD700",
    color: "#FFD700",
    padding: "0.4rem 1rem",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    color: "#888",
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "1rem",
    letterSpacing: "0.05em",
  },
  count: { color: "#555", fontWeight: 400 },
  empty: { color: "#555", fontStyle: "italic", padding: "1rem 0" },
  trendGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))",
    gap: "1rem",
  },
  trendCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
  },
  trendHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.4rem",
  },
  trendName: {
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.95rem",
    flex: 1,
    marginRight: "0.5rem",
  },
  trendDesc: {
    color: "#777",
    fontSize: "0.8rem",
    marginBottom: "0.6rem",
    lineHeight: 1.5,
  },
  trendMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    alignItems: "center",
  },
  scoreChip: {
    background: "#1a1000",
    color: "#FFD700",
    border: "1px solid #3a2a00",
    borderRadius: "4px",
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  catChip: {
    background: "#0d0d1a",
    color: "#a78bfa",
    border: "1px solid #1a1a33",
    borderRadius: "4px",
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
  },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th: {
    background: "#0a0a0a",
    color: "#666",
    padding: "0.6rem 1rem",
    textAlign: "left",
    borderBottom: "1px solid #1a1a1a",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: { padding: "0.6rem 1rem", borderBottom: "1px solid #111", color: "#ccc" },
  tr: {},
};
