"use strict";

/**
 * Migration 005 — Scraping pipeline
 *
 * Dedicated tables for structured scraping job management (replacing the
 * simpler scrape_history table for new code paths):
 *
 *   - scrape_tasks   — queue of scraping jobs with lifecycle tracking
 *   - scrape_results — individual raw records returned by each task
 */

exports.up = async function (knex) {
  // ── scrape_tasks ───────────────────────────────────────────────────────────
  await knex.schema.createTable("scrape_tasks", (t) => {
    t.increments("id").primary();
    t.text("source").notNullable(); // google_maps | bing_maps | yelp | directory
    t.text("keyword").notNullable();
    t.text("city");
    t.text("state");
    t.text("country").defaultTo("US");
    t.text("status").notNullable().defaultTo("pending"); // pending|running|completed|failed|cancelled
    t.integer("priority").notNullable().defaultTo(5);
    t.integer("agent_task_id")
      .references("id")
      .inTable("agent_tasks")
      .onDelete("SET NULL");
    t.integer("result_count").defaultTo(0);
    t.integer("new_leads").defaultTo(0);
    t.integer("updated_leads").defaultTo(0);
    t.text("error");
    t.jsonb("options"); // extra scraper config (max_results, radius, etc.)
    t.timestamp("started_at", { useTz: true });
    t.timestamp("completed_at", { useTz: true });
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_scrape_tasks_status  ON scrape_tasks (status)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_scrape_tasks_source  ON scrape_tasks (source)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_scrape_tasks_created ON scrape_tasks (created_at DESC)",
  );
  await knex.schema.raw(
    "ALTER TABLE scrape_tasks ADD CONSTRAINT chk_scrape_tasks_status CHECK (status IN ('pending','running','completed','failed','cancelled'))",
  );

  // ── scrape_results ─────────────────────────────────────────────────────────
  await knex.schema.createTable("scrape_results", (t) => {
    t.increments("id").primary();
    t.integer("task_id")
      .notNullable()
      .references("id")
      .inTable("scrape_tasks")
      .onDelete("CASCADE");
    t.jsonb("raw_data").notNullable(); // verbatim data returned by the scraper
    t.boolean("processed").notNullable().defaultTo(false);
    t.integer("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.text("validation_status"); // valid|invalid|duplicate
    t.text("validation_errors");
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_scrape_results_task_id   ON scrape_results (task_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_scrape_results_processed ON scrape_results (processed)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_scrape_results_lead_id   ON scrape_results (lead_id)",
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("scrape_results");
  await knex.schema.dropTableIfExists("scrape_tasks");
};
