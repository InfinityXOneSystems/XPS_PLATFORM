"use strict";

/**
 * Migration 002 — Users
 *
 * Adds user authentication and API-key support:
 *   - users   — platform user accounts with bcrypt password_hash
 *               and hashed API keys for machine access
 */

exports.up = async function (knex) {
  await knex.schema.createTable("users", (t) => {
    t.increments("id").primary();
    t.text("username").notNullable().unique();
    t.text("email").notNullable().unique();
    t.text("password_hash").notNullable();
    t.text("role").notNullable().defaultTo("user");
    // API key is stored as a SHA-256 hash; prefix stored separately for lookup
    t.text("api_key_hash").unique();
    t.text("api_key_prefix");
    t.timestamp("api_key_expires_at", { useTz: true });
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("last_login", { useTz: true });
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_users_api_key_prefix ON users (api_key_prefix)",
  );
  await knex.schema.raw(
    "ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('admin','user','viewer'))",
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("users");
};
