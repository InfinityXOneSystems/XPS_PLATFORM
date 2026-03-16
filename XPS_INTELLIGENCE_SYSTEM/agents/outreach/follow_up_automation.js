"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(
  __dirname,
  "../../data/outreach/follow_up_schedule.json",
);

class FollowUpAutomation {
  constructor() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    this._data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      return { followUps: {} };
    }
  }

  _save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2));
  }

  /**
   * Schedules a follow-up for a lead `dayOffset` days from now.
   * Returns the follow-up record.
   */
  scheduleFollowUp(lead, campaignId, dayOffset = 3) {
    const id = crypto.randomUUID();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dayOffset);

    const followUp = {
      id,
      leadId: lead.id || lead.company_name || null,
      leadEmail: lead.email || null,
      leadName: lead.company_name || lead.name || "Unknown",
      campaignId,
      dueDate: dueDate.toISOString().split("T")[0],
      dayOffset,
      status: "pending",
      createdAt: new Date().toISOString(),
      sentAt: null,
    };

    this._data.followUps[id] = followUp;
    this._save();
    return followUp;
  }

  /**
   * Returns all follow-ups whose dueDate is today or in the past and are still pending.
   */
  getDueFollowUps() {
    const today = new Date().toISOString().split("T")[0];
    return Object.values(this._data.followUps).filter(
      (f) => f.status === "pending" && f.dueDate <= today,
    );
  }

  /**
   * Marks a follow-up as sent.
   */
  markSent(followUpId) {
    const f = this._data.followUps[followUpId];
    if (!f) throw new Error(`Follow-up not found: ${followUpId}`);
    f.status = "sent";
    f.sentAt = new Date().toISOString();
    this._save();
    return f;
  }

  /**
   * Cancels a pending follow-up.
   */
  cancelFollowUp(followUpId) {
    const f = this._data.followUps[followUpId];
    if (!f) throw new Error(`Follow-up not found: ${followUpId}`);
    f.status = "cancelled";
    this._save();
    return f;
  }

  /**
   * Returns all follow-ups (optionally filtered by campaignId).
   */
  getAll(campaignId = null) {
    const all = Object.values(this._data.followUps);
    return campaignId ? all.filter((f) => f.campaignId === campaignId) : all;
  }
}

module.exports = FollowUpAutomation;
