"use strict";

const crypto = require("crypto");

/**
 * Seed 01 — Default admin user
 *
 * Creates a single admin account if none exists.
 * The password is taken from the ADMIN_PASSWORD environment variable
 * (default: "changeme").
 *
 * SECURITY NOTE: Passwords are hashed with scrypt (Node.js native) using a
 * random salt stored as "<salt>:<hash>". The production auth module must
 * implement the same scrypt verification logic.  Change the default password
 * immediately after provisioning any non-development environment.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@xps.local";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

/**
 * Hash a password with scrypt + random salt.
 * Returns "<hex-salt>:<hex-hash>" suitable for storage in password_hash.
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

exports.seed = async function (knex) {
  const existing = await knex("users").where({ email: ADMIN_EMAIL }).first();
  if (existing) {
    return; // idempotent — do not overwrite
  }

  const password_hash = hashPassword(ADMIN_PASSWORD);

  // Generate a default API key for CI/dev use
  const rawKey = crypto.randomBytes(32).toString("hex");
  const api_key_prefix = rawKey.slice(0, 8);
  const api_key_hash = crypto.createHash("sha256").update(rawKey).digest("hex");

  await knex("users").insert({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    password_hash,
    role: "admin",
    api_key_prefix,
    api_key_hash,
    is_active: true,
  });

  console.log(
    `[seed] Created admin user: ${ADMIN_EMAIL}`,
    "\n[seed] IMPORTANT: Change the default password before going to production.",
  );
};
