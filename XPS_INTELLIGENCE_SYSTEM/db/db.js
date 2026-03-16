"use strict";

const { Pool } = require("pg");

/**
 * Build pg Pool config.
 *
 * Priority order (Railway-compatible):
 *   1. DATABASE_URL  — full connection string provided by Railway postgres addon
 *   2. Individual DATABASE_HOST / PORT / NAME / USER / PASSWORD vars
 *
 * When DATABASE_URL points to a Railway private network address (*.railway.internal)
 * SSL is disabled because the private network is already encrypted.  External
 * public connections (*.railway.app / *.up.railway.app) require SSL without
 * certificate verification since Railway uses ephemeral certs.
 */
function buildPoolConfig() {
  const url = process.env.DATABASE_URL || "";
  if (url) {
    const isPrivate =
      url.includes(".railway.internal") || url.includes("localhost");
    return {
      connectionString: url,
      // Private-network connections (*.railway.internal) run inside Railway's
      // encrypted overlay network — SSL at the TCP layer is not required.
      // Public Railway URLs use ephemeral self-signed certs, so we accept them
      // without CA verification.  This is a known Railway deployment pattern;
      // see https://docs.railway.app/databases/postgresql#connecting.
      ssl: isPrivate ? false : { rejectUnauthorized: false },
    };
  }

  // Fall back to individual vars (local dev / legacy deployments)
  return {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    database: process.env.DATABASE_NAME || "lead_intelligence",
    user: process.env.DATABASE_USER || "lead_admin",
    password: process.env.DATABASE_PASSWORD || "",
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"
                ? false
                : true,
          }
        : false,
  };
}

const pool = new Pool(buildPoolConfig());
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

/**
 * Run a SQL query against the connection pool.
 * @param {string} text  - parameterized SQL
 * @param {Array}  params - bound values
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Apply db/schema.sql to the connected database, creating tables if they
 * don't already exist.  Safe to call on every startup.
 */
async function initSchema() {
  const fs = require("fs");
  const path = require("path");
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Database schema initialized.");
}

module.exports = { query, initSchema, pool };

