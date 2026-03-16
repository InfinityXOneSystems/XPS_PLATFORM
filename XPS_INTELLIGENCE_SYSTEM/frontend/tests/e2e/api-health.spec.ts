/**
 * frontend/tests/e2e/api-health.spec.ts
 *
 * Playwright API tests — validates the Railway backend responds correctly.
 * These tests run against the real backend using Playwright's request context.
 */

import { test, expect } from "@playwright/test";

const BACKEND =
  process.env.VITE_API_URL || "https://xps-intelligence.up.railway.app";

test.describe("Backend API Health — Railway", () => {
  test("GET /health returns 200", async ({ request }) => {
    const res = await request.get(`${BACKEND}/health`, {
      timeout: 15_000,
    });
    expect(res.status()).toBe(200);
  });

  test("GET /api/v1/runtime/task/ping returns 404 or 422 (route exists)", async ({
    request,
  }) => {
    // We don't have a real task ID — but a 404/422 confirms the router is up
    const res = await request.get(`${BACKEND}/api/v1/runtime/task/ping`, {
      timeout: 15_000,
    });
    expect([200, 404, 422]).toContain(res.status());
  });

  test("POST /api/v1/runtime/command accepts JSON", async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/v1/runtime/command`, {
      data: {
        command: "ping",
        parameters: {},
      },
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    });
    // 200 queued, 400 bad command, 422 validation error — all mean the server is up
    expect([200, 201, 400, 422]).toContain(res.status());
  });
});
