/**
 * frontend/tests/e2e/home.spec.ts
 *
 * Playwright E2E tests for the XPS Intelligence Platform home page.
 * Validates: page loads, module cards render, status bar shows, navigation works.
 */

import { test, expect } from "@playwright/test";

const VISIBLE_TIMEOUT = 10_000;

test.describe("Home Page — XPS Intelligence Platform", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/XPS/i);
  });

  test("shows XPS Intelligence Platform heading", async ({ page }) => {
    // The heading text from the production screenshot
    const heading = page
      .locator("h1, h2, [class*='title'], [class*='heading']")
      .filter({ hasText: /XPS/i })
      .first();
    await expect(heading).toBeVisible({ timeout: VISIBLE_TIMEOUT });
  });

  test("renders navigation module cards", async ({ page }) => {
    // Production dashboard shows 12 module cards including Chat Agent, Leads, CRM etc
    const cards = page.locator(
      "[class*='card'], [class*='module'], [role='link'], a[href]",
    );
    await expect(cards.first()).toBeVisible({ timeout: VISIBLE_TIMEOUT });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Chat Agent card is visible", async ({ page }) => {
    const chatCard = page
      .locator("a, button, [class*='card']")
      .filter({ hasText: /chat.?agent/i })
      .first();
    // Soft assertion — card should exist in the production build
    await expect(chatCard).toBeVisible({ timeout: VISIBLE_TIMEOUT });
  });

  test("page has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Filter out known benign errors (e.g. favicon 404)
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("page is responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Page should not have horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);
  });
});
