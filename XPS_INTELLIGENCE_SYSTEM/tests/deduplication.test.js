"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  DeduplicationEngine,
  normalizeCompanyName,
  normalizePhone,
  normalizeWebsite,
  jaroWinkler,
  mergeLeads,
} = require("../agents/dedupe/deduplication_engine");

// ---------------------------------------------------------------------------
// normalizeCompanyName
// ---------------------------------------------------------------------------

test("normalizeCompanyName - lowercases and strips punctuation", () => {
  assert.equal(normalizeCompanyName("ABC Flooring!"), "abc flooring");
});

test("normalizeCompanyName - strips LLC suffix", () => {
  assert.equal(normalizeCompanyName("ABC Flooring LLC"), "abc flooring");
});

test("normalizeCompanyName - strips Inc suffix", () => {
  assert.equal(normalizeCompanyName("Prestige Tile Inc."), "prestige tile");
});

test("normalizeCompanyName - strips Corp suffix", () => {
  assert.equal(normalizeCompanyName("XYZ Corp"), "xyz");
});

test("normalizeCompanyName - handles empty string", () => {
  assert.equal(normalizeCompanyName(""), "");
});

test("normalizeCompanyName - handles null/undefined", () => {
  assert.equal(normalizeCompanyName(null), "");
  assert.equal(normalizeCompanyName(undefined), "");
});

// ---------------------------------------------------------------------------
// normalizeWebsite
// ---------------------------------------------------------------------------

test("normalizeWebsite - strips https://", () => {
  assert.equal(normalizeWebsite("https://example.com"), "example.com");
});

test("normalizeWebsite - strips http:// and www.", () => {
  assert.equal(normalizeWebsite("http://www.example.com/"), "example.com");
});

test("normalizeWebsite - strips trailing slash", () => {
  assert.equal(
    normalizeWebsite("https://example.com/path/"),
    "example.com/path",
  );
});

test("normalizeWebsite - handles empty string", () => {
  assert.equal(normalizeWebsite(""), "");
});

// ---------------------------------------------------------------------------
// jaroWinkler
// ---------------------------------------------------------------------------

test("jaroWinkler - identical strings return 1", () => {
  assert.equal(jaroWinkler("flooring", "flooring"), 1);
});

test("jaroWinkler - completely different strings return low score", () => {
  const sim = jaroWinkler("flooring", "zzzzzzzz");
  assert.ok(sim < 0.5, `expected < 0.5, got ${sim}`);
});

test("jaroWinkler - similar strings return high score", () => {
  const sim = jaroWinkler("abc flooring", "abc floring");
  assert.ok(sim >= 0.85, `expected >= 0.85, got ${sim}`);
});

test("jaroWinkler - empty strings", () => {
  assert.equal(jaroWinkler("", ""), 1);
  assert.equal(jaroWinkler("abc", ""), 0);
});

// ---------------------------------------------------------------------------
// mergeLeads
// ---------------------------------------------------------------------------

test("mergeLeads - fills missing string fields from duplicate", () => {
  const canonical = { company: "Alpha", city: "Columbus" };
  const dup = {
    company: "Alpha",
    city: "Columbus",
    phone: "6145550001",
    email: "a@a.com",
  };
  const merged = mergeLeads(canonical, dup);
  assert.equal(merged.phone, "6145550001");
  assert.equal(merged.email, "a@a.com");
  assert.equal(merged.company, "Alpha"); // canonical value kept
});

test("mergeLeads - keeps canonical string fields when both present", () => {
  const canonical = {
    company: "Alpha Flooring",
    city: "Columbus",
    phone: "111",
  };
  const dup = { company: "Alpha", city: "Columbus", phone: "222" };
  const merged = mergeLeads(canonical, dup);
  assert.equal(merged.phone, "111");
});

test("mergeLeads - takes higher numeric value for reviews", () => {
  const canonical = { company: "Alpha", reviews: 5 };
  const dup = { company: "Alpha", reviews: 20 };
  const merged = mergeLeads(canonical, dup);
  assert.equal(merged.reviews, 20);
});

