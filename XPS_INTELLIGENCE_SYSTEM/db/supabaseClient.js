"use strict";

/**
 * Supabase client — singleton for the XPS Intelligence Platform.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL  – e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (has full DB access)
 *
 * For read-only / browser-safe operations you can also use:
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    "[supabase] Warning: SUPABASE_URL or SUPABASE_KEY not set. " +
      "Supabase operations will fail until these are configured.",
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      })
    : createClient("http://localhost", "placeholder", {
        auth: { persistSession: false },
      });

/** Whether Supabase is configured (URL + key both set). */
const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

module.exports = { supabase, SUPABASE_URL, isConfigured };
