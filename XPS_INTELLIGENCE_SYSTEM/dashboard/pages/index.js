// dashboard/pages/index.js
import React from "react";
import Link from "next/link";

const LINKS = [
  {
    href: "/chat",
    label: "💬 Chat Agent",
    desc: "Autonomous LLM — coding, scraping, orchestration, all accounts",
  },
  {
    href: "/leads",
    label: "📋 Leads",
    desc: "View and manage all scraped leads",
  },
  {
    href: "/crm",
    label: "🗂️ CRM",
    desc: "Enterprise CRM — pipeline, outreach, follow-up, contacts",
  },
  {
    href: "/analytics",
    label: "📊 Analytics",
    desc: "Lead analytics, pipeline charts, system health",
  },
  {
    href: "/intelligence",
    label: "🧠 Vision Cortex",
    desc: "AI intelligence scraper, daily briefings, market opportunities",
  },
  {
    href: "/invention-lab",
    label: "🔬 Invention Lab",
    desc: "Idea generation, hypothesis testing, experiment engine",
  },
  {
    href: "/trends",
    label: "📈 Market Trends",
    desc: "Live trend discovery, niche scanner, competitive intelligence",
  },
  {
    href: "/guardian",
    label: "🛡️ System Guardian",
    desc: "Real-time health monitor, anomaly detection, auto-repair log",
  },
  {
    href: "/workspace",
    label: "🖊️ Workspace",
    desc: "Browser, live editor, UI generation, parallel & autonomous",
  },
  {
    href: "/studio",
    label: "🎨 Creative Studio",
    desc: "AI image creator, video creator, business templates, UI library",
  },
  {
    href: "/connectors",
    label: "🔌 Connectors",
    desc: "GitHub, Google Workspace, Vercel, Docker MCP, local machine",
  },
  {
    href: "/settings",
    label: "⚙️ Settings",
    desc: "LLM, APIs, scraping, outreach, CRM, all integrations",
  },
];

export default function Home() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>⚡ XPS Intelligence Platform</h1>
      <p style={styles.subtitle}>
        Autonomous Lead Generation &amp; AI Control System
      </p>

      <div style={styles.grid}>
        {LINKS.map(({ href, label, desc }) => (
          <Link key={href} href={href} style={styles.card}>
            <div style={styles.cardLabel}>{label}</div>
            <div style={styles.cardDesc}>{desc}</div>
          </Link>
        ))}
      </div>

      <div style={styles.footer}>
        <a
          href="https://github.com/InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.ghLink}
        >
          GitHub Repository
        </a>
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
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "3rem 1rem",
  },
  title: {
    color: "#FFD700",
    fontSize: "2.5rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    marginBottom: "0.5rem",
    textAlign: "center",
  },
  subtitle: {
    color: "#888",
    fontSize: "1.1rem",
    marginBottom: "3rem",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "1.25rem",
    width: "100%",
    maxWidth: "900px",
  },
  card: {
    display: "block",
    background: "#0d0d0d",
    border: "1px solid #FFD700",
    borderRadius: "12px",
    padding: "1.5rem",
    textDecoration: "none",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    cursor: "pointer",
  },
  cardLabel: {
    color: "#FFD700",
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: "0.4rem",
  },
  cardDesc: {
    color: "#aaa",
    fontSize: "0.875rem",
  },
  footer: {
    marginTop: "4rem",
  },
  ghLink: {
    color: "#555",
    textDecoration: "none",
    fontSize: "0.85rem",
  },
};
