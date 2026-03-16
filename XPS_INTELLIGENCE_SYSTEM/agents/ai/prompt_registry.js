"use strict";

const fs = require("fs");
const path = require("path");

const PROMPTS_FILE = path.join(__dirname, "../../data/ai/prompts.json");

const BUILTIN_PROMPTS = {
  cold_email: {
    template:
      "Write a cold outreach email for a flooring contractor named {company} located in {city}, {state}. " +
      "The email should be professional, concise (under 120 words), and highlight how XPS Intelligence can help them grow their business with qualified leads. " +
      "Include a clear call to action for a 15-minute discovery call.",
    description: "Generate cold outreach email for flooring contractor",
    builtin: true,
  },

  follow_up: {
    template:
      "Write a follow-up email for {company} in {city} who has not responded to a previous outreach. " +
      "Keep it short (under 80 words), acknowledge they may be busy, reiterate the value proposition briefly, and propose a specific day/time for a call.",
    description: "Follow-up email after no response",
    builtin: true,
  },

  sales_script_cold: {
    template:
      "Write a cold call script for reaching out to {company} in {city}. " +
      "The script should include: a brief intro, a qualifying question about their current lead generation, " +
      'a value pitch for XPS Intelligence, handling a "not interested" objection, and a close for scheduling a demo. ' +
      "Format as a dialogue with [REP] and [PROSPECT] labels.",
    description: "Cold call script for {company} in {city}",
    builtin: true,
  },

  lead_qualification: {
    template:
      "Generate a list of 8 qualifying questions to ask a flooring contractor to determine if they are a good fit for XPS Intelligence lead generation services. " +
      "Focus on: current lead sources, monthly revenue targets, geographic coverage area, team size, and pain points with {pain_point}. " +
      "Format as numbered questions.",
    description: "Questions to qualify a flooring lead",
    builtin: true,
  },

  objection_handler: {
    template:
      "Provide professional responses to the following sales objections from a flooring contractor: " +
      '1) "We already get enough leads" 2) "Your service is too expensive" 3) "We tried something similar before and it didn\'t work" ' +
      '4) "I need to think about it" 5) "{custom_objection}". ' +
      "For each objection, provide a 2–3 sentence empathetic response that redirects to a next step.",
    description: "Handle common sales objections",
    builtin: true,
  },

  proposal_writer: {
    template:
      "Write a professional proposal for {company} in {city} for {service} services through XPS Intelligence. " +
      "Include: Executive Summary, Problem Statement, Proposed Solution, Pricing Overview (use placeholder tiers), " +
      "Expected Outcomes (lead volume, ROI), Timeline, and Next Steps. " +
      "Keep the tone consultative and data-driven.",
    description: "Generate proposal for {service} services",
    builtin: true,
  },
};

function loadCustomPrompts() {
  try {
    if (fs.existsSync(PROMPTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveCustomPrompts(data) {
  fs.mkdirSync(path.dirname(PROMPTS_FILE), { recursive: true });
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify(data, null, 2));
}

function interpolate(template, variables = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match,
  );
}

class PromptRegistry {
  constructor() {
    this._custom = loadCustomPrompts();
  }

  getPrompt(name, variables = {}) {
    const entry = this._custom[name] || BUILTIN_PROMPTS[name];
    if (!entry) {
      throw new Error(
        `Prompt "${name}" not found. Use listPrompts() to see available prompts.`,
      );
    }
    return {
      name,
      prompt: interpolate(entry.template, variables),
      description: entry.description,
      builtin: !!entry.builtin,
    };
  }

  addPrompt(name, template, description = "") {
    if (BUILTIN_PROMPTS[name]) {
      throw new Error(
        `Cannot overwrite builtin prompt "${name}" with addPrompt. Use updatePrompt().`,
      );
    }
    this._custom[name] = {
      template,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this._persist();
    return { added: true, name };
  }

  updatePrompt(name, template) {
    const existing = this._custom[name];
    if (existing) {
      existing.template = template;
      existing.updated_at = new Date().toISOString();
    } else {
      // Also allow updating builtin descriptions by storing in custom layer
      this._custom[name] = {
        template,
        description: BUILTIN_PROMPTS[name]?.description || "",
        updated_at: new Date().toISOString(),
      };
    }
    this._persist();
    return { updated: true, name };
  }

  listPrompts() {
    const builtins = Object.entries(BUILTIN_PROMPTS).map(([name, entry]) => ({
      name,
      description: entry.description,
      builtin: true,
      overridden: !!this._custom[name],
    }));

    const customs = Object.entries(this._custom)
      .filter(([name]) => !BUILTIN_PROMPTS[name])
      .map(([name, entry]) => ({
        name,
        description: entry.description,
        builtin: false,
        created_at: entry.created_at,
      }));

    return [...builtins, ...customs];
  }

  _persist() {
    try {
      saveCustomPrompts(this._custom);
    } catch (err) {
      console.error("[PromptRegistry] Failed to persist prompts:", err.message);
    }
  }
}

module.exports = PromptRegistry;
