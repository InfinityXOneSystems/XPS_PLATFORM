"use strict";

const PATTERNS = [
  {
    // "scrape epoxy contractors ohio"
    regex: /scrape\s+(.+?)\s+contractors?\s+(?:in\s+)?(.+)/i,
    build: (m) => ({
      action: "scrape",
      keyword: m[1].trim(),
      city: m[2].trim(),
    }),
  },
  {
    // "find flooring in ohio"
    regex: /find\s+(.+?)\s+(?:contractors?\s+)?in\s+(.+)/i,
    build: (m) => ({
      action: "find",
      industry: m[1].trim(),
      state: m[2].trim(),
    }),
  },
  {
    // "run outreach campaign" or "run campaign"
    regex: /run\s+(?:outreach\s+)?campaign/i,
    build: () => ({ action: "outreach" }),
  },
  {
    // "export leads" / "export data"
    regex: /export\s+(?:leads?|data)?/i,
    build: () => ({ action: "export" }),
  },
  {
    // "show stats" / "stats" / "show analytics"
    regex: /(?:show\s+)?(?:stats?|analytics|metrics)/i,
    build: () => ({ action: "stats" }),
  },
  {
    // "score leads" / "run scoring" / "score all leads"
    regex: /(?:score\s+(?:all\s+)?leads?|run\s+scoring)/i,
    build: () => ({ action: "score" }),
  },
  {
    // "validate leads" / "run validation"
    regex: /(?:validate\s+leads?|run\s+validation)/i,
    build: () => ({ action: "validate" }),
  },
  {
    // "enrich leads" / "run enrichment"
    regex: /(?:enrich\s+leads?|run\s+enrichment)/i,
    build: () => ({ action: "enrich" }),
  },
  {
    // "run pipeline" / "start pipeline"
    regex: /(?:run|start)\s+pipeline/i,
    build: () => ({ action: "pipeline" }),
  },
  {
    // "show leads" / "list leads"
    regex: /(?:show|list|get)\s+leads?/i,
    build: () => ({ action: "list_leads" }),
  },
  {
    // "help" / "what can you do"
    regex: /help|what can you do/i,
    build: () => ({ action: "help" }),
  },
];

const ACTION_DESCRIPTIONS = {
  scrape: "Scrape contractor leads for a keyword/location",
  find: "Find leads by industry and state",
  outreach: "Run automated outreach campaign",
  export: "Export leads to CSV",
  stats: "Show system analytics",
  score: "Score and rank all leads",
  validate: "Validate lead data",
  enrich: "Enrich leads with additional contact data",
  pipeline: "Run full scrape → validate → enrich → score pipeline",
  list_leads: "List current leads",
  help: "Show available commands",
};

class LeadSniperCommandRouter {
  constructor() {
    this._handlers = {};
  }

  /** Register a handler for an action: fn(command) => result */
  registerHandler(action, fn) {
    this._handlers[action] = fn;
    return this;
  }

  parseCommand(text) {
    if (!text || typeof text !== "string") {
      return { action: "unknown", raw: text, error: "Empty or invalid input" };
    }

    const trimmed = text.trim();

    for (const { regex, build } of PATTERNS) {
      const match = trimmed.match(regex);
      if (match) {
        return { ...build(match), raw: trimmed };
      }
    }

    return { action: "unknown", raw: trimmed, error: "Command not recognized" };
  }

  async executeCommand(command) {
    if (!command || command.action === "unknown") {
      return {
        success: false,
        action: "unknown",
        result: null,
        message: `Command not recognized: "${command?.raw}". Type "help" to see available commands.`,
      };
    }

    if (command.action === "help") {
      return {
        success: true,
        action: "help",
        result: ACTION_DESCRIPTIONS,
        message:
          "Available commands:\n" +
          Object.entries(ACTION_DESCRIPTIONS)
            .map(([a, d]) => `  ${a}: ${d}`)
            .join("\n"),
      };
    }

    const handler = this._handlers[command.action];
    if (handler) {
      try {
        const result = await handler(command);
        return {
          success: true,
          action: command.action,
          result,
          message: `Command "${command.action}" executed successfully.`,
        };
      } catch (err) {
        return {
          success: false,
          action: command.action,
          result: null,
          message: `Command "${command.action}" failed: ${err.message}`,
        };
      }
    }

    // Stub response when no handler registered
    return {
      success: true,
      action: command.action,
      result: { queued: true, command },
      message: `Command "${command.action}" queued. No live handler registered — integrate with orchestrator to execute.`,
    };
  }

  /** Convenience: parse then execute in one call */
  async run(text) {
    const command = this.parseCommand(text);
    return this.executeCommand(command);
  }
}

module.exports = LeadSniperCommandRouter;
