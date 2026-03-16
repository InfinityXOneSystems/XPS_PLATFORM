"use strict";
/**
 * Sandbox Manager — isolated execution environment for the Headless REST API Agent
 *
 * Each sandbox is a scoped Playwright BrowserContext with:
 *   - Separate cookie/storage isolation
 *   - Configurable network interception (block ads, analytics)
 *   - Request logging for audit
 *   - Optional route interception (mock responses)
 *   - Automatic teardown on timeout or explicit release
 *
 * Usage (programmatic):
 *   const mgr = require('./sandbox_manager');
 *   const { sandboxId, page } = await mgr.createSandbox({ blockAds: true });
 *   await page.goto('https://example.com');
 *   await mgr.destroySandbox(sandboxId);
 *
 * Usage (HTTP — mounted by headless_agent.js at /sandbox/*):
 *   POST /sandbox/create
 *   DELETE /sandbox/:id
 *   GET  /sandbox/list
 */

const { chromium } = require("playwright");
const crypto = require("crypto");

const SANDBOX_TIMEOUT_MS = parseInt(
  process.env.SANDBOX_TIMEOUT_MS || "600000",
  10,
); // 10 min

/** Ad/tracker domains to block inside sandboxes */
const BLOCK_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "google-analytics.com",
  "facebook.com/tr",
  "pixel.facebook.com",
  "analytics.twitter.com",
  "ads.twitter.com",
  "hotjar.com",
  "segment.io",
  "mixpanel.com",
];

class SandboxManager {
  constructor() {
    this._browser = null;
    this._sandboxes = new Map(); // id → { context, page, log, timer }
  }

  async _ensureBrowser() {
    if (!this._browser) {
      this._browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
      console.log("[SandboxManager] Browser launched");
    }
    return this._browser;
  }

  /**
   * Create a sandboxed browser context with optional ad-blocking and request logging.
   * @param {object} options
   * @param {boolean} [options.blockAds=true]
   * @param {boolean} [options.logRequests=true]
   * @param {object[]} [options.mockRoutes]   Array of { url, body, status }
   * @returns {{ sandboxId: string, page: import('playwright').Page, log: object[] }}
   */
  async createSandbox(options = {}) {
    const browser = await this._ensureBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      // Storage isolation: each context has its own cookies/localStorage
    });

    const page = await context.newPage();
    const log = [];

    /* Ad/tracker blocking */
    if (options.blockAds !== false) {
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (BLOCK_DOMAINS.some((d) => url.includes(d))) {
          return route.abort();
        }
        return route.continue();
      });
    }

    /* Request logging */
    if (options.logRequests !== false) {
      page.on("request", (req) => {
        log.push({
          ts: Date.now(),
          type: "request",
          method: req.method(),
          url: req.url(),
        });
      });
      page.on("response", (resp) => {
        log.push({
          ts: Date.now(),
          type: "response",
          status: resp.status(),
          url: resp.url(),
        });
      });
    }

    /* Mock routes */
    if (Array.isArray(options.mockRoutes)) {
      for (const mock of options.mockRoutes) {
        await context.route(mock.url, (route) =>
          route.fulfill({ status: mock.status || 200, body: mock.body || "" }),
        );
      }
    }

    const sandboxId = crypto.randomUUID();
    const timer = setTimeout(async () => {
      console.warn(
        `[SandboxManager] Timeout — destroying sandbox: ${sandboxId}`,
      );
      await this.destroySandbox(sandboxId);
    }, SANDBOX_TIMEOUT_MS);

    this._sandboxes.set(sandboxId, { context, page, log, timer });
    console.log(
      `[SandboxManager] Sandbox created: ${sandboxId} (total: ${this._sandboxes.size})`,
    );

    return { sandboxId, page, log };
  }

  /** Get the page for a sandbox */
  getSandbox(sandboxId) {
    const s = this._sandboxes.get(sandboxId);
    if (!s) throw new Error(`Sandbox not found: ${sandboxId}`);
    return s;
  }

  /** Destroy a sandbox and all its resources */
  async destroySandbox(sandboxId) {
    const s = this._sandboxes.get(sandboxId);
    if (!s) return false;
    clearTimeout(s.timer);
    try {
      await s.context.close();
    } catch (_) {
      /* ignore */
    }
    this._sandboxes.delete(sandboxId);
    console.log(
      `[SandboxManager] Sandbox destroyed: ${sandboxId} (remaining: ${this._sandboxes.size})`,
    );
    return true;
  }

  /** List all active sandbox IDs */
  listSandboxes() {
    return Array.from(this._sandboxes.entries()).map(([id, s]) => ({
      sandboxId: id,
      url: s.page.url(),
      logEntries: s.log.length,
    }));
  }

  /** Get the request/response audit log for a sandbox */
  getSandboxLog(sandboxId) {
    const s = this._sandboxes.get(sandboxId);
    if (!s) throw new Error(`Sandbox not found: ${sandboxId}`);
    return s.log;
  }

  /** Graceful shutdown */
  async shutdown() {
    for (const id of [...this._sandboxes.keys()]) {
      await this.destroySandbox(id);
    }
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
    }
  }
}

const manager = new SandboxManager();
module.exports = manager;
