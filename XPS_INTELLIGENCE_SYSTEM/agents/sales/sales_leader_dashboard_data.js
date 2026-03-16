"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const LEADS_DIR = path.join(ROOT, "leads");
const DATA_DIR = path.join(ROOT, "data");

// Lazy-load sales agents to avoid hard failures if files are missing
function safeLazyLoad(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return null;
  }
}

// ── SalesLeaderDashboardData ──────────────────────────────────────────────────

class SalesLeaderDashboardData {
  constructor() {
    this._pipelineTracker = safeLazyLoad(
      path.join(__dirname, "sales_pipeline_tracker"),
    );
    this._revenueForecast = safeLazyLoad(
      path.join(__dirname, "revenue_forecast"),
    );
  }

  // ── internal data loaders ─────────────────────────────────────────────────

  _loadLeads() {
    const scoredFile = path.join(LEADS_DIR, "scored_leads.json");
    const rawFile = path.join(LEADS_DIR, "leads.json");
    try {
      if (fs.existsSync(scoredFile))
        return JSON.parse(fs.readFileSync(scoredFile, "utf8"));
      if (fs.existsSync(rawFile))
        return JSON.parse(fs.readFileSync(rawFile, "utf8"));
    } catch (_) {}
    return [];
  }

  _loadSalesData(filename) {
    const file = path.join(DATA_DIR, "sales", filename);
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {}
    return null;
  }

  _loadRepData(repId) {
    const file = path.join(DATA_DIR, "sales", "reps", `${repId}.json`);
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {}
    return null;
  }

  // ── pipeline summary ──────────────────────────────────────────────────────

  _getPipelineSummary() {
    const pipeline = this._loadSalesData("pipeline.json");
    if (!pipeline || !pipeline.stages) {
      return { stages: {}, totalDeals: 0, pipelineValue: 0 };
    }
    const stages = {};
    let totalDeals = 0;
    Object.entries(pipeline.stages).forEach(([stage, deals]) => {
      stages[stage] = Array.isArray(deals) ? deals.length : 0;
      totalDeals += stages[stage];
    });
    return { stages, totalDeals };
  }

  // ── revenue forecast ──────────────────────────────────────────────────────

  _getRevenueForecast() {
    const forecast = this._loadSalesData("revenue_forecast.json");
    if (!forecast)
      return { forecast: null, message: "No forecast data available" };
    return forecast;
  }

  // ── rep activity ──────────────────────────────────────────────────────────

  _getRepActivity() {
    const assignments = this._loadSalesData("assignments.json");
    if (!assignments || !assignments.assignments) return [];

    const repStats = {};
    Object.entries(assignments.assignments).forEach(([leadId, assignment]) => {
      const rep = assignment.repId || assignment.assignedTo;
      if (!rep) return;
      if (!repStats[rep])
        repStats[rep] = { repId: rep, assignedLeads: 0, deals: 0, calls: 0 };
      repStats[rep].assignedLeads += 1;
    });

    return Object.values(repStats);
  }

  // ── top leads ─────────────────────────────────────────────────────────────

  _getTopLeads(n = 10) {
    const leads = this._loadLeads();
    return Array.isArray(leads)
      ? leads
          .filter((l) => typeof l.score === "number")
          .sort((a, b) => b.score - a.score)
          .slice(0, n)
          .map((l) => ({
            id: l.id || l.place_id,
            name: l.name || l.company_name,
            score: l.score,
            city: l.city,
            state: l.state,
            phone: l.phone,
            email: l.email,
          }))
      : [];
  }

  // ── recent activity ───────────────────────────────────────────────────────

  _getRecentActivity() {
    const logFile = path.join(DATA_DIR, "outreach", "outreach_queue.json");
    try {
      if (fs.existsSync(logFile)) {
        const queue = JSON.parse(fs.readFileSync(logFile, "utf8"));
        return Array.isArray(queue)
          ? queue
              .sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt))
              .slice(0, 20)
          : [];
      }
    } catch (_) {}
    return [];
  }

  // ── public API ────────────────────────────────────────────────────────────

  getDashboardData() {
    const leads = this._loadLeads();
    const total = Array.isArray(leads) ? leads.length : 0;
    const scored = Array.isArray(leads)
      ? leads.filter((l) => typeof l.score === "number")
      : [];
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, l) => s + l.score, 0) / scored.length)
      : 0;

    return {
      generatedAt: new Date().toISOString(),
      overview: { totalLeads: total, scoredLeads: scored.length, avgScore },
      pipelineSummary: this._getPipelineSummary(),
      revenueForecast: this._getRevenueForecast(),
      repPerformance: this._getRepActivity(),
      topLeads: this._getTopLeads(),
      recentActivity: this._getRecentActivity(),
    };
  }

  getRepPerformance(repId) {
    const repData = this._loadRepData(repId);
    const assignments = this._loadSalesData("assignments.json");
    const assigned = [];

    if (assignments && assignments.assignments) {
      Object.entries(assignments.assignments).forEach(([leadId, a]) => {
        if ((a.repId || a.assignedTo) === repId) assigned.push(leadId);
      });
    }

    return {
      repId,
      assignedLeads: assigned.length,
      calls: repData ? (repData.calls || []).length : 0,
      deals: repData ? (repData.deals || []).length : 0,
      conversionRate:
        assigned.length > 0 && repData
          ? Math.round(((repData.deals || []).length / assigned.length) * 100)
          : 0,
      lastActivity: repData ? repData.lastActivity : null,
    };
  }

  getTeamPerformance() {
    const assignments = this._loadSalesData("assignments.json");
    const reps = new Set();

    if (assignments && assignments.assignments) {
      Object.values(assignments.assignments).forEach((a) => {
        const rep = a.repId || a.assignedTo;
        if (rep) reps.add(rep);
      });
    }

    return Array.from(reps).map((repId) => this.getRepPerformance(repId));
  }

  getKPIs() {
    const leads = this._loadLeads();
    const list = Array.isArray(leads) ? leads : [];
    const pipeline = this._getPipelineSummary();

    const qualifiedLeads = list.filter((l) => (l.score || 0) >= 40).length;
    const hotLeads = list.filter((l) => (l.score || 0) >= 60).length;

    return {
      totalLeads: list.length,
      qualifiedLeads,
      hotLeads,
      withEmail: list.filter((l) => l.email).length,
      withWebsite: list.filter((l) => l.website).length,
      pipelineDeals: pipeline.totalDeals,
      qualificationRate:
        list.length > 0 ? Math.round((qualifiedLeads / list.length) * 100) : 0,
    };
  }
}

module.exports = SalesLeaderDashboardData;
