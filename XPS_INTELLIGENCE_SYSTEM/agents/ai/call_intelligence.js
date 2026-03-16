"use strict";

const fs = require("fs");
const path = require("path");

const CALLS_FILE = path.join(__dirname, "../../data/calls/call_history.json");

function loadCalls() {
  try {
    if (fs.existsSync(CALLS_FILE)) {
      return JSON.parse(fs.readFileSync(CALLS_FILE, "utf8"));
    }
  } catch (_) {}
  return [];
}

function saveCalls(calls) {
  fs.mkdirSync(path.dirname(CALLS_FILE), { recursive: true });
  fs.writeFileSync(CALLS_FILE, JSON.stringify(calls, null, 2));
}

function generateId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

class CallIntelligenceRecorder {
  constructor() {
    this._calls = loadCalls();
  }

  recordCall(repId, leadId, duration, outcome, notes = "") {
    const VALID_OUTCOMES = [
      "connected",
      "voicemail",
      "no_answer",
      "closed",
      "not_interested",
      "follow_up",
    ];
    if (!VALID_OUTCOMES.includes(outcome)) {
      throw new Error(
        `Invalid outcome '${outcome}'. Must be one of: ${VALID_OUTCOMES.join(", ")}`,
      );
    }
    const record = {
      id: generateId(),
      rep_id: repId,
      lead_id: leadId,
      duration_seconds: duration,
      outcome,
      notes,
      recorded_at: new Date().toISOString(),
      hour_of_day: new Date().getHours(),
      day_of_week: new Date().toLocaleDateString("en-US", { weekday: "long" }),
    };
    this._calls.push(record);
    this._persist();
    return record;
  }

  getCallHistory(repId) {
    return this._calls
      .filter((c) => c.rep_id === repId)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
  }

  getLeadCallHistory(leadId) {
    return this._calls
      .filter((c) => c.lead_id === leadId)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
  }

  analyzeCallPatterns(repId) {
    const calls = this.getCallHistory(repId);
    if (calls.length === 0) {
      return {
        rep_id: repId,
        message: "No call history found.",
        patterns: null,
      };
    }

    // Outcome rates
    const outcomeCounts = calls.reduce((acc, c) => {
      acc[c.outcome] = (acc[c.outcome] || 0) + 1;
      return acc;
    }, {});

    const outcomeRates = Object.fromEntries(
      Object.entries(outcomeCounts).map(([k, v]) => [
        k,
        `${((v / calls.length) * 100).toFixed(1)}%`,
      ]),
    );

    // Avg duration
    const avgDuration =
      calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
      calls.length;

    // Best hours
    const hourMap = calls.reduce((acc, c) => {
      const h = c.hour_of_day;
      if (!acc[h]) acc[h] = { total: 0, connected: 0 };
      acc[h].total++;
      if (["connected", "closed", "follow_up"].includes(c.outcome))
        acc[h].connected++;
      return acc;
    }, {});

    const bestHours = Object.entries(hourMap)
      .map(([h, data]) => ({
        hour: parseInt(h),
        connect_rate: ((data.connected / data.total) * 100).toFixed(1) + "%",
        total_calls: data.total,
      }))
      .sort((a, b) => parseFloat(b.connect_rate) - parseFloat(a.connect_rate))
      .slice(0, 3);

    // Best days
    const dayMap = calls.reduce((acc, c) => {
      const d = c.day_of_week;
      if (!acc[d]) acc[d] = { total: 0, connected: 0 };
      acc[d].total++;
      if (["connected", "closed", "follow_up"].includes(c.outcome))
        acc[d].connected++;
      return acc;
    }, {});

    const bestDays = Object.entries(dayMap)
      .map(([day, data]) => ({
        day,
        connect_rate: ((data.connected / data.total) * 100).toFixed(1) + "%",
        total_calls: data.total,
      }))
      .sort((a, b) => parseFloat(b.connect_rate) - parseFloat(a.connect_rate))
      .slice(0, 3);

    return {
      rep_id: repId,
      total_calls: calls.length,
      avg_duration_seconds: Math.round(avgDuration),
      outcome_rates: outcomeRates,
      best_call_hours: bestHours,
      best_call_days: bestDays,
    };
  }

  getInsights() {
    if (this._calls.length === 0) {
      return { message: "No call data available yet.", total_calls: 0 };
    }

    const totalCalls = this._calls.length;
    const uniqueReps = [...new Set(this._calls.map((c) => c.rep_id))].length;
    const uniqueLeads = [...new Set(this._calls.map((c) => c.lead_id))].length;

    const outcomeCounts = this._calls.reduce((acc, c) => {
      acc[c.outcome] = (acc[c.outcome] || 0) + 1;
      return acc;
    }, {});

    const closedCalls = outcomeCounts["closed"] || 0;
    const closeRate = ((closedCalls / totalCalls) * 100).toFixed(1) + "%";

    const avgDuration =
      this._calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
      totalCalls;

    // System-wide best hour
    const hourMap = this._calls.reduce((acc, c) => {
      acc[c.hour_of_day] = (acc[c.hour_of_day] || 0) + 1;
      return acc;
    }, {});
    const busiest_hour = Object.entries(hourMap).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    return {
      total_calls: totalCalls,
      unique_reps: uniqueReps,
      unique_leads_contacted: uniqueLeads,
      close_rate: closeRate,
      avg_duration_seconds: Math.round(avgDuration),
      outcome_breakdown: outcomeCounts,
      busiest_hour: busiest_hour ? `${busiest_hour}:00` : "N/A",
      generated_at: new Date().toISOString(),
    };
  }

  _persist() {
    try {
      saveCalls(this._calls);
    } catch (err) {
      console.error(
        "[CallIntelligenceRecorder] Failed to persist calls:",
        err.message,
      );
    }
  }
}

module.exports = CallIntelligenceRecorder;