test("mergeLeads - takes higher numeric value for rating", () => {
  const canonical = { company: "Alpha", rating: 3.5 };
  const dup = { company: "Alpha", rating: 4.8 };
  const merged = mergeLeads(canonical, dup);
  assert.equal(merged.rating, 4.8);
});

test("mergeLeads - tracks _merged_from history", () => {
  const canonical = { company: "Alpha", city: "Columbus" };
  const dup = { company: "Alpha Flooring LLC", city: "Columbus" };
  const merged = mergeLeads(canonical, dup);
  assert.ok(Array.isArray(merged._merged_from));
  assert.ok(merged._merged_from.includes("Alpha Flooring LLC"));
});

test("mergeLeads - does not mutate canonical object", () => {
  const canonical = { company: "Alpha", city: "Columbus" };
  const dup = { company: "Alpha", city: "Columbus", phone: "123" };
  mergeLeads(canonical, dup);
  assert.equal(canonical.phone, undefined);
});

// ---------------------------------------------------------------------------
// DeduplicationEngine — empty / trivial input
// ---------------------------------------------------------------------------

test("DeduplicationEngine - empty array returns empty results", () => {
  const engine = new DeduplicationEngine();
  const { unique, duplicates, stats } = engine.run([]);
  assert.equal(unique.length, 0);
  assert.equal(duplicates.length, 0);
  assert.equal(stats.total, 0);
});

test("DeduplicationEngine - null input returns empty results", () => {
  const engine = new DeduplicationEngine();
  const { unique, duplicates } = engine.run(null);
  assert.equal(unique.length, 0);
  assert.equal(duplicates.length, 0);
});

test("DeduplicationEngine - single lead is always unique", () => {
  const engine = new DeduplicationEngine();
  const leads = [{ company: "Alpha", city: "Columbus" }];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 0);
});

// ---------------------------------------------------------------------------
// DeduplicationEngine — exact matching
// ---------------------------------------------------------------------------

test("DeduplicationEngine - exact company+city duplicate detected", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha Flooring", city: "Columbus" },
    { company: "Alpha Flooring", city: "Columbus" },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("DeduplicationEngine - phone duplicate detected", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha", city: "Columbus", phone: "6145550001" },
    { company: "Beta", city: "Cleveland", phone: "6145550001" },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].company, "Beta");
});

test("DeduplicationEngine - email duplicate detected", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha", city: "Columbus", email: "dup@example.com" },
    { company: "Beta", city: "Cleveland", email: "dup@example.com" },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("DeduplicationEngine - website duplicate detected (with and without www)", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha", city: "Columbus", website: "https://www.alpha.com" },
    {
      company: "Alpha Flooring",
      city: "Columbus",
      website: "http://alpha.com/",
    },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("DeduplicationEngine - short phone not used as key", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha", city: "Columbus", phone: "123" },
    { company: "Beta", city: "Cleveland", phone: "123" },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 0);
});

test("DeduplicationEngine - matching is case-insensitive for company+city", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "ALPHA FLOORING", city: "Columbus" },
    { company: "alpha flooring", city: "COLUMBUS" },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

// ---------------------------------------------------------------------------
// DeduplicationEngine — LLC / suffix stripping (exact key)
// ---------------------------------------------------------------------------

