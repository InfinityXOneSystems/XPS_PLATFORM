"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { scrapeGoogleMaps } = require("./google_maps_scraper");
const { scrapeBingMaps } = require("./bing_maps_scraper");
const { scrapeYelp } = require("./yelp_scraper");
const { scrapeAngi, scrapeHomeAdvisor } = require("./directory_scraper");
const { upsertLeads: upsertLeadsSupabase } = require("../db/supabaseLeadStore");
// NOTE: PostgreSQL persistence removed — leads now route to Supabase via
// scripts/supabase_lead_writer.py and the InfinityXOneSystems/LEADS repo.
const {
  DeduplicationEngine,
} = require("../agents/dedupe/deduplication_engine");

const KEYWORDS_CSV = path.join(
  __dirname,
  "../data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv",
);
const LOCATIONS_CSV = path.join(
  __dirname,
  "../data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv",
);
const LEADS_DIR_PRIMARY = path.join(__dirname, "../leads");
const LEADS_DIR = path.join(__dirname, "../data/leads");
const LEADS_FILE = path.join(LEADS_DIR_PRIMARY, "leads.json");
const LEADS_FILE_LEGACY = path.join(LEADS_DIR, "leads.json");

/** Default engine configuration */
const DEFAULT_CONFIG = {
  sources: ["google_maps"], // scrapers to use: 'google_maps', 'bing_maps'
  maxKeywords: null, // limit keywords (null = all)
  maxLocations: null, // limit locations (null = all)
  concurrency: 1, // parallel scrape jobs (keep low to avoid rate limits)
  delayBetweenBatchesMs: 3000, // pause between batches of concurrent jobs
};

/**
 * Parse a simple CSV string (with header row) into an array of objects.
 * Handles BOM markers, Windows line endings, and double-quoted fields.
 */
function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Split a single CSV line respecting double-quoted fields
  const splitLine = (line) => {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // Handle escaped quotes ("")
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] !== undefined ? values[i] : "";
    });
    return obj;
  });
}

/**
 * Load leads from the leads file.
 */
function loadExistingLeads() {
  const src = fs.existsSync(LEADS_FILE) ? LEADS_FILE : LEADS_FILE_LEGACY;
  if (!fs.existsSync(src)) return [];
  try {
    return JSON.parse(fs.readFileSync(src, "utf-8"));
  } catch {
    return [];
  }
}

/**
 * Deduplicate leads using the full DeduplicationEngine (company+city, phone,
 * email, website, and fuzzy name matching).
 */
function dedupeLeads(leads) {
  const engine = new DeduplicationEngine({ mergeLeads: true });
  const { unique } = engine.run(leads);
  return unique;
}

/**
 * Save leads array to the leads JSON file.
 */
function saveLeads(leads) {
  const json = JSON.stringify(leads, null, 2);
  if (!fs.existsSync(LEADS_DIR_PRIMARY)) {
    fs.mkdirSync(LEADS_DIR_PRIMARY, { recursive: true });
  }
  fs.writeFileSync(LEADS_FILE, json);
  if (!fs.existsSync(LEADS_DIR)) {
    fs.mkdirSync(LEADS_DIR, { recursive: true });
  }
  fs.writeFileSync(LEADS_FILE_LEGACY, json);
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run one scrape job: keyword + location through the configured source.
 */
async function runJob(source, keyword, city, state) {
  switch (source) {
    case "google_maps":
      return scrapeGoogleMaps(keyword, city, state);
    case "bing_maps":
      return scrapeBingMaps(keyword, city, state);
    case "yelp":
      return scrapeYelp(keyword, city, state);
    case "angi":
      return scrapeAngi(keyword, city, state);
    case "homeadvisor":
      return scrapeHomeAdvisor(keyword, city, state);
    default:
      console.warn(`[engine] Unknown source: ${source}`);
      return [];
  }
}

/**
 * Main scraper engine entry point.
 *
 * @param {object} config - Optional config overrides (see DEFAULT_CONFIG)
 * @returns {Promise<Array>} All collected (and deduped) leads
 */
async function runEngine(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  console.log("[engine] Starting scraper engine");
  console.log("[engine] Config:", JSON.stringify(cfg, null, 2));

  // Load keyword + location datasets
  const allKeywords = parseCsv(KEYWORDS_CSV);
  const allLocations = parseCsv(LOCATIONS_CSV);

  const keywords = cfg.maxKeywords
    ? allKeywords.slice(0, cfg.maxKeywords)
    : allKeywords;
  const locations = cfg.maxLocations
    ? allLocations.slice(0, cfg.maxLocations)
    : allLocations;

  console.log(
    `[engine] Loaded ${keywords.length} keywords, ${locations.length} locations`,
  );

  // Build the job queue: for each source × keyword × location
  const jobs = [];
  for (const source of cfg.sources) {
    for (const kw of keywords) {
      for (const loc of locations) {
        jobs.push({
          source,
          keyword: kw.Keyword,
          city: loc.City,
          state: loc.State,
        });
      }
    }
  }

  console.log(`[engine] Total jobs: ${jobs.length}`);

  // Load existing leads to merge with
  let allLeads = loadExistingLeads();
  console.log(`[engine] Loaded ${allLeads.length} existing leads`);

  let completed = 0;
  let newLeadsCount = 0;

  // Run jobs in batches respecting concurrency limit, with delay between batches
  for (let i = 0; i < jobs.length; i += cfg.concurrency) {
    const batch = jobs.slice(i, i + cfg.concurrency);
    const batchResults = await Promise.all(
      batch.map((job) => runJob(job.source, job.keyword, job.city, job.state)),
    );
    for (const results of batchResults) {
      allLeads = allLeads.concat(results);
      newLeadsCount += results.length;
      completed++;
    }
    console.log(
      `[engine] Progress: ${completed}/${jobs.length} jobs done | ${newLeadsCount} new leads`,
    );
    if (i + cfg.concurrency < jobs.length) {
      await sleep(cfg.delayBetweenBatchesMs);
    }
  }

  // Deduplicate and save to JSON snapshot
  allLeads = dedupeLeads(allLeads);
  saveLeads(allLeads);

  // Persist to PostgreSQL
  // Persist to Supabase
  try {
    await upsertLeadsSupabase(allLeads);
    console.log(`[engine] Persisted ${allLeads.length} leads to Supabase.`);
  } catch (err) {
    console.error(
      `[engine] Supabase persistence failed (leads still saved to JSON): ${err.message}`,
  // Route leads to Supabase + InfinityXOneSystems/LEADS repo
  // (PostgreSQL persistence removed — all lead data goes to Supabase)
  try {
    const leadsFile = path.join(LEADS_DIR_PRIMARY, "leads.json");
    if (allLeads.length > 0 && fs.existsSync(leadsFile)) {
      // Use 'python3' on Linux/Mac, 'python' on Windows
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      execFileSync(
        pythonCmd,
        [
          path.join(__dirname, "../scripts/supabase_lead_writer.py"),
          "--input",
          leadsFile,
        ],
        {
          env: { ...process.env },
          timeout: 60_000,
          stdio: "inherit",
        },
      );
      console.log(
        `[engine] Leads routed to Supabase + LEADS repo (${allLeads.length} leads).`,
      );
    }
  } catch (err) {
    console.error(
      `[engine] Supabase/LEADS write failed (leads still saved to JSON): ${err.message}`,
    );
  }

  console.log(`[engine] Done. Total unique leads saved: ${allLeads.length}`);
  return allLeads;
}

module.exports = {
  runEngine,
  parseCsv,
  dedupeLeads,
  loadExistingLeads,
  saveLeads,
};
