"use strict";
/**
 * Headless REST API Agent — Express server (port 3200)
 *
 * Shadow agent that exposes browser automation over HTTP.
 * Backed by a Playwright browser pool with parallel instance support.
 *
 * Quick start:
 *   node agents/headless/headless_agent.js
 *
 * Environment variables:
 *   HEADLESS_PORT           (default: 3200)
 *   HEADLESS_MAX_SESSIONS   (default: 10)
 *   HEADLESS_IDLE_TIMEOUT_MS (default: 300000 = 5 min)
 *   HEADLESS_API_KEY        optional bearer token
 */

const express = require("express");
const pool = require("./headless_browser");
const routes = require("./headless_routes");

const PORT = parseInt(process.env.HEADLESS_PORT || "3200", 10);
const API_KEY = process.env.HEADLESS_API_KEY || "";

const app = express();
app.use(express.json({ limit: "10mb" }));

/* Optional API key guard */
if (API_KEY) {
  app.use("/agent", (req, res, next) => {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${API_KEY}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });
}

/* Mount headless agent routes */
app.use("/agent", routes);

/* Root info */
app.get("/", (_req, res) => {
  res.json({
    service: "Headless REST API Agent",
    version: "1.0.0",
    description:
      "Shadow headless browser agent with Playwright. Supports form fill, scroll, type, click, screenshot, navigation, and parallel sessions.",
    endpoints: {
      "POST /agent/session/create": "Create a new browser session",
      "DELETE /agent/session/:id": "Destroy a browser session",
      "GET /agent/sessions": "List active sessions",
      "POST /agent/navigate": "Navigate to URL",
      "POST /agent/fill": "Fill a form field",
      "POST /agent/type": "Type text with keyboard events",
      "POST /agent/click": "Click an element",
      "POST /agent/scroll": "Scroll the page or an element",
      "POST /agent/screenshot": "Capture screenshot (base64 PNG)",
      "POST /agent/evaluate": "Evaluate JavaScript in page context",
      "GET /agent/health": "Health check",
    },
    maxSessions: parseInt(process.env.HEADLESS_MAX_SESSIONS || "10", 10),
  });
});

/* Graceful shutdown */
let server;
function shutdown() {
  console.log("[HeadlessAgent] Shutting down...");
  pool.shutdown().finally(() => {
    if (server) server.close(() => process.exit(0));
    else process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server = app.listen(PORT, () => {
  console.log(`[HeadlessAgent] Server running on http://localhost:${PORT}`);
  console.log(
    `[HeadlessAgent] Max parallel sessions: ${process.env.HEADLESS_MAX_SESSIONS || 10}`,
  );
});

module.exports = app;
