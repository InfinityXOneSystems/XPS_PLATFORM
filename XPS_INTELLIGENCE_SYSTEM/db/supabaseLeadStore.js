"use strict";

/**
 * Supabase lead store — CRUD operations for the `leads` table in Supabase.
 *
 * This module replaces the PostgreSQL-backed db/leadStore.js for lead
 * persistence.  All scraper output and API reads/writes now route through
 * Supabase so that data is available in the hosted dashboard without a
 * self-managed Postgres instance.
 *
 * Table: leads
 *   id, company_name, contact_name, phone, email, website, address,
 *   city, state, country, industry, category, keyword, rating, reviews,
 *   lead_score, tier, status, source, metadata, date_scraped, updated_at
 *
 * Conflict key: (company_name, city, state)  — same as the PostgreSQL schema.
 */

const { supabase } = require("./supabaseClient");

const TABLE = "leads";
const BATCH_SIZE = 100;

/**
 * Normalise a raw lead object from the scrapers into the Supabase row shape.
 * Accepts both legacy (company, scrapedAt) and canonical (company_name,
 * date_scraped) field names.
 *
 * @param {Object} lead
 * @returns {Object} row ready for Supabase upsert
 */
function normalise(lead) {
  return {
    company_name: lead.company_name || lead.company || "",
    contact_name: lead.contact_name || lead.contact || null,
    phone: lead.phone || null,
    email: lead.email || null,
    website: lead.website || null,
    address: lead.address || null,
    city: lead.city || "",
    state: lead.state || "",
    country: lead.country || "USA",
    industry: lead.industry || lead.category || null,
    category: lead.category || null,
    keyword: lead.keyword || null,
    rating: lead.rating != null ? parseFloat(lead.rating) || null : null,
    reviews: lead.reviews != null ? parseInt(lead.reviews, 10) || null : null,
    lead_score:
      lead.lead_score != null
        ? parseInt(lead.lead_score, 10)
        : lead.score != null
          ? parseInt(lead.score, 10)
          : 0,
    tier: lead.tier || null,
    status: lead.status || "new",
    source: lead.source || null,
    metadata: lead.metadata || lead._validation || null,
    date_scraped:
      lead.date_scraped || lead.scrapedAt || new Date().toISOString(),
  };
}

/**
 * Upsert a single lead into Supabase.
 * Duplicate leads (same company_name + city + state) are updated in-place.
 *
 * @param {Object} lead
 * @returns {Promise<Object>} the inserted/updated row
 */
async function upsertLead(lead) {
  const row = normalise(lead);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "company_name,city,state" })
    .select()
    .single();

  if (error) {
    throw new Error(`[supabaseLeadStore] upsertLead failed: ${error.message}`);
  }
  return data;
}

/**
 * Bulk-upsert an array of leads.
 * Processed in batches of BATCH_SIZE to stay within Supabase request limits.
 *
 * @param {Object[]} leads
 * @returns {Promise<Object[]>} inserted/updated rows
 */
async function upsertLeads(leads) {
  const results = [];
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE).map(normalise);
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: "company_name,city,state" })
      .select();

    if (error) {
      throw new Error(
        `[supabaseLeadStore] upsertLeads batch ${i / BATCH_SIZE + 1} failed: ${error.message}`,
      );
    }
    results.push(...(data || []));
  }
  return results;
}

/**
 * Retrieve leads ordered by lead_score descending.
 *
 * @param {number} [limit=100]
 * @returns {Promise<Object[]>}
 */
async function getTopLeads(limit = 100) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("lead_score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`[supabaseLeadStore] getTopLeads failed: ${error.message}`);
  }
  return data || [];
}

/**
 * Retrieve all leads, most recently scraped first.
 *
 * @param {number} [limit=500]
 * @returns {Promise<Object[]>}
 */
async function getAllLeads(limit = 500) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("date_scraped", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`[supabaseLeadStore] getAllLeads failed: ${error.message}`);
  }
  return data || [];
}

/**
 * Get a single lead by its Supabase row id.
 *
 * @param {number|string} id
 * @returns {Promise<Object|null>}
 */
async function getLeadById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabaseLeadStore] getLeadById failed: ${error.message}`);
  }
  return data;
}

/**
 * Delete a lead by id.
 *
 * @param {number|string} id
 * @returns {Promise<void>}
 */
async function deleteLead(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) {
    throw new Error(`[supabaseLeadStore] deleteLead failed: ${error.message}`);
  }
}

/**
 * Count all leads in the table.
 *
 * @returns {Promise<number>}
 */
async function countLeads() {
  const { count, error } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`[supabaseLeadStore] countLeads failed: ${error.message}`);
  }
  return count || 0;
}

module.exports = {
  upsertLead,
  upsertLeads,
  getTopLeads,
  getAllLeads,
  getLeadById,
  deleteLead,
  countLeads,
  normalise,
};
