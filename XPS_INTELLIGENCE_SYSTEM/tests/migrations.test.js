"use strict";

/**
 * tests/migrations.test.js
 *
 * Validates Knex migration files and seed files without requiring a live
 * PostgreSQL connection.  Checks file structure, export shapes, table names,
 * column definitions, and index correctness.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

// ── Helpers ──────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations");
const SEEDS_DIR = path.join(__dirname, "../db/seeds");

function loadMigration(filename) {
  return require(path.join(MIGRATIONS_DIR, filename));
}

function loadSeed(filename) {
  return require(path.join(SEEDS_DIR, filename));
}

// ── Migration file existence ──────────────────────────────────────────────────

test("migrations dir contains at least 7 migration files", () => {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".js"));
  assert.ok(
    files.length >= 7,
    `Expected at least 7 migration files, got: ${files.join(", ")}`,
  );
});

test("all migration files are numerically ordered with correct prefix", () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();

  const expectedPrefixes = [
    "20240101000001",
    "20240101000002",
    "20240101000003",
    "20240101000004",
    "20240101000005",
    "20240101000006",
    "20240101000007",
  ];

  for (let i = 0; i < expectedPrefixes.length; i++) {
    assert.ok(
      files[i].startsWith(expectedPrefixes[i]),
      `Expected file ${i} to start with ${expectedPrefixes[i]}, got: ${files[i]}`,
    );
  }
});

test("seeds dir contains exactly 2 seed files", () => {
  const files = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".js"));
  assert.equal(files.length, 2, `Expected 2, got: ${files.join(", ")}`);
});

// ── Migration export shape ────────────────────────────────────────────────────

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".js"))
  .sort();

for (const file of migrationFiles) {
  test(`migration ${file} exports up and down functions`, () => {
    const m = loadMigration(file);
    assert.equal(typeof m.up, "function", `${file} must export up()`);
    assert.equal(typeof m.down, "function", `${file} must export down()`);
  });
}

// ── Seed export shape ─────────────────────────────────────────────────────────

const seedFiles = fs
  .readdirSync(SEEDS_DIR)
  .filter((f) => f.endsWith(".js"))
  .sort();

for (const file of seedFiles) {
  test(`seed ${file} exports a seed function`, () => {
    const s = loadSeed(file);
    assert.equal(typeof s.seed, "function", `${file} must export seed()`);
  });
}

// ── knexfile.js ───────────────────────────────────────────────────────────────

test("knexfile exports development, test, and production configs", () => {
  const knexfile = require("../knexfile");
  assert.ok(knexfile.development, "knexfile must export development");
  assert.ok(knexfile.test, "knexfile must export test");
  assert.ok(knexfile.production, "knexfile must export production");
});

test("all knexfile environments use pg client", () => {
  const knexfile = require("../knexfile");
  for (const env of ["development", "test", "production"]) {
    assert.equal(knexfile[env].client, "pg", `${env} client must be 'pg'`);
  }
});

test("knexfile migrations directory points to db/migrations", () => {
  const knexfile = require("../knexfile");
  assert.ok(
    knexfile.development.migrations.directory.includes("db/migrations"),
    "migrations.directory must contain db/migrations",
  );
});

test("knexfile seeds directory points to db/seeds", () => {
  const knexfile = require("../knexfile");
  assert.ok(
    knexfile.development.seeds.directory.includes("db/seeds"),
    "seeds.directory must contain db/seeds",
  );
});

// ── Individual migration content checks ───────────────────────────────────────

test("migration 001 covers initial schema tables in down()", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000001_initial_schema.js"),
    "utf8",
  );
  for (const table of [
    "leads",
    "scrape_history",
    "outreach_log",
    "lead_scores",
  ]) {
    assert.ok(src.includes(table), `001 must reference table '${table}'`);
  }
});

test("migration 002 creates users table with required columns", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000002_users.js"),
    "utf8",
  );
  for (const col of [
    "username",
    "email",
    "password_hash",
    "role",
    "api_key_hash",
    "is_active",
  ]) {
    assert.ok(src.includes(col), `002 must define column '${col}'`);
  }
});

test("migration 003 creates settings table with required columns", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000003_settings.js"),
    "utf8",
  );
  for (const col of ["key", "value", "value_type", "category", "is_secret"]) {
    assert.ok(src.includes(col), `003 must define column '${col}'`);
  }
});

test("migration 004 creates agent_tasks and agent_runs tables", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000004_agents.js"),
    "utf8",
  );
  assert.ok(src.includes("agent_tasks"), "004 must create agent_tasks");
  assert.ok(src.includes("agent_runs"), "004 must create agent_runs");
  for (const col of [
    "agent_type",
    "command",
    "status",
    "priority",
    "retry_count",
  ]) {
    assert.ok(src.includes(col), `004 must define column '${col}'`);
  }
});

test("migration 005 creates scrape_tasks and scrape_results tables", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000005_scraping_pipeline.js"),
    "utf8",
  );
  assert.ok(src.includes("scrape_tasks"), "005 must create scrape_tasks");
  assert.ok(src.includes("scrape_results"), "005 must create scrape_results");
  for (const col of [
    "source",
    "keyword",
    "result_count",
    "raw_data",
    "processed",
  ]) {
    assert.ok(src.includes(col), `005 must define column '${col}'`);
  }
});

test("migration 006 creates audit_logs table with required columns", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000006_audit_logs.js"),
    "utf8",
  );
  assert.ok(src.includes("audit_logs"), "006 must create audit_logs");
  for (const col of [
    "action",
    "entity_type",
    "entity_id",
    "old_value",
    "new_value",
    "ip_address",
  ]) {
    assert.ok(src.includes(col), `006 must define column '${col}'`);
  }
});

test("migration 007 creates vector_embeddings table with Qdrant fields", () => {
  const src = fs.readFileSync(
    path.join(MIGRATIONS_DIR, "20240101000007_vector_embeddings.js"),
    "utf8",
  );
  assert.ok(
    src.includes("vector_embeddings"),
    "007 must create vector_embeddings",
  );
  for (const col of [
    "entity_type",
    "entity_id",
    "collection_name",
    "qdrant_id",
    "embedding_dim",
    "model_name",
  ]) {
    assert.ok(src.includes(col), `007 must define column '${col}'`);
  }
});

// ── Seed content checks ────────────────────────────────────────────────────────

test("seed 01 inserts into users table", () => {
  const src = fs.readFileSync(
    path.join(SEEDS_DIR, "01_default_user.js"),
    "utf8",
  );
  assert.ok(src.includes("users"), "seed 01 must insert into users");
  assert.ok(src.includes("password_hash"), "seed 01 must set password_hash");
  assert.ok(src.includes("role"), "seed 01 must set role");
});

test("seed 02 inserts into settings table with multiple rows", () => {
  const src = fs.readFileSync(
    path.join(SEEDS_DIR, "02_default_settings.js"),
    "utf8",
  );
  assert.ok(src.includes("settings"), "seed 02 must insert into settings");
  assert.ok(src.includes("value_type"), "seed 02 must include value_type");
  assert.ok(src.includes("category"), "seed 02 must include category");
  assert.ok(src.includes("scraping"), "seed 02 must include scraping category");
  assert.ok(src.includes("scoring"), "seed 02 must include scoring category");
  assert.ok(src.includes("outreach"), "seed 02 must include outreach category");
});

test("seed 02 includes scoring threshold settings", () => {
  const src = fs.readFileSync(
    path.join(SEEDS_DIR, "02_default_settings.js"),
    "utf8",
  );
  assert.ok(
    src.includes("score_threshold_hot"),
    "seed 02 must include score_threshold_hot",
  );
  assert.ok(
    src.includes("score_threshold_warm"),
    "seed 02 must include score_threshold_warm",
  );
});

// ── schema.sql completeness ───────────────────────────────────────────────────

test("schema.sql contains all 13 expected tables", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
  const expectedTables = [
    "schema_version",
    "leads",
    "scrape_history",
    "outreach_log",
    "lead_scores",
    "users",
    "settings",
    "agent_tasks",
    "agent_runs",
    "scrape_tasks",
    "scrape_results",
    "audit_logs",
    "vector_embeddings",
  ];
  for (const table of expectedTables) {
    assert.ok(
      sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `schema.sql must contain CREATE TABLE IF NOT EXISTS ${table}`,
    );
  }
});

test("schema.sql leads table has extended fields (country, metadata, tier, status)", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
  for (const field of [
    "country",
    "metadata",
    "tier",
    "status",
    "address",
    "linkedin",
  ]) {
    assert.ok(
      sql.includes(field),
      `schema.sql leads must include field '${field}'`,
    );
  }
});

test("schema.sql has indexes on critical columns", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
  const expectedIndexes = [
    "idx_leads_lead_score",
    "idx_leads_state",
    "idx_users_email",
    "idx_agent_tasks_status",
    "idx_audit_logs_created_at",
    "idx_vector_embeddings_qdrant_id",
  ];
  for (const idx of expectedIndexes) {
    assert.ok(sql.includes(idx), `schema.sql must define index '${idx}'`);
  }
});

test("schema.sql CHECK constraints are present for enums", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
  assert.ok(
    sql.includes("chk_users_role"),
    "schema.sql must have chk_users_role",
  );
  assert.ok(
    sql.includes("chk_settings_value_type"),
    "schema.sql must have chk_settings_value_type",
  );
  assert.ok(
    sql.includes("chk_agent_tasks_status"),
    "schema.sql must have chk_agent_tasks_status",
  );
  assert.ok(
    sql.includes("chk_scrape_tasks_status"),
    "schema.sql must have chk_scrape_tasks_status",
  );
});
