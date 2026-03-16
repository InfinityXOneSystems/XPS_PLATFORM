"use strict";

const fs = require("fs");
const path = require("path");

const STATS_FILE = path.join(
  __dirname,
  "../../data/monitor/scraper_stats.json",
);

class ScraperHealthMonitor {
  constructor() {
    this.stats = {};
    this._ensureDir();
    this._load();
  }

  _ensureDir() {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _load() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const raw = fs.readFileSync(STATS_FILE, "utf8");
        this.stats = JSON.parse(raw);
      }
    } catch (err) {
      console.error("[HealthMonitor] Failed to load stats:", err.message);
      this.stats = {};
    }
  }

  _save() {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
    } catch (err) {
      console.error("[HealthMonitor] Failed to save stats:", err.message);
    }
  }

  _init(scraperName) {
    if (!this.stats[scraperName]) {
      this.stats[scraperName] = {
        totalRuns: 0,
        successRuns: 0,
        totalLeads: 0,
        lastError: null,
        lastRunAt: null,
      };
    }
  }

  recordRun(scraperName, success, count = 0, error = null) {
    this._init(scraperName);
    const s = this.stats[scraperName];
    s.totalRuns += 1;
    if (success) s.successRuns += 1;
    s.totalLeads += count;
    if (error)
      s.lastError = error instanceof Error ? error.message : String(error);
    s.lastRunAt = new Date().toISOString();
    this._save();
  }

  getStats(scraperName) {
    this._init(scraperName);
    const s = this.stats[scraperName];
    return {
      scraperName,
      totalRuns: s.totalRuns,
      successRate:
        s.totalRuns === 0 ? 0 : Math.round((s.successRuns / s.totalRuns) * 100),
      avgLeadsPerRun:
        s.totalRuns === 0 ? 0 : Math.round(s.totalLeads / s.totalRuns),
      totalLeads: s.totalLeads,
      lastError: s.lastError,
      lastRunAt: s.lastRunAt,
    };
  }

  getReport() {
    return Object.keys(this.stats).map((name) => this.getStats(name));
  }

  reset(scraperName) {
    delete this.stats[scraperName];
    this._save();
  }
}

module.exports = ScraperHealthMonitor;
