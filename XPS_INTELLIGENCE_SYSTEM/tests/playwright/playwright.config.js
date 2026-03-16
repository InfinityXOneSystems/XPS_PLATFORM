// tests/playwright/playwright.config.js
// ======================================
// Playwright configuration for XPS Intelligence Platform E2E tests.
//
// Default: Vite preview frontend at :5173, Express API at :3099.
// Override with PLAYWRIGHT_FRONTEND_URL / PLAYWRIGHT_BACKEND_URL env vars
// for CI runs against staging or production.

const { defineConfig, devices } = require("@playwright/test");

const BASE_URL = process.env.PLAYWRIGHT_FRONTEND_URL || "http://127.0.0.1:5173";

module.exports = defineConfig({
  testDir: "./",
  timeout: 45_000,
  expect: { timeout: 20_000 },
  retries: 1,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "/tmp/playwright-report", open: "never" }],
  ],
  outputDir: "/tmp/xps-screenshots",
  use: {
    baseURL: BASE_URL,
    screenshot: "on",
    video: "off",
    trace: "off",
    headless: true,
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
