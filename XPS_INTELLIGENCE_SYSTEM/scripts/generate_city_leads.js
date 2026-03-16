"use strict";
/**
 * scripts/generate_city_leads.js
 * ================================
 * DEPRECATED — this script previously generated FAKE placeholder leads.
 *
 * Real leads are now produced by the Universal Shadow Scraper:
 *   python scripts/universal_shadow_scraper.py --use-csv
 *
 * This file is kept as a thin wrapper that delegates to the real scraper
 * so any existing callers (scheduler, CI) get real data instead.
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_KEYWORDS =
  "epoxy flooring contractor,flooring contractor,general contractor,tile installer";
const DEFAULT_LOCATIONS =
  "Chicago, IL,Columbus, OH,Phoenix, AZ,Houston, TX,Atlanta, GA";

const keywords = process.env.SCRAPE_KEYWORDS || DEFAULT_KEYWORDS;
const locations = process.env.SCRAPE_LOCATIONS || DEFAULT_LOCATIONS;
const dryRun = process.argv.includes("--dry-run") ? "--dry-run" : "";

console.log(
  "[generate_city_leads] Delegating to universal_shadow_scraper.py (REAL leads only)",
);
console.log(`  Keywords : ${keywords}`);
console.log(`  Locations: ${locations}`);

try {
  execSync(
    `python scripts/universal_shadow_scraper.py ` +
      `--keywords "${keywords}" --locations "${locations}" ` +
      `--max-per-keyword 30 ${dryRun}`,
    { stdio: "inherit", cwd: ROOT },
  );
} catch (err) {
  console.error(
    "[generate_city_leads] Scraper exited with error:",
    err.message,
  );
  process.exit(1);
}
