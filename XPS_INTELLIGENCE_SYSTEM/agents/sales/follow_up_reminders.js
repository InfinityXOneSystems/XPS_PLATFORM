"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "../../data/sales/reminders.json");

class FollowUpReminderSystem {
  constructor() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    this._data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      return { reminders: {} };
    }
  }

  _save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2));
  }

  /**
   * Adds a follow-up reminder.
   * @param {string} leadId
   * @param {string} repId
   * @param {string} dueDate - ISO date string (YYYY-MM-DD)
   * @param {string} note
   * @returns reminder record
   */
  addReminder(leadId, repId, dueDate, note = "") {
    const id = crypto.randomUUID();
    const reminder = {
      id,
      leadId,
      repId,
      dueDate: dueDate.split("T")[0],
      note,
      status: "pending",
      createdAt: new Date().toISOString(),
      completedAt: null,
      snoozedUntil: null,
    };
    this._data.reminders[id] = reminder;
    this._save();
    return reminder;
  }

  /**
   * Returns all pending reminders due today or earlier for a rep.
   */
  getDueReminders(repId = null) {
    const today = new Date().toISOString().split("T")[0];
    return Object.values(this._data.reminders).filter((r) => {
      const matchesRep = !repId || r.repId === repId;
      const isDue = r.status === "pending" && r.dueDate <= today;
      const notSnoozed = !r.snoozedUntil || r.snoozedUntil <= today;
      return matchesRep && isDue && notSnoozed;
    });
  }

  /**
   * Returns overdue reminders (due before today, still pending).
   */
  getOverdue(repId = null) {
    const today = new Date().toISOString().split("T")[0];
    return Object.values(this._data.reminders).filter((r) => {
      const matchesRep = !repId || r.repId === repId;
      return matchesRep && r.status === "pending" && r.dueDate < today;
    });
  }

  /**
   * Marks a reminder as complete.
   */
  markComplete(reminderId) {
    const r = this._data.reminders[reminderId];
    if (!r) throw new Error(`Reminder not found: ${reminderId}`);
    r.status = "completed";
    r.completedAt = new Date().toISOString();
    this._save();
    return r;
  }

  /**
   * Snoozes a reminder by N days from today.
   */
  snooze(reminderId, days = 1) {
    const r = this._data.reminders[reminderId];
    if (!r) throw new Error(`Reminder not found: ${reminderId}`);
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    r.snoozedUntil = snoozeDate.toISOString().split("T")[0];
    this._save();
    return r;
  }

  /**
   * Returns all reminders, optionally filtered by repId.
   */
  getAll(repId = null) {
    const all = Object.values(this._data.reminders);
    return repId ? all.filter((r) => r.repId === repId) : all;
  }
}

module.exports = FollowUpReminderSystem;
