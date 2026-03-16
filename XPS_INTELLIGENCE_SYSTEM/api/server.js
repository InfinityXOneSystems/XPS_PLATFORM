"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Allowed agent roles — validated before interpolation into the system prompt
// to prevent prompt injection attacks.
const ALLOWED_AGENT_ROLES = new Set([
  "GeneralAgent",
  "PlannerAgent",
  "ScraperAgent",
  "EnrichmentAgent",
  "ValidatorAgent",
  "OutreachAgent",
]);
const MAX_CHAT_HISTORY_LENGTH = 20;

// In-memory chat history store keyed by sessionId
const chatHistories = new Map();

// ---------------------------------------------------------------------------
// Real lead data — sourced from the shadow scraper pipeline
// ---------------------------------------------------------------------------

// Ordered list of candidate paths for the scored/normalized leads file.
// The pipeline (scoring_pipeline.js + normalize_leads.js) writes to these
// locations after each scrape cycle.  We pick the first that exists.
const ROOT = path.resolve(__dirname, "..");
const LEAD_FILE_CANDIDATES = [
  path.join(ROOT, "leads", "scored_leads.json"),
  path.join(ROOT, "pages", "data", "scored_leads.json"),
  path.join(ROOT, "data", "leads", "scored_leads.json"),
  path.join(ROOT, "leads", "leads.json"),
  path.join(ROOT, "data", "leads", "leads.json"),
];

// Simple TTL cache so we re-read from disk at most once per minute.
let _leadsCache = null;
let _leadsCacheAt = 0;
const LEADS_CACHE_TTL_MS = 60_000;

/**
 * Normalise a raw lead record to the canonical API schema expected by
 * the frontend.  Includes both the legacy fields (score, tier, industry)
 * AND the fields the XPS-INTELLIGENCE-FRONTEND Lead type requires
 * (opportunityScore, rating, status as LeadStatus, category, createdAt).
 */
function normaliseLead(l, index) {
  const score = Number(l.lead_score ?? l.score ?? 0) || 0;
  const tier = (
    l.tier || (score >= 75 ? "hot" : score >= 50 ? "warm" : "cold")
  ).toLowerCase();
  const city = (l.city || "").trim();
  const state = (l.state || "").trim();
  const location = city && state ? `${city}, ${state}` : city || state || "";

  let website = (l.website || "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    website = "https://" + website;
  }

  // Frontend LeadRating: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'
  const rating =
    score >= 85
      ? "A+"
      : score >= 70
        ? "A"
        : score >= 55
          ? "B+"
          : score >= 40
            ? "B"
            : score >= 25
              ? "C"
              : "D";

  // Frontend LeadStatus: 'new' | 'contacted' | 'qualified' | 'proposal' | 'signed' | 'lost'
  const leadStatus = (() => {
    const s = (l.status || "").toLowerCase();
    if (["contacted", "qualified", "proposal", "signed", "lost"].includes(s))
      return s;
    return "new";
  })();

  const createdAt =
    l.date_scraped ||
    l.scrapedAt ||
    l.scraped_at ||
    l.date ||
    l.createdAt ||
    new Date().toISOString();

  return {
    // Legacy / pipeline fields
    id: l.id || index + 1,
    company: (l.company || l.company_name || "Unknown").trim(),
    email: (l.email || "").trim(),
    phone: (l.phone || "").trim(),
    website,
    address: (l.address || "").trim(),
    city,
    state,
    country: l.country || "US",
    location,
    industry: (l.industry || l.category || "General Contractor").trim(),
    rawRating: Number(l.rating) || 0,
    reviews: Number(l.reviews) || 0,
    score,
    lead_score: score,
    tier,
    source: l.source || "shadow_scraper",
    date_scraped: createdAt,
    // Frontend Lead type fields (XPS-INTELLIGENCE-FRONTEND)
    rating,
    opportunityScore: score,
    status: leadStatus,
    category: (l.industry || l.category || "General Contractor").trim(),
    createdAt,
    isNew: leadStatus === "new",
    notes: l.notes || "",
  };
}

/**
 * Attempt to load leads from Supabase via the REST API.
 * Returns an array of normalised lead objects on success, or null on failure.
 */
