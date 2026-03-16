// dashboard/pages/leads.js
// =========================
// XPS Intelligence – Leads Viewer

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const STATIC_DATA_URL =
  (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/data/scored_leads.json";

const GATEWAY_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3099"
    : "http://localhost:3099";

/** Normalise a raw lead record to the shape the table expects. */
function normaliseLead(l) {
  return {
    ...l,
    company_name: l.company_name || l.company || l.name || "",
    lead_score: l.lead_score ?? l.score ?? 0,
  };
}

export default function LeadsPage() {
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Try live gateway first; fall back to bundled static data.
        let arr = [];
        try {
          const res = await fetch(`${GATEWAY_URL}/api/leads?limit=5000`); // load all leads for client-side filtering
          if (res.ok) {
            const data = await res.json();
            arr = data.data?.leads || data.leads || [];
          }
        } catch {
          // Gateway unreachable (expected on GitHub Pages)
        }

        if (arr.length === 0) {
          const res = await fetch(STATIC_DATA_URL);
          if (res.ok) {
            arr = await res.json();
          }
        }

        if (!cancelled) {
          setAllLeads(arr.map(normaliseLead));
        }
      } catch {
        if (!cancelled) setAllLeads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = allLeads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.company_name || "").toLowerCase().includes(q) ||
          (l.city || "").toLowerCase().includes(q),
      );
    }
    if (cityFilter) {
      const q = cityFilter.toLowerCase();
      result = result.filter((l) => (l.city || "").toLowerCase().includes(q));
    }
    if (minScore) {
      const ms = Number(minScore);
      result = result.filter((l) => l.lead_score >= ms);
    }
    return result;
  }, [allLeads, search, cityFilter, minScore]);

  const total = filtered.length;
  const pageLeads = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    const cols = [
      "company_name",
      "phone",
      "website",
      "email",
      "city",
      "state",
      "lead_score",
      "rating",
    ];
    const rows = [cols.join(",")];
    for (const l of filtered) {
      rows.push(
        cols
          .map((c) => `"${String(l[c] || "").replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "xps_leads.csv";
    a.click();
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>⚡ XPS Intelligence</span>
        <div style={styles.headerLinks}>
          <Link href="/" style={styles.navLink}>
            Home
          </Link>
          <Link href="/chat" style={styles.navLink}>
            Chat
          </Link>
          <Link href="/analytics" style={styles.navLink}>
            Analytics
          </Link>
          <Link href="/settings" style={styles.navLink}>
            Settings
          </Link>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.toolbar}>
          <h1 style={styles.title}>
            📋 Leads{" "}
            <span style={{ color: "#888", fontSize: "1rem" }}>({total})</span>
          </h1>
          <div style={styles.filters}>
            <input
              style={styles.filterInput}
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <input
              style={styles.filterInput}
              placeholder="City"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(0);
              }}
            />
            <input
              style={{ ...styles.filterInput, width: "100px" }}
              placeholder="Min score"
              type="number"
              value={minScore}
              onChange={(e) => {
                setMinScore(e.target.value);
                setPage(0);
              }}
            />
            <button style={styles.exportBtn} onClick={exportCsv}>
              ⬇ CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div
            style={{ color: "#FFD700", padding: "2rem", textAlign: "center" }}
          >
            Loading…
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    "Company",
                    "City",
                    "State",
                    "Score",
                    "Phone",
                    "Website",
                    "Rating",
                  ].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageLeads.map((l, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0f0f0f" }}>
                    <td style={styles.td}>{l.company_name || "—"}</td>
                    <td style={{ ...styles.td, color: "#aaa" }}>
                      {l.city || "—"}
                    </td>
                    <td style={{ ...styles.td, color: "#aaa" }}>
                      {l.state || "—"}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        color: "#FFD700",
                        fontWeight: 600,
                      }}
                    >
                      {l.lead_score ?? l.score ?? 0}
                    </td>
                    <td style={{ ...styles.td, color: "#4CAF50" }}>
                      {l.phone || "—"}
                    </td>
                    <td style={styles.td}>
                      {l.website ? (
                        <a
                          href={l.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#2196F3" }}
                        >
                          🔗 site
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ ...styles.td, color: "#aaa" }}>
                      {l.rating ? `⭐ ${l.rating}` : "—"}
                    </td>
                  </tr>
                ))}
                {pageLeads.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        ...styles.td,
                        textAlign: "center",
                        color: "#555",
                        padding: "2rem",
                      }}
                    >
                      No leads found. Try scraping some leads via the{" "}
                      <Link href="/chat" style={{ color: "#FFD700" }}>
                        Chat interface
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={styles.pagination}>
          <button
            style={{ ...styles.pageBtn, opacity: page === 0 ? 0.3 : 1 }}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </button>
          <span style={{ color: "#888", fontSize: "0.875rem" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            style={{
              ...styles.pageBtn,
              opacity: page + 1 >= totalPages ? 0.3 : 1,
            }}
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
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
  content: { padding: "1.5rem" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  title: { color: "#FFD700", fontSize: "1.5rem", fontWeight: 700 },
  filters: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  filterInput: {
    background: "#111",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    width: "150px",
  },
  exportBtn: {
    background: "transparent",
    border: "1px solid #FFD700",
    borderRadius: "6px",
    color: "#FFD700",
    padding: "0.4rem 0.75rem",
    fontSize: "0.875rem",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: {
    padding: "0.6rem 0.5rem",
    textAlign: "left",
    color: "#FFD700",
    borderBottom: "1px solid #222",
    whiteSpace: "nowrap",
  },
  td: { padding: "0.45rem 0.5rem", verticalAlign: "middle" },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem 0",
    justifyContent: "center",
  },
  pageBtn: {
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
  },
};
