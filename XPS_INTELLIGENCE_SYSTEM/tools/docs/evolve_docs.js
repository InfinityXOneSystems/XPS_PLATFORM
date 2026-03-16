"use strict";

/**
 * evolve_docs.js — Living Documentation Generator
 * XPS Lead Intelligence Platform
 *
 * Generates/updates:
 *   docs/REPO_MAP.md      — File tree summary + key entrypoints
 *   docs/TODO.md          — Derived from code TODO markers
 *   docs/TODO.json        — Machine-readable TODO output
 *   docs/STATUS.md        — Current system status
 *   docs/CHANGELOG.md     — Updated with recent commits (best-effort)
 *   docs/SELF_REVIEW.md   — Automated repo review + recommendations
 *   docs/self_review.json — Machine-readable self-review output
 *
 * Usage:
 *   node tools/docs/evolve_docs.js
 *
 * Requirements: Node.js 18+, built-in modules only, idempotent.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..", "..");
const DOCS = path.join(ROOT, "docs");
const NOW = new Date().toISOString();
const NOW_HUMAN = new Date().toUTCString();

// Directories to exclude from tree scan
const EXCLUDE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  "__pycache__",
  ".turbo",
  ".vercel",
  "dist",
  "build",
  "coverage",
]);

// File extensions to include in TODO scan
const TODO_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".sh",
  ".yml",
  ".yaml",
  ".json",
  ".sql",
]);

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeDoc(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`[evolve_docs] Updated: ${path.relative(ROOT, filePath)}`);
}

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, {
      cwd: cwd || ROOT,
      encoding: "utf8",
      timeout: 15000,
    }).trim();
  } catch {
    return null;
  }
}

function fileStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// ─── File Tree Builder ─────────────────────────────────────────────────────────

function buildTree(dir, prefix, depth, maxDepth) {
  if (depth > maxDepth) return "";
  let result = "";
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return "";
  }
  entries = entries
    .filter((e) => !EXCLUDE_DIRS.has(e.name) && !e.name.startsWith("."))
    .sort((a, b) => {
      // Dirs first, then files
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";
    result += `${prefix}${connector}${entry.name}\n`;
    if (entry.isDirectory()) {
      result += buildTree(
        path.join(dir, entry.name),
        prefix + childPrefix,
        depth + 1,
        maxDepth,
      );
    }
  });
  return result;
}

function getKeyEntrypoints() {
  const entrypoints = [
    {
      path: "agents/orchestrator/orchestrator.js",
      desc: "Master pipeline controller",
    },
    {
      path: "agents/scoring/scoring_pipeline.js",
      desc: "Lead scoring pipeline",
    },
    { path: "agents/scoring/lead_scoring.js", desc: "Scoring engine (0–100)" },
    {
      path: "agents/gpt_actions/server.js",
      desc: "GPT Actions REST API server",
    },
    { path: "agents/task_agent.js", desc: "Autonomous task runner" },
    { path: "scrapers/engine.js", desc: "Scraper dispatcher" },
    { path: "scrapers/google_maps_scraper.js", desc: "Google Maps scraper" },
    { path: "scrapers/bing_maps_scraper.js", desc: "Bing Maps scraper" },
    { path: "outreach/outreach_engine.js", desc: "Email outreach engine" },
    { path: "outreach/follow_up_scheduler.js", desc: "Follow-up automation" },
    { path: "db/db.js", desc: "PostgreSQL connection pool" },
    { path: "db/leadStore.js", desc: "Lead CRUD operations" },
    { path: "db/schema.sql", desc: "Database schema DDL" },
    {
      path: "tools/docs/evolve_docs.js",
      desc: "Living docs generator (this file)",
    },
    { path: "contracts/lead_schema.json", desc: "Lead data schema contract" },
    { path: "tests/lead_scoring.test.js", desc: "Unit tests" },
  ];

  return entrypoints
    .filter((e) => fs.existsSync(path.join(ROOT, e.path)))
    .map((e) => `| \`${e.path}\` | ${e.desc} |`)
    .join("\n");
}

// ─── TODO Scanner ──────────────────────────────────────────────────────────────

// Absolute paths to skip during TODO scanning (generator files would self-detect)
const TODO_SKIP_PATHS = new Set([
  path.join(ROOT, "tools", "docs", "evolve_docs.js"),
  path.join(ROOT, "tools", "docs", "create_issues.js"),
]);

// Anchored patterns: comment marker must be the first non-whitespace on the line
// This prevents matching TODO inside template strings or output text
const JS_TODO_RE = /^\s*\/\/\s*TODO[:\s]+(.+)/i;
const SH_TODO_RE = /^\s*#\s*TODO[:\s]+(.+)/i;
const SHELL_LIKE_EXTS = new Set([".sh", ".yml", ".yaml", ".py", ".sql"]);

function scanTodos() {
  const todos = [];

  function scanDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (
        TODO_EXTENSIONS.has(path.extname(entry.name)) &&
        !TODO_SKIP_PATHS.has(fullPath)
      ) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          const ext = path.extname(entry.name);
          lines.forEach((line, i) => {
            const match = SHELL_LIKE_EXTS.has(ext)
              ? SH_TODO_RE.exec(line) || JS_TODO_RE.exec(line)
              : JS_TODO_RE.exec(line);
            if (match) {
              const text = match[1].trim();
              if (text) {
                todos.push({
                  id: `TODO-${todos.length + 1}`,
                  file: path.relative(ROOT, fullPath),
                  line: i + 1,
                  text,
                  priority:
                    text.toLowerCase().includes("critical") ||
                    text.toLowerCase().includes("urgent")
                      ? "HIGH"
                      : text.toLowerCase().includes("important")
                        ? "MEDIUM"
                        : "LOW",
                  label: detectLabel(text, entry.name),
                  status: "open",
                  discovered: NOW,
                });
              }
            }
          });
        } catch {
          // skip binary or unreadable files
        }
      }
    }
  }

  scanDir(ROOT);
  return todos;
}

function detectLabel(text, filename) {
  const t = text.toLowerCase();
  const f = filename.toLowerCase();
  if (t.includes("test") || f.includes("test")) return "testing";
  if (t.includes("security") || t.includes("auth") || t.includes("secret"))
    return "security";
  if (t.includes("database") || t.includes("sql") || t.includes("db"))
    return "database";
  if (t.includes("scraper") || t.includes("crawl")) return "scraper";
  if (t.includes("email") || t.includes("outreach")) return "outreach";
  if (t.includes("dashboard") || t.includes("ui")) return "dashboard";
  if (t.includes("performance") || t.includes("slow") || t.includes("optimize"))
    return "performance";
  if (t.includes("doc") || t.includes("readme")) return "documentation";
  return "enhancement";
}

// ─── Status Reader ─────────────────────────────────────────────────────────────

function getSystemStatus() {
  const status = {};

  // Scored leads
  const scoredLeads = readJsonSafe(
    path.join(ROOT, "data", "leads", "scored_leads.json"),
  );
  const scoringReport = readJsonSafe(
    path.join(ROOT, "data", "leads", "scoring_report.json"),
  );

  if (scoredLeads) {
    status.leadsCount = Array.isArray(scoredLeads) ? scoredLeads.length : 0;
    const stat = fileStat(
      path.join(ROOT, "data", "leads", "scored_leads.json"),
    );
    status.leadsLastUpdated = stat ? stat.mtime.toISOString() : "unknown";
  } else {
    status.leadsCount = 0;
    status.leadsLastUpdated = "No data file found";
  }

  if (scoringReport) {
    status.scoringTiers = scoringReport.tiers || {};
    status.scoringTotal = scoringReport.total || 0;
  }

  // Outreach log
  const outreachLog = readJsonSafe(
    path.join(ROOT, "data", "outreach", "outreach_log.json"),
  );
  if (outreachLog && Array.isArray(outreachLog)) {
    status.outreachTotal = outreachLog.length;
    status.outreachSent = outreachLog.filter((e) => e.status === "sent").length;
  } else {
    status.outreachTotal = 0;
    status.outreachSent = 0;
  }

  // Scraper progress
  const scraperProgress = readJsonSafe(
    path.join(ROOT, "data", "scraper_progress.json"),
  );
  status.scraperProgress = scraperProgress || "No progress file found";

  // Git info
  status.lastCommit =
    safeExec('git log -1 --format="%H %s" 2>/dev/null') || "unknown";
  status.branch =
    safeExec("git rev-parse --abbrev-ref HEAD 2>/dev/null") || "unknown";
  status.commitCount =
    safeExec("git rev-list --count HEAD 2>/dev/null") || "unknown";

  // Node version
  status.nodeVersion = process.version;

  // Package versions
  const pkg = readJsonSafe(path.join(ROOT, "package.json"));
  status.packageVersion = pkg ? pkg.version : "unknown";

  return status;
}

// ─── Self-Review Engine ────────────────────────────────────────────────────────

function runSelfReview(todos, status) {
  const recommendations = [];

  // Check: no leads in pipeline
  if (status.leadsCount === 0) {
    recommendations.push({
      id: "SR-001",
      severity: "HIGH",
      category: "pipeline",
      title: "No leads in pipeline",
      description:
        "data/leads/scored_leads.json is empty or missing. The scraper pipeline has not produced results.",
      action:
        "Run the lead scraper pipeline: trigger `.github/workflows/lead_scraper.yml` or run `npm run score` locally.",
      fingerprint: "sr-no-leads-in-pipeline",
    });
  }

  // Check: many TODO items
  const highPriorityTodos = todos.filter((t) => t.priority === "HIGH");
  if (highPriorityTodos.length > 0) {
    recommendations.push({
      id: "SR-002",
      severity: "MEDIUM",
      category: "code-quality",
      title: `${highPriorityTodos.length} high-priority TODO items found`,
      description: `Found ${highPriorityTodos.length} TODO comments marked HIGH priority in the codebase.`,
      action: `Review and resolve: ${highPriorityTodos
        .slice(0, 3)
        .map((t) => t.file + ":" + t.line)
        .join(", ")}`,
      fingerprint: `sr-high-priority-todos-${highPriorityTodos.length}`,
    });
  }

  // Check: outreach not configured
  const outreachEngine = path.join(ROOT, "outreach", "outreach_engine.js");
  if (fs.existsSync(outreachEngine)) {
    try {
      const content = fs.readFileSync(outreachEngine, "utf8");
      if (content.includes("TODO") && content.includes("nodemailer")) {
        recommendations.push({
          id: "SR-003",
          severity: "MEDIUM",
          category: "outreach",
          title: "Email outreach not fully configured",
          description:
            "outreach/outreach_engine.js contains TODO markers for nodemailer configuration.",
          action:
            "Configure SMTP credentials and complete nodemailer setup in outreach/outreach_engine.js.",
          fingerprint: "sr-outreach-not-configured",
        });
      }
    } catch {
      /* skip */
    }
  }

  // Check: tests coverage
  const testsDir = path.join(ROOT, "tests");
  let testFileCount = 0;
  if (fs.existsSync(testsDir)) {
    try {
      testFileCount = fs
        .readdirSync(testsDir)
        .filter((f) => f.endsWith(".test.js")).length;
    } catch {
      /* skip */
    }
  }
  if (testFileCount < 3) {
    recommendations.push({
      id: "SR-004",
      severity: "LOW",
      category: "testing",
      title: "Limited test coverage",
      description: `Only ${testFileCount} test file(s) found in tests/. Scraper, outreach, and enrichment modules lack tests.`,
      action:
        "Add test files for outreach_engine.js, google_maps_scraper.js, and enrichment agents.",
      fingerprint: "sr-limited-test-coverage",
    });
  }

  // Check: database schema
  const schemaFile = path.join(ROOT, "db", "schema.sql");
  if (!fs.existsSync(schemaFile)) {
    recommendations.push({
      id: "SR-005",
      severity: "HIGH",
      category: "database",
      title: "Database schema file missing",
      description: "db/schema.sql not found. Cannot initialize the database.",
      action: "Restore or recreate db/schema.sql.",
      fingerprint: "sr-schema-missing",
    });
  }

  // Check: README completeness
  const readme = path.join(ROOT, "README.md");
  if (fs.existsSync(readme)) {
    try {
      const content = fs.readFileSync(readme, "utf8");
      if (content.length < 500) {
        recommendations.push({
          id: "SR-006",
          severity: "LOW",
          category: "documentation",
          title: "README.md is minimal",
          description:
            "README.md contains less than 500 characters and does not describe the platform.",
          action:
            "Expand README.md with quickstart, architecture overview, and links to docs/.",
          fingerprint: "sr-readme-minimal",
        });
      }
    } catch {
      /* skip */
    }
  }

  // Check: env example exists
  const envExample = path.join(ROOT, ".env.example");
  if (!fs.existsSync(envExample)) {
    recommendations.push({
      id: "SR-007",
      severity: "MEDIUM",
      category: "configuration",
      title: ".env.example missing",
      description:
        ".env.example was not found. Contributors cannot onboard without knowing required environment variables.",
      action:
        "Create .env.example with all required environment variable names (no values).",
      fingerprint: "sr-env-example-missing",
    });
  }

  return recommendations;
}

