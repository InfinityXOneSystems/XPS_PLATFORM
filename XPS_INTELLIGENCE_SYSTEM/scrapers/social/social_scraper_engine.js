"use strict";
/**
 * Social Scraper Engine — orchestrates all social media scrapers
 *
 * Sources: LinkedIn, Twitter/X, Facebook, Instagram
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { scrapeLinkedInBatch } = require("./linkedin_scraper");
const { scrapeTwitterBatch } = require("./twitter_scraper");
const { scrapeFacebookBatch } = require("./facebook_scraper");
const { scrapeInstagramBatch } = require("./instagram_scraper");

const OUTPUT_DIR = path.resolve(__dirname, "../../leads");

/**
 * Merge social media results into the existing lead records by matching company name.
 * @param {object[]} existingLeads
 * @param {object[]} socialResults
 * @returns {object[]}
 */
function mergeSocialData(existingLeads, socialResults) {
  const byName = new Map(
    existingLeads.map((l) => [l.company?.toLowerCase().trim(), l]),
  );

  for (const social of socialResults) {
    const key = social.company?.toLowerCase().trim();
    if (!key) continue;

    const lead = byName.get(key);
    if (lead) {
      // Enrich: add social fields only if not already present
      if (!lead.linkedinUrl && social.source === "linkedin")
        lead.linkedinUrl = social.profileUrl;
      if (!lead.twitterUrl && social.source === "twitter")
        lead.twitterUrl = social.profileUrl;
      if (!lead.facebookUrl && social.source === "facebook")
        lead.facebookUrl = social.profileUrl;
      if (!lead.instagramUrl && social.source === "instagram")
        lead.instagramUrl = social.profileUrl;
      if (!lead.website && social.website) lead.website = social.website;
      if (!lead.email && social.email) lead.email = social.email;
      if (!lead.phone && social.phone) lead.phone = social.phone;
      lead.socialEnriched = true;
      lead.socialEnrichedAt = new Date().toISOString();
    } else {
      // New lead discovered via social media
      existingLeads.push({
        id: `social-${crypto.randomUUID()}`,
        company: social.company || social.handle || "Unknown",
        phone: social.phone || "",
        email: social.email || "",
        website: social.website || "",
        source: `social:${social.source}`,
        socialData: social,
        discoveredAt: new Date().toISOString(),
      });
    }
  }

  return existingLeads;
}

/**
 * Run the social scraper engine.
 * @param {object} targets
 * @param {string[]} [targets.linkedin]  company slugs
 * @param {string[]} [targets.twitter]   handles
 * @param {string[]} [targets.facebook]  page slugs
 * @param {string[]} [targets.instagram] handles
 * @param {number}   [targets.concurrency=3]
 * @returns {Promise<object>}
 */
async function run(targets = {}) {
  const concurrency = targets.concurrency || 3;
  const allResults = [];

  console.log("[SocialEngine] Starting social media scraping...");

  const jobs = [];
  if (targets.linkedin?.length)
    jobs.push(
      scrapeLinkedInBatch(targets.linkedin, concurrency).then((r) =>
        allResults.push(...r),
      ),
    );
  if (targets.twitter?.length)
    jobs.push(
      scrapeTwitterBatch(targets.twitter, concurrency).then((r) =>
        allResults.push(...r),
      ),
    );
  if (targets.facebook?.length)
    jobs.push(
      scrapeFacebookBatch(targets.facebook, concurrency).then((r) =>
        allResults.push(...r),
      ),
    );
  if (targets.instagram?.length)
    jobs.push(
      scrapeInstagramBatch(targets.instagram, concurrency).then((r) =>
        allResults.push(...r),
      ),
    );

  await Promise.all(jobs);
  console.log(`[SocialEngine] Collected ${allResults.length} social records`);

  // Load existing leads and merge
  const leadsFile = path.join(OUTPUT_DIR, "leads.json");
  let leads = [];
  if (fs.existsSync(leadsFile)) {
    try {
      leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
    } catch (_) {}
  }

  const enriched = mergeSocialData(leads, allResults);

  // Save enriched leads
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(leadsFile, JSON.stringify(enriched, null, 2));

  // Save raw social data separately
  const socialFile = path.join(OUTPUT_DIR, "social_leads.json");
  fs.writeFileSync(socialFile, JSON.stringify(allResults, null, 2));

  console.log(
    `[SocialEngine] Saved ${enriched.length} leads (${allResults.length} social records)`,
  );

  return {
    totalLeads: enriched.length,
    socialRecords: allResults.length,
    sources: {
      linkedin: allResults.filter((r) => r.source === "linkedin").length,
      twitter: allResults.filter((r) => r.source === "twitter").length,
      facebook: allResults.filter((r) => r.source === "facebook").length,
      instagram: allResults.filter((r) => r.source === "instagram").length,
    },
  };
}

module.exports = { run, mergeSocialData };

/* CLI usage */
if (require.main === module) {
  const targets = {
    linkedin: (process.env.SOCIAL_LINKEDIN || "").split(",").filter(Boolean),
    twitter: (process.env.SOCIAL_TWITTER || "").split(",").filter(Boolean),
    facebook: (process.env.SOCIAL_FACEBOOK || "").split(",").filter(Boolean),
    instagram: (process.env.SOCIAL_INSTAGRAM || "").split(",").filter(Boolean),
    concurrency: parseInt(process.env.SOCIAL_CONCURRENCY || "3", 10),
  };

  if (
    !targets.linkedin.length &&
    !targets.twitter.length &&
    !targets.facebook.length &&
    !targets.instagram.length
  ) {
    console.log(
      "[SocialEngine] No targets specified.  Set SOCIAL_LINKEDIN, SOCIAL_TWITTER, SOCIAL_FACEBOOK, or SOCIAL_INSTAGRAM env vars.",
    );
    console.log(
      "Example: SOCIAL_LINKEDIN=acme-flooring,bob-tile node scrapers/social/social_scraper_engine.js",
    );
    process.exit(0);
  }

  run(targets)
    .then((summary) => {
      console.log("[SocialEngine] Done:", JSON.stringify(summary));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[SocialEngine] Error:", err.message);
      process.exit(1);
    });
}
