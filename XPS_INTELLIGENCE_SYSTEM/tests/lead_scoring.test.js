"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  scoreContactCompleteness,
  scoreBusinessQuality,
  detectIndustry,
  scoreGeography,
  getTier,
  scoreLead,
  scoreLeads,
  segmentByIndustry,
  segmentByTier,
  generateReport,
} = require("../agents/scoring/lead_scoring");

// ---------------------------------------------------------------------------
// scoreContactCompleteness
// ---------------------------------------------------------------------------
test("scoreContactCompleteness - full contact (company_name field)", () => {
  const lead = {
    company_name: "Acme Epoxy",
    phone: "614-555-0000",
    email: "info@acme.com",
    website: "https://acme.com",
    contact_name: "Jane Doe",
  };
  assert.equal(scoreContactCompleteness(lead), 40);
});

test("scoreContactCompleteness - full contact (company field)", () => {
  const lead = {
    company: "Acme Epoxy",
    phone: "614-555-0000",
    email: "info@acme.com",
    website: "https://acme.com",
    contact_name: "Jane Doe",
  };
  assert.equal(scoreContactCompleteness(lead), 40);
});

test("scoreContactCompleteness - minimal lead (company only)", () => {
  assert.equal(scoreContactCompleteness({ company: "Acme" }), 10);
});

test("scoreContactCompleteness - empty lead", () => {
  assert.equal(scoreContactCompleteness({}), 0);
});

// ---------------------------------------------------------------------------
// scoreBusinessQuality
// ---------------------------------------------------------------------------
test("scoreBusinessQuality - perfect score (rating 5, 100 reviews)", () => {
  assert.equal(scoreBusinessQuality({ rating: 5.0, reviews: 100 }), 30);
});

test("scoreBusinessQuality - rating 4.0 and 20 reviews", () => {
  const score = scoreBusinessQuality({ rating: 4.0, reviews: 20 });
  assert.equal(score, 20); // 10 (rating>=4.0) + 10 (reviews>=20)
});

test("scoreBusinessQuality - no rating or reviews", () => {
  assert.equal(scoreBusinessQuality({}), 0);
});

test("scoreBusinessQuality - rating 3.4 below threshold", () => {
  assert.equal(scoreBusinessQuality({ rating: 3.4, reviews: 0 }), 0);
});

// ---------------------------------------------------------------------------
// detectIndustry
// ---------------------------------------------------------------------------
test("detectIndustry - detects Epoxy from company name", () => {
  const result = detectIndustry({ company_name: "Columbus Epoxy Pros" });
  assert.equal(result.industry, "Epoxy");
  assert.equal(result.points, 20);
});

test("detectIndustry - detects Concrete from company name", () => {
  const result = detectIndustry({ company_name: "Best Concrete Polishing Co" });
  assert.equal(result.industry, "Concrete");
  assert.equal(result.points, 20);
});

test("detectIndustry - uses explicit industry field when no keyword match", () => {
  const result = detectIndustry({
    company_name: "ABC Company",
    industry: "Industrial",
  });
  assert.equal(result.industry, "Industrial");
  assert.equal(result.points, 15);
});

test("detectIndustry - returns Unknown for unrecognised lead", () => {
  const result = detectIndustry({ company_name: "Random Business" });
  assert.equal(result.industry, "Unknown");
  assert.equal(result.points, 0);
});

// ---------------------------------------------------------------------------
// scoreGeography
// ---------------------------------------------------------------------------
test("scoreGeography - primary market Columbus", () => {
  assert.equal(scoreGeography({ city: "Columbus" }), 10);
});

test("scoreGeography - primary market Tempe", () => {
  assert.equal(scoreGeography({ city: "Tempe" }), 10);
});

test("scoreGeography - secondary market Cleveland", () => {
  assert.equal(scoreGeography({ city: "Cleveland" }), 5);
});

test("scoreGeography - unknown market", () => {
  assert.equal(scoreGeography({ city: "New York" }), 0);
});

test("scoreGeography - no city", () => {
  assert.equal(scoreGeography({}), 0);
});

// ---------------------------------------------------------------------------
// getTier
// ---------------------------------------------------------------------------
test("getTier - HOT at 75", () => assert.equal(getTier(75), "HOT"));
test("getTier - HOT at 100", () => assert.equal(getTier(100), "HOT"));
test("getTier - WARM at 50", () => assert.equal(getTier(50), "WARM"));
test("getTier - WARM at 74", () => assert.equal(getTier(74), "WARM"));
test("getTier - COLD at 49", () => assert.equal(getTier(49), "COLD"));
test("getTier - COLD at 0", () => assert.equal(getTier(0), "COLD"));

