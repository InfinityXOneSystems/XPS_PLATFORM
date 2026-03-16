"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const app = express();
app.use(express.json());

// ── simple rate limiter ────────────────────────────────────────────────────
// Allow at most `max` requests per `windowMs` per IP for sensitive routes.
function createRateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const store = new Map();
  // Prune expired entries periodically to prevent the Map from growing
  // unboundedly as unique IP addresses accumulate over time.
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, windowMs);
  if (pruneInterval.unref) pruneInterval.unref();

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    store.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: "Too Many Requests" });
    }
    next();
  };
}

const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

// ── stricter limiter for high-cost system commands ──────────────────────────
const cmdLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

const ROOT = path.resolve(__dirname, "..", "..");
const LEADS_FILE = path.join(ROOT, "data", "leads", "leads.json");
const TODO_FILE = path.join(ROOT, "todo", "todo.csv");
const TEMPLATES_FILE = path.join(
  ROOT,
  "outreach",
  "templates",
  "outreach_templates.csv",
);

// ── helpers ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
  } catch {
    return [];
  }
}

// TTL cache for leads file — avoids re-reading/parsing on every request.
let _leadsCache = null;
let _leadsCacheAt = 0;

function readLeadsCached() {
  const now = Date.now();
  if (_leadsCache !== null && now - _leadsCacheAt < CACHE_TTL_MS)
    return _leadsCache;
  _leadsCache = readLeads();
  _leadsCacheAt = now;
  return _leadsCache;
}

function writeLeads(leads) {
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  // Invalidate cache so the next read sees the updated data.
  _leadsCache = null;
  _leadsCacheAt = 0;
}

function scoreLead(lead) {
  let score = 0;
  if (lead.website) score += 10;
  if (lead.email) score += 15;
  if (lead.phone) score += 10;
  if (lead.reviews > 10) score += 5;
  if (lead.rating > 4) score += 10;
  return score;
}

function readUtf16File(filePath) {
  const buf = fs.readFileSync(filePath);
  // Detect UTF-16 LE BOM (FF FE)
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString("utf16le");
  }
  return buf.toString("utf8");
}

function parseTasks() {
  if (!fs.existsSync(TODO_FILE)) return [];
  const content = readUtf16File(TODO_FILE);
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const header = lines
    .shift()
    .split(",")
    .map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] || "";
    });
    return obj;
  });
}

// TTL cache for tasks — avoids re-reading the CSV on every /status and /tasks request.
let _tasksCache = null;
let _tasksCacheAt = 0;

function parseTasksCached() {
  const now = Date.now();
  if (_tasksCache !== null && now - _tasksCacheAt < CACHE_TTL_MS)
    return _tasksCache;
  _tasksCache = parseTasks();
  _tasksCacheAt = now;
  return _tasksCache;
}

// ── routes ─────────────────────────────────────────────────────────────────

/** GET /status – system health */
app.get("/status", (_req, res) => {
  const leads = readLeadsCached();
  const tasks = parseTasksCached();
  const pending = tasks.filter((t) => t.STATUS === "pending").length;
  res.json({
    status: "ok",
    lead_count: leads.length,
    pending_tasks: pending,
    timestamp: new Date().toISOString(),
  });
});

/** GET /leads – return all stored leads (optional ?limit=N) */
app.get("/leads", (req, res) => {
  let leads = readLeadsCached();
  const limit = parseInt(req.query.limit, 10);
  if (!isNaN(limit) && limit > 0) leads = leads.slice(0, limit);
  res.json({ leads, count: leads.length });
});

/** POST /leads – add or update a lead */
app.post("/leads", (req, res) => {
  const lead = req.body;
  if (!lead || !lead.company) {
    return res.status(400).json({ error: "company field is required" });
  }
  const leads = readLeads();
  const idx = leads.findIndex(
    (l) => l.company === lead.company && l.city === lead.city,
  );
  if (idx >= 0) {
    leads[idx] = { ...leads[idx], ...lead };
  } else {
    leads.push(lead);
  }
  writeLeads(leads);
  res.json({ success: true, lead_count: leads.length });
});

/** POST /score – score a lead object */
app.post("/score", (req, res) => {
  const lead = req.body;
  if (!lead || typeof lead !== "object") {
    return res
      .status(400)
      .json({ error: "lead object required in request body" });
  }
  const score = scoreLead(lead);
  res.json({ score, lead });
});

/** GET /tasks – return todo tasks (optional ?status=pending|complete) */
app.get("/tasks", apiLimiter, (req, res) => {
  let tasks = parseTasksCached();
  if (req.query.status) {
    tasks = tasks.filter((t) => t.STATUS === req.query.status);
  }
  res.json({ tasks, count: tasks.length });
});

/** POST /scrape – trigger the lead scraper */
app.post("/scrape", apiLimiter, cmdLimiter, async (_req, res) => {
  const scraperPath = path.join(ROOT, "scrapers", "google_maps_scraper.js");
  try {
    const { stdout } = await execFileAsync("node", [scraperPath]);
    res.json({ success: true, output: stdout });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: err.message, stderr: err.stderr || "" });
  }
});

