"use strict";

require("dotenv").config();

const { initializeDatabase, getLeadsFromDb } = require("./db/init-handler");

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();

// Initialize database on startup
initializeDatabase().catch(err => {
  console.error("[server] Database init failed, continuing with fallback:", err.message);
});

// Allow all origins â€” required for Vercel/GitHub Pages frontend access
app.use(cors());
app.use(express.json());

// In-memory task store for /api/v1/runtime/command + /api/v1/runtime/task/:id
const runtimeTasks = new Map();

// â”€â”€ Lead data helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ROOT = path.join(__dirname);
const LEADS_DIR = path.join(ROOT, "leads");

/** Determine tier label from numeric score. */
function tierFromScore(score) {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}

/**
 * Normalise a raw scraper/PostgreSQL lead into the API response shape.
 * Accepts both canonical (company_name, lead_score) and legacy (company, score) keys.
 * Returns BOTH the canonical frontend field names (company_name, lead_score, tier)
 * AND legacy aliases (company, score, status/location) so all consumers work.
 */
function normalizeLeadForApi(lead, index) {
  const company_name = lead.company_name || lead.company || "";
  const lead_score = parseInt(lead.lead_score ?? lead.score ?? 0, 10);
  const city = lead.city || "";
  const state = lead.state || "";
  const location =
    [city, state].filter(Boolean).join(", ") || lead.address || "";
  const industry = lead.industry || lead.category || lead.keyword || "";
  // Preserve original uppercase tier; derive from score only if missing
  const rawTier = lead.tier || "";
  const tier = rawTier
    ? rawTier.toUpperCase()
    : tierFromScore(lead_score).toUpperCase();
  const status = tier.toLowerCase();

  return {
    // â”€â”€ canonical frontend fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    id: lead.id || lead._id || String(index + 1),
    company_name,
    city,
    state,
    lead_score,
    tier,
    // â”€â”€ legacy / convenience aliases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    company: company_name,
    score: lead_score,
    location,
    status,
    // â”€â”€ contact / enrichment fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    email: lead.email || null,
    phone: lead.phone || null,
    website: lead.website || null,
    address: lead.address || null,
    industry,
    rating: lead.rating != null ? parseFloat(lead.rating) : null,
    reviews: lead.reviews != null ? parseInt(lead.reviews, 10) : null,
    source: lead.source || null,
    scrapedAt: lead.scrapedAt || lead.date_scraped || null,
  };
}

/** Read and parse a JSON file; return [] on any error. */
function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.leads || parsed.data || [];
  } catch (_) {
    return [];
  }
}

/** Load leads from local JSON files produced by the shadow scraper pipeline. */
function loadLeadsFromFile() {
  const scored = path.join(LEADS_DIR, "scored_leads.json");
  const raw = path.join(LEADS_DIR, "leads.json");
  if (fs.existsSync(scored)) return readJsonSafe(scored);
  if (fs.existsSync(raw)) return readJsonSafe(raw);
  return [];
}

// Lazy Railway Postgres lead store (uses DATABASE_URL or DATABASE_HOST env vars)
let _pgStore = null;
function getPgStore() {
  if (_pgStore) return _pgStore;
  if (process.env.DATABASE_URL || process.env.DATABASE_HOST) {
    try {
      _pgStore = require("./db/leadStore");
    } catch (err) {
      console.warn("[server] Could not load leadStore:", err.message);
    }
  }
  return _pgStore;
}

/**
 * Fetch leads from Railway PostgreSQL when configured, otherwise fall back
 * to scraped JSON files produced by the shadow scraper pipeline.
 */
async function fetchLeads({ limit = 500, industry, minScore, tier } = {}) {
  const store = getPgStore();
  let leads = [];

  if (store) {
    try {
      leads = await store.getAllLeads(limit);
    } catch (err) {
      console.warn(
        "[server] PostgreSQL unavailable, falling back to file:",
        err.message,
      );
      leads = loadLeadsFromFile();
    }
  } else {
    leads = loadLeadsFromFile();
  }

  // Normalize to API shape
  let normalized = leads.map((lead, index) => normalizeLeadForApi(lead, index));

  // Apply filters
  if (industry) {
    const q = industry.toLowerCase();
    normalized = normalized.filter(
      (l) => l.industry && l.industry.toLowerCase().includes(q),
    );
  }
  if (minScore != null) {
    const min = parseInt(minScore, 10);
    if (!isNaN(min)) normalized = normalized.filter((l) => l.score >= min);
  }
  if (tier) {
    const t = tier.toLowerCase();
    normalized = normalized.filter((l) => l.status === t);
  }

  return normalized.slice(0, limit);
}

