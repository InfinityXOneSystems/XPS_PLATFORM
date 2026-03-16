"use strict";

/**
 * agents/scheduler.js
 *
 * Cron-based scheduler for nationwide lead scraping.
 *
 * Default schedule: every 2 hours – processes one batch of cities.
 * When all cities have been scraped the cycle resets automatically.
 *
 * Environment variables:
 *   SCHEDULER_CRON        – cron expression          (default: "0 *\/2 * * *")
 *   SCRAPER_BATCH_SIZE    – cities per run            (default: 10)
 *   SCRAPER_CONCURRENCY   – parallel tasks per run   (default: 3)
 *   SCRAPER_RATE_LIMIT_MS – ms between tasks         (default: 2000)
 */

const cron = require("node-cron");
const { exec } = require("child_process");
const path = require("path");
const {
  getCoverageSummary,
  resetProgress,
} = require("../scrapers/scraper_queue");

const SCHEDULER_CRON = process.env.SCHEDULER_CRON || "0 */2 * * *";
const SCRAPER_SCRIPT = path.join(
  __dirname,
  "../scrapers/google_maps_scraper.js",
);

function runScraper(env) {
  return new Promise((resolve, reject) => {
    const envOverrides = Object.assign({}, process.env, env || {});
    const child = exec(`node "${SCRAPER_SCRIPT}"`, { env: envOverrides });

    child.stdout.on("data", (data) => process.stdout.write(data));
    child.stderr.on("data", (data) => process.stderr.write(data));

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scraper exited with code ${code}`));
    });
  });
}

async function scheduledRun() {
  console.log(`[scheduler] ── Scheduled run at ${new Date().toISOString()} ──`);

  // Check if all locations have been scraped; auto-reset the cycle if so.
  const summary = getCoverageSummary();
  console.log(
    `[scheduler] Coverage: ${summary.completedLocations}/${summary.totalLocations} locations scraped`,
  );

  if (summary.pendingLocations === 0) {
    console.log(
      "[scheduler] All locations scraped – resetting cycle for next pass.",
    );
    resetProgress();
  }

  try {
    await runScraper();
    console.log("[scheduler] Scraper run completed successfully.");
  } catch (err) {
    console.error("[scheduler] Scraper run failed:", err.message);
  }
}

console.log(`[scheduler] Starting with cron: "${SCHEDULER_CRON}"`);
cron.schedule(SCHEDULER_CRON, scheduledRun);

// Run once on startup so the first batch is collected immediately.
scheduledRun().catch((err) =>
  console.error("[scheduler] Startup run failed:", err.message),
);
