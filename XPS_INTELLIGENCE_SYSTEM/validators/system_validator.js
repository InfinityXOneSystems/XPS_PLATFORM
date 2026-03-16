"use strict";

/**
 * System Validator
 * Validates the overall health of the lead generation system by checking
 * required directories, files, and module functionality.
 */

const fs = require("fs");
const path = require("path");

const REQUIRED_DIRS = [
  "leads",
  "data/leads",
  "data/datasets",
  "data/outreach",
  "agents/scoring",
  "validation",
  "validators",
  "db",
];

const REQUIRED_FILES = [
  "package.json",
  "agents/scoring/lead_scoring.js",
  "agents/scoring/scoring_pipeline.js",
  "validation/lead_validation_pipeline.js",
  "validators/lead_validator.js",
  "db/db.js",
  "db/leadStore.js",
  "db/schema.sql",
];

/**
 * Validates that required directories and files exist.
 * @returns {{ ok: boolean, missing: string[], warnings: string[] }}
 */
function validateSystem() {
  const missing = [];
  const warnings = [];

  for (const dir of REQUIRED_DIRS) {
    if (!fs.existsSync(dir)) {
      warnings.push(`Directory missing: ${dir}`);
    }
  }

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(file)) {
      missing.push(`File missing: ${file}`);
    }
  }

  const ok = missing.length === 0;
  return { ok, missing, warnings };
}

/**
 * Runs system validation and logs results to console.
 * Exits with code 1 if critical files are missing.
 */
function runSystemValidation() {
  console.log("[SystemValidator] Starting system validation...");
  const result = validateSystem();

  for (const w of result.warnings) {
    console.warn("[SystemValidator] WARN:", w);
  }
  for (const m of result.missing) {
    console.error("[SystemValidator] ERROR:", m);
  }

  if (result.ok) {
    console.log("[SystemValidator] System validation passed.");
  } else {
    console.error(
      `[SystemValidator] Validation FAILED: ${result.missing.length} critical file(s) missing.`,
    );
  }

  return result;
}

module.exports = { validateSystem, runSystemValidation };

// Run directly if invoked as main module
if (require.main === module) {
  const result = runSystemValidation();
  process.exit(result.ok ? 0 : 1);
}
