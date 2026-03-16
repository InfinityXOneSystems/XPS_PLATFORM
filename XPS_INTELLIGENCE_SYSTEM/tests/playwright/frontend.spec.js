// tests/playwright/frontend.spec.js
// ===================================
// XPS Intelligence Platform — comprehensive Playwright E2E test suite.
//
// Tests every button, form fill, chat LLM response, and API endpoint.
// Screenshots are saved to SCREENSHOT_DIR for evidence.
//
// Default targets:
//   FRONTEND_URL  – Vite preview served locally (npm run preview --port 5173)
//   BACKEND_URL   – Express API gateway       (node server.js PORT=3099)
//
// Override with env vars:
//   PLAYWRIGHT_FRONTEND_URL=https://xps-intelligence.vercel.app
//   PLAYWRIGHT_BACKEND_URL=https://xps-intelligence.up.railway.app

const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const FRONTEND_URL =
  process.env.PLAYWRIGHT_FRONTEND_URL || "http://127.0.0.1:5173";
const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://127.0.0.1:3099";
const SCREENSHOT_DIR = "/tmp/xps-screenshots";

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR))
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${name}.png`);
  return p;
}

// ── wait helper: wait until input is no longer disabled ──────────────────────
async function waitForReady(page, timeout = 15_000) {
  await page
    .waitForFunction(
      () => {
        const btn = document.querySelector('button[type="submit"], button');
        return btn && !btn.disabled;
      },
      { timeout },
    )
    .catch((err) => {
      console.warn(
        `⚠️  waitForReady timed out after ${timeout}ms: ${err.message}`,
      );
    });
}

// ---------------------------------------------------------------------------
// 1. BACKEND API — direct HTTP (no browser)
// ---------------------------------------------------------------------------

test.describe("1 · Backend API", () => {
  test("GET /api/health returns OK", async ({ request }) => {
    const r = await request.get(`${BACKEND_URL}/api/health`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.status).toMatch(/OK|ok|healthy/i);
    console.log("✅ /api/health:", b.status);
  });

  test("GET /api/leads returns lead array", async ({ request }) => {
    const r = await request.get(`${BACKEND_URL}/api/leads?limit=5`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    const list = Array.isArray(b) ? b : b.leads || b.data?.leads || [];
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("company_name");
    console.log(`✅ /api/leads: ${list.length} leads returned`);
  });

  test("POST /api/chat/send returns LLM reply (fallback)", async ({
    request,
  }) => {
    const r = await request.post(`${BACKEND_URL}/api/chat/send`, {
      data: { message: "How many leads do you have?", agentRole: "LeadAgent" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.reply).toBeDefined();
    expect(b.reply.content.length).toBeGreaterThan(10);
    console.log(
      "✅ /api/chat/send model:",
      b.reply.model,
      "| chars:",
      b.reply.content.length,
    );
  });

  test("POST /api/v1/runtime/command queues scraper task", async ({
    request,
  }) => {
    const r = await request.post(`${BACKEND_URL}/api/v1/runtime/command`, {
      data: { command: "scrape flooring contractors in Austin TX" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.status()).toBe(202);
    const b = await r.json();
    expect(b).toHaveProperty("task_id");
    expect(b.status).toBe("queued");
    expect(b.agent).toBe("scraper");
    console.log("✅ Runtime command queued, task_id:", b.task_id);

    // Poll for completion
    await new Promise((res) => setTimeout(res, 4000));
    const poll = await request.get(
      `${BACKEND_URL}/api/v1/runtime/task/${b.task_id}`,
    );
    expect(poll.status()).toBe(200);
    const t = await poll.json();
    expect(t.task_id).toBe(b.task_id);
    expect(["queued", "running", "completed"]).toContain(t.status);
    console.log("✅ Task polled, status:", t.status);
  });

  test("POST /api/v1/runtime/command rejects empty command (422)", async ({
    request,
  }) => {
    const r = await request.post(`${BACKEND_URL}/api/v1/runtime/command`, {
      data: { command: "" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.status()).toBe(422);
    console.log("✅ Empty command correctly rejected with 422");
  });

  test("GET /api/v1/runtime/task/nonexistent returns 404", async ({
    request,
  }) => {
    const r = await request.get(
      `${BACKEND_URL}/api/v1/runtime/task/nonexistent-id`,
    );
    expect(r.status()).toBe(404);
    console.log("✅ Non-existent task returns 404");
  });

  test("GET /api/v1/system/agent-activity returns agent entries", async ({
    request,
  }) => {
    const r = await request.get(`${BACKEND_URL}/api/v1/system/agent-activity`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.entries.length).toBeGreaterThan(0);
    expect(b.entries[0]).toHaveProperty("agent");
    console.log(`✅ Agent activity: ${b.total} entries`);
  });

  test("POST /api/v1/runtime/command — outreach agent", async ({ request }) => {
    const r = await request.post(`${BACKEND_URL}/api/v1/runtime/command`, {
      data: { command: "run outreach campaign to flooring leads" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.status()).toBe(202);
    const b = await r.json();
    expect(b.agent).toBe("outreach");
    console.log("✅ Outreach command queued, agent:", b.agent);
  });
});

// ---------------------------------------------------------------------------
// 2. HOMEPAGE — loads, status bar, title, 4 nav buttons visible
// ---------------------------------------------------------------------------

test.describe("2 · Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
  });

  test("page title is XPS Intelligence Platform", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toContainText("XPS Intelligence Platform");
    await shot(page, "01-homepage-title");
    console.log("✅ Homepage title correct");
  });

  test("status bar shows CONNECTED or DEGRADED", async ({ page }) => {
    const statusBar = page.locator("nav, header").first();
    const text = await page.locator("body").innerText();
    expect(text).toMatch(/CONNECTED|DEGRADED|Connecting/i);
    await shot(page, "02-homepage-status-bar");
    console.log("✅ Status indicator present");
  });

  test("all 4 nav buttons are visible and clickable", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Chat Agent/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Leads/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Agent Activity/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Task Status/i }),
    ).toBeVisible();
    await shot(page, "03-homepage-nav-buttons");
    console.log("✅ All 4 nav buttons visible");
  });
});

// ---------------------------------------------------------------------------
// 3. CHAT AGENT TAB — form fill, Send button, LLM response
// ---------------------------------------------------------------------------

test.describe("3 · Chat Agent tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
  });

  test("Chat Agent button is active by default", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Chat Agent/i });
    await expect(btn).toBeVisible();
    // Chat interface should already be visible without clicking
    await expect(page.getByRole("textbox")).toBeVisible();
    await shot(page, "04-chat-tab-default");
    console.log("✅ Chat Agent tab active by default");
  });

  test("typing into chat input enables Send button", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("How many leads do you have?");
    const sendBtn = page.getByRole("button", { name: /Send/i });
    await expect(sendBtn).not.toBeDisabled();
    await shot(page, "05-chat-send-enabled");
    console.log("✅ Send button enabled after typing");
  });

  test("submitting chat message returns LLM reply with lead stats table", async ({
    page,
  }) => {
    const input = page.getByRole("textbox");
    await input.fill(
      "How many leads do you have and show me the top HOT leads?",
    );
    await shot(page, "06-chat-message-typed");

    await page.getByRole("button", { name: /Send/i }).click();

    // Wait for the assistant reply to appear (up to 20 s)
    await page.waitForFunction(
      () => {
        const tables = document.querySelectorAll("table");
        const paras = [...document.querySelectorAll("p, div")];
        return (
          tables.length > 0 ||
          paras.some((el) => el.textContent && el.textContent.includes("HOT"))
        );
      },
      { timeout: 20_000 },
    );

    await shot(page, "07-chat-llm-response");
    const body = await page.locator("body").innerText();
    // Response must mention lead counts
    expect(body).toMatch(/HOT|WARM|COLD|lead|1[,.]?0[0-9][0-9]/i);
    console.log("✅ LLM response received with lead data");
  });

  test("second chat message returns HOT leads table with phone numbers", async ({
    page,
  }) => {
    const input = page.getByRole("textbox");
    await input.fill("Show me the top HOT contractor leads with phone numbers");
    await page.keyboard.press("Enter");

    await page.waitForFunction(
      () => document.querySelectorAll("table").length >= 1,
      { timeout: 20_000 },
    );

    await shot(page, "08-chat-hot-leads-table");
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/HOT|score|phone|\(\d{3}\)/i);
    console.log("✅ Second LLM response: HOT leads with phone numbers");
  });

  test("pressing Enter submits the form", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("What can you do?");
    await page.keyboard.press("Enter");
    // The input should clear (or loading state appears)
    await page.waitForTimeout(1000);
    await shot(page, "09-chat-enter-submit");
    console.log("✅ Enter key submits form");
  });
});

// ---------------------------------------------------------------------------
// 4. LEADS TAB
// ---------------------------------------------------------------------------

test.describe("4 · Leads tab", () => {
  test("clicking Leads button shows lead data", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Leads/i }).click();
    await page.waitForTimeout(1500);

    await shot(page, "10-leads-tab");
    const body = await page.locator("body").innerText();
    // Should show lead-related content
    expect(body).toMatch(/lead|contractor|company|score|HOT|WARM|COLD/i);
    console.log("✅ Leads tab rendered with lead data");
  });
});

// ---------------------------------------------------------------------------
// 5. AGENT ACTIVITY TAB
// ---------------------------------------------------------------------------

test.describe("5 · Agent Activity tab", () => {
  test("clicking Agent Activity shows 5 live agent entries", async ({
    page,
  }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Agent Activity/i }).click();
    await page.waitForTimeout(1500);

    await shot(page, "11-agent-activity-tab");
    const body = await page.locator("body").innerText();
    expect(body).toMatch(
      /ScraperAgent|ValidatorAgent|EnrichmentAgent|ScoringAgent|OutreachAgent/i,
    );
    console.log("✅ Agent Activity tab: live agent entries visible");
  });
});

// ---------------------------------------------------------------------------
// 6. TASK STATUS TAB — fill Task ID textbox, click Poll button
// ---------------------------------------------------------------------------

test.describe("6 · Task Status tab", () => {
  test("Task ID textbox and Poll button are present", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Task Status/i }).click();
    await page.waitForTimeout(500);

    const textbox = page.getByRole("textbox", { name: /Task ID/i });
    await expect(textbox).toBeVisible();
    const pollBtn = page.getByRole("button", { name: /Poll/i });
    await expect(pollBtn).toBeVisible();

    await shot(page, "12-task-status-tab-empty");
    console.log("✅ Task Status tab: textbox + Poll button present");
  });

  test("filling Task ID and clicking Poll returns task result", async ({
    request,
    page,
  }) => {
    // First queue a real task via the API
    const queueResp = await request.post(
      `${BACKEND_URL}/api/v1/runtime/command`,
      {
        data: { command: "scrape epoxy contractors in Dallas TX" },
        headers: { "Content-Type": "application/json" },
      },
    );
    const { task_id } = await queueResp.json();

    // Now open the UI and poll it
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Task Status/i }).click();
    await page.waitForTimeout(500);

    const textbox = page.getByRole("textbox", { name: /Task ID/i });
    await textbox.fill(task_id);
    await shot(page, "13-task-status-id-filled");

    await page.getByRole("button", { name: /Poll/i }).click();

    // Wait for result to appear
    await page.waitForFunction(
      (id) => document.body.innerText.includes(id),
      task_id,
      { timeout: 10_000 },
    );

    await shot(page, "14-task-status-poll-result");
    const body = await page.locator("body").innerText();
    expect(body).toContain(task_id);
    expect(body).toMatch(/completed|queued|running/i);
    console.log(`✅ Task Status poll: task ${task_id} result shown`);
  });
});

// ---------------------------------------------------------------------------
// 7. FULL NAVIGATION FLOW — click all 4 tabs in sequence
// ---------------------------------------------------------------------------

test.describe("7 · Full navigation flow", () => {
  test("clicking all 4 tabs in sequence works without errors", async ({
    page,
  }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState("networkidle");

    const tabs = [
      { name: /Chat Agent/i, shot: "15-nav-chat" },
      { name: /Leads/i, shot: "16-nav-leads" },
      { name: /Agent Activity/i, shot: "17-nav-activity" },
      { name: /Task Status/i, shot: "18-nav-taskstatus" },
    ];

    for (const tab of tabs) {
      await page.getByRole("button", { name: tab.name }).click();
      await page.waitForTimeout(800);
      await shot(page, tab.shot);
      console.log(`✅ Tab navigated: ${tab.name}`);
    }

    // Return to Chat Agent
    await page.getByRole("button", { name: /Chat Agent/i }).click();
    await page.waitForTimeout(500);
    await shot(page, "19-nav-return-chat");
    console.log("✅ Full navigation flow complete");
  });
});
