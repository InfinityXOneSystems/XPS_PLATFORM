"use strict";

/**
 * google_maps_scraper.js
 *
 * Nationwide batch scraper for contractor leads via Google Maps.
 *
 * Environment variables (all optional):
 *   SCRAPER_BATCH_SIZE    – number of cities to process per run  (default: 10)
 *   SCRAPER_CONCURRENCY   – parallel search tasks within a batch (default: 3)
 *   SCRAPER_RATE_LIMIT_MS – ms to wait between tasks             (default: 2000)
 *   SCRAPER_STATE         – restrict this run to one state abbr  (e.g. "TX")
 *   SCRAPER_RESET         – set to "1" to reset progress first   (default: off)
 *   SCRAPER_CITIES        – comma-separated "City:State" pairs to target
 *                           (e.g. "Rockford:IL,Columbus:OH,Tempe:AZ")
 *                           When set, ignores batch/state/progress settings.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// ── Google Maps scraper constants ─────────────────────────────────────────────
const RESULT_LOAD_MS = 3000;
const MAX_RESULTS_PER_QUERY = 20;
const NAVIGATION_TIMEOUT_MS = 30000;
const {
  loadKeywords,
  getNextBatch,
  getTargetCities,
  markComplete,
  generateSearchTasks,
  resetProgress,
  getCoverageSummary,
} = require("./scraper_queue");

// ── Configuration ────────────────────────────────────────────────────────────

const BATCH_SIZE = parseInt(process.env.SCRAPER_BATCH_SIZE || "10", 10);
const CONCURRENCY = parseInt(process.env.SCRAPER_CONCURRENCY || "3", 10);
const RATE_LIMIT_MS = parseInt(process.env.SCRAPER_RATE_LIMIT_MS || "2000", 10);
const STATE_FILTER = process.env.SCRAPER_STATE || null;
const RESET_FLAG = process.env.SCRAPER_RESET === "1";
// Comma-separated "City:State" pairs – when set, overrides batch/state/progress.
const CITIES_FILTER = process.env.SCRAPER_CITIES || null;

const LEADS_DIR_PRIMARY = path.join(__dirname, "../leads");
const LEADS_DIR = path.join(__dirname, "../data/leads");
const LEADS_FILE = path.join(LEADS_DIR_PRIMARY, "leads.json");
const LEADS_FILE_LEGACY = path.join(LEADS_DIR, "leads.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadExistingLeads() {
  const src = fs.existsSync(LEADS_FILE) ? LEADS_FILE : LEADS_FILE_LEGACY;
  try {
    return JSON.parse(fs.readFileSync(src, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(
        "[scraper] Warning: could not read existing leads file:",
        err.message,
      );
    }
    return [];
  }
}

function saveLeads(leads) {
  const json = JSON.stringify(leads, null, 2);
  ensureDir(LEADS_DIR_PRIMARY);
  fs.writeFileSync(LEADS_FILE, json);
  ensureDir(LEADS_DIR);
  fs.writeFileSync(LEADS_FILE_LEGACY, json);
}

/** Remove duplicate leads keyed on (company, city). */
function dedupeLeads(leads) {
  const seen = new Set();
  return leads.filter((lead) => {
    const key =
      (lead.company || "").toLowerCase().trim() +
      "|" +
      (lead.city || "").toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Category helper ───────────────────────────────────────────────────────────

function deriveCategory(keyword) {
  const kw = (keyword || "").toLowerCase();
  if (
    kw.includes("epoxy") ||
    kw.includes("polyaspartic") ||
    kw.includes("polyurea") ||
    kw.includes("resin") ||
    kw.includes("flake") ||
    kw.includes("metallic")
  )
    return "Epoxy";
  if (
    kw.includes("concrete") ||
    kw.includes("polish") ||
    kw.includes("grind") ||
    kw.includes("stain") ||
    kw.includes("decor")
  )
    return "Concrete";
  if (kw.includes("shot blasting") || kw.includes("surface"))
    return "SurfacePrep";
  return "General";
}

// ── Google Maps scraper (Playwright) ─────────────────────────────────────────

/**
 * Scrape Google Maps for contractor leads matching a keyword in a given city/state.
 *
 * @param {string} keyword - Search keyword, e.g. "epoxy flooring contractor"
 * @param {string} city    - City name, e.g. "Columbus"
 * @param {string} state   - State abbreviation, e.g. "OH"
 * @returns {Promise<Array>} Array of lead objects
 */
async function scrapeGoogleMaps(keyword, city, state) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  const page = await context.newPage();
  const leads = [];

  try {
    const query = encodeURIComponent(`${keyword} ${city} ${state}`);
    const url = `https://www.google.com/maps/search/${query}`;

    console.log(`[google_maps] Searching: "${keyword}" | ${city}, ${state}`);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForTimeout(RESULT_LOAD_MS);

    // Handle consent/GDPR dialogs (common outside the US in CI)
    const consentSelectors = [
      "#L2AGLb",
      'button[aria-label*="Accept all"]',
      'form[action*="consent"] button[value="1"]',
    ];
    for (const sel of consentSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          await page.waitForTimeout(1500);
          break;
        }
      } catch (_) {
        // selector not found – continue
      }
    }
    // Also try the text-based locator approach for consent buttons
    try {
      const textBtn = page.getByRole("button", { name: /accept all/i }).first();
      if (await textBtn.isVisible({ timeout: 2000 })) {
        await textBtn.click();
        await page.waitForTimeout(1500);
      }
    } catch (_) {
      // no consent button – continue
    }

    // Wait for results feed
    try {
      await page.waitForSelector('div[role="feed"], div.Nv2PK', {
        timeout: 15000,
      });
    } catch (_) {
      console.warn(
        `[google_maps] No results found for "${keyword}" in ${city}, ${state}`,
      );
      return leads;
    }

    // Scroll to load more results
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop += 600;
      });
      await page.waitForTimeout(800);
    }

    // Extract listing cards.
    // Note: "div.Nv2PK" is a Google Maps result-card class (verified 2025-06).
    // If Google changes this selector, results will be empty (graceful degradation).
    const rawLeads = await page.evaluate(
      ({ max, keyword: kw }) => {
        const cards = Array.from(document.querySelectorAll("div.Nv2PK")).slice(
          0,
          max,
        );

        return cards
          .map((card) => {
            // Company name – try multiple selectors in priority order
            const nameEl =
              card.querySelector(".qBF1Pd") ||
              card.querySelector('[class*="fontHeadlineSmall"]') ||
              card.querySelector("a[aria-label]");
            const company = nameEl
              ? (
                  nameEl.textContent ||
                  nameEl.getAttribute("aria-label") ||
                  ""
                ).trim()
              : "";

            if (!company) return null;

            // Rating
            const ratingEl = card.querySelector(".MW4etd");
            const rating = ratingEl ? parseFloat(ratingEl.textContent) || 0 : 0;

            // Review count (usually displayed as "(123)")
            const reviewsEl = card.querySelector(".UY7F9");
            const reviewsText = reviewsEl
              ? reviewsEl.textContent.replace(/[^0-9]/g, "")
              : "";
            const reviews = reviewsText ? parseInt(reviewsText, 10) : 0;

            // Phone
            const phoneEl = card.querySelector('[data-item-id*="phone"]');
            const phone = phoneEl ? phoneEl.textContent.trim() : "";

            // Website
            const websiteEl = card.querySelector('a[data-item-id="authority"]');
            const website = websiteEl ? websiteEl.href : "";

            // Address – find first span containing a digit
            const bodySpans = card.querySelectorAll(
              '[class*="fontBodyMedium"] span',
            );
            const address =
              Array.from(bodySpans)
                .map((s) => s.textContent.trim())
                .filter(Boolean)
                .find((t) => /\d/.test(t)) || "";

            return {
              company,
              rating,
              reviews,
              phone,
              website,
              address,
              keyword: kw,
            };
          })
          .filter(Boolean);
      },
      { max: MAX_RESULTS_PER_QUERY, keyword },
    );

    for (const lead of rawLeads) {
      leads.push({
        company: lead.company,
        phone: lead.phone || "",
        website: lead.website || "",
        address: lead.address || "",
        city,
        state,
        country: "USA",
        keyword,
        category: deriveCategory(keyword),
        rating: lead.rating,
        reviews: lead.reviews,
        source: "google_maps",
        scrapedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(
      `[google_maps] Error for "${keyword}" in ${city}, ${state}: ${err.message}`,
    );
  } finally {
    await browser.close();
  }

  console.log(
    `[google_maps] Collected ${leads.length} leads for "${keyword}" in ${city}, ${state}`,
  );
  return leads;
}

// ── Core scraping function (uses scrapeGoogleMaps internally) ─────────────────

async function scrapeTask(task) {
  const results = await scrapeGoogleMaps(task.keyword, task.city, task.state);
  // Ensure each result carries task-level metadata for compatibility
  return results.map((lead) => ({
    ...lead,
    country: lead.country || task.country || "USA",
    category: lead.category || task.category || deriveCategory(task.keyword),
  }));
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function scrapeWithRetry(task, retries, backoffMs) {
  retries = retries !== undefined ? retries : 3;
  backoffMs = backoffMs !== undefined ? backoffMs : RATE_LIMIT_MS;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await scrapeTask(task);
    } catch (err) {
      const isLast = attempt === retries;
      console.error(
        `[scraper] Attempt ${attempt}/${retries} failed for "${task.keyword}" ` +
          `in ${task.city}, ${task.state}: ${err.message}`,
      );
      if (isLast) throw err;
      await delay(backoffMs * attempt);
    }
  }
}

