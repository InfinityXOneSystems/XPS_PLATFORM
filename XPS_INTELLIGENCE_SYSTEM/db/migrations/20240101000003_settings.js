"use strict";

/**
 * Migration 003 — Settings
 *
 * Global platform settings / configuration key-value store.
 * Supports typed values (string, number, boolean, json) and optional
 * per-user overrides linked to the users table.
 */

exports.up = async function (knex) {
  await knex.schema.createTable("settings", (t) => {
    t.increments("id").primary();
    t.text("key").notNullable();
    // user_id NULL  → global/system setting
    // user_id NOT NULL → per-user override
    t.integer("user_id").references("id").inTable("users").onDelete("CASCADE");
    t.text("value");
    t.text("value_type").notNullable().defaultTo("string"); // string|number|boolean|json
    t.text("category").defaultTo("general");
    t.text("description");
    t.boolean("is_secret").notNullable().defaultTo(false);
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    t.unique(["key", "user_id"]);
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_settings_key      ON settings (key)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_settings_category ON settings (category)",
  );
  await knex.schema.raw(
    "ALTER TABLE settings ADD CONSTRAINT chk_settings_value_type CHECK (value_type IN ('string','number','boolean','json'))",
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("settings");
};
