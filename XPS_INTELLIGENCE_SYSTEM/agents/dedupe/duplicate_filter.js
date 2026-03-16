"use strict";

/**
 * duplicate_filter.js
 *
 * Lightweight stateful duplicate checker used by early-stage pipeline steps.
 * For full deduplication of a leads array (fuzzy matching, merge, reporting)
 * use agents/dedupe/deduplication_engine.js instead.
 */

const { normalizeCompanyName } = require("./deduplication_engine");

const seen = new Set();

/**
 * Returns true if the given company name has already been seen in this
 * process lifetime (case-insensitive, strips common legal suffixes).
 * Registers the name on first call so subsequent calls return true.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isDuplicate(name) {
  const key = normalizeCompanyName(name);
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

/** Clears the internal seen-set (useful in tests). */
function reset() {
  seen.clear();
}

module.exports = isDuplicate;
module.exports.reset = reset;
