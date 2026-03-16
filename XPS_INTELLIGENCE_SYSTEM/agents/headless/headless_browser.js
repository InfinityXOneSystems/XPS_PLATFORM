"use strict";
/**
 * HeadlessBrowserPool — manages a pool of Playwright browser contexts
 * for parallel headless automation.
 *
 * Each "session" is an isolated BrowserContext + Page, keyed by a UUID.
 * Up to MAX_SESSIONS run concurrently; excess requests wait in a queue.
 */

const { chromium } = require("playwright");
const crypto = require("crypto");

const MAX_SESSIONS = parseInt(process.env.HEADLESS_MAX_SESSIONS || "10", 10);
const IDLE_TIMEOUT_MS = parseInt(
  process.env.HEADLESS_IDLE_TIMEOUT_MS || "300000",
  10,
); // 5 min

class HeadlessBrowserPool {
  constructor() {
    this._browser = null;
    this._sessions = new Map(); // id → { context, page, lastActivity, timer }
    this._launching = false;
    this._launchPromise = null;
  }

  /** Ensure the shared browser process is running */
  async _ensureBrowser() {
    if (this._browser) return this._browser;
    if (this._launching) return this._launchPromise;

    this._launching = true;
    this._launchPromise = chromium
      .launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      })
      .then((b) => {
        this._browser = b;
        this._launching = false;
        console.log("[HeadlessPool] Browser launched");
        return b;
      });
    return this._launchPromise;
  }

  /** Create a new isolated browser session (context + page) */
  async createSession(options = {}) {
    // If at max capacity, wait up to 30s for a slot to free up
    if (this._sessions.size >= MAX_SESSIONS) {
      const freed = await new Promise((resolve) => {
        const CHECK_INTERVAL_MS = 500;
        const MAX_WAIT_MS = 30_000;
        let elapsed = 0;
        const timer = setInterval(() => {
          elapsed += CHECK_INTERVAL_MS;
          if (this._sessions.size < MAX_SESSIONS) {
            clearInterval(timer);
            resolve(true);
          } else if (elapsed >= MAX_WAIT_MS) {
            clearInterval(timer);
            resolve(false);
          }
        }, CHECK_INTERVAL_MS);
      });
      if (!freed) {
        throw new Error(
          `Max sessions reached (${MAX_SESSIONS}). All slots busy — try again later.`,
        );
      }
    }

    const browser = await this._ensureBrowser();
    const context = await browser.newContext({
      userAgent:
        options.userAgent ||
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: options.viewport || { width: 1280, height: 800 },
      locale: options.locale || "en-US",
      ...options.contextOptions,
    });

    const page = await context.newPage();
    const id = crypto.randomUUID();

    const session = { id, context, page, lastActivity: Date.now() };
    session.timer = setTimeout(() => this._idleCleanup(id), IDLE_TIMEOUT_MS);
    this._sessions.set(id, session);

    console.log(
      `[HeadlessPool] Session created: ${id} (active: ${this._sessions.size})`,
    );
    return id;
  }

  /** Retrieve a session by ID */
  getSession(id) {
    const s = this._sessions.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    s.lastActivity = Date.now();
    clearTimeout(s.timer);
    s.timer = setTimeout(() => this._idleCleanup(id), IDLE_TIMEOUT_MS);
    return s;
  }

  /** Destroy a session and free resources */
  async destroySession(id) {
    const s = this._sessions.get(id);
    if (!s) return false;
    clearTimeout(s.timer);
    try {
      await s.context.close();
    } catch (_) {
      /* ignore */
    }
    this._sessions.delete(id);
    console.log(
      `[HeadlessPool] Session destroyed: ${id} (active: ${this._sessions.size})`,
    );
    return true;
  }

  /** List all active session IDs and their metadata */
  listSessions() {
    return Array.from(this._sessions.values()).map((s) => ({
      id: s.id,
      lastActivity: new Date(s.lastActivity).toISOString(),
      url: s.page.url(),
    }));
  }

  /** Auto-clean idle sessions */
  async _idleCleanup(id) {
    console.log(`[HeadlessPool] Idle timeout — destroying session: ${id}`);
    await this.destroySession(id);
  }

  /** Graceful shutdown */
  async shutdown() {
    for (const id of this._sessions.keys()) {
      await this.destroySession(id);
    }
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
      console.log("[HeadlessPool] Browser closed");
    }
  }
}

module.exports = new HeadlessBrowserPool();
