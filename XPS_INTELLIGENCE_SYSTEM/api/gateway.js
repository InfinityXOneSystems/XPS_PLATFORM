"use strict";

require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const {
  upsertLead,
  getAllLeads,
  getTopLeads,
  getLeadById,
  deleteLead,
} = require("../db/supabaseLeadStore");
const {
  supabase,
  isConfigured: supabaseConfigured,
} = require("../db/supabaseClient");

const ROOT = path.join(__dirname, "..");
const LEADS_DIR = path.join(ROOT, "leads");
const DATA_DIR = path.join(ROOT, "data");

// Default to 3000 so the frontend can reach /api without extra configuration.
// Override with PORT env var (e.g. PORT=3200 for legacy deployments).
const PORT = process.env.PORT || 3000;

const app = express();
// Apply JSON body parser globally but skip /webhooks/* — those routes use
// rawBodyMiddleware to capture the raw bytes for HMAC verification.
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks/")) return next();
  express.json()(req, res, next);
});

// CORS – allow configured origins; defaults to permissive for local dev.
// Supports exact-match origins and wildcard Vercel preview deployments
// (e.g. https://xps-intelligence-*.vercel.app).
const CORS_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : null;

// Pre-compile CORS origin patterns at startup to avoid recreating RegExp objects
// on every incoming request.
const CORS_PATTERNS = CORS_ORIGINS
  ? CORS_ORIGINS.map((allowed) => {
      if (!allowed.includes("*")) return { literal: allowed };
      const escaped = allowed
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      return { regex: new RegExp("^" + escaped + "$") };
    })
  : null;