/** GET /outreach/templates – list outreach templates */
app.get("/outreach/templates", apiLimiter, (_req, res) => {
  if (!fs.existsSync(TEMPLATES_FILE)) {
    return res.json({ templates: [] });
  }
  const raw = fs.readFileSync(TEMPLATES_FILE, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  lines.shift(); // skip header
  const templates = lines
    .map((line) => {
      // Parse CSV with optional quoted fields.
      // Format: id,"subject","message" – extract first numeric id then two
      // remaining fields, handling commas inside double-quoted values.
      const fields = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuote = !inQuote;
        } else if (ch === "," && !inQuote) {
          fields.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      fields.push(cur);
      if (fields.length < 3) return null;
      return {
        id: fields[0].trim(),
        subject: fields[1].trim(),
        message: fields[2].trim(),
      };
    })
    .filter(Boolean);
  res.json({ templates });
});

/** POST /outreach/send – record an outreach action for a lead */
app.post("/outreach/send", (req, res) => {
  const { lead, template_id } = req.body;
  if (!lead || !template_id) {
    return res.status(400).json({ error: "lead and template_id are required" });
  }
  // Record the outreach in the leads store
  const leads = readLeads();
  const idx = leads.findIndex(
    (l) => l.company === lead.company && l.city === lead.city,
  );
  if (idx < 0) {
    return res
      .status(404)
      .json({ error: "lead not found – upsert it first via POST /leads" });
  }
  const record = {
    template_id,
    sent_at: new Date().toISOString(),
  };
  leads[idx].outreach = leads[idx].outreach || [];
  leads[idx].outreach.push(record);
  writeLeads(leads);
  res.json({ success: true, outreach: record });
});

// ── serve OpenAPI spec ──────────────────────────────────────────────────────

app.get("/openapi.json", (_req, res) => {
  res.sendFile(path.join(__dirname, "openapi.json"));
});

// ── pipeline / validation / export command endpoints ────────────────────────

/** POST /pipeline/run – run the scoring + export pipeline */
app.post("/pipeline/run", apiLimiter, cmdLimiter, async (_req, res) => {
  const pipelineScript = path.join(
    ROOT,
    "agents",
    "scoring",
    "scoring_pipeline.js",
  );
  const exportScript = path.join(ROOT, "tools", "export_snapshot.js");
  try {
    const { stdout: stdout1 } = await execFileAsync("node", [pipelineScript]);
    const { stdout: stdout2 } = await execFileAsync("node", [exportScript]);
    res.json({
      success: true,
      scoring_output: stdout1,
      export_output: stdout2,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: err.message, stderr: err.stderr || "" });
  }
});

/** POST /validate – run the lead validation pipeline */
app.post("/validate", apiLimiter, (_req, res) => {
  try {
    const {
      runValidationPipeline,
    } = require("../../validation/lead_validation_pipeline");
    const leads = readLeadsCached();
    const result = runValidationPipeline(leads, {
      writeReports: true,
      enforceGates: false,
    });
    res.json({ success: true, summary: result.summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /export – export JSON snapshot */
app.get("/export", apiLimiter, cmdLimiter, async (_req, res) => {
  const exportScript = path.join(ROOT, "tools", "export_snapshot.js");
  try {
    const { stdout } = await execFileAsync("node", [exportScript]);
    res.json({ success: true, output: stdout });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: err.message, stderr: err.stderr || "" });
  }
});

// ── Google Workspace endpoints ───────────────────────────────────────────────

/** GET /workspace/status – check if Google Workspace is configured */
app.get("/workspace/status", apiLimiter, (_req, res) => {
  try {
    const {
      checkWorkspaceConfig,
    } = require("../../integrations/google_workspace");
    const config = checkWorkspaceConfig();
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /workspace/sheets/export – export leads to a new Google Sheet */
app.post("/workspace/sheets/export", apiLimiter, async (req, res) => {
  try {
    const {
      sheetsExportLeads,
    } = require("../../integrations/google_workspace");
    const leads = readLeadsCached();
    if (leads.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No leads to export" });
    }
    const result = await sheetsExportLeads({
      title: req.body.title || "XPS Lead Export",
      leads,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /workspace/gmail/send – send an email via Gmail */
app.post("/workspace/gmail/send", apiLimiter, async (req, res) => {
  const { to, subject, body: emailBody } = req.body || {};
  if (!to || !subject || !emailBody) {
    return res
      .status(400)
      .json({ error: "to, subject, and body are required" });
  }
  try {
    const { gmailSendEmail } = require("../../integrations/google_workspace");
    const result = await gmailSendEmail({ to, subject, body: emailBody });
    res.json({ success: true, message_id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /workspace/gmail/messages – list recent Gmail messages */
app.get("/workspace/gmail/messages", apiLimiter, async (req, res) => {
  try {
    const {
      gmailListMessages,
    } = require("../../integrations/google_workspace");
    const messages = await gmailListMessages({
      query: req.query.q || "",
      maxResults: parseInt(req.query.limit, 10) || 20,
    });
    res.json({ success: true, messages, count: messages.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /workspace/drive/upload – upload a file to Google Drive */
app.post(
  "/workspace/drive/upload",
  apiLimiter,
  cmdLimiter,
  async (req, res) => {
    const { name, filePath, folderId } = req.body || {};
    if (!name || !filePath) {
      return res.status(400).json({ error: "name and filePath are required" });
    }
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }
    try {
      const {
        driveUploadFile,
      } = require("../../integrations/google_workspace");
      const result = await driveUploadFile({
        name,
        filePath: absPath,
        folderId,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// ── start ───────────────────────────────────────────────────────────────────

const PORT = process.env.GPT_ACTIONS_PORT || 3100;

if (require.main === module) {
  app
    .listen(PORT, () => {
      console.log(`GPT Actions server running on port ${PORT}`);
    })
    .on("error", (err) => {
      console.error(`Failed to start GPT Actions server: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
