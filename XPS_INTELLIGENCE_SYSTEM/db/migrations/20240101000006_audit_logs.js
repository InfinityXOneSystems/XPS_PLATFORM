"use strict";

/**
 * Migration 006 — Audit logs
 *
 * Immutable audit trail for every significant state change in the platform.
 * Covers user actions, lead mutations, agent dispatches, and settings changes.
 */

exports.up = async function (knex) {
  await knex.schema.createTable("audit_logs", (t) => {
    t.increments("id").primary();
    t.integer("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.text("action").notNullable(); // create|update|delete|login|export|scrape|…
    t.text("entity_type"); // lead|user|setting|agent_task|scrape_task
    t.text("entity_id"); // pk of the affected entity (text to support non-integer ids)
    t.jsonb("old_value");
    t.jsonb("new_value");
    t.text("ip_address");
    t.text("user_agent");
    t.jsonb("metadata"); // any extra context
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs (entity_type, entity_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs (action)",
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("audit_logs");
};
