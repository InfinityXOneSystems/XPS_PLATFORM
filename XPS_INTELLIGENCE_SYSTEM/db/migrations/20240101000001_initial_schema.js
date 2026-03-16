"use strict";

/**
 * Migration 001 — Initial schema
 *
 * Creates the four foundational tables that were previously managed via
 * db/schema.sql:
 *   - leads
 *   - scrape_history
 *   - outreach_log
 *   - lead_scores
 *
 * The raw SQL file (db/schema.sql) remains for backward-compatible
 * bootstrapping via initSchema(); Knex migrations take over for all
 * subsequent changes.
 */

exports.up = async function (knex) {
  // ── leads ──────────────────────────────────────────────────────────────────
  const hasLeads = await knex.schema.hasTable("leads");
  if (!hasLeads) {
    await knex.schema.createTable("leads", (t) => {
      t.increments("id").primary();
      t.text("company_name").notNullable();
      t.text("contact_name");
      t.text("phone");
      t.text("email");
      t.text("website");
      t.text("address");
      t.text("city").notNullable().defaultTo("");
      t.text("state").notNullable().defaultTo("");
      t.text("country").defaultTo("US");
      t.text("industry");
      t.text("category");
      t.text("keyword");
      t.text("linkedin");
      t.decimal("rating", 3, 1);
      t.integer("reviews");
      t.integer("lead_score").defaultTo(0);
      t.text("tier");
      t.text("status").defaultTo("new");
      t.text("source");
      t.jsonb("metadata");
      t.timestamp("date_scraped", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("last_contacted", { useTz: true });
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
      t.unique(["company_name", "city", "state"]);
    });

    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_leads_lead_score   ON leads (lead_score DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_leads_date_scraped ON leads (date_scraped DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_leads_state        ON leads (state)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads (status)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_leads_tier         ON leads (tier)",
    );
  }

  // ── scrape_history ─────────────────────────────────────────────────────────
  const hasScrapeHistory = await knex.schema.hasTable("scrape_history");
  if (!hasScrapeHistory) {
    await knex.schema.createTable("scrape_history", (t) => {
      t.increments("id").primary();
      t.timestamp("run_at", { useTz: true }).defaultTo(knex.fn.now());
      t.text("source");
      t.text("keyword");
      t.text("city");
      t.text("state");
      t.integer("leads_found").defaultTo(0);
      t.text("status").defaultTo("ok");
    });
  }

  // ── outreach_log ───────────────────────────────────────────────────────────
  const hasOutreachLog = await knex.schema.hasTable("outreach_log");
  if (!hasOutreachLog) {
    await knex.schema.createTable("outreach_log", (t) => {
      t.increments("id").primary();
      t.integer("lead_id")
        .references("id")
        .inTable("leads")
        .onDelete("SET NULL");
      t.timestamp("sent_at", { useTz: true }).defaultTo(knex.fn.now());
      t.text("channel").defaultTo("email");
      t.text("template_id");
      t.text("status").defaultTo("sent");
      t.text("notes");
    });
  }

  // ── lead_scores ────────────────────────────────────────────────────────────
  // NOTE: lead_scores.lead_id is a nullable FK to leads(id).  Existing rows
  // with NULL lead_id are valid — no NOT NULL constraint is applied.
  // The leads table is always created before this block, ensuring the FK
  // target exists whenever lead_scores is created fresh.
  const hasLeadScores = await knex.schema.hasTable("lead_scores");
  if (!hasLeadScores) {
    await knex.schema.createTable("lead_scores", (t) => {
      t.increments("id").primary();
      t.integer("lead_id")
        .references("id")
        .inTable("leads")
        .onDelete("CASCADE");
      t.timestamp("scored_at", { useTz: true }).defaultTo(knex.fn.now());
      t.integer("score");
      t.text("tier");
      t.jsonb("breakdown");
    });

    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON lead_scores (lead_id)",
    );
  } else {
    // Handle existing table that may be missing the lead_id column
    const hasLeadId = await knex.schema.hasColumn("lead_scores", "lead_id");
    if (!hasLeadId) {
      await knex.schema.alterTable("lead_scores", (t) => {
        t.integer("lead_id")
          .references("id")
          .inTable("leads")
          .onDelete("CASCADE");
      });
      await knex.schema.raw(
        "CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON lead_scores (lead_id)",
      );
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("lead_scores");
  await knex.schema.dropTableIfExists("outreach_log");
  await knex.schema.dropTableIfExists("scrape_history");
  await knex.schema.dropTableIfExists("leads");
};