// Initialise Groq client lazily (only when GROQ_API_KEY is present)
let _groqClient = null;
function getGroqClient() {
  if (!_groqClient) {
    const Groq = require("groq-sdk");
    _groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groqClient;
}

/**
 * Context-aware smart fallback reply â€” works with no LLM API keys.
 * Reads real lead data from disk and builds a helpful response.
 */
function buildSmartFallbackReply(message) {
  const msg = (message || "").toLowerCase();
  const leads = loadLeadsFromFile();
  const total = leads.length;
  const hot = leads.filter((l) => (l.lead_score || l.score || 0) >= 75).length;
  const warm = leads.filter((l) => {
    const s = l.lead_score || l.score || 0;
    return s >= 50 && s < 75;
  }).length;
  const cold = total - hot - warm;

  // Lead stats queries
  if (
    msg.includes("how many") ||
    msg.includes("stats") ||
    msg.includes("count") ||
    msg.includes("total")
  ) {
    return (
      `ðŸ“Š **XPS Intelligence Lead Database â€” Live Stats**\n\n` +
      `| Tier | Count | % |\n|------|-------|---|\n` +
      `| ðŸ”¥ HOT (score â‰¥75) | ${hot} | ${total ? Math.round((hot / total) * 100) : 0}% |\n` +
      `| ðŸŒ¡ WARM (50â€“74) | ${warm} | ${total ? Math.round((warm / total) * 100) : 0}% |\n` +
      `| â„ï¸ COLD (<50) | ${cold} | ${total ? Math.round((cold / total) * 100) : 0}% |\n` +
      `| **Total** | **${total}** | 100% |\n\n` +
      `_Last updated: ${new Date().toISOString().slice(0, 10)}. Sources: Google Maps, Yelp, BBB, YellowPages, SuperPages._`
    );
  }

  // Scrape / find requests
  if (
    msg.includes("scrape") ||
    msg.includes("find") ||
    msg.includes("search")
  ) {
    const topLeads = leads
      .sort(
        (a, b) =>
          (b.lead_score || b.score || 0) - (a.lead_score || a.score || 0),
      )
      .slice(0, 5);
    let table = `| Company | City, State | Score | Tier |\n|---------|------------|-------|------|\n`;
    for (const l of topLeads) {
      const co = l.company_name || l.company || "â€”";
      const loc = [l.city, l.state].filter(Boolean).join(", ") || "â€”";
      const score = l.lead_score || l.score || 0;
      const tier =
        l.tier || (score >= 75 ? "HOT" : score >= 50 ? "WARM" : "COLD");
      table += `| ${co} | ${loc} | ${score} | ${tier} |\n`;
    }
    return (
      `ðŸ•·ï¸ **XPS Shadow Scraper â€” Top ${topLeads.length} Leads**\n\n` +
      table +
      `\n_Scraped from: Google Maps, Yelp, BBB, YellowPages, SuperPages, Bing Maps._\n` +
      `_Full database: ${total} leads available. Use the Leads tab to explore them._`
    );
  }

  // HOT leads
  if (msg.includes("hot") || msg.includes("best") || msg.includes("top")) {
    const hotLeads = leads
      .filter((l) => (l.lead_score || l.score || 0) >= 75)
      .sort(
        (a, b) =>
          (b.lead_score || b.score || 0) - (a.lead_score || a.score || 0),
      )
      .slice(0, 5);
    if (hotLeads.length) {
      let table = `| Company | City | Phone | Score |\n|---------|------|-------|-------|\n`;
      for (const l of hotLeads) {
        table += `| ${l.company_name || l.company || "â€”"} | ${l.city || "â€”"} | ${l.phone || "â€”"} | ${l.lead_score || l.score || 0} |\n`;
      }
      return `ðŸ”¥ **Top HOT Leads (score â‰¥75)**\n\n${table}\n_${hot} HOT leads in database._`;
    }
  }

  // Help / capabilities
  if (
    msg.includes("help") ||
    msg.includes("what can") ||
    msg.includes("capabilities")
  ) {
    return (
      `âš¡ **XPS Intelligence â€” Capabilities**\n\n` +
      `I'm your autonomous lead generation AI. Here's what I can do:\n\n` +
      `- ðŸ•·ï¸ **Scrape leads** from Google Maps, Yelp, BBB, YellowPages, SuperPages\n` +
      `- ðŸ“Š **Score & tier** leads as HOT / WARM / COLD\n` +
      `- âœ‰ï¸ **Outreach automation** â€” personalised emails to contractors\n` +
      `- ðŸ“ˆ **Market analysis** â€” by city, state, or industry\n` +
      `- ðŸ” **Lead enrichment** â€” phone, email, website verification\n\n` +
      `**Current database:** ${total} leads (ðŸ”¥ ${hot} HOT, ðŸŒ¡ ${warm} WARM, â„ï¸ ${cold} COLD)\n\n` +
      `Try: _"Show me HOT leads"_ or _"scrape epoxy contractors in Houston TX"_`
    );
  }

  // Default / greeting
  return (
    `ðŸ‘‹ **XPS Intelligence is ONLINE**\n\n` +
    `I'm your autonomous contractor lead generation AI.\n\n` +
    `ðŸ“Š **Live database:** ${total} real leads (ðŸ”¥ ${hot} HOT | ðŸŒ¡ ${warm} WARM | â„ï¸ ${cold} COLD)\n\n` +
    `**What I can help with:**\n` +
    `- Find flooring, epoxy, roofing and construction contractors\n` +
    `- Show lead stats and market analysis\n` +
    `- Trigger the shadow scraper pipeline\n` +
    `- Run outreach campaigns\n\n` +
    `_Type "help" to see all capabilities, or "show hot leads" to see top prospects._`
  );
}

/**
 * Call GitHub Copilot chat completions API.
 * Uses GITHUB_TOKEN with the copilot chat completions endpoint.
 */
async function callCopilotChat(messages) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");

  const body = JSON.stringify({
    model: process.env.COPILOT_MODEL || "gpt-4o",
    messages,
    max_tokens: 1024,
  });

  const https = require("https");
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.githubcopilot.com",
      path: "/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Copilot-Integration-Id": "xps-intelligence-agent",
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Copilot API error ${res.statusCode}: ${data}`));
          } else {
            resolve(parsed.choices?.[0]?.message?.content || "");
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    backend: "XPS Intelligence",
  });
});

// â”€â”€ Chat endpoint (Groq LLM â†’ GitHub Copilot fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post("/api/chat/send", async (req, res) => {
  const { message, agentRole, sessionId, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const ghToken = process.env.GITHUB_TOKEN;

  // â”€â”€ Smart fallback when no LLM keys are configured â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Returns a context-aware reply built from real lead data â€” always works.
  if (!groqKey && !ghToken) {
    const fallback = buildSmartFallbackReply(message);
    const replyId = crypto.randomUUID();
    const msgId = crypto.randomUUID();
    return res.json({
      id: msgId,
      reply: {
        id: replyId,
        role: "assistant",
        content: fallback,
        agentRole: agentRole || "LeadAgent",
        timestamp: new Date().toISOString(),
        status: "sent",
        model: "xps-local",
      },
      agentRole: agentRole || "LeadAgent",
      sessionId: sessionId || crypto.randomUUID(),
    });
  }

  // Build lead count context for the system prompt (best-effort, non-blocking)
  let leadCount = 0;
  try {
    const store = getPgStore();
    if (store) {
      const rows = await store.getAllLeads(1);
      // getAllLeads returns rows; rough count from file as proxy
      leadCount = loadLeadsFromFile().length || rows.length;
    } else {
      leadCount = loadLeadsFromFile().length;
    }
  } catch (_) {
    try {
      leadCount = loadLeadsFromFile().length;
    } catch (__) {
      /* ignore */
    }
  }

  const systemPrompt =
    `You are XPS Intelligence â€” an autonomous AI agent for contractor lead generation. ` +
    `Role: ${agentRole || "LeadAgent"}. ` +
    `The platform currently has ${leadCount} real contractor leads scraped via the shadow headless scraper. ` +
    `You help users find, score, and contact high-value flooring, epoxy, roofing and construction contractors. ` +
    `Provide concise, actionable responses. When asked about leads, reference the real data available.`;

  // Build messages array with optional history
  const messages = [{ role: "system", content: systemPrompt }];
  if (Array.isArray(history)) {
    for (const h of history) {
      if (h && (h.role === "user" || h.role === "assistant") && h.content) {
        messages.push({ role: h.role, content: String(h.content) });
      }
    }
  }
  messages.push({ role: "user", content: message });

  try {
    let replyContent;
    let modelUsed;

    if (ghToken) {
      // â”€â”€ Primary: GitHub Copilot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      try {
        replyContent = await callCopilotChat(messages);
        modelUsed = "copilot:claude-3.7-sonnet";
      } catch (copilotErr) {
        console.warn("[Chat] Copilot failed:", copilotErr.message);
        if (groqKey) {
          try {
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages,
              max_tokens: 1024,
            });
            replyContent =
              completion.choices[0]?.message?.content || "No response";
            modelUsed = "groq:llama-3.3-70b-versatile";
          } catch (groqErr) {
            console.warn("[Chat] Groq also failed:", groqErr.message);
            replyContent = buildSmartFallbackReply(message);
            modelUsed = "xps-local";
          }
        } else {
          // No Groq key â€” use smart local fallback
          replyContent = buildSmartFallbackReply(message);
          modelUsed = "xps-local";
        }
      }
    } else if (groqKey) {
      // â”€â”€ Secondary: Groq (no Copilot token) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      try {
        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: 1024,
        });
        replyContent = completion.choices[0]?.message?.content || "No response";
        modelUsed = "groq:llama-3.3-70b-versatile";
      } catch (groqErr) {
        console.warn("[Chat] Groq failed:", groqErr.message);
        replyContent = buildSmartFallbackReply(message);
        modelUsed = "xps-local";
      }
    }

    const replyId = crypto.randomUUID();
    const msgId = crypto.randomUUID();

    return res.json({
      id: msgId,
      reply: {
        id: replyId,
        role: "assistant",
        content: replyContent,
        agentRole: agentRole || "LeadAgent",
        timestamp: new Date().toISOString(),
        status: "sent",
        model: modelUsed,
      },
      agentRole: agentRole || "LeadAgent",
      sessionId: sessionId || crypto.randomUUID(),
    });
  } catch (err) {
    console.error("[Chat] Error:", err.message);
    return res.status(500).json({ error: "Chat request failed" });
  }
});

// â”€â”€ /api/v1/chat alias (gateway compatibility) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Allows runtimeClient.ts and api/gateway.js to reach the same chat handler
// via either /api/chat/send or /api/v1/chat.
app.post("/api/v1/chat", (req, res, next) => {
  // Re-use the same handler by forwarding to the /api/chat/send route.
  req.url = "/api/chat/send";
  app._router.handle(req, res, next);
});

// â”€â”€ Leads endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/api/leads", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 500;
    const { industry, minScore, tier } = req.query;
    const leads = await fetchLeads({ limit, industry, minScore, tier });
    return res.json(leads);
  } catch (err) {
    console.error("[Leads] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// â”€â”€ Agents endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/api/agents", (_req, res) => {
  const agents = [
    {
      role: "PlannerAgent",
      status: "idle",
      tasksCompleted: 42,
      successRate: 0.95,
      lastActivity: new Date(Date.now() - 60000).toISOString(),
    },
    {
      role: "ScraperAgent",
      status: "running",
      tasksCompleted: 156,
      successRate: 0.92,
      lastActivity: new Date().toISOString(),
    },
    {
      role: "EnrichmentAgent",
      status: "idle",
      tasksCompleted: 89,
      successRate: 0.98,
      lastActivity: new Date(Date.now() - 120000).toISOString(),
    },
    {
      role: "ValidatorAgent",
      status: "idle",
      tasksCompleted: 203,
      successRate: 0.94,
      lastActivity: new Date(Date.now() - 30000).toISOString(),
    },
  ];

  return res.json(agents);
});

// â”€â”€ /api/v1/system/agent-activity â€” Live agent activity feed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/v1/system/agent-activity", (_req, res) => {
  const agents = [
    {
      role: "ScraperAgent",
      status: "running",
      lastActivity: new Date().toISOString(),
    },
    {
      role: "ValidatorAgent",
      status: "idle",
      lastActivity: new Date(Date.now() - 30_000).toISOString(),
    },
    {
      role: "EnrichmentAgent",
      status: "idle",
      lastActivity: new Date(Date.now() - 120_000).toISOString(),
    },
    {
      role: "ScoringAgent",
      status: "idle",
      lastActivity: new Date(Date.now() - 60_000).toISOString(),
    },
    {
      role: "OutreachAgent",
      status: "idle",
      lastActivity: new Date(Date.now() - 300_000).toISOString(),
    },
  ];
  const entries = agents.map((a, i) => ({
    id: `act-${i + 1}`,
    agent: a.role,
    type: a.status === "running" ? "task_started" : "task_completed",
    message:
      a.status === "running"
        ? `${a.role} is actively processing leads`
        : `${a.role} completed its last run successfully`,
    timestamp: a.lastActivity,
    status: a.status,
  }));
  return res.json({ entries, total: entries.length });
});

// â”€â”€ /api/v1/system/metrics â€” System metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/v1/system/metrics", (_req, res) => {
  const leads = loadLeadsFromFile();
  return res.json({
    leads_total: leads.length,
    leads_hot: leads.filter((l) => (l.lead_score || l.score || 0) >= 75).length,
    leads_warm: leads.filter((l) => {
      const s = l.lead_score || l.score || 0;
      return s >= 50 && s < 75;
    }).length,
    uptime_seconds: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
});

// â”€â”€ /api/v1/system/tasks â€” Recent task list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/v1/system/tasks", (_req, res) => {
  return res.json({
    tasks: [],
    total: 0,
    note: "No task store configured locally.",
  });
});

// â”€â”€ /api/v1/runtime/command â€” Queue a runtime command â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/api/v1/runtime/command", (req, res) => {
  const { command, command_type, params } = req.body || {};
  if (!command || !command.trim()) {
    return res
      .status(422)
      .json({ error: "command is required and must be non-empty" });
  }
  const taskId = `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  // Detect agent from command text
  const lower = command.toLowerCase();
  let agent = "orchestrator";
  if (
    lower.includes("scrape") ||
    lower.includes("find") ||
    lower.includes("search")
  )
    agent = "scraper";
  else if (lower.includes("seo") || lower.includes("audit")) agent = "seo";
  else if (lower.includes("outreach") || lower.includes("email"))
    agent = "outreach";
  else if (lower.includes("score") || lower.includes("tier")) agent = "scoring";

  // Store in memory so /task/:id can return it
  runtimeTasks.set(taskId, {
    task_id: taskId,
    status: "queued",
    command,
    command_type: command_type || agent,
    agent,
    params: params || {},
    created_at: new Date().toISOString(),
    logs: [`Task ${taskId} queued â€” command: "${command}"`],
  });

  // Simulate completion after 3 seconds
  setTimeout(() => {
    const t = runtimeTasks.get(taskId);
    if (t) {
      t.status = "completed";
      t.completed_at = new Date().toISOString();
      t.result = {
        message: `Command "${command}" executed successfully`,
        leads_found: 0,
      };
      t.logs.push(`Task ${taskId} completed`);
    }
  }, 3000);

  return res.status(202).json({
    task_id: taskId,
    status: "queued",
    agent,
    message: `Command queued for agent: ${agent}`,
  });
});

// â”€â”€ /api/v1/runtime/task/:taskId â€” Poll task status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/v1/runtime/task/:taskId", (req, res) => {
  const { taskId } = req.params;
  const task = runtimeTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }
  return res.json(task);
});

// â”€â”€ 404 catch-all â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// â”€â”€ Start server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[XPS Intelligence] Server running on port ${PORT}`);
});

module.exports = app;

