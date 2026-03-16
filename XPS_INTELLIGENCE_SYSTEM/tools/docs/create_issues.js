"use strict";

/**
 * create_issues.js — Auto-create GitHub Issues from Self-Review Recommendations
 * XPS Lead Intelligence Platform
 *
 * - Reads docs/self_review.json for recommendations
 * - Searches existing issues by fingerprint to avoid duplicates
 * - Creates new issues only for items not already tracked
 * - Only creates issues for HIGH/MEDIUM severity
 *
 * Usage:
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node tools/docs/create_issues.js
 *
 * Requirements: Node.js 18+ (built-in fetch), GITHUB_TOKEN env var.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const SELF_REVIEW_PATH = path.join(ROOT, "docs", "self_review.json");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY =
  process.env.GITHUB_REPOSITORY || "InfinityXOneSystems/LEAD_GEN_INTELLIGENCE";

const [OWNER, REPO] = GITHUB_REPOSITORY.split("/");
const API_BASE = "https://api.github.com";
const LABEL_NAME = "auto-review";
const LABEL_COLOR = "eab308";
const LABEL_DESC = "Auto-created by docs_reflection workflow";

// Only create issues for these severities
const CREATE_FOR_SEVERITIES = new Set(["HIGH", "MEDIUM"]);

// ─── GitHub API Helpers ───────────────────────────────────────────────────────

async function ghRequest(method, endpoint, body) {
  if (!GITHUB_TOKEN) {
    console.warn(
      "[create_issues] GITHUB_TOKEN not set — skipping GitHub API calls",
    );
    return null;
  }

  const url = `${API_BASE}${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "xps-lead-intelligence-docs-bot/1.0",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[create_issues] GitHub API error ${res.status}: ${text.slice(0, 200)}`,
      );
      return null;
    }
    if (res.status === 204) return {};
    return await res.json();
  } catch (e) {
    console.error("[create_issues] Network error:", e.message);
    return null;
  }
}

async function ensureLabel() {
  // Try to get the label
  const existing = await ghRequest(
    "GET",
    `/repos/${OWNER}/${REPO}/labels/${encodeURIComponent(LABEL_NAME)}`,
  );
  if (existing) return; // Already exists

  // Create it
  await ghRequest("POST", `/repos/${OWNER}/${REPO}/labels`, {
    name: LABEL_NAME,
    color: LABEL_COLOR,
    description: LABEL_DESC,
  });
  console.log(`[create_issues] Created label: ${LABEL_NAME}`);
}

async function searchExistingIssues(fingerprint) {
  // Search issues by fingerprint in the body
  const query = `repo:${OWNER}/${REPO} is:issue "${fingerprint}" in:body`;
  const result = await ghRequest(
    "GET",
    `/search/issues?q=${encodeURIComponent(query)}&per_page=5`,
  );
  if (!result) return false;
  return (result.total_count || 0) > 0;
}

async function createIssue(rec) {
  const body = [
    `## ${rec.title}`,
    "",
    `**Severity:** ${rec.severity}  `,
    `**Category:** ${rec.category}  `,
    `**ID:** \`${rec.id}\`  `,
    `**Fingerprint:** \`${rec.fingerprint}\``,
    "",
    "### Description",
    "",
    rec.description,
    "",
    "### Recommended Action",
    "",
    rec.action,
    "",
    "---",
    "",
    "_Auto-created by [docs_reflection workflow](https://github.com/InfinityXOneSystems/LEAD_GEN_INTELLIGENCE/actions). " +
      "Do not remove the fingerprint line above — it prevents duplicate issue creation._",
  ].join("\n");

  const issue = await ghRequest("POST", `/repos/${OWNER}/${REPO}/issues`, {
    title: `[Auto-Review] ${rec.title}`,
    body,
    labels: [LABEL_NAME],
  });

  if (issue && issue.number) {
    console.log(`[create_issues] Created issue #${issue.number}: ${rec.title}`);
    return issue.number;
  }
  return null;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[create_issues] Starting GitHub issue creation...");

  // Load self-review data
  if (!fs.existsSync(SELF_REVIEW_PATH)) {
    console.log("[create_issues] docs/self_review.json not found — skipping");
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(SELF_REVIEW_PATH, "utf8"));
  } catch (e) {
    console.error(
      "[create_issues] Failed to parse self_review.json:",
      e.message,
    );
    return;
  }

  const recommendations = (data.recommendations || []).filter((r) =>
    CREATE_FOR_SEVERITIES.has(r.severity),
  );

  if (!recommendations.length) {
    console.log(
      "[create_issues] No HIGH/MEDIUM recommendations to create issues for.",
    );
    return;
  }

  if (!GITHUB_TOKEN) {
    console.log("[create_issues] No GITHUB_TOKEN — would create issues for:");
    recommendations.forEach((r) =>
      console.log(`  - [${r.severity}] ${r.title}`),
    );
    return;
  }

  // Ensure the label exists
  await ensureLabel();

  let created = 0;
  let skipped = 0;

  for (const rec of recommendations) {
    // Check for existing issue with this fingerprint
    const exists = await searchExistingIssues(rec.fingerprint);
    if (exists) {
      console.log(
        `[create_issues] Skipping (duplicate): ${rec.title} [${rec.fingerprint}]`,
      );
      skipped++;
      continue;
    }

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 500));

    const issueNum = await createIssue(rec);
    if (issueNum) created++;

    // Delay between creations
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(
    `[create_issues] ✅ Done. Created: ${created}, Skipped (duplicates): ${skipped}`,
  );
}

main().catch((e) => {
  console.error("[create_issues] Fatal error:", e.message);
  process.exit(1);
});
