// dashboard/pages/settings.js
// ============================
// XPS Intelligence – Settings Control Panel
// Full integration config: LLM, API keys, scraping, outreach, CRM, Vercel, GitHub, Google Workspace, Docker MCP

import React, { useState, useEffect } from "react";
import Link from "next/link";

const API_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099"
    : "http://localhost:3099";

const SETTING_SECTIONS = [
  {
    title: "🤖 LLM Configuration",
    fields: [
      {
        key: "llm_provider",
        label: "LLM Provider",
        type: "select",
        options: ["auto", "groq", "ollama", "openai"],
      },
      {
        key: "groq_model",
        label: "Groq Model",
        type: "text",
        placeholder: "llama3-8b-8192",
      },
      {
        key: "openai_model",
        label: "OpenAI Model",
        type: "text",
        placeholder: "gpt-4o-mini",
      },
      {
        key: "ollama_base_url",
        label: "Ollama Base URL",
        type: "text",
        placeholder: "http://localhost:11434",
      },
      {
        key: "ollama_model",
        label: "Ollama Default Model",
        type: "text",
        placeholder: "llama3.2",
      },
      {
        key: "ollama_code_model",
        label: "Ollama Code Model",
        type: "text",
        placeholder: "codellama",
      },
    ],
  },
  {
    title: "🔑 API Keys",
    fields: [
      {
        key: "groq_api_key",
        label: "Groq API Key",
        type: "password",
        placeholder: "gsk_…",
      },
      {
        key: "openai_api_key",
        label: "OpenAI API Key",
        type: "password",
        placeholder: "sk-…",
      },
      {
        key: "google_api_key",
        label: "Google API Key",
        type: "password",
        placeholder: "AIza…",
      },
      {
        key: "anthropic_api_key",
        label: "Anthropic API Key",
        type: "password",
        placeholder: "sk-ant-…",
      },
    ],
  },
  {
    title: "🐙 GitHub Integration",
    fields: [
      {
        key: "github_token",
        label: "GitHub Personal Access Token",
        type: "password",
        placeholder: "ghp_…",
      },
      {
        key: "github_leads_repo",
        label: "Leads Repo",
        type: "text",
        placeholder: "InfinityXOneSystems/LEADS",
      },
      {
        key: "github_system_repo",
        label: "System Repo",
        type: "text",
        placeholder: "InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM",
      },
      {
        key: "github_sandbox_branch",
        label: "Sandbox Branch",
        type: "text",
        placeholder: "copilot/sandbox",
      },
    ],
  },
  {
    title: "▲ Vercel Deployment",
    fields: [
      {
        key: "vercel_token",
        label: "Vercel Token",
        type: "password",
        placeholder: "vt_…",
      },
      {
        key: "vercel_project_id",
        label: "Project ID",
        type: "text",
        placeholder: "prj_eNK90PC48eWsMW3O6aHHRWsM4wwI",
      },
      {
        key: "vercel_webhook_url",
        label: "Deploy Webhook URL",
        type: "text",
        placeholder: "https://api.vercel.com/v1/integrations/deploy/…",
      },
      {
        key: "vercel_frontend_url",
        label: "Frontend URL",
        type: "text",
        placeholder: "https://xps-intelligence.vercel.app",
      },
    ],
  },
  {
    title: "🔵 Google Workspace",
    fields: [
      {
        key: "google_service_account_json",
        label: "Service Account JSON",
        type: "password",
        placeholder: '{"type":"service_account","project_id":"…"}',
      },
      {
        key: "google_workspace_domain",
        label: "Workspace Domain",
        type: "text",
        placeholder: "infinityxonesystems.com",
      },
      {
        key: "gmail_address",
        label: "Gmail Address",
        type: "text",
        placeholder: "info@infinityxonesystems.com",
      },
      {
        key: "gmail_app_password",
        label: "Gmail App Password",
        type: "password",
        placeholder: "xxxx xxxx xxxx xxxx",
      },
      {
        key: "google_drive_folder_id",
        label: "Drive Leads Folder ID",
        type: "text",
        placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      },
      {
        key: "google_sheet_id",
        label: "Leads Sheet ID",
        type: "text",
        placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgm…",
      },
    ],
  },
  {
    title: "📧 Email & Outreach",
    fields: [
      {
        key: "leads_email_to",
        label: "Lead Report Email",
        type: "text",
        placeholder: "info@infinityxonesystems.com",
      },
      {
        key: "smtp_host",
        label: "SMTP Host",
        type: "text",
        placeholder: "smtp.gmail.com",
      },
      {
        key: "smtp_port",
        label: "SMTP Port",
        type: "number",
        placeholder: "465",
      },
      {
        key: "sendgrid_api_key",
        label: "SendGrid API Key",
        type: "password",
        placeholder: "SG.…",
      },
      {
        key: "mailgun_api_key",
        label: "Mailgun API Key",
        type: "password",
        placeholder: "key-…",
      },
    ],
  },
  {
    title: "💬 SMS Configuration",
    fields: [
      {
        key: "twilio_account_sid",
        label: "Twilio Account SID",
        type: "password",
        placeholder: "AC…",
      },
      {
        key: "twilio_auth_token",
        label: "Twilio Auth Token",
        type: "password",
        placeholder: "…",
      },
      {
        key: "twilio_from_number",
        label: "Twilio From Number",
        type: "text",
        placeholder: "+19545551234",
      },
    ],
  },
  {
    title: "📞 AI Voice (Outbound Calls)",
    fields: [
      {
        key: "retell_api_key",
        label: "Retell AI API Key",
        type: "password",
        placeholder: "key_…",
      },
      {
        key: "bland_api_key",
        label: "Bland.ai API Key",
        type: "password",
        placeholder: "…",
      },
      {
        key: "elevenlabs_api_key",
        label: "ElevenLabs API Key",
        type: "password",
        placeholder: "sk_…",
      },
      {
        key: "voice_agent_phone",
        label: "AI Agent Phone Number",
        type: "text",
        placeholder: "+19545551234",
      },
    ],
  },
  {
    title: "🐋 Docker MCP",
    fields: [
      {
        key: "docker_host",
        label: "Docker Host",
        type: "text",
        placeholder: "unix:///var/run/docker.sock",
      },
      {
        key: "docker_registry",
        label: "Container Registry",
        type: "text",
        placeholder: "ghcr.io/infinityxonesystems",
      },
    ],
  },
  {
    title: "💻 Local Machine MCP",
    fields: [
      {
        key: "local_mcp_secret",
        label: "Local MCP Secret",
        type: "password",
        placeholder: "…",
      },
      {
        key: "local_mcp_url",
        label: "Local Bridge URL",
        type: "text",
        placeholder: "ws://localhost:9000/mcp",
      },
    ],
  },
  {
    title: "🕷️ Scraping & Pipeline",
    fields: [
      {
        key: "scraping_rate_limit",
        label: "Rate Limit (req/min)",
        type: "number",
        placeholder: "10",
      },
      {
        key: "pipeline_cron",
        label: "Pipeline Cron (2hr default)",
        type: "text",
        placeholder: "0 */2 * * *",
      },
      {
        key: "scraper_targets",
        label: "Custom Targets (JSON)",
        type: "text",
        placeholder: '[{"city":"Miami","state":"FL","keyword":"epoxy"}]',
      },
      { key: "proxy_enabled", label: "Proxy Enabled", type: "checkbox" },
      {
        key: "proxy_url",
        label: "Proxy URL",
        type: "text",
        placeholder: "http://proxy:8080",
      },
    ],
  },
  {
    title: "🗄️ Infrastructure",
    fields: [
      {
        key: "redis_url",
        label: "Redis URL",
        type: "text",
        placeholder: "redis://localhost:6379/0",
      },
      {
        key: "database_url",
        label: "Database URL",
        type: "text",
        placeholder: "postgresql://localhost/xps",
      },
      {
        key: "qdrant_url",
        label: "Qdrant URL",
        type: "text",
        placeholder: "http://localhost:6333",
      },
      {
        key: "max_workers",
        label: "Max Workers",
        type: "number",
        placeholder: "5",
      },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    loadSettings();
    loadStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/agent/settings`);
      const data = await res.json();
      if (data.success) setSettings(data.settings || {});
    } catch {
      // backend might not be running
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/agent/status`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    }
  };

  const saveSettings = async () => {
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/agent/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.detail || "Failed to save settings");
      }
    } catch (err) {
      setError(`Connection error: ${err.message}`);
    }
  };

  const updateField = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ color: "#FFD700", fontSize: "1.5rem" }}>
          Loading settings…
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>⚡ XPS Intelligence</span>
        <div style={styles.headerLinks}>
          <Link href="/" style={styles.navLink}>
            Home
          </Link>
          <Link href="/chat" style={styles.navLink}>
            Chat
          </Link>
          <Link href="/leads" style={styles.navLink}>
            Leads
          </Link>
        </div>
      </div>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>⚙️ System Settings</h1>

        {/* System Status */}
        {status && (
          <div style={styles.statusBar}>
            {Object.entries(status).map(([k, v]) => (
              <span key={k} style={styles.statusChip}>
                {k === "system_ready"
                  ? "🟢 Online"
                  : v === true
                    ? `✅ ${k}`
                    : v === false
                      ? `❌ ${k}`
                      : `${k}: ${v}`}
              </span>
            ))}
          </div>
        )}

        {/* Setting sections */}
        {SETTING_SECTIONS.map((section) => (
          <div key={section.title} style={styles.section}>
            <h2 style={styles.sectionTitle}>{section.title}</h2>
            <div style={styles.fieldGrid}>
              {section.fields.map(
                ({ key, label, type, placeholder, options }) => (
                  <div key={key} style={styles.fieldRow}>
                    <label style={styles.label}>{label}</label>
                    {type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(settings[key])}
                        onChange={(e) => updateField(key, e.target.checked)}
                        style={styles.checkbox}
                      />
                    ) : type === "select" ? (
                      <select
                        value={settings[key] ?? (options && options[0]) ?? ""}
                        onChange={(e) => updateField(key, e.target.value)}
                        style={{ ...styles.input, cursor: "pointer" }}
                      >
                        {(options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={settings[key] ?? ""}
                        onChange={(e) => updateField(key, e.target.value)}
                        placeholder={placeholder}
                        style={styles.input}
                        autoComplete="off"
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        ))}

        {/* Save button */}
        <div style={styles.actions}>
          {error && <div style={styles.errorMsg}>{error}</div>}
          {saved && (
            <div style={styles.successMsg}>✅ Settings saved successfully</div>
          )}
          <button style={styles.saveBtn} onClick={saveSettings}>
            💾 Save Settings
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
  content: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "2rem 1rem",
  },
  pageTitle: {
    color: "#FFD700",
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "1.5rem",
  },
  statusBar: {
    background: "#0d0d0d",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1.5rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  statusChip: {
    fontSize: "0.8rem",
    color: "#aaa",
  },
  section: {
    background: "#0d0d0d",
    border: "1px solid #1a1a1a",
    borderRadius: "10px",
    padding: "1.25rem",
    marginBottom: "1rem",
  },
  sectionTitle: {
    color: "#FFD700",
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "1rem",
    marginTop: 0,
  },
  fieldGrid: {
    display: "grid",
    gap: "0.75rem",
  },
  fieldRow: {
    display: "grid",
    gridTemplateColumns: "200px 1fr",
    alignItems: "center",
    gap: "0.75rem",
  },
  label: {
    color: "#ccc",
    fontSize: "0.875rem",
  },
  input: {
    background: "#111",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    fontFamily: "monospace",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    accentColor: "#FFD700",
  },
  actions: {
    marginTop: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    alignItems: "flex-start",
  },
  saveBtn: {
    background: "#FFD700",
    border: "none",
    borderRadius: "8px",
    color: "#000",
    fontWeight: 600,
    fontSize: "0.95rem",
    padding: "0.7rem 1.5rem",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  errorMsg: {
    background: "#1a0000",
    border: "1px solid #f00",
    borderRadius: "6px",
    color: "#f88",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    width: "100%",
  },
  successMsg: {
    background: "#001a00",
    border: "1px solid #0f0",
    borderRadius: "6px",
    color: "#8f8",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    width: "100%",
  },
};
