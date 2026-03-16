#!/usr/bin/env node
"use strict";

/**
 * scripts/auto_resolve_conflicts.js
 *
 * Resolves git-style conflict markers in text/JSON files by keeping the
 * "ours" (HEAD) side of each conflict block.
 *
 * Usage:
 *   node scripts/auto_resolve_conflicts.js <file> [--dry-run]
 *
 * Options:
 *   --dry-run   Print resolved content to stdout without modifying the file.
 *
 * Exit codes:
 *   0  No conflicts found, or conflicts resolved successfully.
 *   1  File not found or could not be read/written.
 */

const fs = require("fs");
const path = require("path");

const CONFLICT_START = /^<{7}( .*)?$/m;
const CONFLICT_SEP = /^={7}$/m;
const CONFLICT_END = /^>{7}( .*)?$/m;

/**
 * Returns true when the text contains at least one conflict marker.
 * @param {string} content
 * @returns {boolean}
 */
function hasConflicts(content) {
  return CONFLICT_START.test(content);
}

/**
 * Counts the number of conflict blocks in the given text.
 * @param {string} content
 * @returns {number}
 */
function countConflicts(content) {
  const matches = content.match(/^<{7}( .*)?$/gm);
  return matches ? matches.length : 0;
}

/**
 * Resolves all conflict blocks in content by keeping the "ours" (HEAD) side.
 * Lines between <<<<<<< and ======= are kept; lines between ======= and
 * >>>>>>> are discarded.
 *
 * @param {string} content
 * @returns {{ resolved: string, count: number }}
 */
function resolveConflicts(content) {
  const lines = content.split("\n");
  const output = [];
  let inOurs = false;
  let inTheirs = false;
  let count = 0;

  for (const line of lines) {
    if (/^<{7}( .*)?$/.test(line)) {
      inOurs = true;
      inTheirs = false;
      count += 1;
      continue;
    }
    if (/^={7}$/.test(line)) {
      inOurs = false;
      inTheirs = true;
      continue;
    }
    if (/^>{7}( .*)?$/.test(line)) {
      inOurs = false;
      inTheirs = false;
      continue;
    }

    if (!inTheirs) {
      output.push(line);
    }
  }

  return { resolved: output.join("\n"), count };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error(
      "[resolver] Usage: auto_resolve_conflicts.js <file> [--dry-run]",
    );
    process.exit(1);
  }

  const abs = path.resolve(filePath);

  let content;
  try {
    content = fs.readFileSync(abs, "utf-8");
  } catch (err) {
    console.error(`[resolver] Cannot read file: ${abs}`);
    console.error(`[resolver] ${err.message}`);
    process.exit(1);
  }

  if (!hasConflicts(content)) {
    console.log(`[resolver] No conflicts in ${filePath}. Nothing to do.`);
    process.exit(0);
  }

  const { resolved, count } = resolveConflicts(content);
  console.log(`[resolver] Resolved ${count} conflict(s) in ${filePath}.`);

  if (dryRun) {
    console.log("[resolver] Dry-run mode – file not modified.");
    process.stdout.write(resolved);
    process.exit(0);
  }

  try {
    fs.writeFileSync(abs, resolved, "utf-8");
    console.log(`[resolver] Written: ${abs}`);
  } catch (err) {
    console.error(`[resolver] Cannot write file: ${abs}`);
    console.error(`[resolver] ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
}

module.exports = { hasConflicts, countConflicts, resolveConflicts };

if (require.main === module) {
  main();
}