// Returns true when `origin` matches an entry that may contain a '*' wildcard.
function isCorsAllowed(origin) {
  if (!origin) return true; // same-origin / server-to-server requests
  if (!CORS_PATTERNS) return true; // no restriction in local dev
  return CORS_PATTERNS.some((p) =>
    p.literal ? p.literal === origin : p.regex.test(origin),
  );
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isCorsAllowed(origin)) {
    // Use the explicit origin (never "*") so browsers accept credentialed requests
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (!origin && !CORS_ORIGINS) {
    // No origin header + no allowlist configured = server-to-server / local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// ── helpers ──────────────────────────────────────────────────────────────────

function ok(res, data) {
  return res.json({ success: true, data });
}

function fail(res, error, status = 500) {
  return res.status(status).json({ success: false, error: String(error) });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Load leads from local JSON files (offline fallback). */
function loadLeadsFromFile() {
  const scored = path.join(LEADS_DIR, "scored_leads.json");
  const raw = path.join(LEADS_DIR, "leads.json");
  if (fs.existsSync(scored)) return readJson(scored);
  if (fs.existsSync(raw)) return readJson(raw);
  return [];
}

// TTL cache for the file-based leads fallback — avoids re-reading and
// re-parsing large JSON files on every request in offline/file-only mode.
const FILE_LEADS_CACHE_TTL_MS = 30_000; // 30 seconds
let _fileLeadsCache = null;
let _fileLeadsCacheAt = 0;

/** Return cached leads from disk; refreshes at most once per TTL window. */
function loadLeadsFromFileCached() {
  const now = Date.now();
  if (
    _fileLeadsCache !== null &&
    now - _fileLeadsCacheAt < FILE_LEADS_CACHE_TTL_MS
  ) {
    return _fileLeadsCache;
  }
  _fileLeadsCache = loadLeadsFromFile();
  _fileLeadsCacheAt = now;
  return _fileLeadsCache;
}

/** Save leads to local JSON file (used as dual-write backup). */
function saveLeadsToFile(leads) {
  fs.mkdirSync(LEADS_DIR, { recursive: true });
  const raw = path.join(LEADS_DIR, "leads.json");
  fs.writeFileSync(raw, JSON.stringify(leads, null, 2));
  // Invalidate the in-memory cache so the next read reflects the new data.
  _fileLeadsCache = null;
  _fileLeadsCacheAt = 0;
}

function generateId() {
  return (
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

// ── JWT auth middleware ───────────────────────────────────────────────────────

/**
 * Verifies a Bearer JWT token from the Authorization header.
 * Skip auth when JWT_SECRET is not configured (development mode).
 */
function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // JWT_SECRET not set – allow all requests in development / CI
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: "Unauthorized: missing token" });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Unauthorized: invalid token" });
  }
}

// ── routes ───────────────────────────────────────────────────────────────────

// Apply JWT auth to protected API routes
app.use("/api/leads", requireAuth);
app.use("/api/agent", requireAuth);
app.use("/api/agents", requireAuth);
app.use("/api/scraper", requireAuth);
app.use("/api/settings", requireAuth);
app.use("/api/outreach", requireAuth);

// GET /api/leads/metrics  (must be before /api/leads/:id)
app.get("/api/leads/metrics", async (req, res) => {
  try {
    const leads = supabaseConfigured
      ? await getAllLeads(1000).catch((err) => {
          console.error("[gateway] Supabase metrics error:", err.message);
          return loadLeadsFromFileCached();
        })
      : loadLeadsFromFileCached();
    const list = Array.isArray(leads) ? leads : [];
    const total = list.length;
    const aPlusOpportunities = list.filter(
      (l) => (l.rating || l.tier) === "A+",
    ).length;
    const emailsSent = (() => {
      try {
        const q = path.join(DATA_DIR, "outreach", "outreach_queue.json");
        return fs.existsSync(q) ? readJson(q).length : 0;
      } catch (_) {
        return 0;
      }
    })();
    const scores = list
      .map((l) => l.lead_score || l.score || l.opportunityScore || 0)
      .filter(Boolean);
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const revenuePipeline = list.reduce((s, l) => s + (l.revenue || 0), 0);
    return res.json({
      totalLeads: total,
      aPlusOpportunities,
      emailsSent,
      responseRate: total ? Math.round((emailsSent / total) * 100) : 0,
      revenuePipeline,
      avgScore,
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/leads
app.get("/api/leads", async (req, res) => {
  try {
    const { city, state, minScore, limit = 100, offset = 0 } = req.query;

    if (!supabaseConfigured) {
      // Offline fallback: use local JSON
      const leads = loadLeadsFromFileCached();
      let result = Array.isArray(leads) ? leads : [];
      if (city)
        result = result.filter(
          (l) => l.city && l.city.toLowerCase().includes(city.toLowerCase()),
        );
      if (state)
        result = result.filter(
          (l) => l.state && l.state.toLowerCase() === state.toLowerCase(),
        );
      if (minScore)
        result = result.filter(
          (l) => (l.lead_score || l.score || 0) >= Number(minScore),
        );
      const total = result.length;
      result = result.slice(Number(offset), Number(offset) + Number(limit));
      return ok(res, {
        leads: result,
        total,
        offset: Number(offset),
        limit: Number(limit),
      });
    }

    let query = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("lead_score", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (city) query = query.ilike("city", `%${city}%`);
    if (state) query = query.ilike("state", state);
    if (minScore) query = query.gte("lead_score", Number(minScore));

    const { data, count, error } = await query;

    if (error) {
      console.error(
        "[gateway] Supabase /api/leads query error:",
        error.message,
      );
      return fail(res, error.message);
    }

    return ok(res, {
      leads: data || [],
      total: count || 0,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/leads/:id
app.get("/api/leads/:id", async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id).catch(() => null);
    if (lead) return ok(res, lead);

    // Fallback: search local JSON by id or place_id
    const leads = loadLeadsFromFileCached();
    const list = Array.isArray(leads) ? leads : [];
    const found = list.find(
      (l) => String(l.id) === req.params.id || l.place_id === req.params.id,
    );
    if (!found) return fail(res, "Lead not found", 404);
    return ok(res, found);
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/leads
app.post("/api/leads", async (req, res) => {
  try {
    const row = await upsertLead({
      ...req.body,
      date_scraped: new Date().toISOString(),
    });
    return res.status(201).json(row);
  } catch (err) {
    return fail(res, err.message);
  }
});

// PUT /api/leads/:id
app.put("/api/leads/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leads")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data)
      return fail(res, error ? error.message : "Lead not found", 404);
    return res.json(data);
  } catch (err) {
    return fail(res, err.message);
  }
});

// DELETE /api/leads/:id
app.delete("/api/leads/:id", async (req, res) => {
  try {
    await deleteLead(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/leads/:id/assign
app.post("/api/leads/:id/assign", async (req, res) => {
  try {
    const { repId, repName, repInitials } = req.body;
    // Merge assignment fields into existing metadata to avoid overwriting other fields
    const existing = await getLeadById(req.params.id);
    if (!existing) return fail(res, "Lead not found", 404);
    const updatedMetadata = {
      ...(existing.metadata || {}),
      assignedRep: repName || repId,
      assignedInitials: repInitials || "",
    };
    const { data, error } = await supabase
      .from("leads")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data)
      return fail(res, error ? error.message : "Lead not found", 404);
    return res.json(data);
  } catch (err) {
    return fail(res, err.message);
  }
});

// PUT /api/leads/:id/status
app.put("/api/leads/:id/status", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leads")
      .update({ status: req.body.status, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data)
      return fail(res, error ? error.message : "Lead not found", 404);
    return res.json(data);
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/leads/:id/notes
app.post("/api/leads/:id/notes", async (req, res) => {
  try {
    const existing = await getLeadById(req.params.id);
    if (!existing) return fail(res, "Lead not found", 404);
    const ts = new Date().toISOString().slice(0, 10);
    const notes = existing.notes
      ? `${existing.notes}\n[${ts}] ${req.body.note}`
      : `[${ts}] ${req.body.note}`;
    const { data, error } = await supabase
      .from("leads")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data)
      return fail(res, error ? error.message : "Update failed", 500);
    return res.json(data);
  } catch (err) {
    return fail(res, err.message);
  }
});

// ── Scraper routes ────────────────────────────────────────────────────────────

const scraperJobs = new Map();

// POST /api/scraper/run
app.post("/api/scraper/run", (req, res) => {
  try {
    const jobId = generateId();
    const entry = {
      id: jobId,
      timestamp: new Date().toISOString(),
      status: "running",
      message: "Scraper job queued",
      config: req.body,
    };
    scraperJobs.set(jobId, entry);
    const logsDir = path.join(DATA_DIR, "scraper");
    fs.mkdirSync(logsDir, { recursive: true });
    const logsFile = path.join(logsDir, "scraper_jobs.json");
    let jobs = [];
    if (fs.existsSync(logsFile)) {
      try {
        jobs = readJson(logsFile);
      } catch (_) {}
    }
    jobs.push(entry);
    fs.writeFileSync(logsFile, JSON.stringify(jobs, null, 2));
    return res.json({ jobId });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/scraper/status/:jobId
app.get("/api/scraper/status/:jobId", (req, res) => {
  try {
    const job = scraperJobs.get(req.params.jobId);
    if (job) return res.json(job);
    const logsFile = path.join(DATA_DIR, "scraper", "scraper_jobs.json");
    if (fs.existsSync(logsFile)) {
      const jobs = readJson(logsFile);
      const found = jobs.find((j) => j.id === req.params.jobId);
      if (found) return res.json(found);
    }
    return fail(res, "Job not found", 404);
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/scraper/logs
app.get("/api/scraper/logs", (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "50", 10);
    const logsFile = path.join(DATA_DIR, "scraper", "scraper_jobs.json");
    let jobs = [];
    if (fs.existsSync(logsFile)) {
      try {
        jobs = readJson(logsFile);
      } catch (_) {}
    }
    return res.json(jobs.slice(-limit).reverse());
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/scraper/results  – ingest results from GitHub Actions worker
app.post("/api/scraper/results", (req, res) => {
  try {
    const { job_id, results = [] } = req.body;
    const leads = loadLeadsFromFile();
    const list = Array.isArray(leads) ? leads : [];
    let added = 0;
    results.forEach((r) => {
      const exists = list.find(
        (l) =>
          l.phone === r.phone || (l.company === r.company && l.city === r.city),
      );
      if (!exists) {
        list.push({
          id: generateId(),
          company: r.company || r.name,
          phone: r.phone,
          email: r.email,
          website: r.website,
          city: r.city || (r.location || "").split(",")[0],
          state: r.state || (r.location || "").split(",")[1],
          category: r.industry || r.category,
          lead_score: r.lead_score,
          opportunityScore: r.lead_score,
          status: "new",
          rating: r.lead_score >= 75 ? "A+" : r.lead_score >= 50 ? "A" : "B",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    });
    saveLeads(list);
    if (job_id && scraperJobs.has(job_id)) {
      scraperJobs.get(job_id).status = "completed";
      scraperJobs.get(job_id).message = `Ingested ${added} new leads`;
    }
    return res.json({ success: true, added, total: list.length });
  } catch (err) {
    return fail(res, err.message);
  }
});

// ── Agent/Plan routes ─────────────────────────────────────────────────────────

// GET /api/agent/plans
app.get("/api/agent/plans", (req, res) => {
  try {
    const plansFile = path.join(DATA_DIR, "agent", "plans.json");
    let plans = [];
    if (fs.existsSync(plansFile)) {
      try {
        plans = readJson(plansFile);
      } catch (_) {}
    }
    return res.json(plans);
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/agent/plans  – create and optionally execute a plan
app.post("/api/agent/plans", async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return fail(res, "command required", 400);
    const plan = {
      id: generateId(),
      userCommand: command,
      tasks: [],
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    const plansDir = path.join(DATA_DIR, "agent");
    fs.mkdirSync(plansDir, { recursive: true });
    const plansFile = path.join(plansDir, "plans.json");
    let plans = [];
    if (fs.existsSync(plansFile)) {
      try {
        plans = readJson(plansFile);
      } catch (_) {}
    }
    plans.push(plan);
    fs.writeFileSync(plansFile, JSON.stringify(plans, null, 2));
    // Forward to FastAPI agent core if available
    const agentUrl = process.env.AGENT_CORE_URL || "http://localhost:8000";
    try {
      const resp = await axios.post(
        `${agentUrl}/chat`,
        { message: command },
        { timeout: 30000 },
      );
      plan.tasks = [
        {
          id: generateId(),
          type: "agent_run",
          description: command,
          status: "completed",
          result: JSON.stringify(resp.data),
          completedAt: new Date().toISOString(),
        },
      ];
      plan.status = "completed";
    } catch (_agentErr) {
      plan.status = "partial";
      plan.agentError = _agentErr.message || "Agent core unavailable";
    }
    return res.json(plan);
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/agent/plans/:id
app.get("/api/agent/plans/:id", (req, res) => {
  try {
    const plansFile = path.join(DATA_DIR, "agent", "plans.json");
    let plans = [];
    if (fs.existsSync(plansFile)) {
      try {
        plans = readJson(plansFile);
      } catch (_) {}
    }
    const plan = plans.find((p) => p.id === req.params.id);
    if (!plan) return fail(res, "Plan not found", 404);
    return res.json(plan);
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/tools
app.get("/api/tools", (req, res) => {
  return res.json([
    {
      id: "google-maps",
      name: "Google Maps Scraper",
      description: "Scrape contractor leads from Google Maps",
      category: "crawler",
      enabled: true,
      configurable: true,
    },
    {
      id: "yelp",
      name: "Yelp Scraper",
      description: "Scrape contractor leads from Yelp",
      category: "crawler",
      enabled: true,
      configurable: true,
    },
    {
      id: "github-actions",
      name: "GitHub Actions",
      description: "Trigger autonomous pipeline workflows",
      category: "github",
      enabled: true,
      configurable: true,
    },
    {
      id: "email-outreach",
      name: "Email Outreach",
      description: "Send personalised outreach emails via Nodemailer",
      category: "communication",
      enabled: true,
      configurable: true,
    },
    {
      id: "lead-scoring",
      name: "Lead Scoring Engine",
      description: "Score and tier leads by quality signals",
      category: "data",
      enabled: true,
      configurable: false,
    },
  ]);
});

// GET /api/stats
app.get("/api/stats", (req, res) => {
  try {
    const leads = loadLeadsFromFileCached();
    const list = Array.isArray(leads) ? leads : [];
    const scores = list.map((l) => l.score || 0).filter((s) => s > 0);
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const cityCount = {};
    list.forEach((l) => {
      if (l.city) cityCount[l.city] = (cityCount[l.city] || 0) + 1;
    });
    const topCities = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([city, count]) => ({ city, count }));

    return ok(res, {
      totalLeads: list.length,
      avgScore,
      topCities,
      withWebsite: list.filter((l) => l.website).length,
      withPhone: list.filter((l) => l.phone).length,
      withEmail: list.filter((l) => l.email).length,
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/pipeline/status
app.get("/api/pipeline/status", (req, res) => {
  try {
    const checks = [];

    const leadsFile = path.join(LEADS_DIR, "leads.json");
    const scoredFile = path.join(LEADS_DIR, "scored_leads.json");
    checks.push({ component: "raw_leads", ok: fs.existsSync(leadsFile) });
    checks.push({ component: "scored_leads", ok: fs.existsSync(scoredFile) });

    const progressFile = path.join(DATA_DIR, "scraper_progress.json");
    let lastRun = null;
    if (fs.existsSync(progressFile)) {
      try {
        const p = readJson(progressFile);
        lastRun = p.lastRun || p.timestamp || null;
      } catch (_) {}
    }

    const healthy = checks.every((c) => c.ok);
    return ok(res, {
      status: healthy ? "healthy" : "degraded",
      checks,
      lastRun,
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/pipeline/run
app.post("/api/pipeline/run", async (req, res) => {
  const token = process.env.GITHUB_TOKEN || req.headers["x-github-token"];
  if (!token) return fail(res, "GITHUB_TOKEN required", 401);

  const owner = process.env.GITHUB_OWNER || "InfinityXOneSystems";
  const repo = process.env.GITHUB_REPO || "XPS_INTELLIGENCE_SYSTEM";
  const workflow = req.body.workflow || "score_leads.yml";

  try {
    const resp = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
      { ref: req.body.ref || "main", inputs: req.body.inputs || {} },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    return ok(res, { triggered: true, workflow, status: resp.status });
  } catch (err) {
    return fail(res, err.response ? err.response.data.message : err.message);
  }
});

// GET /api/scoring/report
app.get("/api/scoring/report", (req, res) => {
  try {
    const reportFile = path.join(LEADS_DIR, "scoring_report.json");
    if (!fs.existsSync(reportFile))
      return fail(res, "Scoring report not found", 404);
    return ok(res, readJson(reportFile));
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/outreach/send
app.post("/api/outreach/send", async (req, res) => {
  const { leadId, template, campaignId } = req.body;
  if (!leadId) return fail(res, "leadId required", 400);
  try {
    const leads = loadLeadsFromFileCached();
    const list = Array.isArray(leads) ? leads : [];
    const lead = list.find(
      (l) => String(l.id) === String(leadId) || l.place_id === String(leadId),
    );
    if (!lead) return fail(res, "Lead not found", 404);
    if (!lead.email) return fail(res, "Lead has no email address", 400);

    const logDir = path.join(DATA_DIR, "outreach");
    fs.mkdirSync(logDir, { recursive: true });
    const entry = {
      leadId,
      email: lead.email,
      companyName: lead.name || lead.company_name,
      template: template || "default",
      campaignId: campaignId || null,
      queuedAt: new Date().toISOString(),
      status: "queued",
    };

    const logFile = path.join(logDir, "outreach_queue.json");
    let queue = [];
    if (fs.existsSync(logFile)) {
      try {
        queue = readJson(logFile);
      } catch (_) {}
    }
    queue.push(entry);
    fs.writeFileSync(logFile, JSON.stringify(queue, null, 2));

    return ok(res, { queued: true, entry });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/outreach/stats
app.get("/api/outreach/stats", (req, res) => {
  try {
    const logDir = path.join(DATA_DIR, "outreach");
    const queueFile = path.join(logDir, "outreach_queue.json");
    let queue = [];
    if (fs.existsSync(queueFile)) {
      try {
        queue = readJson(queueFile);
      } catch (_) {}
    }
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const last30 = queue.filter(
      (e) => new Date(e.queuedAt) >= thirtyDaysAgo,
    ).length;
    const byChannel = [{ channel: "email", count: queue.length }];
    return ok(res, {
      total_sent: queue.length,
      last_30_days: last30,
      by_channel: byChannel,
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/outreach/campaigns
app.get("/api/outreach/campaigns", (req, res) => {
  try {
    const campaignsFile = path.join(DATA_DIR, "outreach", "campaigns.json");
    let campaigns = [];
    if (fs.existsSync(campaignsFile)) {
      try {
        campaigns = readJson(campaignsFile);
      } catch (_) {}
    }
    return ok(res, { campaigns, total: campaigns.length });
  } catch (err) {
    return fail(res, err.message);
  }
});

// POST /api/outreach/campaigns
app.post("/api/outreach/campaigns", (req, res) => {
  try {
    const { name, industry, min_score, template } = req.body;
    if (!name) return fail(res, "name required", 400);

    const outreachDir = path.join(DATA_DIR, "outreach");
    fs.mkdirSync(outreachDir, { recursive: true });
    const campaignsFile = path.join(outreachDir, "campaigns.json");
    let campaigns = [];
    if (fs.existsSync(campaignsFile)) {
      try {
        campaigns = readJson(campaignsFile);
      } catch (_) {}
    }

    // Count matching leads for target_count
    const leads = loadLeadsFromFileCached();
    const list = Array.isArray(leads) ? leads : [];
    const minScore = typeof min_score === "number" ? min_score : 0;
    const industryLower = industry ? industry.toLowerCase() : null;
    const targetLeads = list.filter((l) => {
      const score = l.lead_score || l.score || 0;
      if (score < minScore) return false;
      if (
        industryLower &&
        l.industry &&
        !l.industry.toLowerCase().includes(industryLower)
      ) {
        return false;
      }
      return true;
    });

    const campaign = {
      id: generateId(),
      name,
      industry: industry || null,
      min_score: minScore,
      template: template || "default",
      target_count: targetLeads.length,
      sent_count: 0,
      status: "active",
      created_at: new Date().toISOString(),
    };

    campaigns.push(campaign);
    fs.writeFileSync(campaignsFile, JSON.stringify(campaigns, null, 2));
    return res.status(201).json(campaign);
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/monitoring/health
app.get("/api/monitoring/health", (req, res) => {
  try {
    const reportFile = path.join(DATA_DIR, "monitor", "health_reports.json");
    let latest = null;
    if (fs.existsSync(reportFile)) {
      try {
        const reports = readJson(reportFile);
        const arr = Array.isArray(reports) ? reports : [];
        latest = arr[arr.length - 1] || null;
      } catch (_) {}
    }
    return ok(res, {
      gateway: "running",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      lastHealthReport: latest,
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// GET /api/heatmap
app.get("/api/heatmap", (req, res) => {
  try {
    const leads = loadLeadsFromFileCached();
    const list = Array.isArray(leads) ? leads : [];

    const cityMap = {};
    list.forEach((l) => {
      const key = `${l.city || "Unknown"}, ${l.state || ""}`.trim();
      if (!cityMap[key])
        cityMap[key] = {
          city: l.city,
          state: l.state,
          count: 0,
          totalScore: 0,
          leads: [],
        };
      cityMap[key].count += 1;
      cityMap[key].totalScore += l.score || 0;
      if (cityMap[key].leads.length < 5)
        cityMap[key].leads.push({
          id: l.id || l.place_id,
          name: l.name || l.company_name,
        });
    });

    const heatmap = Object.values(cityMap)
      .map((c) => ({
        ...c,
        avgScore: c.count ? Math.round(c.totalScore / c.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return ok(res, {
      heatmap,
      totalCities: heatmap.length,
      totalLeads: list.length,
    });
  } catch (err) {
    return fail(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK BLOCK
//
// Three inbound webhook receivers – all at /webhooks/*
//
//  POST /webhooks/github    — GitHub events (push, workflow_run, repository_dispatch …)
//  POST /webhooks/supabase  — Supabase Database Webhooks (INSERT/UPDATE/DELETE on leads)
//  POST /webhooks/vercel    — Vercel deploy events (deployment.succeeded / .failed)
//  GET  /webhooks/info      — Machine-readable config doc (URLs + required secrets)
//
// Secrets (set in Railway env and .env.local):
//   GITHUB_WEBHOOK_SECRET    — shared secret for HMAC-SHA256 sig on X-Hub-Signature-256
//   SUPABASE_WEBHOOK_SECRET  — Supabase custom auth header value (set in Supabase → Webhooks)
//   VERCEL_WEBHOOK_SECRET    — Vercel webhook signing secret
//
// The gateway forwards processed events to the Infinity Orchestrator when it
// is running (ORCHESTRATOR_URL env).  If the orchestrator is not reachable the
// gateway handles the event itself.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require("crypto");

/** Capture raw body for HMAC verification on webhook routes */
function rawBodyMiddleware(req, res, next) {
  const chunks = [];
  req.on("data", (chunk) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    // Also parse as JSON so req.body is available on the route
    try {
      req.body = JSON.parse(req.rawBody.toString("utf8"));
    } catch (_) {
      req.body = {};
    }
    next();
  });
}

/** Verify GitHub HMAC-SHA256 signature (X-Hub-Signature-256) */
function verifyGitHubSignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // skip when no secret is configured
  const sig = req.headers["x-hub-signature-256"];
  if (!sig) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

/** Verify Supabase webhook secret (Authorization: Bearer <secret>) */
function verifySupabaseSecret(req) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) return true; // skip when not configured
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  const secretBuf = Buffer.from(secret, "utf8");
  const tokenBuf = Buffer.from(token, "utf8");
  if (tokenBuf.length !== secretBuf.length) return false;
  try {
    return crypto.timingSafeEqual(tokenBuf, secretBuf);
  } catch (_) {
    return false;
  }
}

/** Verify Vercel webhook signature (x-vercel-signature: sha1=<hex>) */
function verifyVercelSignature(req) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) return true; // skip when not configured
  const sig = req.headers["x-vercel-signature"];
  if (!sig) return false;
  const expected =
    "sha1=" +
    crypto.createHmac("sha1", secret).update(req.rawBody).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

/** Forward processed event to Infinity Orchestrator if available */
async function forwardToOrchestrator(event, payload) {
  const url = process.env.ORCHESTRATOR_URL;
  if (!url) return;
  try {
    await axios.post(
      `${url}/webhooks/infinity-orchestrator`,
      { event, payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-From": "xps-gateway",
        },
        timeout: 5000,
      },
    );
  } catch (_) {
    // Orchestrator unreachable — gateway handles event directly
  }
}

// Webhook rate limiter — 60 events per minute
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Webhook rate limit exceeded" },
});

// ── POST /webhooks/github ─────────────────────────────────────────────────────
app.post("/webhooks/github", webhookLimiter, rawBodyMiddleware, (req, res) => {
  if (!verifyGitHubSignature(req)) {
    console.warn("[Webhook] GitHub: invalid signature");
    return res.status(401).json({ error: "Invalid GitHub webhook signature" });
  }

  const event = req.headers["x-github-event"] || "unknown";
  const delivery = req.headers["x-github-delivery"] || "";
  const payload = req.body;

  console.log(`[Webhook] GitHub event: ${event} delivery: ${delivery}`);

  // Forward to orchestrator (non-blocking)
  forwardToOrchestrator(event, payload).catch(() => {});

  // Local event handling
  const action = payload.action || null;

  // Push to main/staging triggers pipeline
  if (event === "push") {
    const ref = payload.ref || "";
    const branch = ref.replace("refs/heads/", "");
    console.log(
      `[Webhook] GitHub push to ${branch} — pipeline may be triggered`,
    );
  }

  // workflow_run failure — log for monitoring
  if (
    event === "workflow_run" &&
    payload.workflow_run?.conclusion === "failure"
  ) {
    const name = payload.workflow_run.name;
    console.warn(`[Webhook] GitHub workflow failed: ${name}`);
  }

  return res.json({
    ok: true,
    event,
    action,
    delivery,
    received: new Date().toISOString(),
  });
});

// ── POST /webhooks/supabase ───────────────────────────────────────────────────
// Supabase Database Webhooks (pg_webhooks / Supabase Webhooks)
// Fires on INSERT/UPDATE/DELETE on the leads table in Supabase.
//
// Configure in Supabase Dashboard → Database → Webhooks → Create webhook:
//   Table:  leads
//   Events: INSERT, UPDATE, DELETE
//   URL:    <RAILWAY_BACKEND_URL>/webhooks/supabase
//   HTTP Headers: Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>
app.post(
  "/webhooks/supabase",
  webhookLimiter,
  rawBodyMiddleware,
  (req, res) => {
    if (!verifySupabaseSecret(req)) {
      console.warn("[Webhook] Supabase: invalid secret");
      return res.status(401).json({ error: "Invalid Supabase webhook secret" });
    }

    const payload = req.body;
    const table = payload.table || payload.schema?.name || "unknown";
    const eventType = payload.type || payload.event || "unknown";
    const record = payload.record || payload.new || null;
    const oldRecord = payload.old_record || payload.old || null;

    console.log(`[Webhook] Supabase: ${eventType} on ${table}`);

    // Handle lead changes
    if (table === "leads" || table === "public.leads") {
      if (eventType === "INSERT" && record) {
        console.log(
          `[Webhook] New lead: ${record.company_name || "unknown"} — ${record.city || ""}, ${record.state || ""}`,
        );
      }
      if (eventType === "UPDATE" && record) {
        console.log(
          `[Webhook] Updated lead: ${record.company_name || "unknown"} score=${record.lead_score || 0}`,
        );
      }
      if (eventType === "DELETE" && oldRecord) {
        console.log(
          `[Webhook] Deleted lead: ${oldRecord.company_name || "unknown"}`,
        );
      }
    }

    // Forward to orchestrator (non-blocking)
    forwardToOrchestrator(`supabase:${eventType}`, payload).catch(() => {});

    return res.json({
      ok: true,
      table,
      event: eventType,
      received: new Date().toISOString(),
    });
  },
);

// ── POST /webhooks/vercel ─────────────────────────────────────────────────────
// Vercel Deploy Webhooks — fires on deployment.succeeded, deployment.failed etc.
//
// Configure in Vercel Dashboard → Project → Settings → Git → Deploy Hooks OR
// Vercel Dashboard → Team → Settings → Webhooks:
//   URL:    <RAILWAY_BACKEND_URL>/webhooks/vercel
//   Events: deployment.succeeded, deployment.failed, deployment.cancelled
app.post("/webhooks/vercel", webhookLimiter, rawBodyMiddleware, (req, res) => {
  if (!verifyVercelSignature(req)) {
    console.warn("[Webhook] Vercel: invalid signature");
    return res.status(401).json({ error: "Invalid Vercel webhook signature" });
  }

  const payload = req.body;
  const eventType = payload.type || "unknown";
  const deployment = payload.payload?.deployment || payload.deployment || {};
  const url = deployment.url || "";
  const state = deployment.state || "";

  console.log(`[Webhook] Vercel: ${eventType} url=${url} state=${state}`);

  if (eventType === "deployment.succeeded") {
    console.log(`[Webhook] ✅ Vercel deployment succeeded: ${url}`);
  }
  if (eventType === "deployment.error" || eventType === "deployment.failed") {
    console.warn(`[Webhook] ❌ Vercel deployment failed: ${url}`);
  }

  // Forward to orchestrator (non-blocking)
  forwardToOrchestrator(eventType, payload).catch(() => {});

  return res.json({
    ok: true,
    event: eventType,
    url,
    state,
    received: new Date().toISOString(),
  });
});

// ── GET /webhooks/info ────────────────────────────────────────────────────────
// Returns the machine-readable webhook configuration for this platform.
// Use this to quickly find out which URLs to paste into GitHub / Supabase / Vercel.
app.get("/webhooks/info", (req, res) => {
  const base =
    process.env.RAILWAY_STATIC_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null) ||
    process.env.BACKEND_URL ||
    `http://localhost:${PORT}`;

  return res.json({
    platform: "XPS Intelligence",
    base_url: base,
    webhooks: {
      github: {
        url: `${base}/webhooks/github`,
        secret_env: "GITHUB_WEBHOOK_SECRET",
        content_type: "application/json",
        events: [
          "push",
          "pull_request",
          "issues",
          "issue_comment",
          "workflow_run",
          "repository_dispatch",
          "create",
          "delete",
          "check_run",
          "check_suite",
        ],
        instructions: [
          "1. Go to GitHub → InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM → Settings → Webhooks",
          "2. Click 'Add webhook'",
          `3. Payload URL: ${base}/webhooks/github`,
          "4. Content type: application/json",
          "5. Secret: value of GITHUB_WEBHOOK_SECRET env var",
          "6. Select events: push, pull_request, issues, issue_comment, workflow_run, repository_dispatch",
          "7. Repeat for XPS-INTELLIGENCE-FRONTEND and LEADS repos",
        ],
      },
      supabase: {
        url: `${base}/webhooks/supabase`,
        secret_env: "SUPABASE_WEBHOOK_SECRET",
        supabase_project: "https://nxfbfbipjsfzoefpgrof.supabase.co",
        // ── Prerequisite: run db/supabase_migration.sql first ──────────────
        // The Supabase webhook "Conditions to fire webhook" schema dropdown
        // ONLY shows schemas that contain at least one table.
        // A fresh Supabase project shows only: auth, realtime, storage, vault.
        // `public` does NOT appear until you create a table in it.
        // Solution: open the Supabase SQL Editor and run db/supabase_migration.sql
        // BEFORE configuring this webhook.
        prerequisite: {
          title: "Create the leads table in Supabase first",
          reason:
            "The webhook schema dropdown only shows `public` after at least one user table exists in it. A fresh project only shows auth/realtime/storage/vault.",
          steps: [
            "1. Open https://nxfbfbipjsfzoefpgrof.supabase.co/project/nxfbfbipjsfzoefpgrof/sql/new",
            "2. Click 'New query'",
            "3. Paste the full contents of db/supabase_migration.sql from this repo",
            "4. Click Run (Ctrl+Enter) — expect 'Success. No rows returned.'",
            "5. Now `public` will appear in the webhook schema dropdown",
          ],
          migration_file: "db/supabase_migration.sql",
        },
        // ── Exact values to fill into the Supabase Dashboard webhook form ──
        form_fields: {
          name: "xps-gateway-leads",
          description: "XPS Intelligence lead pipeline trigger",
          // ── Schema / Table (Conditions to fire webhook) ──────────────────
          // The Supabase dashboard schema dropdown lists system schemas
          // (auth, realtime, storage, vault) AND user schemas.
          // You MUST choose "public" — the schema where the leads table lives.
          // Do NOT select auth / realtime / storage / vault.
          available_schemas: [
            {
              schema: "auth",
              system: true,
              select: false,
              note: "Supabase built-in auth tables — do NOT select",
            },
            {
              schema: "realtime",
              system: true,
              select: false,
              note: "Supabase internal realtime tables — do NOT select",
            },
            {
              schema: "storage",
              system: true,
              select: false,
              note: "Supabase file storage tables — do NOT select",
            },
            {
              schema: "vault",
              system: true,
              select: false,
              note: "Supabase encrypted secrets store — do NOT select",
            },
            {
              schema: "public",
              system: false,
              select: true,
              note: "Your application tables — SELECT THIS",
            },
          ],
          schema: "public", // ← Select this in the Schema dropdown
          table: "leads", // ← Only 1 table per trigger; select "leads"
          events: ["INSERT", "UPDATE", "DELETE"],
          type: "HTTP Request",
          method: "POST",
          url: `${base}/webhooks/supabase`,
          timeout_ms: 5000,
          http_headers: [
            // Supabase pre-fills Content-Type — verify it is set to application/json
            { name: "Content-Type", value: "application/json" },
            // Custom auth header — set value to your SUPABASE_WEBHOOK_SECRET
            {
              name: "Authorization",
              value: "Bearer <SUPABASE_WEBHOOK_SECRET>",
            },
          ],
          http_parameters: [], // Leave empty — no query-string params needed
        },
        table_columns: [
          "id",
          "company_name",
          "contact_name",
          "phone",
          "email",
          "website",
          "address",
          "city",
          "state",
          "country",
          "industry",
          "category",
          "keyword",
          "linkedin",
          "rating",
          "reviews",
          "lead_score",
          "tier",
          "status",
          "source",
          "metadata",
          "date_scraped",
          "last_contacted",
          "updated_at",
        ],
        instructions: [
          "PREREQUISITE: Run db/supabase_migration.sql in Supabase SQL Editor BEFORE these steps",
          "PREREQUISITE: Without the migration, 'public' will NOT appear in the schema dropdown",
          "1. Go to https://nxfbfbipjsfzoefpgrof.supabase.co → Database → Webhooks → Create new webhook",
          "2. Name: xps-gateway-leads",
          "3. Conditions to fire webhook — Schema dropdown: select 'public' (appears only after migration)",
          "4. Table: leads  (only 1 table per trigger)",
          "5. Events: check INSERT, UPDATE, DELETE",
          "6. Type: HTTP Request  |  Method: POST",
          `7. URL: ${base}/webhooks/supabase`,
          "8. Timeout: 5000",
          "9. HTTP Headers → Content-Type header should already be 'application/json' — verify",
          "10. HTTP Headers → Add a new header: Authorization = Bearer <value of SUPABASE_WEBHOOK_SECRET>",
          "11. HTTP Parameters: leave empty — click 'Add a new parameter' is NOT needed",
          "12. Click Confirm / Save",
        ],
      },
      vercel: {
        url: `${base}/webhooks/vercel`,
        secret_env: "VERCEL_WEBHOOK_SECRET",
        frontend_project: "xps-intelligence",
        events: [
          "deployment.succeeded",
          "deployment.error",
          "deployment.cancelled",
        ],
        instructions: [
          "1. Go to Vercel Dashboard → Team Settings → Webhooks",
          "2. Click 'Add webhook'",
          `3. Endpoint URL: ${base}/webhooks/vercel`,
          "4. Events: deployment.succeeded, deployment.error, deployment.cancelled",
          "5. Secret: value of VERCEL_WEBHOOK_SECRET env var",
          "6. Vercel will sign requests with X-Vercel-Signature header",
        ],
      },
    },
    required_env_vars: {
      GITHUB_WEBHOOK_SECRET:
        "Shared secret for GitHub HMAC-SHA256 webhook signature",
      SUPABASE_WEBHOOK_SECRET:
        "Bearer token sent by Supabase in Authorization header",
      VERCEL_WEBHOOK_SECRET: "Secret for Vercel X-Vercel-Signature header",
      ORCHESTRATOR_URL:
        "URL of Infinity Orchestrator service (optional, e.g. http://localhost:3300)",
    },
    status: {
      github_secret_configured: !!process.env.GITHUB_WEBHOOK_SECRET,
      supabase_secret_configured: !!process.env.SUPABASE_WEBHOOK_SECRET,
      vercel_secret_configured: !!process.env.VERCEL_WEBHOOK_SECRET,
      orchestrator_url: process.env.ORCHESTRATOR_URL || null,
    },
  });
});

// ── /api/v1/runtime/* – Runtime command proxy ─────────────────────────────────
// Proxies runtime API calls to the FastAPI agent core when AGENT_CORE_URL is
// set; falls back to inline responses so the frontend always gets a valid reply.
//
// Frontend runtimeClient.ts calls:
//   POST /api/v1/runtime/command
//   GET  /api/v1/runtime/task/:id
//   GET  /api/v1/system/health
//   GET  /api/v1/system/metrics
//   GET  /api/v1/system/tasks
//   GET  /api/v1/system/agent-activity

/** Forward a request to the FastAPI agent core and pipe the response back. */
async function proxyToAgentCore(req, res, targetPath) {
  const agentUrl = process.env.AGENT_CORE_URL || "http://localhost:8000";
  const url = `${agentUrl}${targetPath}`;
  try {
    const fetchOpts = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }
    const upstream = await axios({
      method: req.method,
      url,
      data: fetchOpts.body ? JSON.parse(fetchOpts.body) : undefined,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    return res.status(upstream.status).json(upstream.data);
  } catch (err) {
    // Agent core not reachable — return a 503 with diagnostic info
    return res.status(503).json({
      success: false,
      error: "Agent core unavailable",
      detail: err.message,
      hint: "Set AGENT_CORE_URL to point to the FastAPI backend service.",
    });
  }
}

// POST /api/v1/runtime/command — submit a command to the runtime engine
app.post("/api/v1/runtime/command", async (req, res) => {
  const { command, target, parameters } = req.body || {};
  if (!command) return fail(res, "command is required", 400);

  // Try to forward to FastAPI agent core
  if (process.env.AGENT_CORE_URL) {
    return proxyToAgentCore(req, res, "/api/v1/runtime/command");
  }

  // Fallback: gateway-native inline task (no agent core available)
  const taskId = `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(
    `[Gateway] Runtime command queued: ${command} target=${target || "—"} task=${taskId}`,
  );
  return res.status(201).json({
    task_id: taskId,
    status: "queued",
    command,
    target: target || null,
    note: "Queued by API Gateway (agent core not configured). Set AGENT_CORE_URL to enable full runtime.",
  });
});

// GET /api/v1/runtime/task/:taskId — poll task status
app.get("/api/v1/runtime/task/:taskId", async (req, res) => {
  if (process.env.AGENT_CORE_URL) {
    return proxyToAgentCore(
      req,
      res,
      `/api/v1/runtime/task/${encodeURIComponent(req.params.taskId)}`,
    );
  }
  // Fallback: gateway-native stub
  const { taskId } = req.params;
  if (!taskId || taskId === "ping") {
    return res
      .status(404)
      .json({ success: false, error: "Task not found", task_id: taskId });
  }
  return res.json({
    task_id: taskId,
    status: "completed",
    command: "unknown",
    logs: ["Task handled by API Gateway (agent core not configured)"],
    result: null,
    note: "Set AGENT_CORE_URL to enable full runtime task tracking.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

// GET /api/v1/system/health — runtime system health
app.get("/api/v1/system/health", async (req, res) => {
  if (process.env.AGENT_CORE_URL) {
    return proxyToAgentCore(req, res, "/api/v1/system/health");
  }
  return res.json({
    status: "healthy",
    service: "XPS Intelligence API Gateway",
    uptime: process.uptime(),
    checks: [
      { name: "gateway", status: "healthy" },
      {
        name: "agent_core",
        status: process.env.AGENT_CORE_URL ? "reachable" : "not_configured",
      },
    ],
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/system/metrics — runtime metrics
app.get("/api/v1/system/metrics", async (req, res) => {
  if (process.env.AGENT_CORE_URL) {
    return proxyToAgentCore(req, res, "/api/v1/system/metrics");
  }
  const mem = process.memoryUsage();
  return res.json({
    metrics: {
      uptime_seconds: process.uptime(),
      counters: {},
      gauges: { memory_heap_mb: Math.round(mem.heapUsed / 1024 / 1024) },
    },
    worker_stats: {
      queue_size: 0,
      tasks_last_hour: 0,
      successes_last_hour: 0,
      failures_last_hour: 0,
    },
    queue_size: 0,
    circuit_breakers: {},
  });
});

// GET /api/v1/system/tasks — recent tasks list
app.get("/api/v1/system/tasks", async (req, res) => {
  if (process.env.AGENT_CORE_URL) {
    return proxyToAgentCore(req, res, "/api/v1/system/tasks");
  }
  return res.json({
    tasks: [],
    total: 0,
    note: "Set AGENT_CORE_URL for full task tracking.",
  });
});

// GET /api/v1/system/agent-activity — agent activity feed
app.get("/api/v1/system/agent-activity", async (req, res) => {
  if (process.env.AGENT_CORE_URL) {
    return proxyToAgentCore(req, res, "/api/v1/system/agent-activity");
  }
  return res.json({
    entries: [],
    total: 0,
    note: "Set AGENT_CORE_URL for live agent activity.",
  });
});

// ── Smart local reply builder (used when GROQ_API_KEY is absent) ──────────────
/**
 * Reads real lead data from disk and constructs a context-aware reply based
 * on the user's message intent — no LLM API key required.
 * Handles: lead queries, scrape requests, stats, market analysis, help.
 */
function buildSmartFallbackReply(userMessage) {
  const msg = userMessage.toLowerCase();

  // Load current lead data
  let leads = [];
  try {
    leads = loadLeadsFromFileCached();
  } catch (_) {}
  const total = leads.length;
  const hot = leads.filter(
    (l) => l.tier === "HOT" || (l.lead_score || l.score || 0) >= 75,
  ).length;
  const warm = leads.filter(
    (l) =>
      l.tier === "WARM" ||
      ((l.lead_score || l.score || 0) >= 50 &&
        (l.lead_score || l.score || 0) < 75),
  ).length;
  const cold = total - hot - warm;

  // Extract cities/states mentioned
  const stateAbbrs = (msg.match(/\b([a-z]{2})\b/g) || [])
    .map((s) => s.toUpperCase())
    .filter((s) =>
      [
        "TX",
        "FL",
        "GA",
        "IL",
        "AZ",
        "CA",
        "NY",
        "OH",
        "NC",
        "PA",
        "WA",
        "CO",
        "NV",
        "MI",
        "TN",
      ].includes(s),
    );
  const cityWords =
    msg.match(
      /\b(houston|miami|atlanta|chicago|phoenix|dallas|orlando|tampa|denver|seattle|boston|detroit|austin|nashville|charlotte)\b/gi,
    ) || [];

  // ── Intent: scrape / find / search ──────────────────────────────────────────
  if (/scrape|find|search|discover|get me|show me.*leads|fetch/.test(msg)) {
    // Build a keyword from the message
    const kwMatch = msg.match(
      /\b(epoxy|flooring|tile|hardwood|carpet|concrete|roofing|hvac|plumbing|electrical|solar|painting|siding|pool|landscaping|fence|deck)\b/i,
    );
    const kw = kwMatch ? kwMatch[0] : "flooring contractor";

    // Filter leads by keyword and location if mentioned
    let filtered = leads.filter(
      (l) =>
        (l.keyword || "").toLowerCase().includes(kw) ||
        (l.category || "").toLowerCase().includes(kw) ||
        (l.company || "").toLowerCase().includes(kw),
    );
    if (cityWords.length > 0) {
      filtered = filtered.filter((l) =>
        cityWords.some((c) =>
          (l.city || "").toLowerCase().includes(c.toLowerCase()),
        ),
      );
    }
    if (stateAbbrs.length > 0) {
      filtered = filtered.filter((l) =>
        stateAbbrs.includes((l.state || "").toUpperCase()),
      );
    }
    filtered.sort(
      (a, b) => (b.lead_score || b.score || 0) - (a.lead_score || a.score || 0),
    );
    const top = filtered.slice(0, 10);

    if (top.length === 0) {
      return (
        `🔍 **Searching for ${kw} contractors${cityWords.length ? " in " + cityWords.join(", ") : ""}...**\n\n` +
        `No matching leads found in the current dataset for that combination.\n\n` +
        `**To scrape fresh leads, trigger the workflow:**\n` +
        `\`\`\`\nnpm run scrape -- --keywords "${kw} contractor" --locations "${cityWords[0] || "Houston, TX"}"\n\`\`\`\n\n` +
        `Or go to GitHub → Actions → 🕷️ Universal Shadow Scraper → Run workflow.`
      );
    }

    const locationLabel =
      cityWords.length > 0
        ? cityWords.join(", ")
        : stateAbbrs.length > 0
          ? stateAbbrs.join(", ")
          : "nationwide";
    let reply = `✅ **Found ${top.length} ${kw} contractors in ${locationLabel}** (from ${total.toLocaleString()} total leads)\n\n`;
    reply += `| # | Company | Phone | City, State | Score |\n`;
    reply += `|---|---------|-------|-------------|-------|\n`;
    top.forEach((l, i) => {
      const co = (l.company || l.company_name || "?").slice(0, 40);
      const ph = l.phone || "—";
      const loc = `${l.city || ""}, ${l.state || ""}`
        .trim()
        .replace(/^,|,$/, "");
      const sc = l.lead_score || l.score || 0;
      reply += `| ${i + 1} | ${co} | ${ph} | ${loc} | ${sc} |\n`;
    });
    reply += `\n**Tier breakdown:** 🔥 HOT: ${hot} · 🌡 WARM: ${warm} · 🧊 COLD: ${cold}\n`;
    reply += `\n_Source: YellowPages, SuperPages, Google Maps, Bing Maps, Playwright headless — no API keys used._`;
    return reply;
  }

  // ── Intent: stats / summary / dashboard ─────────────────────────────────────
  if (
    /how many|count|total|stats|summary|dashboard|report|overview|status/.test(
      msg,
    )
  ) {
    const sources = {};
    leads.forEach((l) => {
      const s = l.source || "unknown";
      sources[s] = (sources[s] || 0) + 1;
    });
    const topSources = Object.entries(sources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s, c]) => `${s}: ${c}`)
      .join(" · ");

    const cities = {};
    leads.forEach((l) => {
      if (l.city) cities[l.city] = (cities[l.city] || 0) + 1;
    });
    const topCities = Object.entries(cities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${c} (${n})`)
      .join(", ");

    return (
      `📊 **XPS Intelligence Lead Database — Live Status**\n\n` +
      `| Metric | Value |\n|--------|-------|\n` +
      `| Total Leads | **${total.toLocaleString()}** |\n` +
      `| 🔥 HOT (score ≥ 75) | **${hot}** |\n` +
      `| 🌡 WARM (score 50–74) | **${warm}** |\n` +
      `| 🧊 COLD (score < 50) | **${cold}** |\n\n` +
      `**Top sources:** ${topSources}\n\n` +
      `**Top cities:** ${topCities}\n\n` +
      `**Pipeline:** Universal Shadow Scraper → Score → Validate → Publish\n` +
      `**Scrape schedule:** Twice daily (03:00 + 15:00 UTC)\n` +
      `_All leads scraped from public web — YellowPages, Yelp, BBB, Manta, SuperPages, DuckDuckGo, Google Maps, Bing Maps — no API keys._`
    );
  }

  // ── Intent: market analysis ──────────────────────────────────────────────────
  if (/market|best|top|hottest|analysis|opportunity|where should/.test(msg)) {
    const stateCounts = {};
    leads.forEach((l) => {
      if (l.state) stateCounts[l.state] = (stateCounts[l.state] || 0) + 1;
    });
    const topStates = Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([s, n]) => `**${s}** (${n} leads)`)
      .join(", ");
    const hotLeads = leads
      .filter((l) => (l.lead_score || l.score || 0) >= 75)
      .slice(0, 5);

    let reply =
      `📈 **Top Market Opportunities — XPS Intelligence Analysis**\n\n` +
      `**Highest lead volume by state:** ${topStates}\n\n` +
      `**Top 5 HOT leads right now:**\n`;
    hotLeads.forEach((l, i) => {
      reply += `${i + 1}. **${l.company || l.company_name}** — ${l.city}, ${l.state} | ${l.phone || "no phone"} | Score: ${l.lead_score || l.score}\n`;
    });
    reply += `\n_Score ≥ 75 = HOT: has phone + website + industry match. Ready for outreach._`;
    return reply;
  }

  // ── Intent: help / what can you do ──────────────────────────────────────────
  if (/help|what can|capabilities|features|what do|how do|explain/.test(msg)) {
    return (
      `⚡ **XPS Intelligence — Capabilities**\n\n` +
      `I'm your autonomous lead generation and business intelligence agent. Here's what I can do:\n\n` +
      `**🕷️ Scraping (no API keys)**\n` +
      `- Find any business type in any US city/state\n` +
      `- Sources: YellowPages, Yelp, BBB, Manta, SuperPages, DuckDuckGo, Google Maps, Bing Maps\n` +
      `- Playwright headless browser for JS-rendered pages\n\n` +
      `**📋 Lead Management (${total.toLocaleString()} leads now)**\n` +
      `- Filter by city, state, industry, score\n` +
      `- HOT/WARM/COLD tiers based on 9-factor scoring\n` +
      `- Export to CSV, push to Supabase + LEADS repo\n\n` +
      `**📈 Analysis**\n` +
      `- Market opportunity by region\n` +
      `- Lead quality breakdown\n` +
      `- Pipeline status and metrics\n\n` +
      `**Try asking:**\n` +
      `- "Find epoxy contractors in Houston TX"\n` +
      `- "Show me HOT leads in Florida"\n` +
      `- "How many leads do we have?"\n` +
      `- "What are the best markets right now?"`
    );
  }

  // ── Default: show lead summary ───────────────────────────────────────────────
  const topLeads = [...leads]
    .sort(
      (a, b) => (b.lead_score || b.score || 0) - (a.lead_score || a.score || 0),
    )
    .slice(0, 5);
  let reply = `⚡ **XPS Intelligence** — ${total.toLocaleString()} leads in database\n\n`;
  reply += `**Quick stats:** 🔥 ${hot} HOT · 🌡 ${warm} WARM · 🧊 ${cold} COLD\n\n`;
  if (topLeads.length) {
    reply += `**Top 5 leads right now:**\n`;
    topLeads.forEach((l, i) => {
      reply += `${i + 1}. **${l.company || l.company_name}** — ${l.city}, ${l.state} | Score: ${l.lead_score || l.score || 0}\n`;
    });
    reply += "\n";
  }
  reply += `Ask me to **find leads**, show **stats**, analyze **markets**, or explain **capabilities**.`;
  return reply;
}

// ── /api/v1/chat – LLM Chat Endpoint (Groq) ──────────────────────────────────
// POST /api/v1/chat
//   Body: { message: string, history?: [{role, content}], system?: string }
//   Response: { reply: string, model: string, usage?: {...} }
//
// Uses GROQ_API_KEY env var.  Falls back to a canned response when the key
// is absent so the frontend always gets a well-formed reply.
app.post("/api/v1/chat", async (req, res) => {
  const { message, history = [], system } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "message is required" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
  const GROQ_MODEL = process.env.GROQ_MODEL || "llama3-8b-8192";
  const GROQ_API_BASE = "https://api.groq.com/openai/v1";

  // Build a live-context system prompt with real lead stats
  let liveLeads = [];
  try {
    liveLeads = loadLeadsFromFileCached();
  } catch (_) {}
  const liveTotal = liveLeads.length;
  const liveHot = liveLeads.filter(
    (l) => (l.lead_score || l.score || 0) >= 75,
  ).length;
  const liveWarm = liveLeads.filter((l) => {
    const s = l.lead_score || l.score || 0;
    return s >= 50 && s < 75;
  }).length;

  const systemPrompt =
    system ||
    "You are XPS Intelligence AI — an autonomous lead generation and business intelligence assistant. " +
      `LIVE DATABASE STATUS: ${liveTotal.toLocaleString()} leads total (🔥 ${liveHot} HOT, 🌡 ${liveWarm} WARM). ` +
      "Sources: YellowPages, SuperPages, Yelp, BBB, Manta, DuckDuckGo, Google Maps HTML, Bing Maps, Playwright headless — NO API KEYS required. " +
      "You can find contractors, analyze markets, run audits, and manage outreach. " +
      "Be concise, data-driven, and action-oriented. Return markdown tables for lead lists. " +
      "When users ask to scrape: confirm you are triggering the universal shadow scraper and describe expected results.";

  const messages = [
    { role: "system", content: systemPrompt },
    ...(Array.isArray(history) ? history.slice(-20) : []),
    { role: "user", content: message.trim() },
  ];

  if (!GROQ_API_KEY) {
    // Smart fallback: read real lead data and return context-aware response
    const reply = buildSmartFallbackReply(message.trim());
    return res.json({ reply, model: "xps-local", usage: null });
  }

  try {
    const payload = JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const groqRes = await axios.post(
      `${GROQ_API_BASE}/chat/completions`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      },
    );

    const choice = groqRes.data?.choices?.[0];
    const reply = choice?.message?.content || "(no response)";
    const usage = groqRes.data?.usage || null;
    return res.json({ reply, model: GROQ_MODEL, usage });
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.message;
    console.error("[Chat] Groq API error:", status, detail);

    // Return a structured error so the frontend can display it gracefully
    return res.status(502).json({
      success: false,
      error: `LLM error: ${detail}`,
      reply: `I encountered an error communicating with the AI service: ${detail}. Please try again.`,
    });
  }
});

// GET /health  – top-level health check (no auth; used by Railway, Vercel, and monitoring)
app.get("/health", (req, res) => {
  return res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// GET /api/health  – Railway-compatible health check (used by railway.json healthcheckPath)
app.get("/api/health", (req, res) => {
  return res.json({
    status: "ok",
    service: "XPS Intelligence API Gateway",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// GET /api  – root health check (used by frontend to verify connectivity)
app.get("/api", (req, res) => {
  return res.json({
    success: true,
    service: "XPS Intelligence API Gateway",
    version: "2.0.0",
    status: "running",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/status  – alias for health check (some UIs expect this path)
app.get("/api/status", (req, res) => {
  const leads = loadLeadsFromFileCached();
  const list = Array.isArray(leads) ? leads : [];
  return res.json({
    success: true,
    service: "XPS Intelligence Backend",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    gateway: "running",
    uptime: process.uptime(),
    leads_available: list.length,
    timestamp: new Date().toISOString(),
  });
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
});

function start() {
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`[API Gateway] Running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

module.exports = { app, start };

if (require.main === module) {
  start().catch((err) => {
    console.error("[API Gateway] Failed to start:", err.message);
    process.exit(1);
  });
}
