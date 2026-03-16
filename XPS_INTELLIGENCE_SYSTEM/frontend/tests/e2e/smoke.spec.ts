/**
 * frontend/tests/e2e/smoke.spec.ts
 *
 * Lightweight post-deploy smoke test.
 * Runs against the live production or preview URL to confirm
 * the deployment is reachable and renders the correct content.
 *
 * Used by both `frontend_deploy.yml` and manual smoke runs.
 */

import { test, expect } from "@playwright/test";

const VISIBLE_TIMEOUT = 30_000;

test.describe("Post-Deploy Smoke Test", () => {
  test("production URL responds with XPS Intelligence content", async ({
    page,
  }) => {
    const url =
      process.env.PLAYWRIGHT_BASE_URL || "https://xps-intelligence.vercel.app";

    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: VISIBLE_TIMEOUT,
    });

    expect(response?.status()).toBeLessThan(400);

    // The heading should contain XPS
    const heading = page
      .locator("h1, h2, [class*='title'], [class*='heading']")
      .filter({ hasText: /XPS/i })
      .first();
    await expect(heading).toBeVisible({ timeout: VISIBLE_TIMEOUT });

    await page.screenshot({ path: "test-results/smoke-screenshot.png" });
  });

  test("page loads critical assets (no 4xx)", async ({ page }) => {
    const failedRequests: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 400 && !res.url().includes("favicon")) {
        failedRequests.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(process.env.PLAYWRIGHT_BASE_URL || "/", {
      waitUntil: "networkidle",
      timeout: VISIBLE_TIMEOUT,
    });

    // Log but don't hard-fail on CDN/API errors — only local asset failures matter
    const localFails = failedRequests.filter(
      (r) => !r.includes("railway.app") && !r.includes("api/"),
    );
    expect(localFails).toHaveLength(0);
  });
});
