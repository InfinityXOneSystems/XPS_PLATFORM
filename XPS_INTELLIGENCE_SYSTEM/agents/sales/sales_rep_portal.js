"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data");
const LEADS_DIR = path.join(ROOT, "leads");

const REPS_DIR = path.join(DATA_DIR, "sales", "reps");
const ASSIGNMENTS_FILE = path.join(DATA_DIR, "sales", "assignments.json");
const REMINDERS_FILE = path.join(DATA_DIR, "sales", "follow_up_reminders.json");

// ── helpers ───────────────────────────────────────────────────────────────────

function ensureRepDir() {
  fs.mkdirSync(REPS_DIR, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath))
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {}
  return fallback;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadLeads() {
  const scored = path.join(LEADS_DIR, "scored_leads.json");
  const raw = path.join(LEADS_DIR, "leads.json");
  const data = readJson(scored) || readJson(raw) || [];
  return Array.isArray(data) ? data : [];
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

// ── SalesRepPortal ─────────────────────────────────────────────────────────────

class SalesRepPortal {
  constructor() {
    ensureRepDir();
  }

  // ── rep profile ───────────────────────────────────────────────────────────

  _getRepProfile(repId) {
    const file = path.join(REPS_DIR, `${repId}.json`);
    const defaults = {
      repId,
      calls: [],
      deals: [],
      statusUpdates: [],
      lastActivity: null,
      createdAt: new Date().toISOString(),
    };
    return readJson(file, defaults);
  }

  _saveRepProfile(repId, profile) {
    const file = path.join(REPS_DIR, `${repId}.json`);
    writeJson(file, profile);
  }

  // ── assigned leads ────────────────────────────────────────────────────────

  _getAssignedLeadIds(repId) {
    const assignments = readJson(ASSIGNMENTS_FILE, { assignments: {} });
    const ids = [];
    const map = assignments.assignments || {};
    Object.entries(map).forEach(([leadId, a]) => {
      if ((a.repId || a.assignedTo) === repId) ids.push(leadId);
    });
    return ids;
  }

  _resolveLeads(leadIds) {
    const all = loadLeads();
    return leadIds
      .map((id) =>
        all.find(
          (l) => String(l.id) === String(id) || l.place_id === String(id),
        ),
      )
      .filter(Boolean);
  }

  // ── follow-up reminders ───────────────────────────────────────────────────

  _getDueFollowUps(repId) {
    const reminders = readJson(REMINDERS_FILE, { reminders: [] });
    const list = Array.isArray(reminders.reminders)
      ? reminders.reminders
      : reminders;
    const today = isoToday();
    return (Array.isArray(list) ? list : []).filter(
      (r) =>
        (r.repId === repId || r.assignedTo === repId) &&
        r.dueDate <= today &&
        r.status !== "done",
    );
  }

  // ── today's tasks ─────────────────────────────────────────────────────────

  _getTodaysTasks(repId, assignedLeads) {
    const tasks = [];
    const dueFollowUps = this._getDueFollowUps(repId);
    dueFollowUps.forEach((r) =>
      tasks.push({
        type: "follow_up",
        priority: "high",
        leadId: r.leadId,
        note: r.note || "",
        dueDate: r.dueDate,
      }),
    );

    // High-score leads without recent contact are suggested for outreach
    assignedLeads
      .filter((l) => (l.score || 0) >= 60 && l.email && !l.contacted)
      .slice(0, 5)
      .forEach((l) =>
        tasks.push({
          type: "outreach",
          priority: "medium",
          leadId: l.id || l.place_id,
          name: l.name || l.company_name,
        }),
      );

    return tasks;
  }

  // ── pipeline value ────────────────────────────────────────────────────────

  _getPersonalPipelineValue(repId) {
    const profile = this._getRepProfile(repId);
    const active = (profile.deals || []).filter(
      (d) => d.status !== "closed_lost",
    );
    const total = active.reduce((sum, d) => sum + (d.value || 0), 0);
    return { activeDeals: active.length, estimatedValue: total };
  }

  // ── public API ────────────────────────────────────────────────────────────

  getRepDashboard(repId) {
    if (!repId) throw new Error("repId is required");

    const assignedIds = this._getAssignedLeadIds(repId);
    const assignedLeads = this._resolveLeads(assignedIds);
    const profile = this._getRepProfile(repId);
    const dueFollowUps = this._getDueFollowUps(repId);
    const todaysTasks = this._getTodaysTasks(repId, assignedLeads);
    const pipelineValue = this._getPersonalPipelineValue(repId);

    const recentCalls = (profile.calls || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    return {
      repId,
      generatedAt: new Date().toISOString(),
      assignedLeads: assignedLeads.slice(0, 50).map((l) => ({
        id: l.id || l.place_id,
        name: l.name || l.company_name,
        score: l.score,
        city: l.city,
        state: l.state,
        phone: l.phone,
        email: l.email,
        status: l.repStatus || "new",
      })),
      totalAssigned: assignedIds.length,
      dueFollowUps,
      todaysTasks,
      recentCallHistory: recentCalls,
      pipelineValue,
    };
  }

  updateLeadStatus(repId, leadId, status, notes = "") {
    if (!repId) throw new Error("repId is required");
    if (!leadId) throw new Error("leadId is required");
    if (!status) throw new Error("status is required");

    const VALID_STATUSES = [
      "new",
      "contacted",
      "interested",
      "proposal_sent",
      "negotiating",
      "closed_won",
      "closed_lost",
      "not_interested",
      "callback",
      "voicemail",
    ];
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }

    const profile = this._getRepProfile(repId);
    const entry = {
      leadId,
      status,
      notes,
      timestamp: new Date().toISOString(),
      repId,
    };

    profile.statusUpdates = profile.statusUpdates || [];
    profile.statusUpdates.push(entry);
    profile.lastActivity = entry.timestamp;

    // Track calls
    if (
      status === "contacted" ||
      status === "voicemail" ||
      status === "callback"
    ) {
      profile.calls = profile.calls || [];
      profile.calls.push({
        leadId,
        outcome: status,
        notes,
        timestamp: entry.timestamp,
      });
    }

    // Track deals
    if (status === "closed_won") {
      profile.deals = profile.deals || [];
      if (!profile.deals.find((d) => d.leadId === leadId)) {
        profile.deals.push({
          leadId,
          status: "closed_won",
          closedAt: entry.timestamp,
          value: 0,
        });
      }
    }

    this._saveRepProfile(repId, profile);

    // Persist status back to shared status file
    const statusFile = path.join(DATA_DIR, "sales", "lead_statuses.json");
    const statuses = readJson(statusFile, {});
    statuses[leadId] = { status, repId, notes, updatedAt: entry.timestamp };
    writeJson(statusFile, statuses);

    return { ok: true, entry };
  }

  getCallHistory(repId, limit = 20) {
    const profile = this._getRepProfile(repId);
    return (profile.calls || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  addFollowUpReminder(repId, leadId, dueDate, note = "") {
    const reminders = readJson(REMINDERS_FILE, { reminders: [] });
    const list = Array.isArray(reminders.reminders) ? reminders.reminders : [];
    list.push({
      repId,
      leadId,
      dueDate,
      note,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    writeJson(REMINDERS_FILE, { reminders: list });
    return { ok: true, reminder: { repId, leadId, dueDate, note } };
  }
}

module.exports = SalesRepPortal;
