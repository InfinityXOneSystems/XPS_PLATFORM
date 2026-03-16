"use strict";

/**
 * Seed 02 — Default platform settings
 *
 * Inserts sensible defaults for all configurable platform parameters.
 * Uses INSERT … ON CONFLICT DO NOTHING so re-running the seed is safe.
 *
 * Secret values (is_secret: true) are stored as empty strings; the real
 * values must be injected via environment variables or the Settings UI.
 */

const defaults = [
  // ── Scraping ───────────────────────────────────────────────────────────────
  {
    key: "scrape_interval_hours",
    value: "4",
    value_type: "number",
    category: "scraping",
    description: "How often (in hours) the autonomous scraping pipeline runs.",
    is_secret: false,
  },
  {
    key: "scrape_max_results_per_task",
    value: "100",
    value_type: "number",
    category: "scraping",
    description: "Maximum leads to collect per scraping task.",
    is_secret: false,
  },
  {
    key: "scrape_concurrency",
    value: "3",
    value_type: "number",
    category: "scraping",
    description: "Number of concurrent scraper instances.",
    is_secret: false,
  },

  // ── Lead scoring ──────────────────────────────────────────────────────────
  {
    key: "score_threshold_hot",
    value: "75",
    value_type: "number",
    category: "scoring",
    description: "Minimum score for a lead to be classified as HOT.",
    is_secret: false,
  },
  {
    key: "score_threshold_warm",
    value: "50",
    value_type: "number",
    category: "scoring",
    description:
      "Minimum score for a lead to be classified as WARM (below = COLD).",
    is_secret: false,
  },

  // ── Outreach ──────────────────────────────────────────────────────────────
  {
    key: "outreach_enabled",
    value: "false",
    value_type: "boolean",
    category: "outreach",
    description: "Master switch for automated email outreach.",
    is_secret: false,
  },
  {
    key: "outreach_daily_limit",
    value: "50",
    value_type: "number",
    category: "outreach",
    description: "Maximum outreach emails to send per day.",
    is_secret: false,
  },
  {
    key: "outreach_from_email",
    value: "",
    value_type: "string",
    category: "outreach",
    description: "Sender email address for outreach campaigns.",
    is_secret: false,
  },
  {
    key: "smtp_host",
    value: "",
    value_type: "string",
    category: "outreach",
    description: "SMTP server hostname.",
    is_secret: false,
  },
  {
    key: "smtp_port",
    value: "587",
    value_type: "number",
    category: "outreach",
    description: "SMTP server port.",
    is_secret: false,
  },
  {
    key: "smtp_user",
    value: "",
    value_type: "string",
    category: "outreach",
    description: "SMTP authentication username.",
    is_secret: false,
  },
  {
    key: "smtp_password",
    value: "",
    value_type: "string",
    category: "outreach",
    description: "SMTP authentication password.",
    is_secret: true,
  },

  // ── AI / Enrichment ───────────────────────────────────────────────────────
  {
    key: "openai_model",
    value: "gpt-4o-mini",
    value_type: "string",
    category: "ai",
    description: "Default OpenAI model for AI-assisted enrichment and chat.",
    is_secret: false,
  },
  {
    key: "embedding_model",
    value: "text-embedding-ada-002",
    value_type: "string",
    category: "ai",
    description: "OpenAI model used for generating vector embeddings.",
    is_secret: false,
  },
  {
    key: "qdrant_collection_leads",
    value: "leads",
    value_type: "string",
    category: "ai",
    description: "Qdrant collection name for lead embeddings.",
    is_secret: false,
  },

  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    key: "redis_url",
    value: "redis://localhost:6379/0",
    value_type: "string",
    category: "infrastructure",
    description: "Redis connection URL for BullMQ task queue.",
    is_secret: false,
  },
  {
    key: "qdrant_url",
    value: "http://localhost:6333",
    value_type: "string",
    category: "infrastructure",
    description: "Qdrant vector database URL.",
    is_secret: false,
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    key: "api_key_expiry_days",
    value: "365",
    value_type: "number",
    category: "security",
    description: "Default API key validity in days.",
    is_secret: false,
  },
  {
    key: "session_timeout_minutes",
    value: "60",
    value_type: "number",
    category: "security",
    description: "Dashboard session timeout in minutes.",
    is_secret: false,
  },
];

exports.seed = async function (knex) {
  for (const row of defaults) {
    await knex("settings")
      .insert({ ...row, user_id: null })
      .onConflict(["key", "user_id"])
      .ignore();
  }
  console.log(`[seed] Upserted ${defaults.length} default settings.`);
};
