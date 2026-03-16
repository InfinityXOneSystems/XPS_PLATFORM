"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateLead } = require("../validators/lead_validator");
const { dedupe } = require("../validation/dedupe");
const {
  runValidationPipeline,
} = require("../validation/lead_validation_pipeline");

// ---------------------------------------------------------------------------
// validateLead
// ---------------------------------------------------------------------------

test("validateLead - valid lead with all fields", () => {
  const lead = {
    company: "Acme Flooring",
    phone: "614-555-0000",
    email: "info@acme.com",
    website: "https://acme.com",
    city: "Columbus",
    rating: 4.5,
    reviews: 20,
  };
  const result = validateLead(lead);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.score, 100);
});

test("validateLead - missing required company field", () => {
  const lead = { phone: "614-555-0000" };
  const result = validateLead(lead);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("company")));
});

test("validateLead - invalid email format", () => {
  const lead = { company: "ACME", email: "not-an-email" };
  const result = validateLead(lead);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("email")));
});

test("validateLead - invalid website format", () => {
  const lead = { company: "ACME", website: "not-a-url" };
  const result = validateLead(lead);
  assert.ok(result.warnings.some((w) => w.includes("website")));
});

test("validateLead - rating out of range produces warning", () => {
  const lead = { company: "ACME", rating: 6 };
  const result = validateLead(lead);
  assert.ok(result.warnings.some((w) => w.includes("Rating")));
});

test("validateLead - negative reviews produces warning", () => {
  const lead = { company: "ACME", reviews: -5 };
  const result = validateLead(lead);
  assert.ok(result.warnings.some((w) => w.includes("reviews")));
});

test("validateLead - score calculation partial fields", () => {
  const lead = { company: "ACME", phone: "614-555-0000" };
  const result = validateLead(lead);
  // company and phone each contribute; email, website, city, rating, reviews are absent
  assert.ok(
    result.score > 0,
    "score should be positive when fields are present",
  );
  assert.ok(
    result.score < 100,
    "score should be less than 100 when fields are missing",
  );
});

test("validateLead - warning for missing city", () => {
  const lead = { company: "ACME" };
  const result = validateLead(lead);
  assert.ok(result.warnings.some((w) => w.includes("city")));
});

// ---------------------------------------------------------------------------
// dedupe
// ---------------------------------------------------------------------------

test("dedupe - no duplicates returns all as unique", () => {
  const leads = [
    {
      company: "Alpha",
      city: "Columbus",
      phone: "6145550001",
      email: "a@a.com",
    },
    {
      company: "Beta",
      city: "Cleveland",
      phone: "6145550002",
      email: "b@b.com",
    },
  ];
  const { unique, duplicates } = dedupe(leads);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 0);
});

test("dedupe - exact company+city duplicate detected", () => {
  const leads = [
    { company: "Alpha", city: "Columbus" },
    { company: "Alpha", city: "Columbus" },
  ];
  const { unique, duplicates } = dedupe(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("dedupe - phone duplicate detected", () => {
  const leads = [
    { company: "Alpha", city: "Columbus", phone: "6145550001" },
    { company: "Beta", city: "Cleveland", phone: "6145550001" },
  ];
  const { unique, duplicates } = dedupe(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("dedupe - email duplicate detected", () => {
  const leads = [
    { company: "Alpha", city: "Columbus", email: "dup@example.com" },
    { company: "Beta", city: "Cleveland", email: "dup@example.com" },
  ];
  const { unique, duplicates } = dedupe(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("dedupe - company+city comparison is case-insensitive", () => {
  const leads = [
    { company: "ALPHA FLOORING", city: "Columbus" },
    { company: "alpha flooring", city: "COLUMBUS" },
  ];
  const { unique, duplicates } = dedupe(leads);
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 1);
});

test("dedupe - short phone numbers not used as dedupe key", () => {
  const leads = [
    { company: "Alpha", city: "Columbus", phone: "123" },
    { company: "Beta", city: "Cleveland", phone: "123" },
  ];
  const { unique, duplicates } = dedupe(leads);
  assert.equal(unique.length, 2); // too short, not a dedupe key
  assert.equal(duplicates.length, 0);
});

// ---------------------------------------------------------------------------
// runValidationPipeline
// ---------------------------------------------------------------------------

test("runValidationPipeline - valid leads pass through", () => {
  const leads = [
    { company: "Acme", phone: "614-555-0001", city: "Columbus" },
    { company: "Beta", phone: "614-555-0002", city: "Cleveland" },
  ];
  const result = runValidationPipeline(leads);
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.valid, 2);
  assert.equal(result.summary.invalid, 0);
  assert.equal(result.summary.unique, 2);
  assert.equal(result.summary.duplicates, 0);
});

test("runValidationPipeline - invalid leads are separated", () => {
  const leads = [
    { company: "Acme" }, // valid (company present)
    { phone: "614-555-0000" }, // invalid (no company)
  ];
  const result = runValidationPipeline(leads);
  assert.equal(result.summary.valid, 1);
  assert.equal(result.summary.invalid, 1);
});

test("runValidationPipeline - duplicate valid leads are deduplicated", () => {
  const leads = [
    { company: "Acme", city: "Columbus" },
    { company: "Acme", city: "Columbus" }, // duplicate
  ];
  const result = runValidationPipeline(leads);
  assert.equal(result.summary.unique, 1);
  assert.equal(result.summary.duplicates, 1);
});

test("runValidationPipeline - empty input returns zero counts", () => {
  const result = runValidationPipeline([]);
  assert.equal(result.summary.total, 0);
  assert.equal(result.summary.valid, 0);
  assert.equal(result.summary.invalid, 0);
  assert.equal(result.summary.unique, 0);
  assert.equal(result.summary.duplicates, 0);
});

test("runValidationPipeline - annotated leads contain _validation metadata", () => {
  const leads = [{ company: "Acme", city: "Columbus" }];
  const result = runValidationPipeline(leads);
  assert.ok(result.valid[0]._validation);
  assert.equal(typeof result.valid[0]._validation.score, "number");
});
