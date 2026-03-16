#!/usr/bin/env node
"use strict";

/**
 * migrate_leads_to_supabase.js
 * ─────────────────────────────
 * One-time migration script: reads all local JSON lead files and upserts
 * them into the Supabase `leads` table.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_key \
 *   node scripts/migrate_leads_to_supabase.js
 *
 * Environment variables (loaded from .env automatically):
 *   NEXT_PUBLIC_SUPABASE_URL   – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  – Service-role key (full access)
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { upsertLeads } = require("../db/supabaseLeadStore");

const ROOT = path.join(__dirname, "..");

// All lead JSON files to migrate (primary + legacy paths)
const LEAD_FILES = [
  path.join(ROOT, "leads", "leads.json"),
  path.join(ROOT, "leads", "scored_leads.json"),
  path.join(ROOT, "leads", "validated_leads.json"),
  path.join(ROOT, "data", "leads", "leads.json"),
  path.join(ROOT, "data", "leads", "validated_leads.json"),
];

/**
 * Safely load a JSON array from a file.
 * Returns [] if the file is missing, empty, or malformed.
 */
function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[migrate] Could not parse ${filePath}: ${err.message}`);
    return [];
  }
}

/**
 * Deduplicate leads by (company_name/company + city + state) before
 * uploading, to avoid sending redundant rows to Supabase.
 */
function deduplicateLeads(leads) {
  const seen = new Set();
  return leads.filter((lead) => {
    const key = [
      (lead.company_name || lead.company || "").toLowerCase().trim(),
      (lead.city || "").toLowerCase().trim(),
      (lead.state || "").toLowerCase().trim(),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  console.log("[migrate] Starting lead migration to Supabase…");

  // Validate env — require service role key for migration
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl) {
    console.error(
      "[migrate] ERROR: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) must be set.",
    );
    process.exit(1);
  }
  if (!supabaseKey) {
    console.error(
      "[migrate] ERROR: SUPABASE_SERVICE_ROLE_KEY must be set for migration (anon key has insufficient permissions).",
    );
    process.exit(1);
  }

  // Load all lead files
  let allLeads = [];
  for (const filePath of LEAD_FILES) {
    const leads = loadJson(filePath);
    if (leads.length > 0) {
      console.log(
        `[migrate]   Loaded ${leads.length} leads from ${path.relative(ROOT, filePath)}`,
      );
      allLeads = allLeads.concat(leads);
    }
  }

  if (allLeads.length === 0) {
    console.log(
      "[migrate] No leads found in local JSON files. Nothing to migrate.",
    );
    return;
  }

  const unique = deduplicateLeads(allLeads);
  console.log(
    `[migrate] Total: ${allLeads.length} leads loaded, ${unique.length} unique after dedup`,
  );

  // Upsert to Supabase in batches
  try {
    const inserted = await upsertLeads(unique);
    console.log(
      `[migrate] ✓ Successfully upserted ${inserted.length} leads to Supabase.`,
    );
  } catch (err) {
    console.error(`[migrate] ✗ Migration failed: ${err.message}`);
    process.exit(1);
  }

  console.log("[migrate] Migration complete.");
}

main().catch((err) => {
  console.error("[migrate] Unexpected error:", err);
  process.exit(1);
});
