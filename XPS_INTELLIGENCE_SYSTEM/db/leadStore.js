"use strict";

const db = require("./db");

/**
 * Upsert a single lead into the database.
 * Duplicate leads (same company_name + city + state) are updated in place.
 *
 * @param {Object} lead
 * @param {string}  lead.company_name
 * @param {string}  [lead.contact_name]
 * @param {string}  [lead.phone]
 * @param {string}  [lead.email]
 * @param {string}  [lead.website]
 * @param {string}  [lead.city]
 * @param {string}  [lead.state]
 * @param {string}  [lead.industry]
 * @param {number}  [lead.rating]
 * @param {number}  [lead.reviews]
 * @param {number}  [lead.lead_score]
 * @param {string}  [lead.source]
 * @returns {Promise<Object>} the inserted/updated row
 */
async function upsertLead(lead) {
  const {
    company_name,
    contact_name = null,
    phone = null,
    email = null,
    website = null,
    city = "",
    state = "",
    industry = null,
    rating = null,
    reviews = null,
    lead_score = 0,
    source = null,
  } = lead;

  const result = await db.query(
    `INSERT INTO leads
       (company_name, contact_name, phone, email, website,
        city, state, industry, rating, reviews, lead_score, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (company_name, city, state)
     DO UPDATE SET
       contact_name  = EXCLUDED.contact_name,
       phone         = EXCLUDED.phone,
       email         = EXCLUDED.email,
       website       = EXCLUDED.website,
       industry      = EXCLUDED.industry,
       rating        = EXCLUDED.rating,
       reviews       = EXCLUDED.reviews,
       lead_score    = EXCLUDED.lead_score,
       source        = EXCLUDED.source,
       date_scraped  = NOW()
     RETURNING *`,
    [
      company_name,
      contact_name,
      phone,
      email,
      website,
      city,
      state,
      industry,
      rating,
      reviews,
      lead_score,
      source,
    ],
  );

  return result.rows[0];
}

/**
 * Bulk-upsert an array of leads using a single parameterised query per batch.
 * Using UNNEST to pass all values as typed arrays is far more efficient than
 * issuing one INSERT per lead, especially for large batches.
 * @param {Object[]} leads
 * @returns {Promise<Object[]>} array of inserted/updated rows
 */
async function upsertLeads(leads) {
  if (!leads || leads.length === 0) return [];

  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);

    // Build typed arrays for each column so we can use UNNEST in a single query.
    const companyNames = [];
    const contactNames = [];
    const phones = [];
    const emails = [];
    const websites = [];
    const cities = [];
    const states = [];
    const industries = [];
    const ratings = [];
    const reviewsList = [];
    const leadScores = [];
    const sources = [];

    for (const lead of batch) {
      companyNames.push(lead.company_name ?? null);
      contactNames.push(lead.contact_name ?? null);
      phones.push(lead.phone ?? null);
      emails.push(lead.email ?? null);
      websites.push(lead.website ?? null);
      cities.push(lead.city ?? "");
      states.push(lead.state ?? "");
      industries.push(lead.industry ?? null);
      ratings.push(lead.rating != null ? Number(lead.rating) : null);
      reviewsList.push(lead.reviews != null ? Number(lead.reviews) : null);
      leadScores.push(lead.lead_score != null ? Number(lead.lead_score) : 0);
      sources.push(lead.source ?? null);
    }

    const { rows } = await db.query(
      `INSERT INTO leads
         (company_name, contact_name, phone, email, website,
          city, state, industry, rating, reviews, lead_score, source)
       SELECT * FROM UNNEST(
         $1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
         $6::text[], $7::text[], $8::text[], $9::float[], $10::int[],
         $11::int[], $12::text[]
       ) AS t(company_name, contact_name, phone, email, website,
              city, state, industry, rating, reviews, lead_score, source)
       ON CONFLICT (company_name, city, state)
       DO UPDATE SET
         contact_name  = EXCLUDED.contact_name,
         phone         = EXCLUDED.phone,
         email         = EXCLUDED.email,
         website       = EXCLUDED.website,
         industry      = EXCLUDED.industry,
         rating        = EXCLUDED.rating,
         reviews       = EXCLUDED.reviews,
         lead_score    = EXCLUDED.lead_score,
         source        = EXCLUDED.source,
         date_scraped  = NOW()
       RETURNING *`,
      [
        companyNames,
        contactNames,
        phones,
        emails,
        websites,
        cities,
        states,
        industries,
        ratings,
        reviewsList,
        leadScores,
        sources,
      ],
    );

    results.push(...rows);
  }

  return results;
}

/**
 * Retrieve leads ordered by score descending.
 * @param {number} [limit=100]
 * @returns {Promise<Object[]>}
 */
async function getTopLeads(limit = 100) {
  const result = await db.query(
    "SELECT * FROM leads ORDER BY lead_score DESC LIMIT $1",
    [limit],
  );
  return result.rows;
}

/**
 * Retrieve all leads, most recently scraped first.
 * @param {number} [limit=500]
 * @returns {Promise<Object[]>}
 */
async function getAllLeads(limit = 500) {
  const result = await db.query(
    "SELECT * FROM leads ORDER BY date_scraped DESC LIMIT $1",
    [limit],
  );
  return result.rows;
}

module.exports = { upsertLead, upsertLeads, getTopLeads, getAllLeads };
