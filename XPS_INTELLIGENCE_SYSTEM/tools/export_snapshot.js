"use strict";

/**
 * export_snapshot.js — Postgres → JSON snapshot exporter
 * XPS Lead Intelligence Platform
 *
 * Reads scored leads from PostgreSQL and writes dashboard-ready JSON files:
 *
 *   leads/scored_leads.json                (primary — dedicated leads folder)
 *   leads/scoring_report.json
 *   data/leads/scored_leads.json           (backward-compatible copy)
 *   data/leads/scoring_report.json
 *
 * Falls back to leads/leads.json or data/leads/leads.json (JSON snapshot)
 * when DATABASE_URL / DATABASE_HOST is not configured.
 *
 * Usage:
 *   node tools/export_snapshot.js
 *
 * Environment variables (all optional — uses defaults):
 *   DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD
 *   EXPORT_LIMIT  — max leads to export (default: 1000)
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
// Primary leads directory (dedicated leads/ folder at repo root)
const LEADS_DIR_PRIMARY = path.join(ROOT, "leads");
// Backward-compatible legacy directory
const DATA_DIR = path.join(ROOT, "data", "leads");

// Resolve lead source files (prefer primary leads/ folder)
const LEADS_JSON = fs.existsSync(path.join(LEADS_DIR_PRIMARY, "leads.json"))
  ? path.join(LEADS_DIR_PRIMARY, "leads.json")
  : path.join(DATA_DIR, "leads.json");
const SCORED_JSON = fs.existsSync(
  path.join(LEADS_DIR_PRIMARY, "scored_leads.json"),
)
  ? path.join(LEADS_DIR_PRIMARY, "scored_leads.json")
  : path.join(DATA_DIR, "scored_leads.json");

const EXPORT_LIMIT = parseInt(process.env.EXPORT_LIMIT || "1000", 10);

// ── helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeBoth(filename, data) {
  const json = JSON.stringify(data, null, 2);
  // Write to primary leads/ folder
  ensureDir(LEADS_DIR_PRIMARY);
  fs.writeFileSync(path.join(LEADS_DIR_PRIMARY, filename), json);
  // Write to legacy data/leads/ folder
  ensureDir(DATA_DIR);
  fs.writeFileSync(path.join(DATA_DIR, filename), json);
  console.log(`[export_snapshot] Wrote ${filename}`);
}

function buildReport(leads) {
  const tiers = { HOT: 0, WARM: 0, COLD: 0 };
  const industries = {};
  let totalScore = 0;

  for (const lead of leads) {
    const score = lead.lead_score || lead.score || 0;
    totalScore += score;

    const tier = score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD";
    tiers[tier] = (tiers[tier] || 0) + 1;

    const ind = lead.industry || lead.category || "unknown";
    industries[ind] = (industries[ind] || 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    total_leads: leads.length,
    average_score: leads.length ? Math.round(totalScore / leads.length) : 0,
    tiers,
    industries,
    top_leads: leads.slice(0, 10),
  };
}

// Normalize a score field from a DB row or JSON object (handles both field names)
function normalizeScore(row) {
  if (row.lead_score != null) return Number(row.lead_score);
  if (row.score != null) return Number(row.score);
  return 0;
}

// Normalise a DB row to the dashboard lead shape
function normaliseRow(row) {
  const score = normalizeScore(row);
  return {
    id: row.id,
    company: row.company_name || row.company || "",
    company_name: row.company_name || row.company || "",
    phone: row.phone || "",
    email: row.email || "",
    website: row.website || "",
    city: row.city || "",
    state: row.state || "",
    industry: row.industry || row.category || "",
    rating: row.rating != null ? Number(row.rating) : null,
    reviews: row.reviews != null ? Number(row.reviews) : null,
    lead_score: score,
    score,
    source: row.source || "",
    date_scraped: row.date_scraped || row.scraped_at || null,
  };
}

// ── DB export ────────────────────────────────────────────────────────────────

async function exportFromDb() {
  const { query, initSchema } = require("../db/db");

  try {
    await initSchema();
  } catch (err) {
    console.warn(
      "[export_snapshot] Could not init schema (continuing):",
      err.message,
    );
  }

  const result = await query(
    "SELECT * FROM leads ORDER BY lead_score DESC NULLS LAST LIMIT $1",
    [EXPORT_LIMIT],
  );

  const leads = result.rows.map(normaliseRow);
  console.log(
    `[export_snapshot] Fetched ${leads.length} leads from PostgreSQL.`,
  );
  return leads;
}

// ── JSON fallback export ─────────────────────────────────────────────────────

async function exportFromJson() {
  // Prefer pre-scored output; fall back to raw leads.json.
  const sourcePath = fs.existsSync(SCORED_JSON) ? SCORED_JSON : LEADS_JSON;
  const sourceLabel =
    sourcePath === SCORED_JSON ? "scored_leads.json" : "leads.json";

  if (!fs.existsSync(sourcePath)) {
    console.warn(
      "[export_snapshot] No leads file found — exporting empty set.",
    );
    return [];
  }
  try {
    const raw = fs.readFileSync(sourcePath, "utf8");
    const leads = JSON.parse(raw);
    if (!Array.isArray(leads)) return [];

    const normalised = leads
      .map(normaliseRow)
      .sort((a, b) => b.lead_score - a.lead_score)
      .slice(0, EXPORT_LIMIT);

    console.log(
      `[export_snapshot] Loaded ${normalised.length} leads from ${sourceLabel}.`,
    );
    return normalised;
  } catch (err) {
    console.error(
      `[export_snapshot] Failed to parse ${sourceLabel}:`,
      err.message,
    );
    return [];
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("[export_snapshot] Starting snapshot export...");

  let leads;

  const useDb = !!(
    process.env.DATABASE_HOST ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_NAME
  );

  if (useDb) {
    try {
      leads = await exportFromDb();
    } catch (err) {
      console.error(
        "[export_snapshot] DB export failed, falling back to JSON:",
        err.message,
      );
      leads = await exportFromJson();
    }
  } else {
    console.log(
      "[export_snapshot] No DATABASE_HOST set — using JSON fallback.",
    );
    leads = await exportFromJson();
  }

  const report = buildReport(leads);

  writeBoth("scored_leads.json", leads);
  writeBoth("scoring_report.json", report);

  console.log(`[export_snapshot] Done. ${leads.length} leads exported.`);
  console.log(
    `[export_snapshot] Tiers: HOT=${report.tiers.HOT} WARM=${report.tiers.WARM} COLD=${report.tiers.COLD}`,
  );

  return { leads, report };
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[export_snapshot] Fatal error:", err);
      process.exit(1);
    });
}

module.exports = { run };
