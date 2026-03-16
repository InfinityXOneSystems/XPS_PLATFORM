#!/usr/bin/env node
"use strict";

/**
 * scripts/migrate_with_retry.js
 * ================================
 * Run Knex database migrations with retry logic so that Railway's
 * preDeployCommand waits for Postgres to become ready before migrating.
 *
 * Exits 0 on success OR after exhausting retries so the gateway always starts.
 *
 * Usage:
 *   node scripts/migrate_with_retry.js
 *
 * Env vars honoured:
 *   DATABASE_URL          — full Postgres connection string (Railway default)
 *   MIGRATE_MAX_RETRIES   — maximum attempts            (default: 10)
 *   MIGRATE_RETRY_DELAY   — milliseconds between retries (default: 5000)
 *   SKIP_MIGRATIONS       — set to "true" to skip entirely (CI / no-DB)
 */

require("dotenv").config();

const { execSync } = require("child_process");

const MAX_RETRIES = parseInt(process.env.MIGRATE_MAX_RETRIES || "10", 10);
const RETRY_DELAY_MS = parseInt(process.env.MIGRATE_RETRY_DELAY || "5000", 10);

if (process.env.SKIP_MIGRATIONS === "true") {
  console.log("[migrate] SKIP_MIGRATIONS=true — skipping.");
  process.exit(0);
}

if (
  !process.env.DATABASE_URL &&
  !process.env.DATABASE_HOST &&
  !process.env.PGHOST
) {
  console.warn(
    "[migrate] No DATABASE_URL or DATABASE_HOST found — skipping migrations.",
  );
  process.exit(0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[migrate] Attempt ${attempt}/${MAX_RETRIES} — running knex migrate:latest …`,
      );
      execSync("npx knex migrate:latest --knexfile knexfile.js", {
        stdio: ["inherit", "inherit", "pipe"],
        env: { ...process.env },
      });
      console.log("[migrate] ✅ Migrations completed successfully.");
      return true;
    } catch (err) {
      // Capture stderr for a human-readable failure reason
      const stderrText = err.stderr ? err.stderr.toString().trim() : "";
      const reason = stderrText.includes("ECONNREFUSED")
        ? "PostgreSQL not reachable (ECONNREFUSED) — database may still be starting"
        : stderrText.includes("password")
          ? "PostgreSQL authentication failed — check PGPASSWORD / DATABASE_URL"
          : stderrText.includes("ETIMEDOUT")
            ? "PostgreSQL connection timed out — check PGHOST and network configuration"
            : stderrText.split("\n")[0].slice(0, 200) ||
              err.message ||
              "unknown error running knex migrate:latest";
      console.error(
        `[migrate] ❌ Migration attempt ${attempt} failed: ${reason}`,
      );

      if (attempt < MAX_RETRIES) {
        console.log(`[migrate] Retrying in ${RETRY_DELAY_MS / 1000}s …`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error(`[migrate] ⚠️  All ${MAX_RETRIES} migration attempts failed.`);
  console.error("[migrate] Continuing anyway so the gateway can start.");
  return false;
}

runMigrations().then(() => {
  process.exit(0);
});