// ─── Document Generators ───────────────────────────────────────────────────────

function generateRepoMap() {
  const tree = buildTree(ROOT, "", 0, 3);
  const entrypoints = getKeyEntrypoints();

  return `# Repository Map — XPS Lead Intelligence Platform

> **Auto-generated by \`tools/docs/evolve_docs.js\`**  
> **Last updated:** ${NOW_HUMAN}

---

## Directory Tree

\`\`\`
LEAD_GEN_INTELLIGENCE/
${tree}\`\`\`

---

## Key Entrypoints

| File | Description |
|---|---|
${entrypoints}

---

## GitHub Actions Workflows

| Workflow | File | Trigger |
|---|---|---|
| Lead Scraper Pipeline | \`.github/workflows/lead_scraper.yml\` | Schedule / manual |
| National Discovery | \`.github/workflows/national_discovery.yml\` | Schedule |
| System Validation | \`.github/workflows/system_validation.yml\` | Push / PR |
| Docs Reflection | \`.github/workflows/docs_reflection.yml\` | Push / Schedule |

---

_Generated at ${NOW_HUMAN}_
`;
}

function generateTodoMd(todos) {
  const byPriority = { HIGH: [], MEDIUM: [], LOW: [] };
  todos.forEach((t) => {
    (byPriority[t.priority] || byPriority.LOW).push(t);
  });

  const renderGroup = (label, items) => {
    if (!items.length) return "";
    return (
      `### ${label} Priority\n\n` +
      items
        .map(
          (t) =>
            `- [ ] **${t.id}** \`${t.file}:${t.line}\` — ${t.text} _(${t.label})_`,
        )
        .join("\n") +
      "\n\n"
    );
  };

  return `# TODO — XPS Lead Intelligence Platform

> **Auto-generated by \`tools/docs/evolve_docs.js\`**  
> **Last updated:** ${NOW_HUMAN}  
> **Total:** ${todos.length} open items

---

${renderGroup("HIGH", byPriority.HIGH)}${renderGroup("MEDIUM", byPriority.MEDIUM)}${renderGroup("LOW", byPriority.LOW)}---

_Source: inline \`// TODO:\` comments in the codebase. See [TODO.json](./TODO.json) for machine-readable format._
`;
}

