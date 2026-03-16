// dashboard/playwright.config.js
// ================================
// Playwright configuration for GitHub Pages e2e tests

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx serve out -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
