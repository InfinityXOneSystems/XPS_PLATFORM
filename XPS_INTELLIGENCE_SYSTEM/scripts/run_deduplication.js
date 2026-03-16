#!/usr/bin/env node
"use strict";

/**
 * scripts/run_deduplication.js
 *
 * CLI entry-point for the Lead Deduplication Engine.
 *
 * Usage:
 *   node scripts/run_deduplication.js
 *
 * Environment variables (all optional):
 *   DEDUP_FUZZY=0            Disable fuzzy matching (default: enabled)
 *   DEDUP_FUZZY_THRESHOLD    Jaro-Winkler threshold, 0–1 (default: 0.85)
 *   DEDUP_MERGE=0            Disable lead-merging (default: enabled)
 *
 * Reads:  leads/leads.json  (falls back to data/leads/leads.json)
 * Writes: leads/leads.json        – deduplicated leads
 *         leads/duplicates.json   – removed duplicate records
 *         leads/dedup_report.json – statistics report
 *         (all three also written to data/leads/ for legacy compatibility)
 */

const fs = require("fs");
const path = require("path");
const {
  DeduplicationEngine,
} = require("../agents/dedupe/deduplication_engine");

const ROOT = path.resolve(__dirname, "..");
const LEADS_DIR = path.join(ROOT, "leads");
const LEADS_DIR_LEGACY = path.join(ROOT, "data", "leads");
const LEADS_FILE = path.join(LEADS_DIR, "leads.json");
const LEADS_FILE_LEGACY = path.join(LEADS_DIR_LEGACY, "leads.json");

function loadLeads() {
  const src = fs.existsSync(LEADS_FILE) ? LEADS_FILE : LEADS_FILE_LEGACY;
  if (!fs.existsSync(src)) {
    console.error("[dedup] No leads file found at", src);
    return [];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(src, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.error("[dedup] Failed to parse leads file:", err.message);
    return [];
  }
}

/**
 * Writes content to both leads/ (primary) and data/leads/ (legacy).
 */
function writeToLeadsDirs(filename, content) {
  for (const dir of [LEADS_DIR, LEADS_DIR_LEGACY]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), content, "utf-8");
  }
}

function main() {
  console.log("[dedup] Starting Lead Deduplication Engine…");

  const leads = loadLeads();
  if (leads.length === 0) {
    console.log("[dedup] No leads to process. Exiting.");
    return;
  }
  console.log(`[dedup] Loaded ${leads.length} leads.`);

  const engine = new DeduplicationEngine({
    fuzzyMatch: process.env.DEDUP_FUZZY !== "0",
    fuzzyThreshold: parseFloat(process.env.DEDUP_FUZZY_THRESHOLD || "0.85"),
    mergeLeads: process.env.DEDUP_MERGE !== "0",
  });

  const { unique, duplicates, stats } = engine.run(leads);

  console.log("[dedup] Results:");
  console.log(`  Total input  : ${stats.total}`);
  console.log(`  Unique leads : ${stats.unique}`);
  console.log(
    `  Duplicates   : ${stats.duplicates} (${(stats.duplicateRate * 100).toFixed(1)}%)`,
  );
  console.log("  Breakdown    :", stats.breakdown);

  writeToLeadsDirs("leads.json", JSON.stringify(unique, null, 2));
  writeToLeadsDirs("duplicates.json", JSON.stringify(duplicates, null, 2));
  writeToLeadsDirs("dedup_report.json", JSON.stringify(stats, null, 2));

  console.log(
    "[dedup] Wrote leads.json, duplicates.json, dedup_report.json to leads/ and data/leads/",
  );
  console.log("[dedup] Done.");
}

main();
