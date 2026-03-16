"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data");
const LOG_FILE = path.join(DATA_DIR, "logs", "orchestrator.log");

// Lazy-load agents so orchestrator doesn't crash if some are absent
function safeLazyLoad(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    return null;
  }
}

// ── logging ───────────────────────────────────────────────────────────────────

function ensureLogDir() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(msg, level = "INFO") {
  const line = `[${new Date().toISOString()}] [${level}] [AgentOrchestrator] ${msg}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (_) {}
}

// ── AgentOrchestrator ─────────────────────────────────────────────────────────

class AgentOrchestrator {
  constructor() {
    ensureLogDir();
  }

  // ── agent loader helpers ──────────────────────────────────────────────────

  _loadScoringPipeline() {
    return safeLazyLoad(path.join(ROOT, "agents/scoring/scoring_pipeline"));
  }

  _loadEnrichmentEngine() {
    return safeLazyLoad(path.join(ROOT, "agents/enrichment/enrichment_engine"));
  }

  _loadDeduplicator() {
    return safeLazyLoad(path.join(ROOT, "agents/dedupe/deduplication_engine"));
  }

  _loadValidator() {
    return (
      safeLazyLoad(path.join(ROOT, "agents/validation/validation_engine")) ||
      safeLazyLoad(path.join(ROOT, "validators/lead_validator"))
    );
  }

  _loadExporter() {
    return safeLazyLoad(path.join(ROOT, "tools/export_snapshot"));
  }

  // ── status helpers ────────────────────────────────────────────────────────

  _checkAgent(name, modulePath) {
    let available = false;
    try {
      require.resolve(modulePath);
      available = true;
    } catch (_) {}
    return { name, available, modulePath };
  }

  // ── pipeline step runner ──────────────────────────────────────────────────

  async _runStep(stepName, fn) {
    const start = Date.now();
    log(`Starting step: ${stepName}`);
    try {
      const result = await fn();
      const ms = Date.now() - start;
      log(`Completed step: ${stepName} (${ms}ms)`);
      return { step: stepName, ok: true, durationMs: ms, result };
    } catch (err) {
      const ms = Date.now() - start;
      log(`Failed step: ${stepName} — ${err.message} (${ms}ms)`, "ERROR");
      return { step: stepName, ok: false, durationMs: ms, error: err.message };
    }
  }

  // ── load leads from file ──────────────────────────────────────────────────

  _loadLeads(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return Array.isArray(data) ? data : [];
      }
    } catch (_) {}
    return [];
  }

  // ── pipelines ─────────────────────────────────────────────────────────────

  async runFullPipeline(options = {}) {
    log(
      "=== Starting full pipeline: scrape → validate → deduplicate → enrich → score → export ===",
    );
    const startTime = Date.now();
    const steps = [];

    // 1. Scrape (check for pre-generated leads from city generator)
    const scrapeStep = await this._runStep("scrape", async () => {
      const leadsFile = path.join(ROOT, "leads/leads.json");
      const leads = this._loadLeads(leadsFile);
      log(`Loaded ${leads.length} raw leads from ${leadsFile}`);
      return { leadsLoaded: leads.length };
    });
    steps.push(scrapeStep);

    // 2. Validate
    const validateStep = await this._runStep("validate", async () => {
      const Validator = this._loadValidator();
      if (!Validator) {
        log("Validator not available – skipping", "WARN");
        return { skipped: true };
      }
      const v =
        typeof Validator === "function" && Validator.prototype
          ? new Validator()
          : Validator;
      const run = v.validate || v.run || v.validateLeads;
      if (typeof run === "function") await run.call(v);
      return { completed: true };
    });
    steps.push(validateStep);

    // 3. Deduplicate
    const dedupStep = await this._runStep("deduplicate", async () => {
      const Dedup = this._loadDeduplicator();
      if (!Dedup) {
        log("Deduplicator not available – skipping", "WARN");
        return { skipped: true };
      }
      const d =
        typeof Dedup === "function" && Dedup.prototype ? new Dedup() : Dedup;
      const run = d.run || d.deduplicate || d.dedup;
      if (typeof run === "function") await run.call(d);
      return { completed: true };
    });
    steps.push(dedupStep);

    // 4. Enrich
    const enrichStep = await this._runStep("enrich", async () => {
      const leadsFile = path.join(ROOT, "leads/leads.json");
      const leads = this._loadLeads(leadsFile);
      return await this.runEnrichmentPipeline(
        leads.slice(0, options.enrichLimit || 50),
      );
    });
    steps.push(enrichStep);

    // 5. Score
    const scoreStep = await this._runStep("score", async () => {
      const ScoringPipeline = this._loadScoringPipeline();
      if (!ScoringPipeline) {
        log("ScoringPipeline not available – skipping", "WARN");
        return { skipped: true };
      }
      const sp =
        typeof ScoringPipeline === "function" && ScoringPipeline.prototype
          ? new ScoringPipeline()
          : ScoringPipeline;
      const run = sp.run || sp.score || sp.execute;
      if (typeof run === "function") await run.call(sp);
      return { completed: true };
    });
    steps.push(scoreStep);

    // 6. Export
    const exportStep = await this._runStep("export", async () => {
      const Exporter = this._loadExporter();
      if (!Exporter) {
        log("Exporter not available – skipping", "WARN");
        return { skipped: true };
      }
      const e =
        typeof Exporter === "function" && Exporter.prototype
          ? new Exporter()
          : Exporter;
      const run = e.run || e.export || e.exportSnapshot;
      if (typeof run === "function") await run.call(e);
      return { completed: true };
    });
    steps.push(exportStep);

    const totalMs = Date.now() - startTime;
    const failed = steps.filter((s) => !s.ok);
    const summary = {
      completedAt: new Date().toISOString(),
      totalDurationMs: totalMs,
      stepsTotal: steps.length,
      stepsPassed: steps.filter((s) => s.ok).length,
      stepsFailed: failed.length,
      steps,
    };

    log(
      `=== Pipeline complete in ${totalMs}ms — ${summary.stepsPassed}/${summary.stepsTotal} steps passed ===`,
    );

    // Persist run summary
    const summaryFile = path.join(DATA_DIR, "logs", "pipeline_runs.json");
    try {
      let runs = [];
      if (fs.existsSync(summaryFile))
        runs = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
      runs.push(summary);
      if (runs.length > 50) runs = runs.slice(-50);
      fs.writeFileSync(summaryFile, JSON.stringify(runs, null, 2));
    } catch (_) {}

    return summary;
  }

  async runEnrichmentPipeline(leads) {
    if (!Array.isArray(leads) || leads.length === 0) {
      log("No leads to enrich");
      return { enriched: 0, skipped: 0 };
    }

    const EnrichmentEngine = this._loadEnrichmentEngine();
    if (!EnrichmentEngine) {
      log("EnrichmentEngine not available – skipping enrichment", "WARN");
      return {
        enriched: 0,
        skipped: leads.length,
        reason: "EnrichmentEngine not available",
      };
    }

    log(`Running enrichment on ${leads.length} leads`);
    const engine =
      typeof EnrichmentEngine === "function" && EnrichmentEngine.prototype
        ? new EnrichmentEngine()
        : EnrichmentEngine;

    let enriched = 0;
    const errors = [];

    for (const lead of leads) {
      try {
        const enrichFn = engine.enrich || engine.enrichLead || engine.run;
        if (typeof enrichFn === "function") {
          await enrichFn.call(engine, lead);
          enriched++;
        }
      } catch (err) {
        errors.push({ lead: lead.id || lead.place_id, error: err.message });
      }
    }

    log(`Enrichment complete: ${enriched}/${leads.length} leads enriched`);
    return { enriched, skipped: leads.length - enriched, errors };
  }

  async runOutreachPipeline(leads, campaign = {}) {
    if (!Array.isArray(leads) || leads.length === 0) {
      log("No leads for outreach");
      return { sent: 0, skipped: 0 };
    }

    const qualified = leads.filter(
      (l) => l.email && (l.score || 0) >= (campaign.minScore || 30),
    );
    log(
      `Outreach pipeline: ${qualified.length}/${leads.length} qualified leads`,
    );

    const logDir = path.join(DATA_DIR, "outreach");
    fs.mkdirSync(logDir, { recursive: true });

    const queueFile = path.join(logDir, "outreach_queue.json");
    let queue = [];
    if (fs.existsSync(queueFile)) {
      try {
        queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
      } catch (_) {}
    }

    const added = [];
    for (const lead of qualified) {
      const entry = {
        leadId: lead.id || lead.place_id,
        email: lead.email,
        companyName: lead.name || lead.company_name,
        campaign: campaign.name || "default",
        template: campaign.template || "default",
        queuedAt: new Date().toISOString(),
        status: "queued",
      };
      queue.push(entry);
      added.push(entry);
    }

    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    log(
      `Queued ${added.length} leads for outreach (campaign: ${campaign.name || "default"})`,
    );
    return { queued: added.length, skipped: leads.length - qualified.length };
  }

  getSystemStatus() {
    const agents = [
      {
        name: "scoring_pipeline",
        path: path.join(ROOT, "agents/scoring/scoring_pipeline"),
      },
      {
        name: "enrichment_engine",
        path: path.join(ROOT, "agents/enrichment/enrichment_engine"),
      },
      {
        name: "deduplication_engine",
        path: path.join(ROOT, "agents/dedupe/deduplication_engine"),
      },
      {
        name: "gpt_actions_server",
        path: path.join(ROOT, "agents/gpt_actions/server"),
      },
      {
        name: "infinity_orchestrator",
        path: path.join(ROOT, "agents/orchestrator/infinity_orchestrator"),
      },
      {
        name: "system_monitor",
        path: path.join(ROOT, "agents/monitor/system_monitor"),
      },
      {
        name: "full_system_monitor",
        path: path.join(ROOT, "agents/monitor/full_system_monitor"),
      },
      { name: "api_gateway", path: path.join(ROOT, "api/gateway") },
    ];

    const agentStatus = agents.map(({ name, path: modulePath }) => {
      let available = false;
      try {
        require.resolve(modulePath);
        available = true;
      } catch (_) {}
      return { name, available };
    });

    const leadsFile = path.join(ROOT, "leads/leads.json");
    const scoredFile = path.join(ROOT, "leads/scored_leads.json");
    const leads = this._loadLeads(scoredFile) || this._loadLeads(leadsFile);

    return {
      timestamp: new Date().toISOString(),
      agents: agentStatus,
      data: {
        totalLeads: leads.length,
        dataDir: fs.existsSync(DATA_DIR),
        leadsDir: fs.existsSync(path.join(ROOT, "leads")),
      },
      logFile: LOG_FILE,
    };
  }
}

module.exports = AgentOrchestrator;

if (require.main === module) {
  const orch = new AgentOrchestrator();
  const cmd = process.argv[2] || "status";
  if (cmd === "status") {
    console.log(JSON.stringify(orch.getSystemStatus(), null, 2));
  } else if (cmd === "run") {
    orch.runFullPipeline().then((s) => {
      console.log(JSON.stringify(s, null, 2));
      process.exit(s.stepsFailed > 0 ? 1 : 0);
    });
  }
}
