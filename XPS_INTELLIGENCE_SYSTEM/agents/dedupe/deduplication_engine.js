"use strict";

const MIN_PHONE_DIGITS = 7;
const DEFAULT_FUZZY_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a company name for fuzzy comparison.
 * Strips common legal suffixes (LLC, Inc, Corp …) and punctuation so that
 * "ABC Flooring LLC" and "ABC Flooring" resolve to the same key.
 * @param {string} name
 * @returns {string}
 */
function normalizeCompanyName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|dba|the)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalises a phone number to digits only.
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Normalises a website URL for deduplication.
 * Strips protocol, leading "www.", and trailing slashes.
 * @param {string} url
 * @returns {string}
 */
function normalizeWebsite(url) {
  return (url || "")
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Jaro-Winkler similarity
// ---------------------------------------------------------------------------

/**
 * Computes the Jaro similarity between two strings.
 * @param {string} s1
 * @param {string} s2
 * @returns {number} Value in [0, 1]
 */
function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Computes Jaro-Winkler similarity (boosts prefix matches).
 * @param {string} s1
 * @param {string} s2
 * @returns {number} Value in [0, 1]
 */
function jaroWinkler(s1, s2) {
  const jaroSim = jaro(s1, s2);
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaroSim + prefix * 0.1 * (1 - jaroSim);
}

// ---------------------------------------------------------------------------
// Lead merge strategy
// ---------------------------------------------------------------------------

/**
 * Merges a duplicate lead into the canonical lead, producing the most
 * complete version of the record.
 *
 * Rules:
 *  - String fields: keep canonical value; fill any missing field from duplicate.
 *  - Numeric fields: prefer the higher value (more reviews, higher rating).
 *  - Tracks merged-from history in `_merged_from`.
 *
 * @param {Object} canonical - The lead to keep.
 * @param {Object} duplicate - The lead being absorbed.
 * @returns {Object} Merged lead (canonical is not mutated).
 */
function mergeLeads(canonical, duplicate) {
  const merged = Object.assign({}, canonical);

  const stringFields = [
    "company",
    "phone",
    "email",
    "website",
    "address",
    "city",
    "state",
    "category",
    "source",
  ];
  const numericFields = ["rating", "reviews", "lead_score"];

  for (const field of stringFields) {
    if (!merged[field] && duplicate[field]) {
      merged[field] = duplicate[field];
    }
  }

  for (const field of numericFields) {
    const dupVal = duplicate[field];
    if (dupVal != null && (merged[field] == null || dupVal > merged[field])) {
      merged[field] = dupVal;
    }
  }

  if (!Array.isArray(merged._merged_from)) {
    merged._merged_from = merged._merged_from ? [merged._merged_from] : [];
  }
  merged._merged_from.push(duplicate.company || "unknown");

  return merged;
}

// ---------------------------------------------------------------------------
// DeduplicationEngine class
// ---------------------------------------------------------------------------

/**
 * Production-grade Lead Deduplication Engine.
 *
 * Matching strategies applied in order (first match wins):
 *  1. Exact normalised company + city
 *  2. Phone digits (≥ MIN_PHONE_DIGITS)
 *  3. Email address (case-insensitive)
 *  4. Normalised website domain
 *  5. Fuzzy company name (Jaro-Winkler, same city, configurable threshold)
 *
 * When `mergeLeads` is enabled (default), duplicate fields are merged into
 * the canonical lead to produce the most complete record.
 */
class DeduplicationEngine {
  /**
   * @param {object} [options]
   * @param {boolean} [options.fuzzyMatch=true]       Enable fuzzy company-name matching.
   * @param {number}  [options.fuzzyThreshold=0.85]   Jaro-Winkler similarity threshold (0–1).
   * @param {boolean} [options.mergeLeads=true]       Merge fields from duplicates into canonical.
   * @param {boolean} [options.useWebsite=true]       Use normalised website domain as dedupe key.
   * @param {boolean} [options.usePhone=true]         Use phone digits as dedupe key.
   * @param {boolean} [options.useEmail=true]         Use email address as dedupe key.
   */
  constructor(options = {}) {
    this.options = {
      fuzzyMatch: options.fuzzyMatch !== false,
      fuzzyThreshold:
        options.fuzzyThreshold != null
          ? options.fuzzyThreshold
          : DEFAULT_FUZZY_THRESHOLD,
      mergeLeads: options.mergeLeads !== false,
      useWebsite: options.useWebsite !== false,
      usePhone: options.usePhone !== false,
      useEmail: options.useEmail !== false,
    };
  }

  /**
   * Runs deduplication over an array of leads.
   *
   * @param {Object[]} leads
   * @returns {{ unique: Object[], duplicates: Object[], stats: object }}
   */
  run(leads) {
    if (!Array.isArray(leads) || leads.length === 0) {
      return { unique: [], duplicates: [], stats: this._emptyStats() };
    }

    // Maps from key → index in unique[]
    const seenCompanyCity = new Map();
    const seenPhone = new Map();
    const seenEmail = new Map();
    const seenWebsite = new Map();

    // For fuzzy matching: array of { normalizedName, city, idx }
    const fuzzyEntries = [];

    const unique = [];
    const duplicates = [];

    // Breakdown counters
    let exactMatches = 0;
    let phoneMatches = 0;
    let emailMatches = 0;
    let websiteMatches = 0;
    let fuzzyMatches = 0;

    for (const lead of leads) {
      const companyNorm = normalizeCompanyName(lead.company);
      const cityNorm = (lead.city || "").toLowerCase().trim();
      const companyCityKey = companyNorm + "|" + cityNorm;
      const phoneKey = normalizePhone(lead.phone);
      const emailKey = (lead.email || "").toLowerCase().trim();
      const websiteKey = normalizeWebsite(lead.website);

      // 1. Exact company + city
      if (seenCompanyCity.has(companyCityKey)) {
        const idx = seenCompanyCity.get(companyCityKey);
        if (this.options.mergeLeads)
          unique[idx] = mergeLeads(unique[idx], lead);
        duplicates.push(lead);
        exactMatches++;
        continue;
      }

      // 2. Phone
      if (
        this.options.usePhone &&
        phoneKey.length >= MIN_PHONE_DIGITS &&
        seenPhone.has(phoneKey)
      ) {
        const idx = seenPhone.get(phoneKey);
        if (this.options.mergeLeads)
          unique[idx] = mergeLeads(unique[idx], lead);
        duplicates.push(lead);
        phoneMatches++;
        continue;
      }

      // 3. Email
      if (
        this.options.useEmail &&
        emailKey.length > 0 &&
        seenEmail.has(emailKey)
      ) {
        const idx = seenEmail.get(emailKey);
        if (this.options.mergeLeads)
          unique[idx] = mergeLeads(unique[idx], lead);
        duplicates.push(lead);
        emailMatches++;
        continue;
      }

      // 4. Website
      if (
        this.options.useWebsite &&
        websiteKey.length > 0 &&
        seenWebsite.has(websiteKey)
      ) {
        const idx = seenWebsite.get(websiteKey);
        if (this.options.mergeLeads)
          unique[idx] = mergeLeads(unique[idx], lead);
        duplicates.push(lead);
        websiteMatches++;
        continue;
      }

      // 5. Fuzzy company name (same city required)
      let fuzzyMatchIdx = -1;
      if (this.options.fuzzyMatch && companyNorm.length >= 3) {
        for (const entry of fuzzyEntries) {
          if (entry.city !== cityNorm) continue;
          const sim = jaroWinkler(companyNorm, entry.normalizedName);
          if (sim >= this.options.fuzzyThreshold) {
            fuzzyMatchIdx = entry.idx;
            break;
          }
        }
      }

      if (fuzzyMatchIdx >= 0) {
        if (this.options.mergeLeads)
          unique[fuzzyMatchIdx] = mergeLeads(unique[fuzzyMatchIdx], lead);
        duplicates.push(lead);
        fuzzyMatches++;
        continue;
      }

      // Not a duplicate — register as canonical
      const idx = unique.length;
      unique.push(lead);

      seenCompanyCity.set(companyCityKey, idx);
      if (this.options.usePhone && phoneKey.length >= MIN_PHONE_DIGITS)
        seenPhone.set(phoneKey, idx);
      if (this.options.useEmail && emailKey.length > 0)
        seenEmail.set(emailKey, idx);
      if (this.options.useWebsite && websiteKey.length > 0)
        seenWebsite.set(websiteKey, idx);
      if (this.options.fuzzyMatch && companyNorm.length >= 3)
        fuzzyEntries.push({ normalizedName: companyNorm, city: cityNorm, idx });
    }

    const stats = {
      total: leads.length,
      unique: unique.length,
      duplicates: duplicates.length,
      duplicateRate: leads.length > 0 ? duplicates.length / leads.length : 0,
      breakdown: {
        exactCompanyCity: exactMatches,
        phone: phoneMatches,
        email: emailMatches,
        website: websiteMatches,
        fuzzy: fuzzyMatches,
      },
      generated_at: new Date().toISOString(),
    };

    return { unique, duplicates, stats };
  }

  /** @private */
  _emptyStats() {
    return {
      total: 0,
      unique: 0,
      duplicates: 0,
      duplicateRate: 0,
      breakdown: {
        exactCompanyCity: 0,
        phone: 0,
        email: 0,
        website: 0,
        fuzzy: 0,
      },
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = {
  DeduplicationEngine,
  normalizeCompanyName,
  normalizePhone,
  normalizeWebsite,
  jaroWinkler,
  mergeLeads,
};
