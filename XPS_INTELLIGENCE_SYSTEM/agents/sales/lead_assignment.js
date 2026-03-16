"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "../../data/sales/assignments.json");

class LeadAssignmentEngine {
  constructor() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    this._data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      return { assignments: {} };
    }
  }

  _save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2));
  }

  /**
   * Scores a sales rep for a lead based on territory, workload, and specialization.
   * Higher score = better match.
   */
  _scoreRep(lead, rep, currentWorkload) {
    let score = 0;

    // Territory match — state first, then city
    const leadState = (lead.state || "").toLowerCase();
    const leadCity = (lead.city || "").toLowerCase();
    const repTerritories = (rep.territories || []).map((t) => t.toLowerCase());

    if (repTerritories.includes(leadState)) score += 30;
    if (repTerritories.includes(leadCity)) score += 20;
    if (repTerritories.length === 0) score += 10; // National rep

    // Workload — prefer reps with fewer active leads
    const workload = currentWorkload[rep.id] || 0;
    if (workload === 0) score += 25;
    else if (workload < 5) score += 15;
    else if (workload < 10) score += 5;

    // Specialization match
    const leadIndustry = (lead.industry || lead.category || "").toLowerCase();
    const repSpecializations = (rep.specializations || []).map((s) =>
      s.toLowerCase(),
    );
    if (
      repSpecializations.some(
        (s) => leadIndustry.includes(s) || s.includes(leadIndustry),
      )
    ) {
      score += 20;
    }

    return score;
  }

  /**
   * Assigns a lead to the best available sales rep.
   * @param {Object} lead
   * @param {Array} salesReps - [{ id, name, territories: [], specializations: [], active: bool }]
   * @returns assignment record
   */
  assignLead(lead, salesReps = []) {
    if (!salesReps.length)
      throw new Error("No sales reps provided for assignment");

    const activeReps = salesReps.filter((r) => r.active !== false);
    if (!activeReps.length) throw new Error("No active sales reps available");

    // Calculate current workload per rep
    const workload = {};
    Object.values(this._data.assignments).forEach((a) => {
      if (a.status === "active") {
        workload[a.repId] = (workload[a.repId] || 0) + 1;
      }
    });

    // Score each rep and pick the best
    let bestRep = null;
    let bestScore = -1;
    for (const rep of activeReps) {
      const score = this._scoreRep(lead, rep, workload);
      if (score > bestScore) {
        bestScore = score;
        bestRep = rep;
      }
    }

    const assignmentId = crypto.randomUUID();
    const leadId = lead.id || lead.company_name || crypto.randomUUID();
    const assignment = {
      id: assignmentId,
      leadId,
      leadName: lead.company_name || lead.name || "Unknown",
      repId: bestRep.id,
      repName: bestRep.name,
      score: bestScore,
      status: "active",
      assignedAt: new Date().toISOString(),
      reassignedAt: null,
    };

    this._data.assignments[assignmentId] = assignment;
    this._save();
    return assignment;
  }

  /**
   * Returns all current assignments, optionally filtered by repId or status.
   */
  getAssignments(filter = {}) {
    let all = Object.values(this._data.assignments);
    if (filter.repId) all = all.filter((a) => a.repId === filter.repId);
    if (filter.status) all = all.filter((a) => a.status === filter.status);
    return all;
  }

  /**
   * Manually reassigns a lead to a different rep.
   */
  reassign(leadId, newRepId, newRepName = "") {
    const assignment = Object.values(this._data.assignments).find(
      (a) => a.leadId === leadId && a.status === "active",
    );
    if (!assignment)
      throw new Error(`No active assignment found for lead: ${leadId}`);

    assignment.repId = newRepId;
    assignment.repName = newRepName || newRepId;
    assignment.reassignedAt = new Date().toISOString();
    this._save();
    return assignment;
  }
}

module.exports = LeadAssignmentEngine;
