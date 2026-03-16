const { validateLead } = require("../validators/lead_validator");
const { dedupe } = require("./dedupe");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LEADS_DIR_PRIMARY = path.join(ROOT, "leads");
const LEADS_DIR_LEGACY = path.join(ROOT, "data", "leads");

/**
 * Quality gate thresholds.  Override via environment variables.
 */
const INVALID_RATE_THRESHOLD = parseFloat(
  process.env.VALIDATION_MAX_INVALID_RATE || "0.5",
);
const DUPLICATE_RATE_THRESHOLD = parseFloat(
  process.env.VALIDATION_MAX_DUPLICATE_RATE || "0.5",
);

/**
 * Runs the full lead validation pipeline:
 *  1. Validates each lead's fields and formats.
 *  2. Separates valid leads from invalid ones.
 *  3. Deduplicates valid leads by company+city, phone, and email.
 *  4. Writes report files to data/leads/.
 *  5. Enforces quality gates (throws when thresholds exceeded).
 *
 * @param {Object[]} leads - Raw lead objects to process.
 * @param {object}   [opts]
 * @param {boolean}  [opts.writeReports=true]   - Write JSON report files to disk.
 * @param {boolean}  [opts.enforceGates=false]  - Throw on quality-gate violation.
 * @returns {{
 *   valid: Object[],
 *   invalid: Object[],
 *   duplicates: Object[],
 *   summary: { total: number, valid: number, invalid: number, unique: number, duplicates: number }
 * }}
 */
function runValidationPipeline(leads, opts = {}) {
  const { writeReports = true, enforceGates = false } = opts;

  const valid = [];
  const invalid = [];

  for (const lead of leads) {
    const result = validateLead(lead);
    const annotated = Object.assign({}, lead, { _validation: result });
    if (result.valid) {
      valid.push(annotated);
    } else {
      invalid.push(annotated);
    }
  }

  const { unique, duplicates } = dedupe(valid);

  const summary = {
    total: leads.length,
    valid: valid.length,
    invalid: invalid.length,
    unique: unique.length,
    duplicates: duplicates.length,
    generated_at: new Date().toISOString(),
  };

  console.log("[LeadValidation] Pipeline summary:", summary);

  /**
   * Writes a file to both the primary leads/ directory and the legacy
   * data/leads/ directory for backward compatibility.
   */
  function writeToLeadsDirs(filename, content) {
    [LEADS_DIR_PRIMARY, LEADS_DIR_LEGACY].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), content);
    });
  }

  // ── Write report files ──────────────────────────────────────────────────
  if (writeReports) {
    try {
      const report = {
        summary,
        invalid_count: invalid.length,
        duplicate_count: duplicates.length,
        samples: {
          invalid: invalid.slice(0, 10),
          duplicates: duplicates.slice(0, 10),
        },
      };

      writeToLeadsDirs(
        "validation_report.json",
        JSON.stringify(report, null, 2),
      );
      writeToLeadsDirs("duplicates.json", JSON.stringify(duplicates, null, 2));
      writeToLeadsDirs("invalid_leads.json", JSON.stringify(invalid, null, 2));
    } catch (err) {
      console.error(
        "[LeadValidation] Could not write report files:",
        err.message,
      );
    }
  }

  // ── Quality gates ────────────────────────────────────────────────────────
  if (enforceGates && leads.length > 0) {
    const invalidRate = invalid.length / leads.length;
    const duplicateRate = duplicates.length / leads.length;

    if (invalidRate > INVALID_RATE_THRESHOLD) {
      throw new Error(
        `[LeadValidation] Quality gate failed: invalid rate ${(invalidRate * 100).toFixed(1)}% ` +
          `exceeds threshold ${(INVALID_RATE_THRESHOLD * 100).toFixed(1)}%`,
      );
    }
    if (duplicateRate > DUPLICATE_RATE_THRESHOLD) {
      throw new Error(
        `[LeadValidation] Quality gate failed: duplicate rate ${(duplicateRate * 100).toFixed(1)}% ` +
          `exceeds threshold ${(DUPLICATE_RATE_THRESHOLD * 100).toFixed(1)}%`,
      );
    }
  }

  return { valid: unique, invalid, duplicates, summary };
}

module.exports = { runValidationPipeline };
