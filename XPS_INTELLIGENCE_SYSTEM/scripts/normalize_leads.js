"use strict";

/**
 * normalize_leads.js
 *
 * Normalizes scored_leads.json to a canonical schema.
 * Resolves field-name discrepancies between different scrapers and pipeline stages:
 *   lead_score  → score
 *   date_scraped → date
 *   company_name → company
 *
 * Usage:
 *   node scripts/normalize_leads.js [--input <path>] [--output <path>]
 *
 * Defaults:
 *   --input   data/leads/scored_leads.json
 *   --output  data/leads/scored_leads.json  (in-place)
 */

const fs = require("fs");
const path = require("path");

// ── CLI arg parsing ──────────────────────────────────────────────────────────
function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const INPUT_PATH = path.resolve(
  getArg("--input", "data/leads/scored_leads.json"),
);
const OUTPUT_PATH = path.resolve(getArg("--output", INPUT_PATH));

// ── Normalise a single lead ──────────────────────────────────────────────────
function normalizeLead(l, index) {
  const score = Number(l.lead_score ?? l.score ?? 0) || 0;
  const today = new Date().toISOString().split("T")[0];

  // Resolve website protocol safely
  let website = (l.website || "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    website = "https://" + website;
  }

  // Derive tier from score
  const tier = score >= 75 ? "HOT" : score >= 50 ? "WARM" : "COLD";

  return {
    id: l.id || index + 1,
    company: (l.company || l.company_name || "Unknown").trim(),
    contact: (l.contact || l.contact_name || "").trim(),
    phone: (l.phone || "").trim(),
    email: (l.email || "").trim(),
    website,
    address: (l.address || "").trim(),
    city: (l.city || "").trim(),
    state: (l.state || "").trim(),
    country: l.country || "US",
    industry: (l.industry || l.category || "Unknown").trim(),
    category: (l.category || l.industry || "Unknown").trim(),
    rating: Number(l.rating) || 0,
    reviews: Number(l.reviews) || 0,
    score,
    lead_score: score,
    tier,
    status: (l.status || "new").toLowerCase(),
    source: l.source || "google_maps",
    date_scraped: l.date_scraped || l.scraped_at || l.date || today,
    date: l.date || l.date_scraped || l.scraped_at || today,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(INPUT_PATH)) {
  console.log("[normalize] No file at", INPUT_PATH, "— skipping.");
  process.exit(0);
}

let leads;
try {
  leads = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
} catch (e) {
  console.error("[normalize] Failed to parse", INPUT_PATH, ":", e.message);
  process.exit(1);
}

if (!Array.isArray(leads)) {
  console.error("[normalize] Expected JSON array, got", typeof leads);
  process.exit(1);
}

const normalized = leads.map(normalizeLead);

// Ensure output directory exists
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(normalized, null, 2));

console.log(
  `[normalize] Normalized ${normalized.length} leads → ${OUTPUT_PATH}`,
);
