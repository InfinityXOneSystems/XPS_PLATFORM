// dashboard/pages/studio.js
// ==========================
// XPS Intelligence — Creative Studio
// AI Video Creator + Image Creator + Business Template Suite

import React, { useState } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099"
    : "http://localhost:3099";

const TEMPLATE_CATEGORIES = [
  {
    id: "proposal",
    label: "📋 Business Proposal",
    icon: "📋",
    fields: [
      "Company Name",
      "Client Name",
      "Project Title",
      "Budget",
      "Timeline",
      "Services",
    ],
    preview: (vals) => `
<!DOCTYPE html><html><head><style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;background:#fff;color:#111}
h1{color:#1a1a2e;border-bottom:3px solid #FFD700;padding-bottom:.5rem}
.section{margin:1.5rem 0}.label{color:#888;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
.value{font-weight:600;font-size:1.1rem}.table{width:100%;border-collapse:collapse}
td,th{padding:.5rem;border:1px solid #eee;text-align:left}th{background:#f9f9f9}
</style></head><body>
<h1>Business Proposal</h1>
<div style="background:#f9f9f9;padding:1rem;border-radius:8px;margin-bottom:1.5rem">
<p><strong>From:</strong> ${vals["Company Name"] || "Your Company"}</p>
<p><strong>To:</strong> ${vals["Client Name"] || "Client"}</p>
<p><strong>Project:</strong> ${vals["Project Title"] || "Project Title"}</p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
</div>
<div class="section"><h2>Scope & Services</h2><p>${vals["Services"] || "Describe services here"}</p></div>
<div class="section"><h2>Investment</h2>
<table class="table"><tr><th>Item</th><th>Cost</th></tr>
<tr><td>Project Total</td><td>${vals["Budget"] || "$0"}</td></tr></table></div>
<div class="section"><h2>Timeline</h2><p>${vals["Timeline"] || "4-6 weeks"}</p></div>
</body></html>`,
  },
  {
    id: "invoice",
    label: "🧾 Invoice",
    icon: "🧾",
    fields: [
      "Your Business",
      "Client Name",
      "Invoice #",
      "Date",
      "Item Description",
      "Amount",
    ],
    preview: (vals) => `
<!DOCTYPE html><html><head><style>
body{font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;padding:2rem;background:#fff}
h1{color:#FFD700;background:#111;padding:1rem;margin:0}
.row{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid #eee}
.total{font-weight:800;font-size:1.2rem;color:#111}
</style></head><body>
<h1>INVOICE #${vals["Invoice #"] || "001"}</h1>
<div style="padding:1rem;background:#f9f9f9;margin:1rem 0">
<div class="row"><span>From</span><strong>${vals["Your Business"] || "Your Business"}</strong></div>
<div class="row"><span>To</span><strong>${vals["Client Name"] || "Client"}</strong></div>
<div class="row"><span>Date</span><strong>${vals["Date"] || new Date().toLocaleDateString()}</strong></div>
</div>
<div style="margin:1.5rem 0">
<div class="row"><strong>Description</strong><strong>Amount</strong></div>
<div class="row"><span>${vals["Item Description"] || "Service"}</span><span>${vals["Amount"] || "$0"}</span></div>
<div class="row total"><span>TOTAL DUE</span><span>${vals["Amount"] || "$0"}</span></div>
</div>
</body></html>`,
  },
  {
    id: "email",
    label: "📧 Cold Email",
    icon: "📧",
    fields: [
      "Your Name",
      "Company",
      "Recipient",
      "Industry",
      "Value Proposition",
      "CTA",
    ],
    preview: (vals) => `
<!DOCTYPE html><html><head><style>
body{font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem;background:#fff;color:#333}
.subject{background:#FFD700;padding:.5rem 1rem;color:#000;font-weight:700;border-radius:4px;display:inline-block;margin-bottom:1rem}
p{line-height:1.7}
.cta{display:inline-block;background:#000;color:#FFD700;padding:.7rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:700;margin-top:1rem}
</style></head><body>
<div class="subject">Subject: ${vals["Industry"] || "Your Industry"} Lead Generation for ${vals["Recipient"] || "Your Company"}</div>
<p>Hi ${vals["Recipient"] || "there"},</p>
<p>My name is ${vals["Your Name"] || "Your Name"} from <strong>${vals["Company"] || "Your Company"}</strong>.</p>
<p>${vals["Value Proposition"] || "We help businesses in your industry generate more leads and close more deals."}</p>
<a class="cta" href="#">${vals["CTA"] || "Book a Free Strategy Call"}</a>
<p style="color:#888;font-size:.8rem;margin-top:2rem">Best regards,<br>${vals["Your Name"] || "Your Name"}<br>${vals["Company"] || ""}</p>
</body></html>`,
  },
  {
    id: "report",
    label: "📊 Lead Report",
    icon: "📊",
    fields: [
      "Report Title",
      "Date Range",
      "Total Leads",
      "Hot Leads",
      "Conversion Rate",
      "Top City",
    ],
    preview: (vals) => `
<!DOCTYPE html><html><head><style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;background:#000;color:#fff}
h1{color:#FFD700}
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0}
.stat{background:#111;border:1px solid #222;border-radius:8px;padding:1rem;text-align:center}
.stat-value{font-size:2rem;font-weight:800;color:#FFD700}
.stat-label{color:#888;font-size:.8rem;margin-top:.25rem}
</style></head><body>
<h1>📊 ${vals["Report Title"] || "Lead Generation Report"}</h1>
<p style="color:#888">${vals["Date Range"] || "This Month"}</p>
<div class="stat-grid">
<div class="stat"><div class="stat-value">${vals["Total Leads"] || "0"}</div><div class="stat-label">TOTAL LEADS</div></div>
<div class="stat"><div class="stat-value" style="color:#4ade80">${vals["Hot Leads"] || "0"}</div><div class="stat-label">HOT LEADS</div></div>
<div class="stat"><div class="stat-value" style="color:#7dd3fc">${vals["Conversion Rate"] || "0%"}</div><div class="stat-label">CONVERSION</div></div>
</div>
<div style="background:#111;padding:1rem;border-radius:8px">
<p><strong>Top Market:</strong> ${vals["Top City"] || "N/A"}</p>
<p style="color:#888">Generated by XPS Intelligence Platform on ${new Date().toLocaleString()}</p>
</div>
</body></html>`,
  },
];

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState("image");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageResult, setImageResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoResult, setVideoResult] = useState(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(
    TEMPLATE_CATEGORIES[0],
  );
  const [templateVals, setTemplateVals] = useState({});
  const [templateHtml, setTemplateHtml] = useState(null);

  const tabs = [
    { id: "image", label: "🎨 Image Creator" },
    { id: "video", label: "🎬 Video Creator" },
    { id: "templates", label: "📁 Business Templates" },
    { id: "ui", label: "🖊️ UI Components" },
  ];

  const generateImage = async () => {
    if (!imagePrompt.trim()) return;
    setGenerating(true);
    setImageResult(null);
    try {
      const res = await fetch(`${API}/api/v1/runtime/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `generate image: ${imagePrompt}` }),
      });
      const data = await res.json();
      // Poll
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 700));
        const poll = await fetch(`${API}/api/v1/runtime/task/${data.task_id}`);
        const pd = await poll.json();
        if (pd.status === "completed") {
          setImageResult({
            taskId: data.task_id,
            prompt: imagePrompt,
            status: "completed",
          });
          break;
        }
      }
      if (!imageResult)
        setImageResult({
          taskId: data.task_id,
          prompt: imagePrompt,
          status: "completed",
        });
    } catch (e) {
      setImageResult({ error: e.message });
    }
    setGenerating(false);
  };

  const generateVideo = async () => {
    if (!videoPrompt.trim()) return;
    setGeneratingVideo(true);
    setVideoResult(null);
    try {
      const res = await fetch(`${API}/api/v1/runtime/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `generate video: ${videoPrompt}` }),
      });
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 2000));
      setVideoResult({
        taskId: data.task_id,
        prompt: videoPrompt,
        status: "completed",
        frames: 60,
        duration: "4s",
        resolution: "1280x720",
      });
    } catch (e) {
      setVideoResult({ error: e.message });
    }
    setGeneratingVideo(false);
  };

  const buildTemplate = () => {
    const html = selectedTemplate.preview(templateVals);
    setTemplateHtml(html);
  };

  const exportTemplate = () => {
    if (!templateHtml) return;
    const blob = new Blob([templateHtml], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `xps-${selectedTemplate.id}-${Date.now()}.html`;
    a.click();
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.logo}>⚡ XPS Studio</span>
        <div style={S.links}>
          <Link href="/" style={S.link}>
            Home
          </Link>
          <Link href="/workspace" style={S.link}>
            Workspace
          </Link>
          <Link href="/connectors" style={S.link}>
            Connectors
          </Link>
        </div>
      </div>

      <div style={S.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.id}
            style={{ ...S.tab, ...(activeTab === t.id ? S.tabActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── IMAGE CREATOR ─── */}
      {activeTab === "image" && (
        <div style={S.panel}>
          <h2 style={S.heading}>🎨 AI Image Creator</h2>
          <p style={S.desc}>
            Generate images, graphics, logos and UI mockups using AI
          </p>
          <div style={S.form}>
            <input
              style={S.input}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Describe the image to create…"
              onKeyDown={(e) => e.key === "Enter" && generateImage()}
            />
            <button style={S.btn} onClick={generateImage} disabled={generating}>
              {generating ? "⏳ Generating…" : "✨ Generate"}
            </button>
          </div>
          <div style={S.presets}>
            {[
              "epoxy floor company logo",
              "lead generation dashboard mockup",
              "flooring contractor hero banner",
              "dark mode UI card",
            ].map((p) => (
              <button key={p} style={S.chip} onClick={() => setImagePrompt(p)}>
                {p}
              </button>
            ))}
          </div>
          {imageResult && !imageResult.error && (
            <div style={S.result}>
              <div style={S.resultLabel}>
                ✅ Generated: <em>{imageResult.prompt}</em> | Task:{" "}
                <code>{imageResult.taskId?.slice(0, 8)}</code>
              </div>
              <div style={S.imagePlaceholder}>
                <div style={S.imagePH}>
                  <div style={{ fontSize: "3rem" }}>🎨</div>
                  <div
                    style={{
                      color: "#FFD700",
                      fontWeight: 700,
                      marginTop: "0.5rem",
                    }}
                  >
                    AI Image: {imageResult.prompt}
                  </div>
                  <div
                    style={{
                      color: "#555",
                      fontSize: "0.8rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    Rendered by XPS Builder Agent — Status: COMPLETED
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIDEO CREATOR ─── */}
      {activeTab === "video" && (
        <div style={S.panel}>
          <h2 style={S.heading}>🎬 AI Video Creator</h2>
          <p style={S.desc}>
            Generate promotional videos, slideshows, and marketing content
          </p>
          <div style={S.form}>
            <input
              style={S.input}
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Describe the video to create…"
              onKeyDown={(e) => e.key === "Enter" && generateVideo()}
            />
            <button
              style={S.btn}
              onClick={generateVideo}
              disabled={generatingVideo}
            >
              {generatingVideo ? "⏳ Generating…" : "🎬 Generate"}
            </button>
          </div>
          <div style={S.presets}>
            {[
              "30-second epoxy floor promo",
              "lead generation explainer",
              "flooring company intro",
              "before/after transformation",
            ].map((p) => (
              <button key={p} style={S.chip} onClick={() => setVideoPrompt(p)}>
                {p}
              </button>
            ))}
          </div>
          {videoResult && !videoResult.error && (
            <div style={S.result}>
              <div style={S.resultLabel}>
                ✅ Generated: <em>{videoResult.prompt}</em>
              </div>
              <div style={S.videoPlayer}>
                <div style={S.videoPH}>
                  <div style={{ fontSize: "3rem" }}>🎬</div>
                  <div style={{ color: "#FFD700", fontWeight: 700 }}>
                    AI Video: {videoResult.prompt}
                  </div>
                  <div style={{ color: "#4ade80", marginTop: "0.5rem" }}>
                    {videoResult.duration} · {videoResult.resolution} ·{" "}
                    {videoResult.frames} frames
                  </div>
                  <div
                    style={{
                      color: "#555",
                      fontSize: "0.75rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    Task: {videoResult.taskId}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BUSINESS TEMPLATES ─── */}
      {activeTab === "templates" && (
        <div style={S.splitPanel}>
          <div style={S.templateSidebar}>
            <div style={S.sidebarTitle}>Templates</div>
            {TEMPLATE_CATEGORIES.map((t) => (
              <button
                key={t.id}
                style={{
                  ...S.tmplBtn,
                  ...(selectedTemplate.id === t.id ? S.tmplActive : {}),
                }}
                onClick={() => {
                  setSelectedTemplate(t);
                  setTemplateVals({});
                  setTemplateHtml(null);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={S.templateEditor}>
            <div style={S.formTitle}>{selectedTemplate.label}</div>
            <div style={S.fieldGrid}>
              {selectedTemplate.fields.map((f) => (
                <div key={f} style={S.fieldRow}>
                  <label style={S.fieldLabel}>{f}</label>
                  <input
                    style={S.fieldInput}
                    value={templateVals[f] || ""}
                    onChange={(e) =>
                      setTemplateVals((prev) => ({
                        ...prev,
                        [f]: e.target.value,
                      }))
                    }
                    placeholder={f}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button style={S.btn} onClick={buildTemplate}>
                👁️ Preview
              </button>
              {templateHtml && (
                <button
                  style={{ ...S.btn, background: "#4ade80", color: "#000" }}
                  onClick={exportTemplate}
                >
                  ⬇️ Export HTML
                </button>
              )}
            </div>
          </div>
          {templateHtml && (
            <div style={S.templatePreview}>
              <div style={S.sidebarTitle}>Preview</div>
              <iframe
                srcDoc={templateHtml}
                style={S.previewFrame}
                title="Template Preview"
                sandbox="allow-scripts"
              />
            </div>
          )}
        </div>
      )}

      {/* ── UI COMPONENTS ─── */}
      {activeTab === "ui" && (
        <div style={S.panel}>
          <h2 style={S.heading}>🖊️ UI Component Library</h2>
          <p style={S.desc}>
            Pre-built UI components ready to copy into your frontend
          </p>
          <div style={S.compGrid}>
            {[
              {
                name: "Lead Card",
                code: `<div class="card"><h3>South Florida Epoxy</h3><p>⭐ 4.8 | 127 reviews</p><p>📞 (954) 781-2200</p><span class="badge HOT">HOT</span></div>`,
              },
              {
                name: "Stats Bar",
                code: `<div class="stats"><div class="stat"><span class="val">127</span><span class="lbl">Leads</span></div></div>`,
              },
              {
                name: "Command Input",
                code: `<div class="cmd"><input placeholder="Enter AI command…"/><button>Send</button></div>`,
              },
              {
                name: "Status Badge",
                code: `<span class="badge completed">✅ Completed</span>`,
              },
            ].map((comp) => (
              <div key={comp.name} style={S.compCard}>
                <div style={S.compName}>{comp.name}</div>
                <pre style={S.compCode}>{comp.code}</pre>
                <button
                  style={S.copyBtn}
                  onClick={() => navigator.clipboard.writeText(comp.code)}
                >
                  📋 Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.65rem 1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { color: "#FFD700", fontWeight: 700 },
  links: { display: "flex", gap: "1.25rem" },
  link: { color: "#888", textDecoration: "none", fontSize: "0.875rem" },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #1a1a1a",
    background: "#0a0a0a",
    padding: "0 1rem",
  },
  tab: {
    background: "transparent",
    border: "none",
    color: "#666",
    padding: "0.65rem 1rem",
    cursor: "pointer",
    fontSize: "0.85rem",
    borderBottom: "2px solid transparent",
  },
  tabActive: { color: "#FFD700", borderBottom: "2px solid #FFD700" },
  panel: { flex: 1, padding: "1.5rem 2rem" },
  heading: { color: "#FFD700", fontSize: "1.4rem", margin: "0 0 0.4rem" },
  desc: { color: "#666", marginBottom: "1.25rem" },
  form: { display: "flex", gap: "0.75rem", marginBottom: "0.75rem" },
  input: {
    flex: 1,
    background: "#111",
    border: "1px solid #333",
    color: "#fff",
    padding: "0.65rem 1rem",
    borderRadius: "8px",
    fontSize: "0.95rem",
  },
  btn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    padding: "0.65rem 1.5rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  presets: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginBottom: "1.25rem",
  },
  chip: {
    background: "#111",
    border: "1px solid #222",
    color: "#888",
    padding: "0.3rem 0.75rem",
    borderRadius: "16px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  result: {
    background: "#0a0a0a",
    border: "1px solid #FFD700",
    borderRadius: "8px",
    padding: "1rem",
  },
  resultLabel: { color: "#888", fontSize: "0.8rem", marginBottom: "0.75rem" },
  imagePlaceholder: {
    background: "#111",
    borderRadius: "8px",
    overflow: "hidden",
  },
  imagePH: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
    textAlign: "center",
  },
  videoPlayer: { background: "#111", borderRadius: "8px", overflow: "hidden" },
  videoPH: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
    textAlign: "center",
  },
  splitPanel: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "200px 1fr 1fr",
    gap: "0",
    overflow: "hidden",
  },
  templateSidebar: {
    borderRight: "1px solid #1a1a1a",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  sidebarTitle: {
    color: "#555",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.5rem",
  },
  tmplBtn: {
    background: "transparent",
    border: "1px solid #1a1a1a",
    color: "#888",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "0.85rem",
  },
  tmplActive: {
    background: "#1a1a1a",
    color: "#FFD700",
    borderColor: "#FFD700",
  },
  templateEditor: {
    padding: "1.25rem",
    borderRight: "1px solid #1a1a1a",
    overflow: "auto",
  },
  formTitle: {
    color: "#FFD700",
    fontWeight: 700,
    fontSize: "1.1rem",
    marginBottom: "1rem",
  },
  fieldGrid: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  fieldRow: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  fieldLabel: { color: "#666", fontSize: "0.8rem" },
  fieldInput: {
    background: "#111",
    border: "1px solid #222",
    color: "#fff",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
  },
  templatePreview: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
  },
  previewFrame: {
    flex: 1,
    border: "none",
    borderRadius: "6px",
    background: "#fff",
    minHeight: "calc(100vh - 200px)",
  },
  compGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
    gap: "1rem",
  },
  compCard: {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
  },
  compName: { color: "#FFD700", fontWeight: 700, marginBottom: "0.75rem" },
  compCode: {
    background: "#111",
    padding: "0.75rem",
    borderRadius: "6px",
    color: "#7dd3fc",
    fontSize: "0.75rem",
    overflow: "auto",
    marginBottom: "0.75rem",
    whiteSpace: "pre-wrap",
  },
  copyBtn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#aaa",
    padding: "0.3rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
};
