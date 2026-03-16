"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "../..");
const LEADS_DIR = path.join(ROOT, "leads");
const DATA_DIR = path.join(ROOT, "data");
const REPORT_FILE = path.join(DATA_DIR, "monitor", "health_reports.json");

const GPT_ACTIONS_PORT = process.env.GPT_ACTIONS_PORT || 3100;
const MAX_REPORTS = 100;

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[FullSystemMonitor] ${new Date().toISOString()} ${msg}`);
}

function saveReport(report) {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  let reports = [];
  if (fs.existsSync(REPORT_FILE)) {
    try {
      reports = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
    } catch (_) {}
  }
  reports.push(report);
  if (reports.length > MAX_REPORTS) reports = reports.slice(-MAX_REPORTS);
  fs.writeFileSync(REPORT_FILE, JSON.stringify(reports, null, 2));
}

function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (d) => {
        body += d;
      });
      res.on("end", () =>
        resolve({ ok: res.statusCode < 400, statusCode: res.statusCode, body }),
      );
    });
    req.on("error", () => resolve({ ok: false, statusCode: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, statusCode: null, timedOut: true });
    });
  });
}

// ── FullSystemMonitor class ───────────────────────────────────────────────────

class FullSystemMonitor {
  constructor() {
    this._interval = null;
  }

  // ── file system checks ────────────────────────────────────────────────────

  _checkFileSystem() {
    const checks = [];

    const files = [
      {
        key: "leads.json",
        file: path.join(LEADS_DIR, "leads.json"),
        critical: true,
      },
      {
        key: "scored_leads.json",
        file: path.join(LEADS_DIR, "scored_leads.json"),
        critical: false,
      },
      {
        key: "scoring_report.json",
        file: path.join(LEADS_DIR, "scoring_report.json"),
        critical: false,
      },
    ];

    for (const { key, file, critical } of files) {
      if (!fs.existsSync(file)) {
        checks.push({
          name: `fs:${key}`,
          ok: false,
          critical,
          message: "File does not exist",
        });
        continue;
      }
      try {
        const stat = fs.statSync(file);
        const content = JSON.parse(fs.readFileSync(file, "utf8"));
        const count = Array.isArray(content)
          ? content.length
          : typeof content === "object"
            ? Object.keys(content).length
            : 0;
        checks.push({
          name: `fs:${key}`,
          ok: true,
          critical,
          message: `${count} records, ${stat.size} bytes`,
          records: count,
          sizeBytes: stat.size,
        });
      } catch (err) {
        checks.push({
          name: `fs:${key}`,
          ok: false,
          critical,
          message: err.message,
        });
      }
    }

    return checks;
  }

  // ── dependency checks ─────────────────────────────────────────────────────

  _checkDependencies() {
    const pkgs = [
      "express",
      "axios",
      "node-cron",
      "express-rate-limit",
      "dotenv",
    ];
    return pkgs.map((pkg) => {
      try {
        require.resolve(pkg);
        return {
          name: `dep:${pkg}`,
          ok: true,
          critical: false,
          message: "available",
        };
      } catch {
        return {
          name: `dep:${pkg}`,
          ok: false,
          critical: pkg === "express",
          message: "not installed",
        };
      }
    });
  }

  // ── data freshness check ──────────────────────────────────────────────────

  _checkDataFreshness() {
    const checks = [];
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

    const files = [
      path.join(LEADS_DIR, "scored_leads.json"),
      path.join(LEADS_DIR, "leads.json"),
    ];

    let latestMtime = null;
    let latestFile = null;

    for (const f of files) {
      if (fs.existsSync(f)) {
        const mtime = fs.statSync(f).mtimeMs;
        if (!latestMtime || mtime > latestMtime) {
          latestMtime = mtime;
          latestFile = f;
        }
      }
    }

    if (!latestMtime) {
      checks.push({
        name: "freshness:leads",
        ok: false,
        critical: false,
        message: "No lead files found",
      });
    } else {
      const ageMs = Date.now() - latestMtime;
      const ageHours = Math.round((ageMs / 3600000) * 10) / 10;
      const stale = ageMs > MAX_AGE_MS;
      checks.push({
        name: "freshness:leads",
        ok: !stale,
        critical: false,
        message: `Last updated ${ageHours}h ago (${path.basename(latestFile)})`,
        ageHours,
        stale,
      });
    }

    return checks;
  }

  // ── API connectivity check ────────────────────────────────────────────────

  async _checkApiConnectivity() {
    const endpoints = [
      {
        name: "gpt_actions_server",
        url: `http://localhost:${GPT_ACTIONS_PORT}/health`,
      },
      {
        name: "api_gateway",
        url: `http://localhost:${process.env.GATEWAY_PORT || 3200}/api/monitoring/health`,
      },
    ];

    const results = await Promise.all(
      endpoints.map(async ({ name, url }) => {
        const result = await httpGet(url, 3000);
        return {
          name: `api:${name}`,
          ok: result.ok,
          critical: false,
          message: result.ok
            ? `HTTP ${result.statusCode}`
            : result.timedOut
              ? "timeout"
              : `HTTP ${result.statusCode || "unreachable"}`,
        };
      }),
    );

    return results;
  }

  // ── main health check ─────────────────────────────────────────────────────

  async runHealthCheck() {
    const fsChecks = this._checkFileSystem();
    const depChecks = this._checkDependencies();
    const freshnessChecks = this._checkDataFreshness();
    const apiChecks = await this._checkApiConnectivity();

    const checks = [
      ...fsChecks,
      ...depChecks,
      ...freshnessChecks,
      ...apiChecks,
    ];

    const issues = checks
      .filter((c) => !c.ok)
      .map((c) => `${c.name}: ${c.message}`);
    const criticalFailures = checks.filter((c) => !c.ok && c.critical);

    let status;
    if (criticalFailures.length > 0) status = "unhealthy";
    else if (issues.length > 0) status = "degraded";
    else status = "healthy";

    const report = {
      status,
      checks,
      timestamp: new Date().toISOString(),
      issues,
      summary: {
        total: checks.length,
        passed: checks.filter((c) => c.ok).length,
        failed: issues.length,
        critical: criticalFailures.length,
      },
    };

    saveReport(report);
    return report;
  }

  // ── continuous monitoring ─────────────────────────────────────────────────

  startMonitoring(intervalMs = 5 * 60 * 1000) {
    if (this._interval) return;
    log(`Starting continuous monitoring (interval: ${intervalMs}ms)`);

    const run = async () => {
      try {
        const report = await this.runHealthCheck();
        if (report.status !== "healthy") {
          log(`[${report.status.toUpperCase()}] Issues detected:`);
          report.issues.forEach((i) => log(`  ✗ ${i}`));
        } else {
          log(`[HEALTHY] All ${report.summary.total} checks passed`);
        }
      } catch (err) {
        log(`Error during health check: ${err.message}`);
      }
    };

    run();
    this._interval = setInterval(run, intervalMs);
    return this._interval;
  }

  stopMonitoring() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
      log("Monitoring stopped");
    }
  }
}

module.exports = FullSystemMonitor;

if (require.main === module) {
  const monitor = new FullSystemMonitor();
  monitor.runHealthCheck().then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.status === "unhealthy" ? 1 : 0);
  });
}
