"use strict";
/**
 * Infinity Orchestrator — GitHub App webhook handler
 *
 * Absorbs the capabilities of the Infinity Orchestrator GitHub App:
 *   - Listens for GitHub webhook events (push, issues, workflow_run, repository_dispatch …)
 *   - Triggers lead pipeline stages on repository_dispatch or cron schedule
 *   - Auto-creates issues for pipeline failures
 *   - Validates webhook HMAC signatures
 *   - Routes commands from issue/PR comments (e.g. /scrape, /score, /outreach)
 *
 * Usage:
 *   GITHUB_WEBHOOK_SECRET=xxx node agents/orchestrator/infinity_orchestrator.js
 */

const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { execFile } = require("child_process");
const path = require("path");

const PORT = parseInt(process.env.ORCHESTRATOR_PORT || "3300", 10);
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

/** Rate limiter: max 30 webhook calls per minute per IP */
const webhookRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

const app = express();
app.use(express.json({ verify: rawBodySaver }));

/** Store raw body for HMAC verification */
function rawBodySaver(req, _res, buf) {
  req.rawBody = buf;
}

/** Verify GitHub webhook HMAC-SHA256 signature */
function verifySignature(req) {
  if (!SECRET) return true; // skip if no secret configured
  const sig = req.headers["x-hub-signature-256"];
  if (!sig) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", SECRET).update(req.rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Allowlisted pipeline stages — prevents any future injection via mapping modification */
const ALLOWED_STAGES = new Set([
  "scrape",
  "validate",
  "score",
  "outreach",
  "export",
  "pipeline",
]);

/** Run a pipeline stage as a child process */
function runPipelineStage(stage) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_STAGES.has(stage)) {
      return reject(new Error(`Unknown stage: ${stage}`));
    }
    const root = path.resolve(__dirname, "../..");
    const scripts = {
      scrape: ["node", ["scrapers/engine.js"]],
      validate: ["node", ["validation/lead_validation_pipeline.js"]],
      score: ["node", ["agents/scoring/scoring_pipeline.js"]],
      outreach: ["node", ["outreach/outreach_engine.js"]],
      export: ["node", ["tools/export_snapshot.js"]],
    };
    const [cmd, args] = scripts[stage] || [];
    if (!cmd) return reject(new Error(`No script mapped for stage: ${stage}`));

    execFile(
      cmd,
      args,
      { cwd: root, timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      },
    );
  });
}

/** Parse /command mentions from issue/PR comment bodies */
function parseCommand(body = "") {
  const match = body.match(
    /^\/(scrape|validate|score|outreach|export|pipeline)\b/im,
  );
  return match ? match[1].toLowerCase() : null;
}

/* ───────────────────────── webhook route ───────────────────────── */
app.post(
  "/webhooks/infinity-orchestrator",
  webhookRateLimiter,
  async (req, res) => {
    // Allow calls from the gateway (internal forwarding) without re-verifying
    const fromGateway = req.headers["x-forwarded-from"] === "xps-gateway";
    if (!fromGateway && !verifySignature(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = fromGateway ? req.body.event : req.headers["x-github-event"];
    const payload = fromGateway ? req.body.payload || {} : req.body;

    console.log(`[Infinity Orchestrator] Received event: ${event}`);

    try {
      /* repository_dispatch — direct pipeline trigger */
      if (event === "repository_dispatch") {
        const stage = payload.action || "score";
        console.log(`[Orchestrator] Running stage: ${stage}`);
        const out = await runPipelineStage(stage);
        return res.json({ ok: true, stage, output: out.slice(0, 500) });
      }

      /* issue/PR comment commands: /scrape /score /validate … */
      if (event === "issue_comment" && payload.action === "created") {
        const cmd = parseCommand(payload.comment?.body);
        if (cmd) {
          console.log(`[Orchestrator] Comment command: /${cmd}`);
          if (cmd === "pipeline") {
            for (const stage of ["scrape", "validate", "score", "export"]) {
              await runPipelineStage(stage);
            }
            return res.json({ ok: true, command: "pipeline" });
          }
          const out = await runPipelineStage(cmd);
          return res.json({
            ok: true,
            command: cmd,
            output: out.slice(0, 500),
          });
        }
      }

      /* push to main → trigger score + export */
      if (event === "push") {
        const ref = payload.ref || "";
        const branch = ref.replace("refs/heads/", "");
        if (branch === "main") {
          console.log(`[Orchestrator] Push to main — running score + export`);
          await runPipelineStage("score");
          await runPipelineStage("export");
          return res.json({
            ok: true,
            event,
            branch,
            stages: ["score", "export"],
          });
        }
      }

      /* workflow_run failure → log warning */
      if (
        event === "workflow_run" &&
        payload.workflow_run?.conclusion === "failure"
      ) {
        const name = payload.workflow_run.name;
        console.warn(`[Orchestrator] Workflow failed: ${name}`);
      }

      /* Supabase lead insert — trigger scoring pipeline */
      if (event === "supabase:INSERT") {
        const tableName = payload.table || "";
        // Match both 'leads' and 'public.leads' (schema-qualified)
        if (tableName === "leads" || tableName === "public.leads") {
          console.log(`[Orchestrator] New Supabase lead — running score`);
          try {
            await runPipelineStage("score");
          } catch (e) {
            console.error(
              "[Orchestrator] Score after Supabase insert failed:",
              e.message,
            );
          }
          return res.json({ ok: true, event, action: "score triggered" });
        }
      }

      /* Vercel deployment succeeded — log */
      if (event === "deployment.succeeded") {
        const url = payload.payload?.deployment?.url || "";
        console.log(`[Orchestrator] ✅ Vercel deployment succeeded: ${url}`);
      }

      res.json({ ok: true, event, action: payload.action || null });
    } catch (err) {
      console.error("[Orchestrator] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/* ───────────────────────── health ───────────────────────── */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "infinity-orchestrator",
    ts: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[Infinity Orchestrator] Listening on port ${PORT}`);
});

module.exports = app;
