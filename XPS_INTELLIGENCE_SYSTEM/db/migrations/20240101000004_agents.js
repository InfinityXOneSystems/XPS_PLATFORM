"use strict";

/**
 * Migration 004 — Agents
 *
 * Tables for the autonomous agent task queue and execution history:
 *   - agent_tasks    — queued / active tasks dispatched to agents
 *   - agent_runs     — completed execution records (success + failure logs)
 */

exports.up = async function (knex) {
  // ── agent_tasks ────────────────────────────────────────────────────────────
  await knex.schema.createTable("agent_tasks", (t) => {
    t.increments("id").primary();
    t.text("agent_type").notNullable(); // scraper | enrichment | scoring | outreach | orchestrator
    t.text("command").notNullable();
    t.jsonb("payload");
    t.text("status").notNullable().defaultTo("pending"); // pending|running|completed|failed|cancelled
    t.integer("priority").notNullable().defaultTo(5); // 1 (highest) – 10 (lowest)
    t.integer("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.text("queue_name").defaultTo("default");
    t.integer("retry_count").notNullable().defaultTo(0);
    t.integer("max_retries").notNullable().defaultTo(3);
    t.text("error");
    t.timestamp("scheduled_at", { useTz: true });
    t.timestamp("started_at", { useTz: true });
    t.timestamp("completed_at", { useTz: true });
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_agent_tasks_status     ON agent_tasks (status)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_type ON agent_tasks (agent_type)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority   ON agent_tasks (priority, created_at)",
  );
  await knex.schema.raw(
    "ALTER TABLE agent_tasks ADD CONSTRAINT chk_agent_tasks_status CHECK (status IN ('pending','running','completed','failed','cancelled'))",
  );

  // ── agent_runs ─────────────────────────────────────────────────────────────
  await knex.schema.createTable("agent_runs", (t) => {
    t.increments("id").primary();
    t.integer("task_id")
      .references("id")
      .inTable("agent_tasks")
      .onDelete("SET NULL");
    t.text("agent_type").notNullable();
    t.text("command").notNullable();
    t.jsonb("input");
    t.jsonb("output");
    t.text("status").notNullable().defaultTo("completed"); // completed|failed
    t.text("error");
    t.integer("duration_ms");
    t.timestamp("started_at", { useTz: true });
    t.timestamp("completed_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id    ON agent_runs (task_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_type ON agent_runs (agent_type)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_agent_runs_completed  ON agent_runs (completed_at DESC)",
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("agent_runs");
  await knex.schema.dropTableIfExists("agent_tasks");
};
