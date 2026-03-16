"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "../../data/sales/deals.json");

const VALID_STAGES = [
  "prospect",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

class DealValueTracker {
  constructor() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    this._data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      return { deals: {} };
    }
  }

  _save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2));
  }

  /**
   * Creates a new deal for a lead.
   * @param {string} leadId
   * @param {number} estimatedValue
   * @param {string} stage - one of VALID_STAGES
   * @returns deal record
   */
  createDeal(leadId, estimatedValue = 0, stage = "prospect") {
    if (!VALID_STAGES.includes(stage)) {
      throw new Error(
        `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}`,
      );
    }
    const id = crypto.randomUUID();
    const deal = {
      id,
      leadId,
      estimatedValue: Number(estimatedValue),
      stage,
      history: [{ stage, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedAt: null,
    };
    this._data.deals[id] = deal;
    this._save();
    return deal;
  }

  /**
   * Updates fields on a deal. If stage changes, appends to history.
   */
  updateDeal(dealId, updates = {}) {
    const deal = this._data.deals[dealId];
    if (!deal) throw new Error(`Deal not found: ${dealId}`);

    if (updates.stage && updates.stage !== deal.stage) {
      if (!VALID_STAGES.includes(updates.stage)) {
        throw new Error(`Invalid stage: ${updates.stage}`);
      }
      deal.history.push({
        stage: updates.stage,
        timestamp: new Date().toISOString(),
      });
      if (updates.stage === "closed_won" || updates.stage === "closed_lost") {
        deal.closedAt = new Date().toISOString();
      }
    }

    Object.assign(deal, updates, { updatedAt: new Date().toISOString() });
    this._save();
    return deal;
  }

  /**
   * Returns a single deal by ID.
   */
  getDeal(dealId) {
    return this._data.deals[dealId] || null;
  }

  /**
   * Returns deals, optionally filtered by stage, leadId, or date range.
   * @param {Object} filter - { stage, leadId, since }
   */
  getDeals(filter = {}) {
    let deals = Object.values(this._data.deals);
    if (filter.stage) deals = deals.filter((d) => d.stage === filter.stage);
    if (filter.leadId) deals = deals.filter((d) => d.leadId === filter.leadId);
    if (filter.since) deals = deals.filter((d) => d.createdAt >= filter.since);
    return deals;
  }

  /**
   * Returns the total estimated value of all active (non-closed) deals.
   */
  getPipelineValue() {
    const activeStages = ["prospect", "qualified", "proposal", "negotiation"];
    const deals = this.getDeals().filter((d) => activeStages.includes(d.stage));
    const total = deals.reduce((sum, d) => sum + d.estimatedValue, 0);
    return {
      total,
      dealCount: deals.length,
      byStage: this._groupByStage(deals),
    };
  }

  /**
   * Returns the total value of closed-won deals in a period.
   * @param {string} period - 'month'|'quarter'|'year'|'all'
   */
  getWonValue(period = "month") {
    const since = this._periodStart(period);
    const deals = this.getDeals({ stage: "closed_won" }).filter(
      (d) => !since || d.closedAt >= since,
    );
    const total = deals.reduce((sum, d) => sum + d.estimatedValue, 0);
    return { period, total, dealCount: deals.length };
  }

  _groupByStage(deals) {
    const result = {};
    for (const stage of VALID_STAGES) result[stage] = { count: 0, value: 0 };
    for (const d of deals) {
      if (result[d.stage]) {
        result[d.stage].count += 1;
        result[d.stage].value += d.estimatedValue;
      }
    }
    return result;
  }

  _periodStart(period) {
    const now = new Date();
    if (period === "month")
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    if (period === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1).toISOString();
    }
    if (period === "year")
      return new Date(now.getFullYear(), 0, 1).toISOString();
    return null;
  }
}

module.exports = DealValueTracker;
