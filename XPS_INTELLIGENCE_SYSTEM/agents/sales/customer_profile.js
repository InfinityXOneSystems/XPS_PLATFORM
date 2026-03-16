"use strict";

const fs = require("fs");
const path = require("path");

const LEADS_FILE = path.join(__dirname, "../../leads/leads.json");
const SCORED_FILE = path.join(__dirname, "../../leads/scored_leads.json");
const OUTREACH_LOG = path.join(
  __dirname,
  "../../data/outreach/follow_up_schedule.json",
);
const DEALS_FILE = path.join(__dirname, "../../data/sales/deals.json");

class CustomerProfileBuilder {
  /**
   * Builds a comprehensive profile for a lead/customer by aggregating data from all sources.
   * @param {string} leadId - Matches lead by `id` or `company_name`
   * @returns {Object} Comprehensive profile or null if not found
   */
  buildProfile(leadId) {
    const lead = this._findLead(leadId);
    if (!lead) return null;

    const scoredData = this._findScored(leadId, lead.company_name);
    const deals = this._getDeals(leadId, lead.company_name);
    const outreachHistory = this._getOutreachHistory(leadId, lead.company_name);

    return {
      id: lead.id || lead.company_name,
      contact: {
        company_name: lead.company_name || null,
        phone: lead.phone || null,
        email: lead.email || null,
        website: lead.website || null,
        address: lead.address || null,
        city: lead.city || null,
        state: lead.state || null,
      },
      business: {
        industry: lead.industry || lead.category || null,
        rating: lead.rating || null,
        review_count: lead.review_count || null,
        source: lead.source || null,
        scraped_at: lead.scraped_at || lead.created_at || null,
      },
      enrichment: {
        linkedin: lead.linkedin || null,
        facebook: lead.facebook || null,
        instagram: lead.instagram || null,
        email_discovered: lead.discovered_email || lead.email || null,
        social_profiles: lead.social_profiles || [],
        additional_emails: lead.additional_emails || [],
      },
      scoring: {
        score: scoredData?.score ?? lead.score ?? null,
        score_breakdown: scoredData?.score_breakdown ?? null,
        tier:
          scoredData?.tier ?? this._scoreTier(scoredData?.score ?? lead.score),
      },
      deals: {
        total: deals.length,
        active: deals.filter(
          (d) => !["closed_won", "closed_lost"].includes(d.stage),
        ).length,
        won: deals.filter((d) => d.stage === "closed_won").length,
        total_value: deals.reduce(
          (s, d) => s + (Number(d.estimatedValue) || 0),
          0,
        ),
        list: deals,
      },
      outreach: {
        total_follow_ups: outreachHistory.length,
        sent: outreachHistory.filter((o) => o.status === "sent").length,
        pending: outreachHistory.filter((o) => o.status === "pending").length,
        history: outreachHistory,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  _loadJson(filePath, fallback = []) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return fallback;
    }
  }

  _findLead(leadId) {
    const leads = this._loadJson(LEADS_FILE, []);
    return (
      leads.find(
        (l) =>
          l.id === leadId ||
          l.company_name === leadId ||
          String(l.id) === String(leadId),
      ) || null
    );
  }

  _findScored(leadId, companyName) {
    const scored = this._loadJson(SCORED_FILE, []);
    return (
      scored.find((l) => l.id === leadId || l.company_name === companyName) ||
      null
    );
  }

  _getDeals(leadId, companyName) {
    try {
      const data = this._loadJson(DEALS_FILE, { deals: {} });
      const deals = Object.values(data.deals || {});
      return deals.filter(
        (d) => d.leadId === leadId || d.leadId === companyName,
      );
    } catch {
      return [];
    }
  }

  _getOutreachHistory(leadId, companyName) {
    try {
      const data = this._loadJson(OUTREACH_LOG, { followUps: {} });
      return Object.values(data.followUps || {}).filter(
        (f) =>
          f.leadId === leadId ||
          f.leadId === companyName ||
          f.leadName === companyName,
      );
    } catch {
      return [];
    }
  }

  _scoreTier(score) {
    if (score === null || score === undefined) return "unscored";
    if (score >= 40) return "hot";
    if (score >= 25) return "warm";
    return "cold";
  }
}

module.exports = CustomerProfileBuilder;