// ── Concurrent task runner ────────────────────────────────────────────────────

async function processTasksConcurrently(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++];
      try {
        const leads = await scrapeWithRetry(task);
        results.push(...leads);
        console.log(
          `[scraper] ✓ "${task.keyword}" in ${task.city}, ${task.state}` +
            ` → ${leads.length} lead(s)`,
        );
      } catch (err) {
        console.error(
          `[scraper] ✗ Skipping "${task.keyword}" in ${task.city}: ${err.message}`,
        );
      }
      await delay(RATE_LIMIT_MS);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function runScraper() {
  console.log("[scraper] ════════════════════════════════════════════════");
  console.log("[scraper] Nationwide Contractor Lead Scraper – Phase 8");
  console.log("[scraper] ════════════════════════════════════════════════");
  console.log(
    `[scraper] Config: batch=${BATCH_SIZE}  concurrency=${CONCURRENCY}` +
      `  rateLimit=${RATE_LIMIT_MS}ms  state=${STATE_FILTER || "all"}` +
      `  cities=${CITIES_FILTER || "all"}`,
  );

  if (RESET_FLAG) {
    resetProgress();
  }

  // Determine which batch of cities to scrape.
  // SCRAPER_CITIES takes priority over batch/state/progress.
  let batch;
  if (CITIES_FILTER) {
    batch = getTargetCities(CITIES_FILTER);
    console.log(
      `[scraper] Targeting ${batch.length} specific city/state pair(s): ` +
        batch.map((l) => `${l.City}, ${l.State}`).join(" | "),
    );
    if (batch.length === 0) {
      console.warn(
        `[scraper] No locations matched SCRAPER_CITIES="${CITIES_FILTER}". ` +
          "Check that the city names and state codes are spelled correctly.",
      );
      return;
    }
  } else {
    // Print coverage summary before this run.
    const before = getCoverageSummary();
    console.log(
      `[scraper] Coverage before run: ${before.completedLocations}/${before.totalLocations} locations` +
        ` (${before.pendingLocations} remaining)`,
    );

    batch = getNextBatch(BATCH_SIZE, STATE_FILTER);
    if (batch.length === 0) {
      console.log(
        "[scraper] No pending locations. " +
          "Set SCRAPER_RESET=1 to restart the scraping cycle.",
      );
      const summary = getCoverageSummary();
      console.log("[scraper] Final coverage by state:");
      for (const [state, info] of Object.entries(summary.byState).sort()) {
        console.log(`  ${state}: ${info.done}/${info.total}`);
      }
      return;
    }

    console.log(
      `[scraper] Processing ${batch.length} location(s): ` +
        batch.map((l) => `${l.City}, ${l.State}`).join(" | "),
    );
  }

  const keywords = loadKeywords();
  const tasks = generateSearchTasks(batch, keywords);
  console.log(
    `[scraper] ${tasks.length} search tasks` +
      ` (${batch.length} locations × ${keywords.length} keywords)`,
  );

  const newLeads = await processTasksConcurrently(tasks, CONCURRENCY);

  // Merge with existing leads and deduplicate before saving.
  const existing = loadExistingLeads();
  const merged = dedupeLeads([...existing, ...newLeads]);
  saveLeads(merged);

  // Mark all locations in this batch as complete (skip for city-targeted runs
  // so they can be re-scraped in future normal batch runs as well).
  if (!CITIES_FILTER) {
    for (const loc of batch) {
      markComplete(loc.ID);
    }
  }

  const after = getCoverageSummary();
  console.log("[scraper] ────────────────────────────────────────────────");
  console.log(`[scraper] New leads collected : ${newLeads.length}`);
  console.log(`[scraper] Total unique leads  : ${merged.length}`);
  if (!CITIES_FILTER) {
    console.log(
      `[scraper] Coverage after run  : ` +
        `${after.completedLocations}/${after.totalLocations} locations` +
        ` (${after.pendingLocations} remaining)`,
    );
  }
  console.log("[scraper] Done.");
}

// Only run the standalone scraper when invoked directly (not when imported).
if (require.main === module) {
  runScraper().catch((err) => {
    console.error("[scraper] Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { scrapeGoogleMaps };