function generateTodoJson(todos) {
  return JSON.stringify(
    {
      generated: NOW,
      total: todos.length,
      summary: {
        HIGH: todos.filter((t) => t.priority === "HIGH").length,
        MEDIUM: todos.filter((t) => t.priority === "MEDIUM").length,
        LOW: todos.filter((t) => t.priority === "LOW").length,
      },
      items: todos,
    },
    null,
    2,
  );
}

function generateStatusMd(status) {
  const tierTable = status.scoringTiers
    ? Object.entries(status.scoringTiers)
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join("\n")
    : "| _No data_ | — |";

  return `# System Status — XPS Lead Intelligence Platform

> **Auto-generated by \`tools/docs/evolve_docs.js\`**  
> **Last updated:** ${NOW_HUMAN}

---

## Lead Pipeline

| Metric | Value |
|---|---|
| Total scored leads | ${status.leadsCount} |
| Leads last updated | ${status.leadsLastUpdated} |

### Scoring Tiers

| Tier | Count |
|---|---|
${tierTable}

---

## Outreach

| Metric | Value |
|---|---|
| Total outreach records | ${status.outreachTotal} |
| Emails sent | ${status.outreachSent} |

---

## Repository

| Metric | Value |
|---|---|
| Branch | \`${status.branch}\` |
| Last commit | \`${status.lastCommit}\` |
| Total commits | ${status.commitCount} |
| Node.js version | ${status.nodeVersion} |
| Package version | ${status.packageVersion} |

---

## Workflows

See [GitHub Actions](https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE/actions) for current workflow status.

---

_Generated at ${NOW_HUMAN}_
`;
}