async function loadLeadsFromSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  try {
    const https = require("https");
    const url = new URL(
      "/rest/v1/leads?select=*&order=lead_score.desc&limit=1000",
      supabaseUrl,
    );
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      };
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", reject);
      req.setTimeout(10_000, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    });

    if (!Array.isArray(data) || data.length === 0) return null;
    console.log(`[leads] Loaded ${data.length} leads from Supabase`);
    return data.map(normaliseLead);
  } catch (err) {
    console.warn("[leads] Supabase fetch failed:", err.message);
    return null;
  }
}

/**
 * Load leads from the local file system (pipeline output).
 */
function loadLeadsFromDisk() {
  for (const candidate of LEAD_FILE_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length > 0) {
          console.log(`[leads] Loaded ${arr.length} leads from ${candidate}`);
          return arr.map(normaliseLead);
        }
      } catch (err) {
        console.warn(`[leads] Failed to parse ${candidate}:`, err.message);
      }
    }
  }
  console.warn("[leads] No lead file found — returning empty array");
  return [];
}

/**
 * Return a cached or freshly loaded leads array.
 * Tries Supabase first; falls back to the local scored_leads.json.
 */
async function getLeads() {
  const now = Date.now();
  if (_leadsCache && now - _leadsCacheAt < LEADS_CACHE_TTL_MS) {
    return _leadsCache;
  }

  let leads = await loadLeadsFromSupabase();
  if (!leads) {
    leads = loadLeadsFromDisk();
  }

  _leadsCache = leads;
  _leadsCacheAt = now;
  return leads;
}

// ---------------------------------------------------------------------------
// Static agent data
// ---------------------------------------------------------------------------

const AGENTS = [
  {
    role: "PlannerAgent",
    status: "idle",
    tasksCompleted: 42,
    successRate: 0.95,
    lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    role: "ScraperAgent",
    status: "running",
    tasksCompleted: 156,
    successRate: 0.92,
    lastActivity: new Date(Date.now() - 30 * 1000).toISOString(),
  },
  {
    role: "EnrichmentAgent",
    status: "idle",
    tasksCompleted: 89,
    successRate: 0.98,
    lastActivity: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    role: "ValidatorAgent",
    status: "idle",
    tasksCompleted: 203,
    successRate: 0.94,
    lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId() {
  return crypto.randomBytes(9).toString("base64url").slice(0, 11);
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();

app.use(
  cors({
    origin: [
      // Production frontends
      "https://xps-intelligence-frontend.vercel.app",
      "https://xps-intelligence.vercel.app",
      "https://infinityxonesystems.github.io",
      // Any Vercel preview deployment for this org
      /^https:\/\/xps-intelligence.*\.vercel\.app$/,
      /^https:\/\/.*infinityxone.*\.vercel\.app$/,
      /\.vercel\.app$/,
      /\.railway\.app$/,
      // Local development
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  }),
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/health
 * Health check — no auth required; used by Railway healthcheckPath
 */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    backend: "XPS Intelligence API",
    version: "1.0.0",
    groq: GROQ_API_KEY ? "configured" : "not configured",
    dataSource: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "local",
  });
});

/**
 * GET /health
 * Top-level alias (some load balancers probe the root path)
 */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /api/chat/send
 * Groq-powered chat endpoint
 * Body: { message, agentRole?, sessionId? }
 */
app.post("/api/chat/send", async (req, res) => {
  const {
    message,
    agentRole = "GeneralAgent",
    sessionId = generateId(),
  } = req.body || {};

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "message is required" });
  }

  // Validate agentRole against the allowed set to prevent prompt injection.
  const safeRole = ALLOWED_AGENT_ROLES.has(agentRole)
    ? agentRole
    : "GeneralAgent";

  if (!GROQ_API_KEY) {
    return res.status(503).json({
      error: "GROQ_API_KEY is not configured on the server",
    });
  }

  try {
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const systemPrompt = `You are an XPS Intelligence AI Agent operating in the role of ${safeRole}. \
You specialise in contractor lead generation for the flooring and construction industries. \
Provide concise, actionable insights.`;

    // Build message history for context
    const history = chatHistories.get(sessionId) || [];
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message.trim() },
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const assistantContent =
      completion.choices[0]?.message?.content || "No response generated.";

    // Persist both turns in history
    const updatedHistory = [
      ...history,
      {
        role: "user",
        content: message.trim(),
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: assistantContent,
        timestamp: new Date().toISOString(),
      },
    ].slice(-MAX_CHAT_HISTORY_LENGTH);
    chatHistories.set(sessionId, updatedHistory);

    const replyId = generateId();
    return res.status(200).json({
      id: replyId,
      reply: {
        id: generateId(),
        role: "assistant",
        content: assistantContent,
        agentRole: safeRole,
        timestamp: new Date().toISOString(),
        status: "sent",
      },
      agentRole: safeRole,
      sessionId,
    });
  } catch (err) {
    console.error("[chat/send] Error:", err.message || err);
    // Only expose error details in non-production environments.
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      error: "Chat request failed",
      ...(isDev && { details: err.message || "Unknown error" }),
    });
  }
});

