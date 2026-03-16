"use strict";

const fs = require("fs");
const path = require("path");

const LEADS_DIR = path.join(__dirname, "../../leads");

const STATE_ABBREVIATIONS = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

function loadAllLeads() {
  const leads = [];
  const files = [
    path.join(LEADS_DIR, "leads.json"),
    path.join(LEADS_DIR, "scored_leads.json"),
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        const arr = Array.isArray(data) ? data : data.leads || [];
        leads.push(...arr);
      } catch (_) {}
    }
  }

  // Also scan any sub-directory JSON files
  try {
    const entries = fs.readdirSync(LEADS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        !["leads.json", "scored_leads.json"].includes(entry.name)
      ) {
        try {
          const raw = JSON.parse(
            fs.readFileSync(path.join(LEADS_DIR, entry.name), "utf8"),
          );
          const arr = Array.isArray(raw) ? raw : raw.leads || [];
          leads.push(...arr);
        } catch (_) {}
      }
    }
  } catch (_) {}

  return leads;
}

function normalizeState(raw) {
  if (!raw) return "Unknown";
  const upper = raw.trim().toUpperCase();
  if (STATE_ABBREVIATIONS[upper]) return STATE_ABBREVIATIONS[upper];
  // Try to match full name
  const titleCase = raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCase || "Unknown";
}

function calcOpportunityScore(count, avgScore, avgRating, avgReviews) {
  let score = 0;
  score += Math.min(count * 2, 40); // Volume: up to 40 pts
  score += Math.min(avgScore * 0.3, 30); // Lead quality: up to 30 pts
  score += Math.min((avgRating / 5) * 15, 15); // Rating: up to 15 pts
  score += Math.min((avgReviews / 50) * 15, 15); // Review momentum: up to 15 pts
  return Math.round(Math.min(score, 100));
}

class OpportunityHeatmapEngine {
  constructor() {
    this._leads = null;
  }

  _getLeads() {
    if (!this._leads) this._leads = loadAllLeads();
    return this._leads;
  }

  generateHeatmap() {
    const stateData = this.getStateOpportunities();
    return {
      type: "heatmap",
      generated_at: new Date().toISOString(),
      total_leads: this._getLeads().length,
      states: stateData,
      top_5: stateData.slice(0, 5),
    };
  }

  getStateOpportunities() {
    const leads = this._getLeads();
    const stateMap = {};

    for (const lead of leads) {
      const state = normalizeState(lead.state || lead.State || "");
      if (!stateMap[state]) {
        stateMap[state] = { leads: [], scores: [], ratings: [], reviews: [] };
      }
      stateMap[state].leads.push(lead);
      if (lead.score != null) stateMap[state].scores.push(Number(lead.score));
      if (lead.rating != null)
        stateMap[state].ratings.push(Number(lead.rating));
      if (lead.review_count != null)
        stateMap[state].reviews.push(Number(lead.review_count));
    }

    return Object.entries(stateMap)
      .map(([state, data]) => {
        const count = data.leads.length;
        const avgScore = data.scores.length
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          : 50;
        const avgRating = data.ratings.length
          ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
          : 3;
        const avgReviews = data.reviews.length
          ? data.reviews.reduce((a, b) => a + b, 0) / data.reviews.length
          : 0;

        return {
          state,
          lead_count: count,
          avg_lead_score: Math.round(avgScore),
          avg_rating: parseFloat(avgRating.toFixed(2)),
          avg_reviews: Math.round(avgReviews),
          opportunity_score: calcOpportunityScore(
            count,
            avgScore,
            avgRating,
            avgReviews,
          ),
        };
      })
      .sort((a, b) => b.opportunity_score - a.opportunity_score);
  }

  getCityOpportunities(state) {
    const leads = this._getLeads().filter((l) => {
      const s = normalizeState(l.state || l.State || "");
      return s.toLowerCase() === state.toLowerCase();
    });

    if (leads.length === 0) return [];

    const cityMap = {};
    for (const lead of leads) {
      const city = (lead.city || lead.City || "Unknown").trim();
      if (!cityMap[city])
        cityMap[city] = { leads: [], scores: [], ratings: [] };
      cityMap[city].leads.push(lead);
      if (lead.score != null) cityMap[city].scores.push(Number(lead.score));
      if (lead.rating != null) cityMap[city].ratings.push(Number(lead.rating));
    }

    return Object.entries(cityMap)
      .map(([city, data]) => {
        const count = data.leads.length;
        const avgScore = data.scores.length
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          : 50;
        const avgRating = data.ratings.length
          ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
          : 3;
        return {
          city,
          state,
          lead_count: count,
          avg_lead_score: Math.round(avgScore),
          avg_rating: parseFloat(avgRating.toFixed(2)),
          opportunity_score: calcOpportunityScore(
            count,
            avgScore,
            avgRating,
            0,
          ),
        };
      })
      .sort((a, b) => b.opportunity_score - a.opportunity_score);
  }

  getTopOpportunities(limit = 10) {
    const states = this.getStateOpportunities();
    const results = [];

    for (const stateEntry of states.slice(0, 5)) {
      const cities = this.getCityOpportunities(stateEntry.state);
      for (const city of cities.slice(0, Math.ceil(limit / 5))) {
        results.push(city);
      }
    }

    return results
      .sort((a, b) => b.opportunity_score - a.opportunity_score)
      .slice(0, limit);
  }
}

module.exports = OpportunityHeatmapEngine;
