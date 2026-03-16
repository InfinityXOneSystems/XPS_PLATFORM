/**
 * Admin — Copilot Instruction Editor & Multi-Agent Spawner
 * Route: /admin/hidden/copilot
 *
 * - Edit COPILOT_PROMPT.md in-browser
 * - Spawn 2-10 parallel agents to build PRs simultaneously
 */

import { useEffect, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3099";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
const hdrs = {
  "Content-Type": "application/json",
  "X-Admin-Token": ADMIN_TOKEN,
};

export default function AdminCopilot() {
  const [promptContent, setPromptContent] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [commitMsg, setCommitMsg] = useState(
    "Update COPILOT_PROMPT.md via admin panel",
  );
  const [spawnTask, setSpawnTask] = useState("");
  const [agentCount, setAgentCount] = useState(4);
  const [branchPrefix, setBranchPrefix] = useState("copilot/spawn");
  const [spawnResult, setSpawnResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [spawning, setSpawning] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/v1/admin/hidden/copilot/prompt`, { headers: hdrs })
      .then((r) => r.json())
      .then((d) => {
        setPromptContent(d.content || "");
        setCharCount(d.char_count || 0);
      })
      .catch(() => setMsg("Failed to load prompt"));
  }, []);

  const savePrompt = async () => {
    setSaving(true);
    const resp = await fetch(`${API}/api/v1/admin/hidden/copilot/prompt`, {
      method: "PUT",
      headers: hdrs,
      body: JSON.stringify({
        content: promptContent,
        commit_message: commitMsg,
      }),
    });
    setSaving(false);
    if (resp.ok) {
      const d = await resp.json();
      setCharCount(d.char_count);
      setMsg("✅ Prompt saved");
    } else setMsg("❌ Save failed");
  };

  const spawnAgents = async () => {
    if (!spawnTask.trim()) {
      setMsg("Please enter a task description");
      return;
    }
    setSpawning(true);
    const resp = await fetch(`${API}/api/v1/admin/hidden/copilot/spawn`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({
        task: spawnTask,
        agent_count: agentCount,
        branch_prefix: branchPrefix,
      }),
    });
    setSpawning(false);
    if (resp.ok) {
      setSpawnResult(await resp.json());
      setMsg("✅ Agents queued");
    } else setMsg("❌ Spawn failed");
  };

  return (
    <>
      <Head>
        <title>Copilot — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={pg}>
        <h1 style={h1}>🤖 Copilot Command Center</h1>
        {msg && <div style={msgBox}>{msg}</div>}

        <div style={twoCol}>
          {/* Prompt Editor */}
          <div>
            <div style={cardStyle}>
              <div style={cardHeader}>
                <h2 style={h2}>📝 COPILOT_PROMPT.md Editor</h2>
                <span style={charBadge}>
                  {promptContent.length.toLocaleString()} chars
                </span>
              </div>
              <textarea
                style={editor}
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                spellCheck={false}
              />
              <input
                style={inp}
                placeholder="Commit message"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
              />
              <button style={btn} onClick={savePrompt} disabled={saving}>
                {saving ? "Saving…" : "Save & Publish"}
              </button>
            </div>
          </div>

          {/* Agent Spawner */}
          <div>
            <div style={cardStyle}>
              <h2 style={h2}>⚡ Multi-Agent Spawner</h2>
              <p style={spawnDesc}>
                Spawn 2–10 parallel Copilot agents to build features
                simultaneously. Each agent creates its own branch and PR.
              </p>
              <textarea
                style={{ ...editor, height: "100px" }}
                placeholder="Task description (e.g. 'Build Stripe payment checkout module with webhook handling')"
                value={spawnTask}
                onChange={(e) => setSpawnTask(e.target.value)}
              />
              <div style={spawnControls}>
                <label style={lbl} htmlFor="agent-count-range">
                  Agent count: <strong>{agentCount}</strong>
                  <input
                    id="agent-count-range"
                    type="range"
                    min={2}
                    max={10}
                    value={agentCount}
                    onChange={(e) => setAgentCount(parseInt(e.target.value))}
                    style={{ marginLeft: "0.75rem" }}
                    aria-label={`Number of agents: ${agentCount}`}
                  />
                </label>
                <input
                  style={inp}
                  placeholder="Branch prefix"
                  value={branchPrefix}
                  onChange={(e) => setBranchPrefix(e.target.value)}
                />
              </div>
              <button
                style={{ ...btn, background: spawning ? "#4c1d95" : "#7c3aed" }}
                onClick={spawnAgents}
                disabled={spawning}
              >
                {spawning ? "Spawning…" : `🚀 Spawn ${agentCount} Agents`}
              </button>
            </div>

            {spawnResult && (
              <div style={spawnResultCard}>
                <h3 style={{ color: "#6ee7b7", marginBottom: "0.75rem" }}>
                  ✅ Spawn Queued
                </h3>
                <KV k="Spawn ID" v={spawnResult.spawn_id} />
                <KV k="Task" v={spawnResult.task} />
                <KV k="Agents" v={spawnResult.agent_count} />
                <KV k="Status" v={spawnResult.status} />
                <div style={{ marginTop: "0.75rem" }}>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "0.8rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Branches:
                  </div>
                  {spawnResult.branches.map((b) => (
                    <div key={b} style={branchTag}>
                      {b}
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "0.8rem",
                    marginTop: "0.75rem",
                  }}
                >
                  {spawnResult.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function KV({ k, v }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid #1e293b",
        padding: "0.35rem 0",
        fontSize: "0.85rem",
      }}
    >
      <span style={{ color: "#64748b" }}>{k}</span>
      <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{v}</span>
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
const h2 = {
  color: "#94a3b8",
  marginBottom: "0.75rem",
  fontSize: "1rem",
  margin: 0,
};
const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.75rem",
};
const charBadge = {
  background: "#1e293b",
  color: "#64748b",
  padding: "0.2rem 0.6rem",
  borderRadius: "0.35rem",
  fontSize: "0.75rem",
};
const cardStyle = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  marginBottom: "1rem",
};
const msgBox = {
  background: "#1e3a5f",
  color: "#93c5fd",
  padding: "0.75rem 1rem",
  borderRadius: "0.5rem",
  marginBottom: "1rem",
};
const twoCol = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1.5rem",
};
const editor = {
  width: "100%",
  height: "340px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#e2e8f0",
  fontFamily: "monospace",
  fontSize: "0.85rem",
  padding: "0.75rem",
  borderRadius: "0.5rem",
  resize: "vertical",
  boxSizing: "border-box",
  marginBottom: "0.75rem",
};
const inp = {
  display: "block",
  width: "100%",
  marginBottom: "0.75rem",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#e2e8f0",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  boxSizing: "border-box",
};
const btn = {
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  padding: "0.6rem 1.5rem",
  borderRadius: "0.5rem",
  cursor: "pointer",
  fontWeight: 600,
};
const spawnDesc = {
  color: "#64748b",
  fontSize: "0.85rem",
  marginBottom: "0.75rem",
};
const spawnControls = { marginBottom: "0.75rem" };
const lbl = {
  display: "block",
  color: "#94a3b8",
  fontSize: "0.85rem",
  marginBottom: "0.5rem",
};
const spawnResultCard = {
  background: "#0d2d1f",
  border: "1px solid #065f46",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};
const branchTag = {
  background: "#1e1b4b",
  color: "#a78bfa",
  fontFamily: "monospace",
  fontSize: "0.75rem",
  padding: "0.25rem 0.6rem",
  borderRadius: "0.35rem",
  display: "inline-block",
  margin: "0.2rem",
};