// ---------------------------------------------------------------------------
// scoreLead
// ---------------------------------------------------------------------------
test("scoreLead - perfect lead scores 100", () => {
  const lead = {
    company_name: "Columbus Epoxy Pros",
    phone: "614-555-1234",
    email: "info@cep.com",
    website: "https://cep.com",
    contact_name: "John",
    city: "Columbus",
    rating: 4.8,
    reviews: 87,
    industry: "Epoxy",
  };
  const result = scoreLead(lead);
  assert.equal(result.lead_score, 100);
  assert.equal(result.tier, "HOT");
  assert.equal(result.score_breakdown.contact_completeness, 40);
  assert.equal(result.score_breakdown.business_quality, 30);
  assert.equal(result.score_breakdown.industry_relevance, 20);
  assert.equal(result.score_breakdown.geographic_priority, 10);
});

test("scoreLead - minimal lead is COLD", () => {
  const lead = { company: "X", city: "Unknown Town" };
  const result = scoreLead(lead);
  assert.ok(result.lead_score < 50);
  assert.equal(result.tier, "COLD");
});

test("scoreLead - preserves original lead fields", () => {
  const lead = { company: "Test Co", city: "Columbus", custom_field: "abc" };
  const result = scoreLead(lead);
  assert.equal(result.custom_field, "abc");
});

// ---------------------------------------------------------------------------
// scoreLeads
// ---------------------------------------------------------------------------
test("scoreLeads - returns sorted array by score descending", () => {
  const leads = [
    { company: "Low", city: "Detroit" },
    {
      company_name: "High",
      phone: "1",
      email: "a@b.com",
      website: "x.com",
      contact_name: "n",
      city: "Columbus",
      rating: 5,
      reviews: 100,
      industry: "Epoxy",
    },
  ];
  const scored = scoreLeads(leads);
  assert.ok(scored[0].lead_score >= scored[1].lead_score);
  assert.equal(scored[0].rank, 1);
  assert.equal(scored[1].rank, 2);
});

// ---------------------------------------------------------------------------
// segmentByTier
// ---------------------------------------------------------------------------
test("segmentByTier - splits into HOT/WARM/COLD", () => {
  const leads = [
    { lead_score: 80, tier: "HOT" },
    { lead_score: 55, tier: "WARM" },
    { lead_score: 20, tier: "COLD" },
  ];
  const result = segmentByTier(leads);
  assert.equal(result.HOT.length, 1);
  assert.equal(result.WARM.length, 1);
  assert.equal(result.COLD.length, 1);
});

// ---------------------------------------------------------------------------
// segmentByIndustry
// ---------------------------------------------------------------------------
test("segmentByIndustry - groups by industry_detected", () => {
  const leads = [
    { industry_detected: "Epoxy", lead_score: 90 },
    { industry_detected: "Epoxy", lead_score: 70 },
    { industry_detected: "Concrete", lead_score: 60 },
  ];
  const result = segmentByIndustry(leads);
  assert.equal(result.Epoxy.length, 2);
  assert.equal(result.Concrete.length, 1);
});

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------
test("generateReport - returns correct summary", () => {
  const leads = [
    {
      company_name: "A",
      city: "Columbus",
      lead_score: 80,
      tier: "HOT",
      industry: "Epoxy",
      industry_detected: "Epoxy",
    },
    {
      company: "B",
      city: "Tempe",
      lead_score: 55,
      tier: "WARM",
      industry: "Concrete",
      industry_detected: "Concrete",
    },
    {
      company: "C",
      city: "Detroit",
      lead_score: 20,
      tier: "COLD",
      industry: "Unknown",
      industry_detected: "Unknown",
    },
  ];
  const report = generateReport(leads);
  assert.equal(report.total_leads, 3);
  assert.equal(report.tiers.HOT, 1);
  assert.equal(report.tiers.WARM, 1);
  assert.equal(report.tiers.COLD, 1);
  assert.ok(report.generated_at);
  assert.equal(report.top_leads.length, 3);
});

test("generateReport - empty leads array", () => {
  const report = generateReport([]);
  assert.equal(report.total_leads, 0);
  assert.equal(report.average_score, 0);
});
