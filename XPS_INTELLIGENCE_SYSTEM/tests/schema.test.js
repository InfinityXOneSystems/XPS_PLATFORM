"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateLeadContract,
} = require("../validators/lead_contract_validator");
const schema = require("../contracts/lead_schema.json");

// ---------------------------------------------------------------------------
// Schema contract structure
// ---------------------------------------------------------------------------

test("schema - has $schema and title", () => {
  assert.ok(schema.$schema, "schema must declare $schema");
  assert.equal(schema.title, "Lead");
});

test("schema - defines required field: company", () => {
  assert.ok(Array.isArray(schema.required), "required must be an array");
  assert.ok(schema.required.includes("company"), "company must be required");
});

test("schema - defines all core properties", () => {
  const coreFields = [
    "id",
    "company",
    "company_name",
    "contact_name",
    "phone",
    "email",
    "website",
    "linkedin",
    "address",
    "city",
    "state",
    "country",
    "industry",
    "category",
    "keyword",
    "rating",
    "reviews",
    "lead_score",
    "score",
    "tier",
    "status",
    "source",
    "date_scraped",
    "date_discovered",
    "last_contacted",
    "_validation",
  ];
  for (const field of coreFields) {
    assert.ok(
      field in schema.properties,
      `schema.properties must include '${field}'`,
    );
  }
});

test("schema - rating has minimum 0 and maximum 5", () => {
  const rating = schema.properties.rating;
  assert.equal(rating.minimum, 0);
  assert.equal(rating.maximum, 5);
});

test("schema - lead_score and score have minimum 0 and maximum 100", () => {
  assert.equal(schema.properties.lead_score.minimum, 0);
  assert.equal(schema.properties.lead_score.maximum, 100);
  assert.equal(schema.properties.score.minimum, 0);
  assert.equal(schema.properties.score.maximum, 100);
});

test("schema - tier enum is [HOT, WARM, COLD]", () => {
  assert.deepEqual(schema.properties.tier.enum, ["HOT", "WARM", "COLD"]);
});

test("schema - status enum includes new, contacted, qualified, closed, rejected", () => {
  const allowed = ["new", "contacted", "qualified", "closed", "rejected"];
  for (const s of allowed) {
    assert.ok(
      schema.properties.status.enum.includes(s),
      `status enum must include '${s}'`,
    );
  }
});

// ---------------------------------------------------------------------------
// validateLeadContract — valid leads
// ---------------------------------------------------------------------------

test("validateLeadContract - minimal valid lead (company only)", () => {
  const result = validateLeadContract({ company: "Acme Flooring" });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateLeadContract - fully populated valid lead", () => {
  const lead = {
    id: 1,
    company: "XPS Epoxy Co",
    company_name: "XPS Epoxy Co",
    contact_name: "Jane Doe",
    phone: "614-555-1234",
    email: "jane@xps.com",
    website: "https://xps.com",
    linkedin: "https://linkedin.com/company/xps",
    address: "123 Main St",
    city: "Columbus",
    state: "OH",
    country: "US",
    industry: "Epoxy",
    category: "Epoxy",
    keyword: "epoxy flooring",
    rating: 4.8,
    reviews: 120,
    lead_score: 85,
    score: 85,
    tier: "HOT",
    status: "new",
    source: "google_maps",
    date_scraped: "2026-03-07T12:00:00Z",
    date_discovered: "2026-03-07",
    last_contacted: "2026-03-07T14:00:00Z",
  };
  const result = validateLeadContract(lead);
  assert.equal(
    result.valid,
    true,
    `Unexpected errors: ${result.errors?.join(", ") || "none"}`,
  );
});

// ---------------------------------------------------------------------------
// validateLeadContract — missing required field
// ---------------------------------------------------------------------------

test("validateLeadContract - missing company returns invalid", () => {
  const result = validateLeadContract({ phone: "614-555-0000" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("company")));
});

test("validateLeadContract - empty company string returns invalid", () => {
  const result = validateLeadContract({ company: "" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("company")));
});

test("validateLeadContract - null input returns invalid", () => {
  const result = validateLeadContract(null);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------------------
// validateLeadContract — type checks
// ---------------------------------------------------------------------------

test("validateLeadContract - rating as string returns error", () => {
  const result = validateLeadContract({ company: "ACME", rating: "four" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("rating")));
});

test("validateLeadContract - reviews as float returns error", () => {
  const result = validateLeadContract({ company: "ACME", reviews: 4.5 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("reviews")));
});

// ---------------------------------------------------------------------------
// validateLeadContract — range checks
// ---------------------------------------------------------------------------

test("validateLeadContract - rating above 5 returns error", () => {
  const result = validateLeadContract({ company: "ACME", rating: 6 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("rating")));
});

test("validateLeadContract - lead_score above 100 returns error", () => {
  const result = validateLeadContract({ company: "ACME", lead_score: 101 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("lead_score")));
});

test("validateLeadContract - score below 0 returns error", () => {
  const result = validateLeadContract({ company: "ACME", score: -1 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("score")));
});

// ---------------------------------------------------------------------------
// validateLeadContract — format checks
// ---------------------------------------------------------------------------

test("validateLeadContract - invalid email returns error", () => {
  const result = validateLeadContract({ company: "ACME", email: "not-email" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("email")));
});

test("validateLeadContract - invalid website returns error", () => {
  const result = validateLeadContract({
    company: "ACME",
    website: "not-a-url",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("website")));
});

test("validateLeadContract - valid https website passes", () => {
  const result = validateLeadContract({
    company: "ACME",
    website: "https://example.com",
  });
  assert.equal(result.valid, true);
});

// ---------------------------------------------------------------------------
// validateLeadContract — enum checks
// ---------------------------------------------------------------------------

test("validateLeadContract - invalid tier returns error", () => {
  const result = validateLeadContract({ company: "ACME", tier: "LUKEWARM" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("tier")));
});

test("validateLeadContract - invalid status returns error", () => {
  const result = validateLeadContract({ company: "ACME", status: "pending" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("status")));
});

// ---------------------------------------------------------------------------
// validateLeadContract — additionalProperties allowed (true at root)
// ---------------------------------------------------------------------------

test("validateLeadContract - unknown extra fields are allowed", () => {
  const result = validateLeadContract({
    company: "ACME",
    custom_crm_id: "XYZ-999",
  });
  assert.equal(result.valid, true);
});

// ---------------------------------------------------------------------------
// validateLeadContract — _validation nested object
// ---------------------------------------------------------------------------

test("validateLeadContract - valid _validation metadata passes", () => {
  const result = validateLeadContract({
    company: "ACME",
    _validation: { score: 80, errors: [], warnings: ["Missing city"] },
  });
  assert.equal(result.valid, true);
});

test("validateLeadContract - _validation with extra property returns error", () => {
  const result = validateLeadContract({
    company: "ACME",
    _validation: { score: 80, unknown_field: true },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("_validation")));
});
