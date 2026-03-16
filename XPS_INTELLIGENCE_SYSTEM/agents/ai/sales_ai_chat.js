"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const SESSIONS_FILE = path.join(__dirname, "../../data/ai/chat_sessions.json");
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are an expert AI sales assistant for XPS Intelligence, a lead generation platform
serving the flooring and construction industry. You help sales reps:
- Understand their lead pipeline and stats
- Craft outreach messages and talking points
- Handle objections from flooring/construction contractors
- Identify the best opportunities in their territory
- Interpret platform data and suggest next actions

Be concise, practical, and focus on actionable advice.`;

const RULE_BASED_RESPONSES = [
  {
    patterns: [/how many leads/i, /lead count/i, /total leads/i],
    reply: () =>
      "I don't have live database access right now, but you can check your lead count by running `npm run score` or visiting the dashboard. Tip: filter by score > 50 for your hottest prospects.",
  },
  {
    patterns: [/pipeline status/i, /pipeline/i],
    reply: () =>
      "Your pipeline status is available in the dashboard under Analytics. For a quick CLI snapshot, run `npm run export` to get a fresh CSV report.",
  },
  {
    patterns: [/best time to call/i, /when to call/i, /call time/i],
    reply: () =>
      "For flooring contractors, the best call windows are typically Tuesday–Thursday, 8–10 AM and 2–4 PM local time. Avoid Monday mornings and Friday afternoons.",
  },
  {
    patterns: [/objection/i, /not interested/i, /busy/i],
    reply: () =>
      "Try: \"I completely understand — that's exactly why I'm reaching out. We help busy contractors like you get leads on autopilot so you can focus on the work, not the hunt.\" Then ask for just 10 minutes.",
  },
  {
    patterns: [/export/i, /download leads/i, /csv/i],
    reply: () =>
      "You can export leads by running `npm run export` in the terminal, or use the Export button in the dashboard. Your file will be saved to data/exports/.",
  },
  {
    patterns: [/score/i, /lead score/i, /rank/i],
    reply: () =>
      "Leads are scored on a 0–100 scale based on: website presence (+10), email discovered (+15), phone present (+10), reviews > 10 (+5), rating > 4 (+10). Focus on leads above 60 for best conversion.",
  },
  {
    patterns: [/hello/i, /hi\b/i, /hey/i, /help/i],
    reply: () =>
      "Hello! I'm your XPS Sales AI assistant. I can help you with lead insights, outreach scripts, pipeline status, call coaching, and more. What do you need?",
  },
  {
    patterns: [/outreach/i, /campaign/i, /email campaign/i],
    reply: () =>
      'To run an outreach campaign, use the Lead Sniper: type "run outreach campaign" in the chat command box, or navigate to Outreach in the dashboard. Campaigns target scored leads automatically.',
  },
];

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveSessions(sessions) {
  fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

class SalesAIChatAssistant {
  constructor() {
    this._openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
    this._sessions = loadSessions();
  }

  async chat(sessionId, message, context = {}) {
    if (!this._sessions[sessionId]) {
      this._sessions[sessionId] = {
        history: [],
        created_at: new Date().toISOString(),
      };
    }

    const session = this._sessions[sessionId];
    session.history.push({
      role: "user",
      content: message,
      ts: new Date().toISOString(),
    });

    let reply;
    if (this._openai) {
      reply = await this._chatWithAI(session.history, context);
    } else {
      reply = this._chatRuleBased(message);
    }

    session.history.push({
      role: "assistant",
      content: reply,
      ts: new Date().toISOString(),
    });

    // Trim to MAX_HISTORY pairs
    if (session.history.length > MAX_HISTORY * 2) {
      session.history = session.history.slice(-MAX_HISTORY * 2);
    }

    session.last_activity = new Date().toISOString();
    this._persist();

    return { sessionId, reply, timestamp: new Date().toISOString() };
  }

  async _chatWithAI(history, context) {
    const contextNote = Object.keys(context).length
      ? `\nCurrent context: ${JSON.stringify(context)}`
      : "";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + contextNote },
      ...history
        .slice(-MAX_HISTORY * 2)
        .map(({ role, content }) => ({ role, content })),
    ];

    try {
      const completion = await this._openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.6,
      });
      return completion.choices[0].message.content.trim();
    } catch (err) {
      console.error("[SalesAIChatAssistant] OpenAI error:", err.message);
      return this._chatRuleBased(history[history.length - 1]?.content || "");
    }
  }

  _chatRuleBased(message) {
    for (const { patterns, reply } of RULE_BASED_RESPONSES) {
      if (patterns.some((p) => p.test(message))) {
        return reply();
      }
    }
    return "I'm not sure about that specific query, but I can help with lead stats, outreach scripts, call coaching, and pipeline insights. Could you rephrase or give more detail?";
  }

  getSessionHistory(sessionId) {
    return this._sessions[sessionId]?.history || [];
  }

  clearSession(sessionId) {
    delete this._sessions[sessionId];
    this._persist();
    return { cleared: true, sessionId };
  }

  _persist() {
    try {
      saveSessions(this._sessions);
    } catch (err) {
      console.error(
        "[SalesAIChatAssistant] Failed to persist sessions:",
        err.message,
      );
    }
  }
}

module.exports = SalesAIChatAssistant;
