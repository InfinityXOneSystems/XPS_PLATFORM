import { defineConfig, devices } from "@playwright/test";

/**
 * frontend/playwright.config.ts
 *
 * Playwright configuration for XPS Intelligence frontend.
 * Targets: local dev server, Vite preview (built dist), and production URL.
 *
 * Environments:
 *   CI=true             → headless, single worker, no retries
 *   PLAYWRIGHT_BASE_URL → override base URL (e.g. for smoke tests)
 */

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.VITE_BASE_URL ||
  "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ["github"],
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : [["list"], ["html", { open: "on-failure" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: process.env.CI
    ? {
        // In CI, serve the pre-built dist
        command: "npx vite preview --port 4173",
        port: 4173,
        reuseExistingServer: true,
        timeout: 30_000,
        env: {
          VITE_API_URL:
            process.env.VITE_API_URL ||
            "https://xps-intelligence.up.railway.app",
        },
      }
    : {
        // Locally, use the dev server
        command: "npm run dev",
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
