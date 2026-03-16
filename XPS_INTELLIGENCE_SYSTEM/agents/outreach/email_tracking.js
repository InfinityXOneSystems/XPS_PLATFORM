"use strict";

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  __dirname,
  "../../data/outreach/email_tracking.json",
);

class EmailTrackingSystem {
  constructor() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    this._data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      return { emails: {}, campaigns: {} };
    }
  }

  _save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2));
  }

  _ensureEmail(emailId) {
    if (!this._data.emails[emailId]) {
      this._data.emails[emailId] = {
        emailId,
        opens: [],
        clicks: [],
        campaignId: null,
        createdAt: new Date().toISOString(),
      };
    }
    return this._data.emails[emailId];
  }

  /**
   * Returns a 1x1 transparent GIF tracking pixel as an HTML img tag.
   * The pixel URL should be routed to `recordOpen` by your API server.
   */
  createTrackingPixel(emailId) {
    this._ensureEmail(emailId);
    this._save();
    const baseUrl = process.env.TRACKING_BASE_URL || "http://localhost:3000";
    return `<img src="${baseUrl}/track/open/${emailId}" width="1" height="1" style="display:none" alt="" />`;
  }

  /**
   * Records an email open event.
   */
  recordOpen(emailId, ip = "", userAgent = "") {
    const entry = this._ensureEmail(emailId);
    const event = { timestamp: new Date().toISOString(), ip, userAgent };
    entry.opens.push(event);
    this._updateCampaignStats(entry.campaignId, "opens");
    this._save();
    return event;
  }

  /**
   * Records a tracked link click.
   */
  recordClick(emailId, linkId = "", ip = "") {
    const entry = this._ensureEmail(emailId);
    const event = { timestamp: new Date().toISOString(), linkId, ip };
    entry.clicks.push(event);
    this._updateCampaignStats(entry.campaignId, "clicks");
    this._save();
    return event;
  }

  /**
   * Associates an email with a campaign (called when email is sent).
   */
  associateWithCampaign(emailId, campaignId) {
    const entry = this._ensureEmail(emailId);
    entry.campaignId = campaignId;

    if (!this._data.campaigns[campaignId]) {
      this._data.campaigns[campaignId] = { sent: 0, opens: 0, clicks: 0 };
    }
    this._data.campaigns[campaignId].sent += 1;
    this._save();
  }

  _updateCampaignStats(campaignId, field) {
    if (!campaignId) return;
    if (!this._data.campaigns[campaignId]) {
      this._data.campaigns[campaignId] = { sent: 0, opens: 0, clicks: 0 };
    }
    this._data.campaigns[campaignId][field] =
      (this._data.campaigns[campaignId][field] || 0) + 1;
  }

  /**
   * Returns open/click statistics for a single email.
   */
  getStats(emailId) {
    const entry = this._data.emails[emailId];
    if (!entry) return null;
    return {
      emailId,
      campaignId: entry.campaignId,
      openCount: entry.opens.length,
      clickCount: entry.clicks.length,
      firstOpen: entry.opens[0]?.timestamp || null,
      lastOpen: entry.opens[entry.opens.length - 1]?.timestamp || null,
      opens: entry.opens,
      clicks: entry.clicks,
    };
  }

  /**
   * Returns aggregate statistics for an entire campaign.
   */
  getCampaignStats(campaignId) {
    const stats = this._data.campaigns[campaignId] || {
      sent: 0,
      opens: 0,
      clicks: 0,
    };
    const openRate =
      stats.sent > 0 ? ((stats.opens / stats.sent) * 100).toFixed(1) : "0.0";
    const clickRate =
      stats.opens > 0 ? ((stats.clicks / stats.opens) * 100).toFixed(1) : "0.0";
    return {
      campaignId,
      ...stats,
      openRate: `${openRate}%`,
      clickRate: `${clickRate}%`,
    };
  }
}

module.exports = EmailTrackingSystem;
