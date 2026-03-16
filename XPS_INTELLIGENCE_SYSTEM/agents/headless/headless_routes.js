"use strict";
/**
 * Headless REST API Agent — Express route handlers
 *
 * Provides browser automation via Playwright over HTTP:
 *   POST /agent/session/create   — open a new browser session
 *   DELETE /agent/session/:id    — close a session
 *   GET  /agent/sessions         — list active sessions
 *   POST /agent/navigate         — navigate to a URL
 *   POST /agent/fill             — fill a form field (selector + value)
 *   POST /agent/type             — type text with keyboard events
 *   POST /agent/click            — click an element
 *   POST /agent/scroll           — scroll the viewport or an element
 *   POST /agent/screenshot       — capture a screenshot (base64 PNG)
 *   POST /agent/evaluate         — run arbitrary JS in the page context
 *   GET  /agent/health           — health check
 */

const express = require("express");
const pool = require("./headless_browser");

const router = express.Router();

/* ── helper ── */
function err(res, statusOrMsg, msg) {
  if (typeof statusOrMsg === "number") {
    return res.status(statusOrMsg).json({ error: msg });
  }
  return res.status(500).json({ error: statusOrMsg });
}

/* ── health ── */
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "headless-agent",
    activeSessions: pool.listSessions().length,
  });
});

/* ── session lifecycle ── */
router.post("/session/create", async (req, res) => {
  try {
    const id = await pool.createSession(req.body || {});
    res.status(201).json({ sessionId: id });
  } catch (e) {
    err(res, 503, e.message);
  }
});

router.delete("/session/:id", async (req, res) => {
  try {
    const ok = await pool.destroySession(req.params.id);
    if (!ok) return err(res, 404, "Session not found");
    res.json({ ok: true });
  } catch (e) {
    err(res, e.message);
  }
});

router.get("/sessions", (_req, res) => {
  res.json({ sessions: pool.listSessions() });
});

/* ── navigate ── */
router.post("/navigate", async (req, res) => {
  const { sessionId, url, waitUntil = "domcontentloaded" } = req.body || {};
  if (!sessionId || !url) return err(res, 400, "sessionId and url required");
  try {
    const { page } = pool.getSession(sessionId);
    await page.goto(url, { waitUntil, timeout: 30_000 });
    res.json({ ok: true, url: page.url(), title: await page.title() });
  } catch (e) {
    err(res, e.message);
  }
});

/* ── fill ── */
router.post("/fill", async (req, res) => {
  const { sessionId, selector, value, clear = true } = req.body || {};
  if (!sessionId || !selector || value === undefined) {
    return err(res, 400, "sessionId, selector, and value required");
  }
  try {
    const { page } = pool.getSession(sessionId);
    if (clear) await page.fill(selector, "");
    await page.fill(selector, String(value));
    res.json({ ok: true, selector, value });
  } catch (e) {
    err(res, e.message);
  }
});

/* ── type ── */
router.post("/type", async (req, res) => {
  const { sessionId, selector, text, delay = 50 } = req.body || {};
  if (!sessionId || !selector || !text) {
    return err(res, 400, "sessionId, selector, and text required");
  }
  try {
    const { page } = pool.getSession(sessionId);
    await page.click(selector);
    await page.keyboard.type(String(text), { delay });
    res.json({ ok: true, selector, text });
  } catch (e) {
    err(res, e.message);
  }
});

/* ── click ── */
router.post("/click", async (req, res) => {
  const {
    sessionId,
    selector,
    button = "left",
    clickCount = 1,
    modifiers = [],
  } = req.body || {};
  if (!sessionId || !selector)
    return err(res, 400, "sessionId and selector required");
  try {
    const { page } = pool.getSession(sessionId);
    await page.click(selector, { button, clickCount, modifiers });
    res.json({ ok: true, selector });
  } catch (e) {
    err(res, e.message);
  }
});

/* ── scroll ── */
router.post("/scroll", async (req, res) => {
  const { sessionId, selector, deltaX = 0, deltaY = 500 } = req.body || {};
  if (!sessionId) return err(res, 400, "sessionId required");
  try {
    const { page } = pool.getSession(sessionId);
    if (selector) {
      await page.locator(selector).scrollIntoViewIfNeeded();
    } else {
      await page.mouse.wheel(deltaX, deltaY);
    }
    res.json({ ok: true, deltaX, deltaY });
  } catch (e) {
    err(res, e.message);
  }
});

/* ── screenshot ── */
router.post("/screenshot", async (req, res) => {
  const { sessionId, fullPage = false, selector } = req.body || {};
  if (!sessionId) return err(res, 400, "sessionId required");
  try {
    const { page } = pool.getSession(sessionId);
    let data;
    if (selector) {
      data = await page.locator(selector).screenshot({ type: "png" });
    } else {
      data = await page.screenshot({ type: "png", fullPage });
    }
    res.json({
      ok: true,
      image: data.toString("base64"),
      mimeType: "image/png",
    });
  } catch (e) {
    err(res, e.message);
  }
});

/* ── evaluate (arbitrary JS) — requires API key when HEADLESS_API_KEY is set ── */
router.post("/evaluate", async (req, res) => {
  const { sessionId, expression } = req.body || {};
  if (!sessionId || !expression)
    return err(res, 400, "sessionId and expression required");
  // Warn: only expose this endpoint behind HEADLESS_API_KEY in production
  try {
    const { page } = pool.getSession(sessionId);
    const result = await page.evaluate(expression);
    res.json({ ok: true, result });
  } catch (e) {
    err(res, e.message);
  }
});

module.exports = router;
