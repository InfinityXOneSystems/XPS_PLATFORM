"use strict";

const path = require("path");

// Probability weights by stage (0–1)
const STAGE_PROBABILITY = {
  prospect: 0.1,
  qualified: 0.3,
  proposal: 0.6,
  negotiation: 0.8,
  closed_won: 1.0,
  closed_lost: 0.0,
};

class RevenueForecastEngine {
  constructor(dealsFilePath = null) {
    this._dealsFile =
      dealsFilePath || path.join(__dirname, "../../data/sales/deals.json");
  }

  _loadDeals() {
    try {
      const fs = require("fs");
      const raw = fs.readFileSync(this._dealsFile, "utf8");
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        throw new Error(
          `Invalid JSON in deals file ${this._dealsFile}: ${parseErr.message}`,
        );
      }
      if (!parsed || typeof parsed !== "object") {
        throw new Error(
          `Deals file ${this._dealsFile} must contain a JSON object with a "deals" property`,
        );
      }
      return Object.values(parsed.deals || {});
    } catch {
      return [];
    }
  }

  /**
   * Generates a revenue forecast for the given period.
   * @param {string} period - 'monthly'|'quarterly'|'annual'
   * @returns {{ period, total_pipeline, weighted_forecast, expected_revenue, deals_by_stage }}
   */
  forecast(period = "monthly") {
    const allDeals = this._loadDeals();
    const activeDeals = allDeals.filter((d) => d.stage !== "closed_lost");

    let total_pipeline = 0;
    let weighted_forecast = 0;
    let expected_revenue = 0;

    const deals_by_stage = {};
    for (const stage of Object.keys(STAGE_PROBABILITY)) {
      deals_by_stage[stage] = { count: 0, total_value: 0, weighted_value: 0 };
    }

    for (const deal of activeDeals) {
      const prob = STAGE_PROBABILITY[deal.stage] ?? 0;
      const value = Number(deal.estimatedValue) || 0;
      const weighted = value * prob;

      total_pipeline += value;
      weighted_forecast += weighted;
      if (deal.stage === "closed_won") expected_revenue += value;

      if (deals_by_stage[deal.stage]) {
        deals_by_stage[deal.stage].count += 1;
        deals_by_stage[deal.stage].total_value += value;
        deals_by_stage[deal.stage].weighted_value += weighted;
      }
    }

    // Apply a period multiplier to project forward
    const multiplier = this._periodMultiplier(period);

    return {
      period,
      generatedAt: new Date().toISOString(),
      total_pipeline: Math.round(total_pipeline),
      weighted_forecast: Math.round(weighted_forecast * multiplier),
      expected_revenue: Math.round(expected_revenue),
      deals_by_stage,
      stage_probabilities: STAGE_PROBABILITY,
      note: `Weighted forecast scaled by ${multiplier}x for ${period} projection`,
    };
  }

  _periodMultiplier(period) {
    switch (period) {
      case "monthly":
        return 1;
      case "quarterly":
        return 3;
      case "annual":
        return 12;
      default:
        return 1;
    }
  }
}

module.exports = RevenueForecastEngine;