function generateSelfReviewMd(recommendations, todos, status) {
  const bySeverity = {
    HIGH: recommendations.filter((r) => r.severity === "HIGH"),
    MEDIUM: recommendations.filter((r) => r.severity === "MEDIUM"),
    LOW: recommendations.filter((r) => r.severity === "LOW"),
  };

  const renderRecs = (label, items) => {
    if (!items.length) return `### ${label} Severity\n\n_None found._ ✅\n\n`;
    return (
      `### ${label} Severity\n\n` +
      items
        .map(
          (r) =>
            `#### ${r.id}: ${r.title}\n\n` +
            `**Category:** ${r.category}  \n` +
            `**Description:** ${r.description}  \n` +
            `**Recommended action:** ${r.action}\n`,
        )
        .join("\n") +
      "\n"
    );
  };

  return `# Self-Review Report — XPS Lead Intelligence Platform

> **Auto-generated by \`tools/docs/evolve_docs.js\`**  
> **Last updated:** ${NOW_HUMAN}  
> **Fingerprint:** Used for GitHub issue deduplication (see \`docs/self_review.json\`)

---

## Summary

| Metric | Value |
|---|---|
| Total recommendations | ${recommendations.length} |
| HIGH severity | ${bySeverity.HIGH.length} |
| MEDIUM severity | ${bySeverity.MEDIUM.length} |
| LOW severity | ${bySeverity.LOW.length} |
| Open TODO items | ${todos.length} |
| Leads in pipeline | ${status.leadsCount} |

---

## Recommendations

${renderRecs("HIGH", bySeverity.HIGH)}
${renderRecs("MEDIUM", bySeverity.MEDIUM)}
${renderRecs("LOW", bySeverity.LOW)}

---

## Next Steps

1. Address HIGH severity recommendations first
2. Run \`node tools/docs/evolve_docs.js\` after fixing issues to re-evaluate
3. Check [GitHub Issues](https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE/issues) for auto-created action items

---

_Generated at ${NOW_HUMAN}_
`;
}