/**
 * GET /api/leads
 * Returns real contractor leads from the shadow scraper pipeline.
 * Query params: tier (hot|warm|cold), industry, state, limit, offset
 */
app.get("/api/leads", async (req, res) => {
  try {
    let leads = await getLeads();

    // Optional filters
    const { tier, industry, state, limit, offset } = req.query;
    if (tier) {
      const t = tier.toLowerCase();
      leads = leads.filter((l) => l.tier === t);
    }
    if (industry) {
      const i = industry.toLowerCase();
      leads = leads.filter((l) => (l.industry || "").toLowerCase().includes(i));
    }
    if (state) {
      const s = state.toUpperCase();
      leads = leads.filter((l) => (l.state || "").toUpperCase() === s);
    }

    const total = leads.length;
    const off = parseInt(offset, 10) || 0;
    const lim = parseInt(limit, 10) || total;
    const page = leads.slice(off, off + lim);

    return res.status(200).json({
      leads: page,
      total,
      offset: off,
      limit: lim,
      timestamp: new Date().toISOString(),
      source: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "supabase"
        : "shadow_scraper",
    });
  } catch (err) {
    console.error("[leads] Error:", err.message);
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      error: "Failed to load leads",
      ...(isDev && { details: err.message }),
    });
  }
});

/**
 * GET /api/leads/metrics
 * Returns dashboard metrics computed from real pipeline data.
 */
