"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CAMPAIGNS_FILE = path.join(
  __dirname,
  "../../data/outreach/sms_campaigns.json",
);
const LOG_FILE = path.join(__dirname, "../../data/outreach/sms_log.json");

class SMSCampaignEngine {
  constructor() {
    fs.mkdirSync(path.dirname(CAMPAIGNS_FILE), { recursive: true });
    this._campaigns = this._loadFile(CAMPAIGNS_FILE, { campaigns: {} });
    this._log = this._loadFile(LOG_FILE, { entries: [] });
  }

  _loadFile(filePath, defaults) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return defaults;
    }
  }

  _saveCampaigns() {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(this._campaigns, null, 2));
  }

  _saveLog() {
    fs.writeFileSync(LOG_FILE, JSON.stringify(this._log, null, 2));
  }

  /**
   * Sends a single SMS via Twilio.
   * If Twilio credentials are not configured, logs a stub send instead.
   */
  async sendSMS(to, message) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;

    const logEntry = {
      id: crypto.randomUUID(),
      to,
      message,
      from: from || "STUB",
      timestamp: new Date().toISOString(),
      status: "unknown",
      error: null,
    };

    if (!sid || !token || !from) {
      logEntry.status = "stub";
      logEntry.error = "Twilio credentials not configured — stub send";
      this._log.entries.push(logEntry);
      this._saveLog();
      console.warn(`[SMSCampaignEngine] STUB send to ${to}: ${message}`);
      return logEntry;
    }

    try {
      const axios = require("axios");
      const params = new URLSearchParams({ To: to, From: from, Body: message });
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        params.toString(),
        {
          auth: { username: sid, password: token },
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
      logEntry.status = response.data.status || "sent";
      logEntry.twilioSid = response.data.sid;
    } catch (err) {
      logEntry.status = "failed";
      logEntry.error = err.response?.data?.message || err.message;
      console.error(
        `[SMSCampaignEngine] Failed to send SMS to ${to}:`,
        logEntry.error,
      );
    }

    this._log.entries.push(logEntry);
    this._saveLog();
    return logEntry;
  }

  /**
   * Creates an SMS campaign with a list of leads.
   * Returns the campaign record.
   */
  createCampaign(name, message, leads = []) {
    const id = crypto.randomUUID();
    const campaign = {
      id,
      name,
      message,
      leads: leads.map((l) => ({
        id: l.id || l.company_name,
        name: l.company_name || l.name || "Unknown",
        phone: l.phone || null,
      })),
      status: "created",
      createdAt: new Date().toISOString(),
      sentAt: null,
      stats: { total: leads.length, sent: 0, failed: 0, stub: 0 },
    };
    this._campaigns.campaigns[id] = campaign;
    this._saveCampaigns();
    return campaign;
  }

  /**
   * Executes all sends for a campaign.
   * Returns updated campaign stats.
   */
  async runCampaign(campaignId) {
    const campaign = this._campaigns.campaigns[campaignId];
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
    if (campaign.status === "completed")
      throw new Error("Campaign already completed");

    campaign.status = "running";
    campaign.sentAt = new Date().toISOString();
    this._saveCampaigns();

    for (const lead of campaign.leads) {
      if (!lead.phone) {
        campaign.stats.failed += 1;
        continue;
      }
      const result = await this.sendSMS(lead.phone, campaign.message);
      if (
        result.status === "stub" ||
        result.status === "sent" ||
        result.status === "queued"
      ) {
        campaign.stats.sent += result.status === "stub" ? 0 : 1;
        campaign.stats.stub += result.status === "stub" ? 1 : 0;
      } else {
        campaign.stats.failed += 1;
      }
    }

    campaign.status = "completed";
    this._saveCampaigns();
    return campaign.stats;
  }

  /**
   * Returns stats for a campaign.
   */
  getCampaignStats(campaignId) {
    const campaign = this._campaigns.campaigns[campaignId];
    if (!campaign) return null;
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      createdAt: campaign.createdAt,
      sentAt: campaign.sentAt,
      stats: campaign.stats,
    };
  }
}

module.exports = SMSCampaignEngine;