function generateSelfReviewJson(recommendations) {
  return JSON.stringify(
    {
      generated: NOW,
      total: recommendations.length,
      summary: {
        HIGH: recommendations.filter((r) => r.severity === "HIGH").length,
        MEDIUM: recommendations.filter((r) => r.severity === "MEDIUM").length,
        LOW: recommendations.filter((r) => r.severity === "LOW").length,
      },
      recommendations,
    },
    null,
    2,
  );
}

function generateChangelogUpdate() {
  // Get recent commits (best-effort)
  const recentCommits = safeExec(
    "git log --oneline -20 --no-merges 2>/dev/null",
  );
  if (!recentCommits) return null;

  const lines = recentCommits.split("\n").filter(Boolean);
  if (!lines.length) return null;

  return lines.map((l) => `- ${l}`).join("\n");
}

// ─── TODO HTML Dashboard ────────────────────────────────────────────────────────

function generateTodoHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XPS Lead Intelligence — TODO Dashboard</title>
  <style>
    :root {
      --bg: #000;
      --surface: #111;
      --border: #222;
      --text: #fff;
      --muted: #888;
      --gold: #eab308;
      --high: #ef4444;
      --medium: #f97316;
      --low: #22c55e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; padding: 2rem; }
    h1 { color: var(--gold); font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem 1.5rem; min-width: 120px; }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-high .stat-value { color: var(--high); }
    .stat-medium .stat-value { color: var(--medium); }
    .stat-low .stat-value { color: var(--low); }
    .stat-total .stat-value { color: var(--gold); }
    .filters { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .filter-btn { background: var(--surface); border: 1px solid var(--border); color: var(--muted); padding: 0.375rem 0.75rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; transition: all 0.15s; }
    .filter-btn.active, .filter-btn:hover { border-color: var(--gold); color: var(--gold); }
    .search { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 1rem; border-radius: 0.375rem; width: 100%; max-width: 400px; margin-bottom: 1.5rem; font-size: 0.875rem; }
    .search:focus { outline: none; border-color: var(--gold); }
    .todo-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .todo-item { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem 1rem; display: flex; align-items: flex-start; gap: 0.75rem; }
    .todo-item.hidden { display: none; }
    .priority-badge { font-size: 0.6875rem; font-weight: bold; padding: 0.125rem 0.375rem; border-radius: 0.25rem; white-space: nowrap; flex-shrink: 0; margin-top: 0.125rem; }
    .priority-HIGH { background: rgba(239,68,68,0.15); color: var(--high); border: 1px solid rgba(239,68,68,0.3); }
    .priority-MEDIUM { background: rgba(249,115,22,0.15); color: var(--medium); border: 1px solid rgba(249,115,22,0.3); }
    .priority-LOW { background: rgba(34,197,94,0.15); color: var(--low); border: 1px solid rgba(34,197,94,0.3); }
    .todo-content { flex: 1; min-width: 0; }
    .todo-text { font-size: 0.875rem; margin-bottom: 0.25rem; }
    .todo-meta { font-size: 0.75rem; color: var(--muted); }
    .todo-id { color: var(--gold); }
    .label-badge { background: rgba(234,179,8,0.1); color: var(--gold); border: 1px solid rgba(234,179,8,0.2); font-size: 0.6875rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; margin-left: 0.5rem; }
    .empty { color: var(--muted); text-align: center; padding: 3rem; }
    .generated { color: var(--muted); font-size: 0.75rem; margin-top: 2rem; }
    a { color: var(--gold); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>⚡ XPS Lead Intelligence — TODO Dashboard</h1>
  <div class="subtitle" id="subtitle">Loading...</div>

  <div class="stats" id="stats"></div>

  <div class="filters">
    <button class="filter-btn active" onclick="setFilter('ALL')">All</button>
    <button class="filter-btn" onclick="setFilter('HIGH')">🔴 High</button>
    <button class="filter-btn" onclick="setFilter('MEDIUM')">🟠 Medium</button>
    <button class="filter-btn" onclick="setFilter('LOW')">🟢 Low</button>
  </div>

  <input class="search" type="text" placeholder="Search TODOs..." oninput="setSearch(this.value)">

  <div class="todo-list" id="todo-list">
    <div class="empty">Loading TODO data...</div>
  </div>

  <div class="generated" id="generated"></div>

  <script>
    let allTodos = [];
    let currentFilter = 'ALL';
    let currentSearch = '';

    async function loadTodos() {
      try {
        const res = await fetch('TODO.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        allTodos = data.items || [];

        document.getElementById('subtitle').textContent =
          data.total + ' open items · Last updated: ' + new Date(data.generated).toLocaleString();
        document.getElementById('generated').textContent =
          'Source: TODO.json · Auto-generated by tools/docs/evolve_docs.js';

        renderStats(data.summary);
        render();
      } catch (e) {
        document.getElementById('todo-list').innerHTML =
          '<div class="empty">Could not load TODO.json.<br><small>' + e.message + '</small></div>';
        document.getElementById('subtitle').textContent = 'Error loading data';
      }
    }

    function renderStats(summary) {
      const cards = [
        { cls: 'stat-total', value: allTodos.length, label: 'Total' },
        { cls: 'stat-high', value: summary.HIGH || 0, label: 'High' },
        { cls: 'stat-medium', value: summary.MEDIUM || 0, label: 'Medium' },
        { cls: 'stat-low', value: summary.LOW || 0, label: 'Low' },
      ];
      document.getElementById('stats').innerHTML = cards.map(c =>
        '<div class="stat-card ' + c.cls + '">' +
        '<div class="stat-value">' + c.value + '</div>' +
        '<div class="stat-label">' + c.label + '</div>' +
        '</div>'
      ).join('');
    }

    function render() {
      const filtered = allTodos.filter(t => {
        const matchFilter = currentFilter === 'ALL' || t.priority === currentFilter;
        const matchSearch = !currentSearch ||
          t.text.toLowerCase().includes(currentSearch) ||
          t.file.toLowerCase().includes(currentSearch) ||
          (t.label || '').toLowerCase().includes(currentSearch);
        return matchFilter && matchSearch;
      });

      if (!filtered.length) {
        document.getElementById('todo-list').innerHTML = '<div class="empty">No items match your filter.</div>';
        return;
      }

      document.getElementById('todo-list').innerHTML = filtered.map(t =>
        '<div class="todo-item">' +
        '<span class="priority-badge priority-' + t.priority + '">' + t.priority + '</span>' +
        '<div class="todo-content">' +
        '<div class="todo-text">' + escHtml(t.text) + '</div>' +
        '<div class="todo-meta">' +
        '<span class="todo-id">' + t.id + '</span> · ' +
        escHtml(t.file) + ':' + t.line +
        (t.label ? '<span class="label-badge">' + escHtml(t.label) + '</span>' : '') +
        '</div>' +
        '</div>' +
        '</div>'
      ).join('');
    }

    function setFilter(f) {
      currentFilter = f;
      document.querySelectorAll('.filter-btn').forEach((b, i) => {
        b.classList.toggle('active', b.textContent.includes(f) || (f === 'ALL' && b.textContent === 'All'));
      });
      render();
    }

    function setSearch(v) {
      currentSearch = v.toLowerCase();
      render();
    }

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    loadTodos();
  </script>
</body>
</html>
`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log("[evolve_docs] Starting documentation generation...");
  console.log("[evolve_docs] Root:", ROOT);
  console.log("[evolve_docs] Time:", NOW_HUMAN);

  ensureDir(DOCS);

  // 1. Scan TODOs
  console.log("[evolve_docs] Scanning TODO comments...");
  const todos = scanTodos();
  console.log(`[evolve_docs] Found ${todos.length} TODO items`);

  // 2. Get system status
  console.log("[evolve_docs] Reading system status...");
  const status = getSystemStatus();

  // 3. Run self-review
  console.log("[evolve_docs] Running self-review...");
  const recommendations = runSelfReview(todos, status);
  console.log(
    `[evolve_docs] Generated ${recommendations.length} recommendations`,
  );

  // 4. Generate REPO_MAP.md
  writeDoc(path.join(DOCS, "REPO_MAP.md"), generateRepoMap());

  // 5. Generate TODO.md + TODO.json
  writeDoc(path.join(DOCS, "TODO.md"), generateTodoMd(todos));
  writeDoc(path.join(DOCS, "TODO.json"), generateTodoJson(todos));

  // 6. Generate STATUS.md
  writeDoc(path.join(DOCS, "STATUS.md"), generateStatusMd(status));

  // 7. Generate SELF_REVIEW.md + self_review.json
  writeDoc(
    path.join(DOCS, "SELF_REVIEW.md"),
    generateSelfReviewMd(recommendations, todos, status),
  );
  writeDoc(
    path.join(DOCS, "self_review.json"),
    generateSelfReviewJson(recommendations),
  );

  // 8. Generate todo.html
  writeDoc(path.join(DOCS, "todo.html"), generateTodoHtml());

  // 9. Update CHANGELOG.md best-effort
  const changelogPath = path.join(DOCS, "CHANGELOG.md");
  const recentCommits = generateChangelogUpdate();
  if (recentCommits && fs.existsSync(changelogPath)) {
    const existing = fs.readFileSync(changelogPath, "utf8");
    if (!existing.includes("## [Unreleased — Recent Commits]")) {
      const section = `\n## [Unreleased — Recent Commits]\n\n_Auto-detected at ${NOW_HUMAN}_\n\n${recentCommits}\n`;
      const updated = existing.replace(
        "## [Unreleased]",
        `## [Unreleased]${section}`,
      );
      if (updated !== existing) {
        writeDoc(changelogPath, updated);
      } else {
        console.log(
          "[evolve_docs] CHANGELOG.md unchanged (section already present)",
        );
      }
    } else {
      console.log(
        "[evolve_docs] CHANGELOG.md already has recent commits section",
      );
    }
  }

  console.log("[evolve_docs] ✅ Documentation generation complete.");
  console.log("[evolve_docs] Files updated:");
  console.log("  docs/REPO_MAP.md");
  console.log("  docs/TODO.md");
  console.log("  docs/TODO.json");
  console.log("  docs/STATUS.md");
  console.log("  docs/SELF_REVIEW.md");
  console.log("  docs/self_review.json");
  console.log("  docs/todo.html");

  // Return summary for use by GitHub Actions
  return {
    todos: todos.length,
    recommendations: recommendations.length,
    highSeverity: recommendations.filter((r) => r.severity === "HIGH").length,
    leads: status.leadsCount,
  };
}

// Run if called directly
if (require.main === module) {
  const summary = main();
  console.log("[evolve_docs] Summary:", JSON.stringify(summary));
}

module.exports = { main, scanTodos, getSystemStatus, runSelfReview };
