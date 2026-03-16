// ═══════════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION (Railway PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Build pool from environment
function buildPoolConfig() {
  const url = process.env.DATABASE_URL || "";
  if (url) {
    const isPrivate = url.includes(".railway.internal") || url.includes("localhost");
    return {
      connectionString: url,
      ssl: isPrivate ? false : { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    database: process.env.DATABASE_NAME || "railway",
    user: process.env.DATABASE_USER || "postgres",
    password: process.env.DATABASE_PASSWORD || "",
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

let pool = null;

async function initializeDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      console.log("[db] DATABASE_URL not set - using file fallback");
      return;
    }

    pool = new Pool(buildPoolConfig());

    // Test connection
    const client = await pool.connect();
    console.log("[db] ✅ PostgreSQL connection established");
    client.release();

    // Run schema initialization SQL
    const schemaPath = path.join(__dirname, "db", "init.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    
    await pool.query(schemaSql);
    console.log("[db] ✅ Schema initialized successfully");

  } catch (error) {
    console.error("[db] ❌ Database initialization failed:", error.message);
    console.log("[db] Falling back to file-based lead storage");
    pool = null;
  }
}

async function getLeadsFromDb() {
  if (!pool) return null;
  try {
    const result = await pool.query("SELECT * FROM leads ORDER BY lead_score DESC LIMIT 1068");
    return result.rows;
  } catch (error) {
    console.error("[db] Query failed:", error.message);
    return null;
  }
}

module.exports = { initializeDatabase, getLeadsFromDb, pool };
