"use strict";

require("dotenv").config();

const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const LOG_FILE = path.join(DATA_DIR, "logs", "scheduler.log");

// ── logging ───────────────────────────────────────────────────────────────────

function ensureLogDir() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(msg, level = "INFO") {
  ensureLogDir();
  const line = `[${new Date().toISOString()}] [${level}] [Scheduler] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (_) {}
}

// ── job definitions ───────────────────────────────────────────────────────────

const JOB_DEFINITIONS = [
  {
    name: "scraper",
    schedule: "0 */4 * * *", // every 4 hours
    description: "Lead scraper run",
    command: "node scripts/generate_city_leads.js",
    enabled: true,
  },
  {
    name: "enrichment",
    schedule: "30 */6 * * *", // every 6 hours (offset by 30min)
    description: "Lead enrichment run",
    command: null, // handled by orchestrator
    handler: async () => {
      const AgentOrchestrator = require(
        path.join(ROOT, "agents/orchestrator/agent_orchestrator"),
      );
      const orch = new AgentOrchestrator();
      const leads = loadLeads();
      return await orch.runEnrichmentPipeline(leads.slice(0, 100));
    },
    enabled: true,
  },
  {
    name: "score_export",
    schedule: "0 * * * *", // every hour
    description: "Score and export leads",
    command: "npm run pipeline --prefix " + ROOT,
    enabled: true,
  },
];

// ── state ─────────────────────────────────────────────────────────────────────

const _tasks = {};
const _lastRuns = {};
const _nextRuns = {};

// ── helpers ───────────────────────────────────────────────────────────────────

function loadLeads() {
  const scoredFile = path.join(ROOT, "leads/scored_leads.json");
  const rawFile = path.join(ROOT, "leads/leads.json");
  try {
    if (fs.existsSync(scoredFile))
      return JSON.parse(fs.readFileSync(scoredFile, "utf8"));
    if (fs.existsSync(rawFile))
      return JSON.parse(fs.readFileSync(rawFile, "utf8"));
  } catch (_) {}
  return [];
}

function runCommand(cmd) {
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      timeout: 10 * 60 * 1000,
      encoding: "utf8",
    });
    return { ok: true, output: output.slice(0, 500) };
  } catch (err) {
    return { ok: false, error: err.message.slice(0, 300) };
  }
}

function updateNextRun(jobName, schedule) {
  // node-cron doesn't expose next-run; compute a simple human-readable label
  _nextRuns[jobName] = { schedule, note: `cron: ${schedule}` };
}

// ── public API ────────────────────────────────────────────────────────────────

function start() {
  if (Object.keys(_tasks).length > 0) {
    log("Scheduler already running");
    return;
  }
  ensureLogDir();
  log("Starting scheduler");

  JOB_DEFINITIONS.forEach((job) => {
    if (!job.enabled) {
      log(`Job "${job.name}" is disabled – skipping`);
      return;
    }

    if (!cron.validate(job.schedule)) {
      log(`Invalid cron schedule for "${job.name}": ${job.schedule}`, "WARN");
      return;
    }

    const task = cron.schedule(job.schedule, async () => {
      log(`Running job: ${job.name} — ${job.description}`);
      _lastRuns[job.name] = new Date().toISOString();

      try {
        if (job.handler) {
          const result = await job.handler();
          log(`Job "${job.name}" completed: ${JSON.stringify(result)}`);
        } else if (job.command) {
          const result = runCommand(job.command);
          if (result.ok) {
            log(`Job "${job.name}" completed successfully`);
          } else {
            log(`Job "${job.name}" failed: ${result.error}`, "ERROR");
          }
        }
      } catch (err) {
        log(`Job "${job.name}" threw: ${err.message}`, "ERROR");
      }
    });

    _tasks[job.name] = task;
    updateNextRun(job.name, job.schedule);
    log(`Scheduled job "${job.name}" [${job.schedule}] — ${job.description}`);
  });

  log(`Scheduler started with ${Object.keys(_tasks).length} jobs`);
}

function stop() {
  Object.entries(_tasks).forEach(([name, task]) => {
    try {
      task.stop();
      log(`Stopped job: ${name}`);
    } catch (err) {
      log(`Error stopping job "${name}": ${err.message}`, "WARN");
    }
  });
  Object.keys(_tasks).forEach((k) => delete _tasks[k]);
  log("Scheduler stopped");
}

function getStatus() {
  return {
    running: Object.keys(_tasks).length > 0,
    jobs: JOB_DEFINITIONS.map((job) => ({
      name: job.name,
      schedule: job.schedule,
      description: job.description,
      enabled: job.enabled,
      active: !!_tasks[job.name],
      lastRun: _lastRuns[job.name] || null,
      nextRun: _nextRuns[job.name] || null,
    })),
    logFile: LOG_FILE,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { start, stop, getStatus };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === "status") {
    console.log(JSON.stringify(getStatus(), null, 2));
  } else {
    start();
    log("Scheduler running. Press Ctrl+C to stop.");
    process.on("SIGINT", () => {
      stop();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      stop();
      process.exit(0);
    });
  }
}
