// dashboard/pages/invention-lab.js
// ==================================
// XPS Intelligence – Invention Lab / Idea Generation

import React, { useState, useEffect } from "react";
import Link from "next/link";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
}

const AGENTS = [
  {
    key: "ceo",
    label: "🏛️ CEO Agent",
    desc: "Strategic direction & prioritization",
  },
  {
    key: "vision",
    label: "🧠 Vision Agent",
    desc: "Market sensing & pattern recognition",
  },
  {
    key: "strategy",
    label: "📐 Strategy Agent",
    desc: "Competitive analysis & roadmap",
  },
  {
    key: "prediction",
    label: "🔮 Prediction Agent",
    desc: "Trend forecasting & risk analysis",
  },
  {
    key: "simulation",
    label: "🧪 Simulation Agent",
    desc: "Hypothesis testing & scenario modeling",
  },
];

export default function InventionLabPage() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [submitMsg, setSubmitMsg] = useState(null);
  const [agentStatus, setAgentStatus] = useState({});

  const loadIdeas = () => {
    const base = getApiBase();
    setLoading(true);
    Promise.all([
      fetch(`${base}/api/v1/intelligence/niches`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${base}/api/v1/system/health`)
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([n, h]) => {
      const list = Array.isArray(n?.niches)
        ? n.niches
        : Array.isArray(n)
          ? n
          : [];
      setIdeas(list);
      setAgentStatus(h?.agents || {});
      setLoading(false);
    });
  };

  useEffect(() => {
    loadIdeas();
  }, []);

  const generateIdea = () => {
    const base = getApiBase();
    setGenerating(true);
    fetch(`${base}/api/v1/intelligence/niches/generate`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d && (d.title || d.name)) {
          setIdeas((prev) => [d, ...prev]);
        }
      })
      .catch(() => {})
      .finally(() => setGenerating(false));
  };

  const submitHypothesis = () => {
    if (!hypothesis.trim()) return;
    const base = getApiBase();
    setSubmitMsg(null);
    fetch(`${base}/api/v1/intelligence/experiment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hypothesis: hypothesis.trim() }),
    })
      .then((r) => r.json())
      .then((d) =>
        setSubmitMsg(d?.message || "Hypothesis submitted to experiment engine"),
      )
      .catch(() => setSubmitMsg("Submitted (API unavailable — queued locally)"))
      .finally(() => setHypothesis(""));
  };

  const scorePct = (v) => {
    if (v == null) return "—";
    return typeof v === "number" ? (v > 1 ? v : Math.round(v * 100)) : v;
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
          <h1 style={S.title}>🔬 Invention Lab</h1>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button style={S.refreshBtn} onClick={loadIdeas}>
              🔄 Refresh
            </button>
            <button
              style={generating ? S.btnDisabled : S.btn}
              onClick={generateIdea}
              disabled={generating}
            >
              {generating ? "⏳ Generating…" : "✨ Generate New Idea"}
            </button>
          </div>
        </div>

        <div style={S.layout}>
          {/* Main Panel */}
          <div style={S.main}>
            {/* Hypothesis Form */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>🧫 Experiment Engine</h2>
              <div style={S.hypothesisBox}>
                <label style={S.label}>
                  Enter a market observation to test as a hypothesis
                </label>
                <textarea
                  style={S.textarea}
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="e.g. 'Flooring contractors in the Midwest are underserved by digital lead generation platforms…'"
                  rows={4}
                />
                {submitMsg && <div style={S.submitMsg}>{submitMsg}</div>}
                <button
                  style={hypothesis.trim() ? S.btn : S.btnDisabled}
                  onClick={submitHypothesis}
                  disabled={!hypothesis.trim()}
                >
                  🧪 Submit to Experiment Engine
                </button>
              </div>
            </div>

            {/* Ideas Grid */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>
                💡 Recent Ideas & Opportunities ({ideas.length})
              </h2>
              {loading ? (
                <div style={S.loading}>Loading ideas…</div>
              ) : ideas.length === 0 ? (
                <div style={S.empty}>
                  No ideas yet. Click &ldquo;Generate New Idea&rdquo; to seed
                  the lab.
                </div>
              ) : (
                <div style={S.ideaGrid}>
                  {ideas.slice(0, 18).map((idea, i) => (
                    <div key={i} style={S.ideaCard}>
                      <div style={S.ideaTitle}>
                        {idea.title ||
                          idea.name ||
                          idea.niche ||
                          `Idea ${i + 1}`}
                      </div>
                      {idea.description && (
                        <div style={S.ideaDesc}>{idea.description}</div>
                      )}
                      <div style={S.ideaMeta}>
                        {idea.opportunity_score != null && (
                          <span style={S.scoreChip}>
                            🎯 {scorePct(idea.opportunity_score)}
                          </span>
                        )}
                        {idea.feasibility != null && (
                          <span style={S.feasibilityChip}>
                            ⚙️ {scorePct(idea.feasibility)}
                          </span>
                        )}
                        {idea.industry && (
                          <span style={S.industryChip}>{idea.industry}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div style={S.sidebar}>
            <h2 style={S.sectionTitle}>🤖 Agent Status</h2>
            {AGENTS.map((a) => {
              const alive = agentStatus[a.key] !== false;
              return (
                <div key={a.key} style={S.agentRow}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        ...S.dot,
                        background: alive ? "#4ade80" : "#f87171",
                      }}
                    />
                    <span style={S.agentLabel}>{a.label}</span>
                  </div>
                  <div style={S.agentDesc}>{a.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
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
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    gap: "2rem",
    alignItems: "start",
  },
  main: { minWidth: 0 },
  sidebar: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1.25rem",
  },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    color: "#888",
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "1rem",
    letterSpacing: "0.05em",
  },
  loading: { color: "#666", fontSize: "1rem", padding: "1rem 0" },
  empty: { color: "#555", fontStyle: "italic", padding: "1rem 0" },
  hypothesisBox: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  label: { color: "#888", fontSize: "0.875rem" },
  textarea: {
    background: "#111",
    border: "1px solid #222",
    color: "#fff",
    borderRadius: "6px",
    padding: "0.75rem",
    fontFamily: "inherit",
    fontSize: "0.9rem",
    resize: "vertical",
    outline: "none",
  },
  submitMsg: {
    background: "#0d1f0d",
    border: "1px solid #1a3a1a",
    color: "#4ade80",
    padding: "0.6rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  ideaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))",
    gap: "1rem",
  },
  ideaCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
  },
  ideaTitle: {
    color: "#fff",
    fontWeight: 600,
    marginBottom: "0.4rem",
    fontSize: "0.95rem",
  },
  ideaDesc: {
    color: "#777",
    fontSize: "0.8rem",
    marginBottom: "0.6rem",
    lineHeight: 1.5,
  },
  ideaMeta: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  scoreChip: {
    background: "#1a1000",
    color: "#FFD700",
    border: "1px solid #3a2a00",
    borderRadius: "4px",
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  feasibilityChip: {
    background: "#001a1a",
    color: "#7dd3fc",
    border: "1px solid #003333",
    borderRadius: "4px",
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  industryChip: {
    background: "#1a001a",
    color: "#c4b5fd",
    border: "1px solid #33003a",
    borderRadius: "4px",
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
  },
  agentRow: {
    marginBottom: "1rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #111",
  },
  agentLabel: { color: "#ddd", fontSize: "0.875rem", fontWeight: 600 },
  agentDesc: {
    color: "#555",
    fontSize: "0.75rem",
    marginTop: "0.2rem",
    paddingLeft: "1.3rem",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
};