app.get("/api/leads/metrics", async (_req, res) => {
  try {
    const leads = await getLeads();
    const hot = leads.filter((l) => l.tier === "hot").length;
    const warm = leads.filter((l) => l.tier === "warm").length;
    const cold = leads.filter((l) => l.tier === "cold").length;
    const withEmail = leads.filter((l) => l.email).length;
    const withWebsite = leads.filter((l) => l.website).length;
    const avgScore =
      leads.length > 0
        ? Math.round(
            leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length,
          )
        : 0;

    // A+ opportunities = top-tier scored leads (score >= 85)
    const aPlusCount = leads.filter((l) => (l.score || 0) >= 85).length;

    return res.status(200).json({
      totalLeads: leads.length,
      hotLeads: hot,
      warmLeads: warm,
      coldLeads: cold,
      aPlusOpportunities: aPlusCount,
      emailsSent: 0,
      responseRate: 0,
      revenuePipeline: aPlusCount * 5000,
      leadsWithEmail: withEmail,
      leadsWithWebsite: withWebsite,
      averageScore: avgScore,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[leads/metrics] Error:", err.message);
    return res.status(500).json({ error: "Failed to compute metrics" });
  }
});

/**
 * GET /api/leads/:id
 * Returns a single lead by ID.
 */
app.get("/api/leads/:id", async (req, res) => {
  try {
    const leads = await getLeads();
    const id = String(req.params.id);
    const lead = leads.find((l) => String(l.id) === id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    return res.status(200).json(lead);
  } catch (err) {
    console.error("[leads/:id] Error:", err.message);
    return res.status(500).json({ error: "Failed to load lead" });
  }
});

/**
 * GET /api/contractors/list
 * Returns leads in the Contractor schema expected by ContractorsPage / useContractors.
 * Query params: status, category, city, state, search, page, limit
 */
app.get("/api/contractors/list", async (req, res) => {
  try {
    let leads = await getLeads();
    const { status, category, city, state, search, page, limit } = req.query;

    // Map tier → CRM status for contractors with no explicit status
    const tierToStatus = { hot: "qualified", warm: "contacted", cold: "new" };

    if (category) {
      const c = category.toLowerCase();
      leads = leads.filter((l) =>
        (l.industry || l.category || "").toLowerCase().includes(c),
      );
    }
    if (city) {
      const ci = city.toLowerCase();
      leads = leads.filter((l) => (l.city || "").toLowerCase().includes(ci));
    }
    if (state) {
      const s = state.toUpperCase();
      leads = leads.filter((l) => (l.state || "").toUpperCase() === s);
    }
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(
        (l) =>
          (l.company || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q),
      );
    }

    const contractors = leads.map((l) => ({
      id: String(l.id),
      name: l.contact || l.company,
      company: l.company,
      email: l.email || "",
      phone: l.phone || "",
      website: l.website || "",
      city: l.city || "",
      state: l.state || "",
      category: l.industry || l.category || "contractor",
      status: status || tierToStatus[l.tier] || "new",
      score: l.score || l.lead_score || 0,
      source: l.source || "shadow_scraper",
      notes: "",
      createdAt: l.date_scraped || new Date().toISOString(),
      updatedAt: l.date_scraped || new Date().toISOString(),
    }));

    if (status && status !== "all") {
      const s = status.toLowerCase();
      contractors.splice(
        0,
        contractors.length,
        ...contractors.filter((c) => c.status === s),
      );
    }

    const total = contractors.length;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const off = (pg - 1) * lim;
    const pages = Math.ceil(total / lim);

    return res.status(200).json({
      contractors: contractors.slice(off, off + lim),
      total,
      page: pg,
      pages,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[contractors/list] Error:", err.message);
    return res.status(500).json({ error: "Failed to load contractors" });
  }
});

/**
 * POST /api/contractors/create
 * Accepts a new contractor (no-op persistence in memory for now, returns created record).
 */
app.post("/api/contractors/create", express.json(), (req, res) => {
  const body = req.body || {};
  const newContractor = {
    id: crypto.randomBytes(6).toString("hex"),
    ...body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return res.status(201).json(newContractor);
});

/**
 * GET /api/scraper/logs
 * Returns scraper activity log (pipeline log if available, else synthetic entries).
 */
app.get("/api/scraper/logs", (_req, res) => {
  const logPath = path.join(ROOT, "leads", "pipeline_log.json");
  let logs = [];
  if (fs.existsSync(logPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logPath, "utf8"));
    } catch (_) {}
  }
  if (logs.length === 0) {
    logs = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        status: "completed",
        message: "Shadow scraper pipeline completed successfully",
      },
    ];
  }
  return res.status(200).json(logs);
});

/**
 * GET /api/agents
 * Returns agent status data
 */
app.get("/api/agents", (_req, res) => {
  const agents = AGENTS.map((a) => ({
    ...a,
    lastActivity:
      a.status === "running" ? new Date().toISOString() : a.lastActivity,
  }));
  res.status(200).json({
    agents,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/chat/history?sessionId=<id>
 * Returns chat history for a session
 */
app.get("/api/chat/history", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res
      .status(400)
      .json({ error: "sessionId query parameter is required" });
  }
  const history = chatHistories.get(sessionId) || [];
  res.status(200).json({
    sessionId,
    messages: history,
    count: history.length,
    timestamp: new Date().toISOString(),
  });
});

/**
 * DELETE /api/chat/history?sessionId=<id>
 * Clears chat history for a session
 */
app.delete("/api/chat/history", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res
      .status(400)
      .json({ error: "sessionId query parameter is required" });
  }
  const existed = chatHistories.has(sessionId);
  chatHistories.delete(sessionId);
  res.status(200).json({
    success: true,
    sessionId,
    cleared: existed,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested endpoint does not exist",
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message || "An unexpected error occurred",
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[XPS Intelligence API] Listening on port ${PORT}`);
  console.log(
    `[XPS Intelligence API] Groq: ${GROQ_API_KEY ? "configured" : "NOT configured — set GROQ_API_KEY"}`,
  );
  // Warm the leads cache on startup
  getLeads()
    .then((leads) => {
      console.log(
        `[XPS Intelligence API] Lead cache primed: ${leads.length} leads`,
      );
    })
    .catch((err) => {
      console.warn(
        "[XPS Intelligence API] Lead cache prime failed:",
        err.message,
      );
    });
});

module.exports = app;
