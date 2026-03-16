// dashboard/pages/workspace.js
// ============================
// XPS Intelligence – Universal Center Editor
//
// Modes:
//   1. Browser Preview  – iframe preview of any URL
//   2. Live HTML Editor – write HTML/CSS/JS, see live preview
//   3. AI UI Generator  – prompt-to-UI via LLM runtime API
//   4. Parallel Workers – 4-instance worker console
//   5. Code Editor      – multi-language scratch editor
//   6. Autonomous Pipeline – run full lead pipeline, stream logs

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:3099";
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.__NEXT_PUBLIC_API_URL) ||
    "http://localhost:3099"
  );
}

const MODES = [
  { id: "browser", label: "🌐 Browser", desc: "Preview any URL" },
  { id: "html", label: "✏️ HTML Editor", desc: "Live HTML/CSS/JS" },
  { id: "ai-ui", label: "🤖 AI UI Gen", desc: "Prompt to UI" },
  { id: "workers", label: "⚙️ Workers", desc: "Parallel instances" },
  { id: "code", label: "💻 Code", desc: "Multi-language scratch" },
  { id: "pipeline", label: "🚀 Pipeline", desc: "Autonomous lead pipeline" },
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { background: #0a0a0a; color: #fff; font-family: system-ui; display: flex;
           align-items: center; justify-content: center; height: 100vh; margin: 0; }
    h1 { color: #FFD700; }
  </style>
</head>
<body>
  <div style="text-align:center">
    <h1>⚡ Live Editor</h1>
    <p>Edit this HTML on the left — preview updates instantly.</p>
  </div>
</body>
</html>`;

const DEFAULT_CODE = `# Python – lead scoring stub
def score_lead(lead):
    score = 0
    if lead.get("website"):   score += 10
    if lead.get("phone"):     score += 10
    if lead.get("email"):     score += 15
    if lead.get("address"):   score += 5
    rating = float(lead.get("rating", 0))
    if rating > 4.0:          score += 10
    reviews = int(lead.get("review_count", 0))
    if reviews > 10:          score += 5
    return score
`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BrowserMode() {
  const [url, setUrl] = useState("https://xps-intelligence.vercel.app");
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState(url);

  const navigate = () => {
    let target = input.trim();
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    setLoaded(false);
    setUrl(target);
  };

  return (
    <div style={S.pane}>
      <div style={S.toolbar}>
        <button
          style={S.tbBtn}
          onClick={() => {
            setInput("https://xps-intelligence.vercel.app");
            setLoaded(false);
            setUrl("https://xps-intelligence.vercel.app");
          }}
        >
          🏠
        </button>
        <button
          style={S.tbBtn}
          onClick={() => {
            setLoaded(false);
            setUrl(url);
          }}
        >
          🔄
        </button>
        <input
          style={S.urlBar}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate()}
          placeholder="Enter URL…"
        />
        <button style={S.goBtn} onClick={navigate}>
          Go
        </button>
      </div>
      {!loaded && <div style={S.iframeLoading}>Loading…</div>}
      <iframe
        key={url}
        src={url}
        style={{ ...S.iframe, display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
        title="Browser Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

function HtmlMode() {
  const [code, setCode] = useState(DEFAULT_HTML);
  const [preview, setPreview] = useState(DEFAULT_HTML);

  useEffect(() => {
    const t = setTimeout(() => setPreview(code), 400);
    return () => clearTimeout(t);
  }, [code]);

  return (
    <div style={{ ...S.pane, flexDirection: "row", gap: 0 }}>
      <div style={S.splitLeft}>
        <div style={S.paneLabel}>HTML / CSS / JS</div>
        <textarea
          style={S.codeArea}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div style={S.splitRight}>
        <div style={S.paneLabel}>Live Preview</div>
        <iframe
          srcDoc={preview}
          style={S.iframe}
          title="HTML Preview"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}

function AiUiMode() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const pollRef = useRef(null);

  const stop = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    stop();
    try {
      const res = await fetch(`${getApiBase()}/api/v1/runtime/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `generate React UI component: ${prompt}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const id = data.task_id || data.id;
      setTaskId(id);

      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`${getApiBase()}/api/v1/runtime/task/${id}`);
          const pd = await poll.json();
          if (pd.status === "completed") {
            stop();
            setResult(pd.result || pd.output || "Done — no output returned.");
            setLoading(false);
          } else if (pd.status === "failed") {
            stop();
            setError(pd.error || "Task failed.");
            setLoading(false);
          }
        } catch {
          stop();
          setError("Polling error.");
          setLoading(false);
        }
      }, 1500);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [prompt, stop]);

  useEffect(() => () => stop(), [stop]);

  const isHtml = result && (/<html/i.test(result) || /<div/i.test(result));

  return (
    <div style={S.pane}>
      <div style={S.paneLabel}>
        🤖 AI UI Generator — prompt to live component
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "0.75rem",
          background: "#111",
        }}
      >
        <input
          style={S.aiInput}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && generate()}
          placeholder="Describe the UI component you want… e.g. lead card with score badge"
        />
        <button
          style={loading ? S.btnDisabled : S.goBtn}
          onClick={generate}
          disabled={loading}
        >
          {loading ? "⏳ Generating…" : "✨ Generate"}
        </button>
      </div>

      <div style={S.quickPrompts}>
        {[
          "Lead card with tier badge",
          "CRM Kanban column",
          "Stats dashboard row",
          "Email outreach form",
        ].map((p) => (
          <button key={p} style={S.chip} onClick={() => setPrompt(p)}>
            {p}
          </button>
        ))}
      </div>

      {loading && (
        <div style={S.logBox}>
          <div style={S.logLine}>⏳ Task queued: {taskId || "pending…"}</div>
          <div style={S.logLine}>Waiting for LLM runtime…</div>
        </div>
      )}
      {error && <div style={S.errorBox}>❌ {error}</div>}
      {result && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={S.resultTabs}>
            <span style={{ color: "#aaa", fontSize: "0.75rem" }}>
              Generated Output
            </span>
          </div>
          {isHtml ? (
            <iframe
              srcDoc={result}
              style={{ flex: 1, border: "none", background: "#fff" }}
              title="Generated UI"
              sandbox="allow-scripts"
            />
          ) : (
            <pre style={S.resultPre}>{result}</pre>
          )}
        </div>
      )}
      {!loading && !result && !error && (
        <div style={S.placeholder}>
          Enter a prompt above and click Generate to create a UI component using
          the LLM runtime.
        </div>
      )}
    </div>
  );
}

function WorkersMode() {
  const WORKER_COUNT = 4;
  const [workers, setWorkers] = useState(() =>
    Array.from({ length: WORKER_COUNT }, (_, i) => ({
      id: i + 1,
      status: "idle",
      logs: [`[Worker ${i + 1}] Ready.`],
      taskId: null,
    })),
  );
  const [cmd, setCmd] = useState("scrape epoxy contractors in Miami FL");
  const pollRefs = useRef([]);

  const stopWorker = (idx) => {
    if (pollRefs.current[idx]) clearInterval(pollRefs.current[idx]);
    pollRefs.current[idx] = null;
  };

  const dispatchAll = useCallback(async () => {
    setWorkers((prev) =>
      prev.map((w) => ({
        ...w,
        status: "starting",
        logs: [`[Worker ${w.id}] Dispatching…`],
      })),
    );

    for (let i = 0; i < WORKER_COUNT; i++) {
      stopWorker(i);
      const idx = i;
      const workerCmd = `${cmd} — worker ${idx + 1}`;
      try {
        const res = await fetch(`${getApiBase()}/api/v1/runtime/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: workerCmd }),
        });
        const data = await res.json();
        const taskId = data.task_id || data.id || `local-${Date.now()}-${idx}`;

        setWorkers((prev) =>
          prev.map((w, wi) =>
            wi === idx
              ? {
                  ...w,
                  status: "running",
                  taskId,
                  logs: [...w.logs, `[Worker ${w.id}] Task ${taskId} queued.`],
                }
              : w,
          ),
        );

        pollRefs.current[idx] = setInterval(async () => {
          try {
            const poll = await fetch(
              `${getApiBase()}/api/v1/runtime/task/${taskId}`,
            );
            const pd = await poll.json();
            setWorkers((prev) =>
              prev.map((w, wi) => {
                if (wi !== idx) return w;
                const newLog = `[Worker ${w.id}] status: ${pd.status}`;
                if (pd.status === "completed" || pd.status === "failed") {
                  stopWorker(idx);
                  return {
                    ...w,
                    status: pd.status,
                    logs: [...w.logs, newLog, `[Worker ${w.id}] ✅ Done.`],
                  };
                }
                return { ...w, logs: [...w.logs, newLog] };
              }),
            );
          } catch {
            stopWorker(idx);
            setWorkers((prev) =>
              prev.map((w, wi) =>
                wi === idx
                  ? {
                      ...w,
                      status: "error",
                      logs: [...w.logs, `[Worker ${w.id}] ❌ Poll error.`],
                    }
                  : w,
              ),
            );
          }
        }, 2000);
      } catch (e) {
        setWorkers((prev) =>
          prev.map((w, wi) =>
            wi === idx
              ? {
                  ...w,
                  status: "error",
                  logs: [...w.logs, `[Worker ${w.id}] ❌ ${e.message}`],
                }
              : w,
          ),
        );
      }
    }
  }, [cmd]);

  useEffect(
    () => () => {
      for (let i = 0; i < WORKER_COUNT; i++) stopWorker(i);
    },
    [],
  );

  const statusColor = {
    idle: "#888",
    starting: "#f59e0b",
    running: "#60a5fa",
    completed: "#4ade80",
    failed: "#f87171",
    error: "#f87171",
  };

  return (
    <div style={S.pane}>
      <div style={S.paneLabel}>⚙️ Parallel Worker Instances</div>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "0.75rem",
          background: "#111",
        }}
      >
        <input
          style={S.aiInput}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="Command to dispatch to all 4 workers…"
        />
        <button style={S.goBtn} onClick={dispatchAll}>
          ▶ Dispatch All
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          padding: "0.5rem",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {workers.map((w, i) => (
          <div key={w.id} style={S.workerBox}>
            <div
              style={{
                ...S.workerHeader,
                borderColor: statusColor[w.status] || "#444",
              }}
            >
              <span style={{ color: statusColor[w.status], fontWeight: 700 }}>
                Worker {w.id}
              </span>
              <span
                style={{
                  color: statusColor[w.status],
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                }}
              >
                {w.status}
              </span>
            </div>
            <div style={S.workerLog}>
              {w.logs.map((l, li) => (
                <div key={li} style={S.logLine}>
                  {l}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeMode() {
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState(null);

  const LANGS = ["python", "javascript", "bash", "json", "html"];
  const STUBS = {
    python: DEFAULT_CODE,
    javascript: `// JavaScript stub\nconst leads = [];\nconsole.log("Leads:", leads.length);\n`,
    bash: `#!/bin/bash\n# Pipeline stub\nnpm run score && npm run dedup\necho "Pipeline complete"\n`,
    json: `{\n  "name": "lead-export",\n  "version": "1.0.0",\n  "leads": []\n}\n`,
    html: DEFAULT_HTML,
  };

  return (
    <div style={{ ...S.pane, flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          background: "#111",
          borderBottom: "1px solid #222",
        }}
      >
        <span style={{ color: "#aaa", fontSize: "0.8rem" }}>Language:</span>
        {LANGS.map((l) => (
          <button
            key={l}
            style={l === lang ? S.langBtnActive : S.langBtn}
            onClick={() => {
              setLang(l);
              setCode(STUBS[l]);
              setOutput(null);
            }}
          >
            {l}
          </button>
        ))}
        <span style={{ marginLeft: "auto", color: "#555", fontSize: "0.7rem" }}>
          Ctrl+Enter to run (browser-only for JS)
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <textarea
          style={S.codeArea}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "Enter" && lang === "javascript") {
              try {
                // eslint-disable-next-line no-new-func
                const fn = new Function(code);
                const logs = [];
                const origLog = console.log;
                console.log = (...args) => logs.push(args.join(" "));
                fn();
                console.log = origLog;
                setOutput(logs.join("\n") || "(no output)");
              } catch (err) {
                setOutput("Error: " + err.message);
              }
            }
          }}
        />
        {output && (
          <div
            style={{
              background: "#0a0a0a",
              padding: "0.5rem 0.75rem",
              borderTop: "1px solid #222",
              fontSize: "0.78rem",
              color: "#4ade80",
              fontFamily: "monospace",
              maxHeight: "8rem",
              overflow: "auto",
            }}
          >
            <strong style={{ color: "#aaa" }}>Output:</strong>
            <pre style={{ margin: 0 }}>{output}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineMode() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const pollRef = useRef(null);
  const logsEndRef = useRef(null);

  const appendLog = (msg) =>
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => () => stopPoll(), []);

  const runPipeline = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    stopPoll();
    appendLog("🚀 Dispatching autonomous lead pipeline…");

    try {
      const res = await fetch(`${getApiBase()}/api/v1/runtime/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command:
            "run full pipeline: scrape → validate → enrich → score → dedup → outreach",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const id = data.task_id || data.id;
      setTaskId(id);
      appendLog(`📋 Task ID: ${id}`);
      appendLog("⏳ Pipeline running — polling for updates…");

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const poll = await fetch(`${getApiBase()}/api/v1/runtime/task/${id}`);
          const pd = await poll.json();
          appendLog(`[${attempts}] Status: ${pd.status}`);
          if (pd.status === "completed") {
            stopPoll();
            appendLog("✅ Pipeline completed successfully.");
            if (pd.result)
              appendLog(`Result: ${JSON.stringify(pd.result).slice(0, 200)}`);
            setRunning(false);
          } else if (pd.status === "failed") {
            stopPoll();
            appendLog(`❌ Pipeline failed: ${pd.error || "unknown error"}`);
            setRunning(false);
          } else if (attempts >= 120) {
            stopPoll();
            appendLog("⚠️ Timeout — pipeline still running in background.");
            setRunning(false);
          }
        } catch {
          appendLog("⚠️ Poll error — retrying…");
        }
      }, 2000);
    } catch (e) {
      appendLog(`❌ Error: ${e.message}`);
      setRunning(false);
    }
  }, [running]);

  const STAGES = [
    { id: "scrape", label: "Scrape", icon: "🕷️" },
    { id: "validate", label: "Validate", icon: "✅" },
    { id: "enrich", label: "Enrich", icon: "🔍" },
    { id: "score", label: "Score", icon: "⭐" },
    { id: "dedup", label: "Dedup", icon: "🔧" },
    { id: "outreach", label: "Outreach", icon: "📧" },
  ];

  return (
    <div style={S.pane}>
      <div style={S.paneLabel}>🚀 Autonomous Lead Pipeline</div>

      <div
        style={{
          padding: "0.75rem",
          background: "#111",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "0.5rem",
          }}
        >
          {STAGES.map((st) => (
            <div key={st.id} style={S.stagePill}>
              {st.icon} {st.label}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            style={running ? S.btnDisabled : S.goBtn}
            onClick={runPipeline}
            disabled={running}
          >
            {running ? "⏳ Running…" : "▶ Run Full Pipeline"}
          </button>
          {taskId && (
            <span
              style={{
                color: "#888",
                fontSize: "0.75rem",
                alignSelf: "center",
              }}
            >
              Task: {taskId}
            </span>
          )}
        </div>
      </div>

      <div style={S.logBox}>
        {logs.length === 0 && (
          <div style={{ color: "#555", fontStyle: "italic" }}>
            Logs will appear here when you run the pipeline.
          </div>
        )}
        {logs.map((l, i) => (
          <div
            key={i}
            style={{
              ...S.logLine,
              color: l.includes("✅")
                ? "#4ade80"
                : l.includes("❌")
                  ? "#f87171"
                  : l.includes("⚠️")
                    ? "#f59e0b"
                    : "#ccc",
            }}
          >
            {l}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WorkspacePage() {
  const [activeMode, setActiveMode] = useState("browser");

  const renderMode = () => {
    switch (activeMode) {
      case "browser":
        return <BrowserMode />;
      case "html":
        return <HtmlMode />;
      case "ai-ui":
        return <AiUiMode />;
      case "workers":
        return <WorkersMode />;
      case "code":
        return <CodeMode />;
      case "pipeline":
        return <PipelineMode />;
      default:
        return null;
    }
  };

  return (
    <div style={S.page}>
      {/* Top nav */}
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
          <Link href="/analytics" style={S.navLink}>
            Analytics
          </Link>
          <Link href="/settings" style={S.navLink}>
            Settings
          </Link>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={S.modeBar}>
        {MODES.map((m) => (
          <button
            key={m.id}
            style={activeMode === m.id ? S.modeTabActive : S.modeTab}
            onClick={() => setActiveMode(m.id)}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div style={S.editorArea}>{renderMode()}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  header: {
    background: "#0a0a0a",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.6rem 1.2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  logo: { color: "#FFD700", fontWeight: 700, fontSize: "1rem" },
  headerLinks: { display: "flex", gap: "1rem" },
  navLink: { color: "#aaa", textDecoration: "none", fontSize: "0.85rem" },
  modeBar: {
    display: "flex",
    gap: "0.25rem",
    padding: "0.5rem 0.75rem",
    background: "#0d0d0d",
    borderBottom: "1px solid #1a1a1a",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  modeTab: {
    background: "#1a1a1a",
    color: "#aaa",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "0.3rem 0.8rem",
    cursor: "pointer",
    fontSize: "0.82rem",
  },
  modeTabActive: {
    background: "#FFD700",
    color: "#000",
    border: "1px solid #FFD700",
    borderRadius: "4px",
    padding: "0.3rem 0.8rem",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.82rem",
  },
  editorArea: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  pane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  paneLabel: {
    background: "#111",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.4rem 0.75rem",
    fontSize: "0.78rem",
    color: "#888",
    flexShrink: 0,
  },
  toolbar: {
    display: "flex",
    gap: "0.25rem",
    padding: "0.4rem 0.6rem",
    background: "#111",
    borderBottom: "1px solid #1a1a1a",
    alignItems: "center",
    flexShrink: 0,
  },
  tbBtn: {
    background: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: "4px",
    padding: "0.25rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  urlBar: {
    flex: 1,
    background: "#0a0a0a",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "4px",
    padding: "0.25rem 0.6rem",
    fontSize: "0.83rem",
  },
  goBtn: {
    background: "#FFD700",
    color: "#000",
    border: "none",
    borderRadius: "4px",
    padding: "0.3rem 0.9rem",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.83rem",
  },
  btnDisabled: {
    background: "#555",
    color: "#999",
    border: "none",
    borderRadius: "4px",
    padding: "0.3rem 0.9rem",
    cursor: "not-allowed",
    fontWeight: 700,
    fontSize: "0.83rem",
  },
  iframe: {
    flex: 1,
    border: "none",
    width: "100%",
    height: "100%",
    display: "block",
  },
  iframeLoading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#555",
    fontSize: "0.9rem",
  },
  splitLeft: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #1a1a1a",
    overflow: "hidden",
  },
  splitRight: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  codeArea: {
    flex: 1,
    background: "#0a0a0a",
    color: "#e2e8f0",
    border: "none",
    padding: "0.75rem",
    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontSize: "0.82rem",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
  },
  aiInput: {
    flex: 1,
    background: "#0a0a0a",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "4px",
    padding: "0.4rem 0.75rem",
    fontSize: "0.85rem",
    outline: "none",
  },
  quickPrompts: {
    display: "flex",
    gap: "0.4rem",
    padding: "0.4rem 0.75rem",
    background: "#0d0d0d",
    borderBottom: "1px solid #1a1a1a",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  chip: {
    background: "#1a1a1a",
    color: "#aaa",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "0.2rem 0.7rem",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  logBox: {
    flex: 1,
    background: "#0a0a0a",
    padding: "0.75rem",
    fontFamily: "monospace",
    fontSize: "0.78rem",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  logLine: {
    color: "#ccc",
    lineHeight: 1.6,
  },
  errorBox: {
    background: "#1a0000",
    color: "#f87171",
    padding: "0.75rem",
    margin: "0.5rem",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "0.82rem",
  },
  resultTabs: {
    background: "#111",
    borderBottom: "1px solid #1a1a1a",
    padding: "0.35rem 0.75rem",
    flexShrink: 0,
  },
  resultPre: {
    flex: 1,
    background: "#0a0a0a",
    color: "#e2e8f0",
    padding: "0.75rem",
    fontFamily: "monospace",
    fontSize: "0.78rem",
    overflow: "auto",
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  placeholder: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#444",
    fontSize: "0.9rem",
    padding: "2rem",
    textAlign: "center",
  },
  workerBox: {
    background: "#0d0d0d",
    border: "1px solid #1a1a1a",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  workerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.35rem 0.6rem",
    borderBottom: "2px solid",
    background: "#111",
  },
  workerLog: {
    flex: 1,
    padding: "0.4rem",
    fontFamily: "monospace",
    fontSize: "0.7rem",
    overflow: "auto",
    color: "#aaa",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  },
  stagePill: {
    background: "#1a1a1a",
    color: "#aaa",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "0.2rem 0.6rem",
    fontSize: "0.75rem",
  },
  langBtn: {
    background: "#1a1a1a",
    color: "#aaa",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "0.2rem 0.6rem",
    cursor: "pointer",
    fontSize: "0.78rem",
  },
  langBtnActive: {
    background: "#FFD700",
    color: "#000",
    border: "1px solid #FFD700",
    borderRadius: "4px",
    padding: "0.2rem 0.6rem",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.78rem",
  },
};
