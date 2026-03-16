"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "../../data/sales/pipeline.json");

const STAGES = [
  "prospect",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

class SalesPipelineTracker {
  constructor() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    this._data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      const stages = {};
      STAGES.forEach((s) => {
        stages[s] = [];
      });
      return { stages, moves: [] };
    }
  }

  _save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2));
  }

  /**
   * Moves a lead from one stage to another, or adds it to a stage if not yet tracked.
   */
  moveLead(leadId, fromStage, toStage) {
    if (!STAGES.includes(toStage)) throw new Error(`Invalid stage: ${toStage}`);

    // Remove from source stage if specified and present
    if (fromStage && this._data.stages[fromStage]) {
      const idx = this._data.stages[fromStage].findIndex(
        (e) => e.leadId === leadId,
      );
      if (idx !== -1) this._data.stages[fromStage].splice(idx, 1);
    }

    // Ensure destination stage exists
    if (!this._data.stages[toStage]) this._data.stages[toStage] = [];

    // Avoid duplicates in target stage
    const alreadyInTarget = this._data.stages[toStage].some(
      (e) => e.leadId === leadId,
    );
    if (!alreadyInTarget) {
      this._data.stages[toStage].push({
        leadId,
        movedAt: new Date().toISOString(),
      });
    }

    // Append to move history
    this._data.moves.push({
      id: crypto.randomUUID(),
      leadId,
      fromStage: fromStage || null,
      toStage,
      timestamp: new Date().toISOString(),
    });

    this._save();
    return { leadId, fromStage, toStage };
  }

  /**
   * Returns all leads currently in a given stage.
   */
  getStageLeads(stage) {
    if (!STAGES.includes(stage)) throw new Error(`Invalid stage: ${stage}`);
    return this._data.stages[stage] || [];
  }

  /**
   * Returns high-level pipeline metrics: counts per stage, total, win rate.
   */
  getPipelineMetrics() {
    const counts = {};
    let total = 0;
    for (const stage of STAGES) {
      const count = (this._data.stages[stage] || []).length;
      counts[stage] = count;
      if (!["closed_won", "closed_lost"].includes(stage)) total += count;
    }
    const closed = counts.closed_won + counts.closed_lost;
    const winRate =
      closed > 0 ? ((counts.closed_won / closed) * 100).toFixed(1) : "0.0";
    return { counts, activePipelineLeads: total, winRate: `${winRate}%` };
  }

  /**
   * Returns funnel data with conversion rates between consecutive stages.
   */
  getFunnelData() {
    const funnelStages = [
      "prospect",
      "qualified",
      "proposal",
      "negotiation",
      "closed_won",
    ];
    const counts = funnelStages.map((s) => ({
      stage: s,
      count: (this._data.stages[s] || []).length,
    }));

    const funnel = counts.map((item, i) => {
      const conversionRate =
        i === 0 || counts[i - 1].count === 0
          ? null
          : ((item.count / counts[i - 1].count) * 100).toFixed(1);
      return {
        ...item,
        conversionFromPrev: conversionRate ? `${conversionRate}%` : null,
      };
    });

    return funnel;
  }

  /**
   * Returns the raw move history for auditing.
   */
  getMoveHistory(leadId = null) {
    return leadId
      ? this._data.moves.filter((m) => m.leadId === leadId)
      : this._data.moves;
  }
}

module.exports = SalesPipelineTracker;
