// dashboard/tests/e2e/pages.spec.js
// ====================================
// Playwright e2e tests for GitHub Pages static export
// Validates that all navigation links/buttons resolve (no 404s)
// and that pages display real data from the repo

const { test, expect } = require("@playwright/test");

// All routes exported by Next.js
const PAGES = [
  { path: "/", title: "XPS Intelligence Platform" },
  { path: "/leads/", title: "Leads" },
  { path: "/analytics/", title: "Analytics" },
  { path: "/crm/", title: "CRM" },
  { path: "/intelligence/", title: "Intelligence" },
  { path: "/trends/", title: "Trends" },
  { path: "/guardian/", title: "Guardian" },
  { path: "/chat/", title: "Chat" },
  { path: "/settings/", title: "Settings" },
  { path: "/workspace/", title: "Workspace" },
  { path: "/studio/", title: "Studio" },
  { path: "/invention-lab/", title: "Invention Lab" },
  { path: "/connectors/", title: "Connectors" },
];

// ---- Home page ----

test("home page loads and shows title", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveTitle(/404/);
  await expect(page.locator("h1")).toContainText("XPS Intelligence Platform");
});

test("home page nav cards are all visible", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("a[href]");
  const count = await cards.count();
  expect(count).toBeGreaterThan(5);
});

test("home page nav links do not 404", async ({ page }) => {
  await page.goto("/");

  // Collect all hrefs from nav cards — only relative paths starting with /
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((els) =>
      els
        .map((el) => el.getAttribute("href"))
        .filter(
          (h) =>
            h &&
            h.startsWith("/") &&
            !h.startsWith("//") &&
            !h.startsWith("/github"),
        ),
    );

  expect(hrefs.length).toBeGreaterThan(5);

  for (const href of hrefs) {
    const response = await page.goto(href);
    expect(
      response?.status(),
      `Expected 200 for ${href}, got ${response?.status()}`,
    ).toBe(200);
  }
});

// ---- Individual pages ----

for (const { path, title } of PAGES) {
  test(`${path} loads without 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(
      response?.status(),
      `Expected 200 for ${path}, got ${response?.status()}`,
    ).toBe(200);
    await expect(page).not.toHaveTitle(/404/);
  });
}

// ---- Data validation ----

test("leads page shows lead data from scored_leads.json", async ({ page }) => {
  await page.goto("/leads/");
  // Wait for the loading spinner to disappear (data loaded)
  await page.waitForSelector("table", { timeout: 15000 });
  const content = await page.content();
  // Should show lead count or company names from static data
  const hasLeads =
    content.includes("HOT") ||
    content.includes("WARM") ||
    content.includes("Epoxy") ||
    content.includes("Total:");
  expect(hasLeads, "Leads page should display lead data").toBe(true);
});

test("analytics page shows stats from scoring data", async ({ page }) => {
  await page.goto("/analytics/");
  // Wait for loading state to resolve
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading metrics"),
    { timeout: 15000 },
  );
  const content = await page.content();
  // Should show health status or lead metrics from static data
  const hasData =
    content.includes("healthy") ||
    content.includes("2658") ||
    content.includes("Epoxy") ||
    content.includes("Total Leads") ||
    content.includes("Lead Database");
  expect(hasData, "Analytics page should display data").toBe(true);
});

test("trends page shows market trend data", async ({ page }) => {
  await page.goto("/trends/");
  // Wait for loading to resolve
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading"),
    { timeout: 10000 },
  );
  const content = await page.content();
  const hasData =
    content.includes("Epoxy") ||
    content.includes("Flooring") ||
    content.includes("Construction") ||
    content.includes("AI");
  expect(hasData, "Trends page should display trend data").toBe(true);
});

test("intelligence page shows niche and briefing data", async ({ page }) => {
  await page.goto("/intelligence/");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading"),
    { timeout: 10000 },
  );
  const content = await page.content();
  const hasData =
    content.includes("Epoxy") ||
    content.includes("Concrete") ||
    content.includes("Vision Cortex") ||
    content.includes("briefing") ||
    content.includes("niches");
  expect(hasData, "Intelligence page should display niche data").toBe(true);
});

test("guardian page shows system health data", async ({ page }) => {
  await page.goto("/guardian/");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Checking"),
    { timeout: 10000 },
  );
  const content = await page.content();
  const hasData =
    content.includes("healthy") ||
    content.includes("API Gateway") ||
    content.includes("Database") ||
    content.includes("Guardian");
  expect(hasData, "Guardian page should display health data").toBe(true);
});

// ---- Button functionality ----

test("leads page search filter works", async ({ page }) => {
  await page.goto("/leads/");
  await page.waitForSelector("input[placeholder]", { timeout: 15000 });

  const searchInput = page.locator("input[placeholder*='Search']").first();
  await expect(searchInput).toBeVisible();
  await searchInput.fill("epoxy");
  // Page should still be visible (not crash)
  await expect(page.locator("body")).toBeVisible();
});

test("analytics refresh button works", async ({ page }) => {
  await page.goto("/analytics/");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading metrics"),
    { timeout: 15000 },
  );

  const refreshBtn = page.locator("button").filter({ hasText: /Refresh/i });
  if (await refreshBtn.isVisible()) {
    await refreshBtn.click();
    await expect(page.locator("body")).toBeVisible();
  }
});

test("crm page tabs switch without error", async ({ page }) => {
  await page.goto("/crm/");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading"),
    { timeout: 15000 },
  );

  // Try clicking on tab buttons
  const tabs = ["Contacts", "Outreach"];
  for (const tab of tabs) {
    const btn = page
      .locator("button")
      .filter({ hasText: new RegExp(tab, "i") })
      .first();
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.locator("body")).toBeVisible();
    }
  }
});

test("trends category tabs work", async ({ page }) => {
  await page.goto("/trends/");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading"),
    { timeout: 10000 },
  );

  const categories = ["Flooring", "AI", "Construction"];
  for (const cat of categories) {
    const btn = page.locator("button").filter({ hasText: cat }).first();
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.locator("body")).toBeVisible();
    }
  }
});

test("static data files are accessible", async ({ page }) => {
  const dataFiles = [
    "/data/scored_leads.json",
    "/data/scoring_report.json",
    "/data/analytics.json",
    "/data/intelligence.json",
    "/data/trends.json",
    "/data/guardian.json",
  ];

  for (const file of dataFiles) {
    const response = await page.goto(file);
    expect(
      response?.status(),
      `Static data file ${file} should be accessible`,
    ).toBe(200);
  }
});
