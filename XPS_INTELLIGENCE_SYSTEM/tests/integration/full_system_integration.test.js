"use strict";

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "../..");
const LEADS_DIR = path.join(ROOT, "leads");

// ── helpers ───────────────────────────────────────────────────────────────────

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isValidLead(lead) {
  return (
    lead !== null &&
    typeof lead === "object" &&
    typeof (lead.name || lead.company_name || lead.company) === "string"
  );
}

function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (d) => {
        body += d;
      });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

// ── Lead schema validator stub ────────────────────────────────────────────────

function validateLeadSchema(lead) {
  const errors = [];
  if (!lead || typeof lead !== "object") {
    errors.push("Lead must be an object");
    return errors;
  }

  const name = lead.name || lead.company_name || lead.company;
  if (!name || typeof name !== "string" || name.trim() === "")
    errors.push("name/company_name/company is required");

  if (lead.phone !== undefined && lead.phone !== null) {
    if (typeof lead.phone !== "string") errors.push("phone must be a string");
  }
  if (lead.website !== undefined && lead.website !== null) {
    if (typeof lead.website !== "string")
      errors.push("website must be a string");
  }
  if (lead.score !== undefined && lead.score !== null) {
    if (typeof lead.score !== "number") errors.push("score must be a number");
  }
  return errors;
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe("Leads Data Integration", () => {
  test("leads/leads.json or leads/scored_leads.json exists", () => {
    const rawLeads = path.join(LEADS_DIR, "leads.json");
    const scoredLeads = path.join(LEADS_DIR, "scored_leads.json");
    const eitherExists = fileExists(rawLeads) || fileExists(scoredLeads);
    assert.ok(
      eitherExists,
      "At least one leads file (leads.json or scored_leads.json) must exist",
    );
  });

  test("leads file contains a valid JSON array", () => {
    const scoredFile = path.join(LEADS_DIR, "scored_leads.json");
    const rawFile = path.join(LEADS_DIR, "leads.json");
    const file = fileExists(scoredFile)
      ? scoredFile
      : fileExists(rawFile)
        ? rawFile
        : null;

    if (!file) {
      console.log("  ⚠ Skipping: no leads file found");
      return;
    }

    const data = tryReadJson(file);
    assert.ok(data !== null, "Leads file must contain valid JSON");
    assert.ok(Array.isArray(data), "Leads file must be a JSON array");
  });

  test("leads array contains valid lead objects", () => {
    const scoredFile = path.join(LEADS_DIR, "scored_leads.json");
    const rawFile = path.join(LEADS_DIR, "leads.json");
    const file = fileExists(scoredFile)
      ? scoredFile
      : fileExists(rawFile)
        ? rawFile
        : null;

    if (!file) {
      console.log("  ⚠ Skipping: no leads file found");
      return;
    }

    const leads = tryReadJson(file);
    if (!Array.isArray(leads) || leads.length === 0) {
      console.log("  ⚠ Skipping: leads array is empty");
      return;
    }

    const sample = leads.slice(0, Math.min(10, leads.length));
    const validCount = sample.filter(isValidLead).length;
    assert.ok(
      validCount > sample.length * 0.8,
      `At least 80% of sampled leads should be valid objects (got ${validCount}/${sample.length})`,
    );
  });

  test("scored leads have numeric score values", () => {
    const scoredFile = path.join(LEADS_DIR, "scored_leads.json");
    if (!fileExists(scoredFile)) {
      console.log("  ⚠ Skipping: scored_leads.json not found");
      return;
    }

    const leads = tryReadJson(scoredFile);
    if (!Array.isArray(leads) || leads.length === 0) {
      console.log("  ⚠ Skipping: scored_leads.json is empty");
      return;
    }

    const withScore = leads.filter((l) => l.score !== undefined);
    if (withScore.length === 0) {
      console.log("  ⚠ Skipping: no leads have a score field");
      return;
    }

    const allNumeric = withScore.every((l) => typeof l.score === "number");
    assert.ok(allNumeric, "All scored leads must have a numeric score field");
  });
});

describe("Lead Schema Validation", () => {
  test("validateLeadSchema returns no errors for a valid lead", () => {
    const lead = {
      id: "1",
      name: "Acme Flooring LLC",
      phone: "555-1234",
      website: "https://acme.com",
      city: "Columbus",
      state: "OH",
      score: 45,
    };
    const errors = validateLeadSchema(lead);
    assert.deepEqual(
      errors,
      [],
      `Expected no validation errors, got: ${errors.join(", ")}`,
    );
  });

  test("validateLeadSchema flags missing name", () => {
    const lead = { phone: "555-1234" };
    const errors = validateLeadSchema(lead);
    assert.ok(errors.length > 0, "Expected validation errors for missing name");
    assert.ok(
      errors.some((e) => e.includes("name")),
      "Error should mention name field",
    );
  });

  test("validateLeadSchema flags invalid score type", () => {
    const lead = { name: "Test Co", score: "45" };
    const errors = validateLeadSchema(lead);
    assert.ok(
      errors.some((e) => e.includes("score")),
      "Error should mention score field",
    );
  });

  test("validateLeadSchema handles null input gracefully", () => {
    const errors = validateLeadSchema(null);
    assert.ok(errors.length > 0, "Should return errors for null input");
  });
});

describe("Scoring Pipeline Output", () => {
  test("scoring_report.json has valid structure if present", () => {
    const reportFile = path.join(LEADS_DIR, "scoring_report.json");
    if (!fileExists(reportFile)) {
      console.log("  ⚠ Skipping: scoring_report.json not found");
      return;
    }

    const report = tryReadJson(reportFile);
    assert.ok(report !== null, "scoring_report.json must be valid JSON");
    assert.ok(typeof report === "object", "Scoring report must be an object");
  });

  test("scored leads score range is 0–100", () => {
    const scoredFile = path.join(LEADS_DIR, "scored_leads.json");
    if (!fileExists(scoredFile)) {
      console.log("  ⚠ Skipping: scored_leads.json not found");
      return;
    }

    const leads = tryReadJson(scoredFile);
    if (!Array.isArray(leads)) return;

    const withScore = leads.filter((l) => typeof l.score === "number");
    if (withScore.length === 0) return;

    const outOfRange = withScore.filter((l) => l.score < 0 || l.score > 100);
    assert.equal(
      outOfRange.length,
      0,
      `${outOfRange.length} leads have scores outside 0–100`,
    );
  });
});

describe("API Gateway", () => {
  const GATEWAY_PORT = process.env.GATEWAY_PORT || 3200;
  const BASE_URL = `http://localhost:${GATEWAY_PORT}`;

  async function gatewayAvailable() {
    try {
      await httpGet(`${BASE_URL}/api/stats`, 2000);
      return true;
    } catch {
      return false;
    }
  }

  test("API gateway /api/stats returns valid JSON envelope", async () => {
    if (!(await gatewayAvailable())) {
      console.log(
        "  ⚠ Skipping: API gateway not running on port " + GATEWAY_PORT,
      );
      return;
    }
    const { statusCode, body } = await httpGet(`${BASE_URL}/api/stats`);
    assert.equal(statusCode, 200, "Expected HTTP 200");
    assert.ok(typeof body === "object", "Response must be JSON");
    assert.ok("success" in body, "Response must have success field");
    assert.ok(body.success === true, "success must be true");
    assert.ok("data" in body, "Response must have data field");
  });

  test("API gateway /api/leads returns array of leads", async () => {
    if (!(await gatewayAvailable())) {
      console.log("  ⚠ Skipping: API gateway not running");
      return;
    }
    const { statusCode, body } = await httpGet(`${BASE_URL}/api/leads?limit=5`);
    assert.equal(statusCode, 200);
    assert.ok(body.success === true);
    assert.ok(Array.isArray(body.data.leads), "data.leads must be an array");
    assert.ok(
      typeof body.data.total === "number",
      "data.total must be a number",
    );
  });

  test("API gateway /api/leads/:id 404 for unknown id", async () => {
    if (!(await gatewayAvailable())) {
      console.log("  ⚠ Skipping: API gateway not running");
      return;
    }
    const { statusCode, body } = await httpGet(
      `${BASE_URL}/api/leads/nonexistent-id-xyz`,
    );
    assert.equal(statusCode, 404);
    assert.ok(body.success === false);
    assert.ok(typeof body.error === "string");
  });
});