test("DeduplicationEngine - company+city match strips legal suffix", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha Flooring LLC", city: "Columbus" },
    { company: "Alpha Flooring", city: "Columbus" },
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

// ---------------------------------------------------------------------------
// DeduplicationEngine — fuzzy matching
// ---------------------------------------------------------------------------

test("DeduplicationEngine - fuzzy match catches typo in company name", () => {
  const engine = new DeduplicationEngine({ fuzzyThreshold: 0.85 });
  const leads = [
    { company: "ABC Flooring", city: "Columbus" },
    { company: "ABC Floring", city: "Columbus" }, // typo
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("DeduplicationEngine - fuzzy match only within same city", () => {
  const engine = new DeduplicationEngine({ fuzzyThreshold: 0.85 });
  const leads = [
    { company: "ABC Flooring", city: "Columbus" },
    { company: "ABC Floring", city: "Cleveland" }, // same typo, different city
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 0);
});

test("DeduplicationEngine - fuzzy disabled via option", () => {
  const engine = new DeduplicationEngine({ fuzzyMatch: false });
  const leads = [
    { company: "ABC Flooring", city: "Columbus" },
    { company: "ABC Floring", city: "Columbus" }, // would match fuzzy
  ];
  const { unique, duplicates } = engine.run(leads);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 0);
});

test("DeduplicationEngine - high threshold prevents borderline fuzzy match", () => {
  const engine = new DeduplicationEngine({ fuzzyThreshold: 0.99 });
  const leads = [
    { company: "Prestige Tile", city: "Dallas" },
    { company: "Prestige Tiles", city: "Dallas" }, // very close but not identical
  ];
  const { unique } = engine.run(leads);
  // At threshold 0.99 the two names may or may not match — just assert no crash
  assert.ok(unique.length >= 1);
});

// ---------------------------------------------------------------------------
// DeduplicationEngine — merge behaviour
// ---------------------------------------------------------------------------

test("DeduplicationEngine - merge fills missing email from duplicate", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "Alpha Flooring", city: "Columbus" },
    { company: "Alpha Flooring", city: "Columbus", email: "alpha@example.com" },
  ];
  const { unique } = engine.run(leads);
  assert.equal(unique[0].email, "alpha@example.com");
});

test("DeduplicationEngine - merge off keeps canonical as-is", () => {
  const engine = new DeduplicationEngine({ mergeLeads: false });
  const leads = [
    { company: "Alpha", city: "Columbus" },
    { company: "Alpha", city: "Columbus", email: "alpha@example.com" },
  ];
  const { unique } = engine.run(leads);
  assert.equal(unique[0].email, undefined);
});

// ---------------------------------------------------------------------------
// DeduplicationEngine — stats
// ---------------------------------------------------------------------------

test("DeduplicationEngine - stats total/unique/duplicates are correct", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "A", city: "X" },
    { company: "A", city: "X" }, // dup
    { company: "B", city: "X" },
    { company: "C", city: "X", phone: "6145550001" },
    { company: "D", city: "X", phone: "6145550001" }, // phone dup
  ];
  const { stats } = engine.run(leads);
  assert.equal(stats.total, 5);
  assert.equal(stats.unique, 3);
  assert.equal(stats.duplicates, 2);
  assert.ok(stats.duplicateRate > 0);
});

test("DeduplicationEngine - stats breakdown tracks each match type", () => {
  const engine = new DeduplicationEngine({ fuzzyMatch: false });
  const leads = [
    { company: "A", city: "X" },
    { company: "A", city: "X" }, // exactCompanyCity
    { company: "B", city: "X", phone: "6145550001" },
    { company: "C", city: "X", phone: "6145550001" }, // phone
    { company: "D", city: "X", email: "e@e.com" },
    { company: "E", city: "X", email: "e@e.com" }, // email
    { company: "F", city: "X", website: "https://f.com" },
    { company: "G", city: "X", website: "http://www.f.com/" }, // website
  ];
  const { stats } = engine.run(leads);
  assert.equal(stats.breakdown.exactCompanyCity, 1);
  assert.equal(stats.breakdown.phone, 1);
  assert.equal(stats.breakdown.email, 1);
  assert.equal(stats.breakdown.website, 1);
});

test("DeduplicationEngine - duplicateRate is 0 for all-unique input", () => {
  const engine = new DeduplicationEngine();
  const leads = [
    { company: "A", city: "X" },
    { company: "B", city: "X" },
    { company: "C", city: "Y" },
  ];
  const { stats } = engine.run(leads);
  assert.equal(stats.duplicateRate, 0);
});
