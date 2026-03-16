"use strict";

require("dotenv").config();

/**
 * Knex configuration — XPS Lead Intelligence Platform
 *
 * Supports three environments: development, test, production.
 * All environments read from environment variables so the same config
 * works locally, in CI, and in Railway / Docker production containers.
 *
 * Connection resolution order (first match wins):
 *   1. DATABASE_URL        — full connection string (Railway sets this)
 *   2. DATABASE_PUBLIC_URL — Railway public TCP proxy URL
 *   3. PG* standard vars   — PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
 *                            (Railway sets these directly on the service)
 *   4. DATABASE_HOST / DATABASE_PORT / DATABASE_NAME / DATABASE_USER / DATABASE_PASSWORD
 *      (legacy local-dev names)
 *   5. Hardcoded localhost fallback (local dev only)
 */

function buildConnection() {
  // ── 1. Full connection string ─────────────────────────────────────────────
  const connStr =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    null;

  if (connStr) {
    // Decide whether SSL is needed.  Railway internal connections don't need
    // SSL (private domain).  Public TCP proxy connections do.
    const needsSsl =
      process.env.DATABASE_SSL === "true" ||
      connStr.includes("railway.app") ||
      connStr.includes("neon.tech") ||
      connStr.includes("supabase.co");

    return {
      connectionString: connStr,
      ssl: needsSsl
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : false,
    };
  }

  // ── 2. PG* standard env vars (set directly by Railway PostgreSQL service) ─
  const pgHost = process.env.PGHOST || process.env.DATABASE_HOST;
  const pgPort = parseInt(
    process.env.PGPORT || process.env.DATABASE_PORT || "5432",
    10,
  );
  const pgDb =
    process.env.PGDATABASE ||
    process.env.POSTGRES_DB ||
    process.env.DATABASE_NAME;
  const pgUser =
    process.env.PGUSER ||
    process.env.POSTGRES_USER ||
    process.env.DATABASE_USER;
  const pgPass =
    process.env.PGPASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    process.env.DATABASE_PASSWORD;

  if (pgHost && pgDb && pgUser) {
    return {
      host: pgHost,
      port: pgPort,
      database: pgDb,
      user: pgUser,
      password: pgPass || "",
      ssl:
        process.env.DATABASE_SSL === "true"
          ? {
              rejectUnauthorized:
                process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
            }
          : false,
    };
  }

  // ── 3. Local dev / CI fallback ────────────────────────────────────────────
  return {
    host: "localhost",
    port: 5432,
    database: "lead_intelligence",
    user: "lead_admin",
    password: "",
    ssl: false,
  };
}

const baseConnection = buildConnection();

/** @type {import('knex').Knex.Config} */
const sharedConfig = {
  client: "pg",
  connection: baseConnection,
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 30000,
  migrations: {
    directory: "./db/migrations",
    tableName: "knex_migrations",
    extension: "js",
  },
  seeds: {
    directory: "./db/seeds",
    extension: "js",
  },
};

module.exports = {
  development: {
    ...sharedConfig,
    debug: process.env.KNEX_DEBUG === "true",
  },

  test: {
    ...sharedConfig,
    connection: (() => {
      const conn = buildConnection();
      const testDb =
        process.env.PGDATABASE_TEST || process.env.DATABASE_NAME_TEST;
      // Only override database when using host/port connection style; a
      // connection-string (DATABASE_URL) cannot be patched inline without
      // re-parsing, so callers should set TEST_DATABASE_URL when needed.
      if (testDb && !("connectionString" in conn)) {
        return { ...conn, database: testDb };
      }
      return conn;
    })(),
    pool: { min: 1, max: 5 },
  },

  production: {
    ...sharedConfig,
    pool: { min: 2, max: 20 },
  },
};
