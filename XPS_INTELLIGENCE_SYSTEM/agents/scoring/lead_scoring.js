"use strict";

/**
 * Lead Scoring Engine - Phase 4
 *
 * Scores contractor leads across four dimensions:
 *   1. Contact completeness  (40 pts)
 *   2. Business quality      (30 pts)
 *   3. Industry relevance    (20 pts)
 *   4. Geographic priority   (10 pts)
 *
 * Total possible: 100 pts
 * Tiers:  HOT  >= 75
 *         WARM >= 50
 *         COLD  < 50
 */

// ---------------------------------------------------------------------------
// Industry keyword map
// ---------------------------------------------------------------------------
const INDUSTRY_KEYWORDS = {
  Epoxy: [
    "epoxy",
    "resin",
    "polyaspartic",
    "polyurea",
    "flake floor",
    "metallic epoxy",
    "garage floor coating",
  ],
  Concrete: [
    "concrete polishing",
    "concrete grinding",
    "concrete resurfacing",
    "concrete repair",
    "concrete sealing",
    "decorative concrete",
    "concrete staining",
    "concrete finishing",
    "shot blasting",
    "floor grinding",
    "polished concrete",
  ],
  SurfacePrep: [
    "surface prep",
    "shot blasting",
    "floor grinding",
    "floor preparation",
    "abrasive blasting",
    "scarifying",
  ],
  Automotive: [
    "auto repair",
    "car dealership",
    "auto body",
    "truck repair",
    "fleet maintenance",
    "automotive",
    "mechanic",
    "garage",
  ],
  Industrial: [
    "manufacturing",
    "warehouse",
    "distribution center",
    "industrial maintenance",
    "industrial flooring",
    "factory",
    "plant",
  ],
};

// Pre-computed lowercase keyword map — avoids repeated .toLowerCase() calls
// inside the hot-path detectIndustry() function.
const INDUSTRY_KEYWORDS_LOWER = Object.fromEntries(
  Object.entries(INDUSTRY_KEYWORDS).map(([industry, kws]) => [
    industry,
    kws.map((kw) => kw.toLowerCase()),
  ]),
);

// ---------------------------------------------------------------------------
// Priority markets: cities near XPS Xpress locations
// ---------------------------------------------------------------------------
const PRIMARY_MARKETS = [
  "columbus",
  "tempe",
  "phoenix",
  "mesa",
  "chandler",
  "scottsdale",
  "west chicago",
  "chicago",
  "rockford",
  "oklahoma city",
];

const SECONDARY_MARKETS = [
  "cleveland",
  "cincinnati",
  "dayton",
  "akron",
  "peoria",
  "springfield",
  "naperville",
  "tucson",
  "aurora",
];

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Score contact completeness (0-40 pts)
 */
function scoreContactCompleteness(lead) {
  let score = 0;
  if (lead.company || lead.company_name) score += 10;
  if (lead.phone) score += 10;
  if (lead.email) score += 10;
  if (lead.website) score += 5;
  if (lead.contact_name) score += 5;
  return score;
}

/**
 * Score business quality based on rating and reviews (0-30 pts)
 */
function scoreBusinessQuality(lead) {
  let score = 0;

  const rating = parseFloat(lead.rating) || 0;
  if (rating >= 4.5) score += 15;
  else if (rating >= 4.0) score += 10;
  else if (rating >= 3.5) score += 5;

  const reviews = parseInt(lead.reviews, 10) || 0;
  if (reviews >= 50) score += 15;
  else if (reviews >= 20) score += 10;
  else if (reviews >= 10) score += 7;
  else if (reviews >= 1) score += 3;

  return score;
}

/**
 * Detect the industry of a lead based on keyword matching (0-20 pts)
 */
function detectIndustry(lead) {
  const text = [
    lead.company,
    lead.company_name,
    lead.industry,
    lead.services,
    lead.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const INDUSTRY_PRIORITY = {
    Epoxy: 20,
    Concrete: 20,
    SurfacePrep: 18,
    Industrial: 15,
    Automotive: 15,
  };

  let bestIndustry = null;
  let bestScore = 0;

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS_LOWER)) {
    const matched = keywords.some((kw) => text.includes(kw));
    if (matched) {
      const pts = INDUSTRY_PRIORITY[industry] || 5;
      if (pts > bestScore) {
        bestScore = pts;
        bestIndustry = industry;
      }
    }
  }

  // Fall back to explicit industry field if no keyword match
  if (!bestIndustry && lead.industry) {
    const normalized = lead.industry.trim();
    if (INDUSTRY_PRIORITY[normalized]) {
      bestIndustry = normalized;
      bestScore = INDUSTRY_PRIORITY[normalized];
    } else {
      bestIndustry = normalized;
      bestScore = 5;
    }
  }

  return { industry: bestIndustry || "Unknown", points: bestScore };
}

/**
 * Score geographic priority (0-10 pts)
 */
function scoreGeography(lead) {
  const city = (lead.city || "").toLowerCase().trim();
  if (!city) return 0;
  if (PRIMARY_MARKETS.some((m) => city.includes(m) || m.includes(city)))
    return 10;
  if (SECONDARY_MARKETS.some((m) => city.includes(m) || m.includes(city)))
    return 5;
  return 0;
}

/**
 * Determine tier label from a numeric score.
 */
function getTier(score) {
  if (score >= 75) return "HOT";
  if (score >= 50) return "WARM";
  return "COLD";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single lead and return enriched object.
 *
 * @param {Object} lead
 * @returns {Object} lead with added fields: lead_score, tier, industry_detected,
 *                   score_breakdown
 */
function scoreLead(lead) {
  const completeness = scoreContactCompleteness(lead);
  const quality = scoreBusinessQuality(lead);
  const { industry: detectedIndustry, points: relevance } =
    detectIndustry(lead);
  const geography = scoreGeography(lead);

  const total = completeness + quality + relevance + geography;

  return {
    ...lead,
    industry: lead.industry || detectedIndustry,
    industry_detected: detectedIndustry,
    lead_score: total,
    tier: getTier(total),
    score_breakdown: {
      contact_completeness: completeness,
      business_quality: quality,
      industry_relevance: relevance,
      geographic_priority: geography,
    },
  };
}

/**
 * Score an array of leads, sort by score descending, and add rank.
 *
 * @param {Object[]} leads
 * @returns {Object[]} scored and ranked leads
 */
function scoreLeads(leads) {
  const scored = leads
    .map(scoreLead)
    .sort((a, b) => b.lead_score - a.lead_score);
  for (let i = 0; i < scored.length; i++) scored[i].rank = i + 1;
  return scored;
}

/**
 * Segment a scored leads array into industry buckets.
 *
 * @param {Object[]} scoredLeads
 * @returns {Object} map of industry -> leads[]
 */
function segmentByIndustry(scoredLeads) {
  return scoredLeads.reduce((acc, lead) => {
    const key = lead.industry_detected || lead.industry || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(lead);
    return acc;
  }, {});
}

/**
 * Segment a scored leads array into tier buckets.
 *
 * @param {Object[]} scoredLeads
 * @returns {{ HOT: Object[], WARM: Object[], COLD: Object[] }}
 */
function segmentByTier(scoredLeads) {
  return scoredLeads.reduce(
    (acc, lead) => {
      acc[lead.tier].push(lead);
      return acc;
    },
    { HOT: [], WARM: [], COLD: [] },
  );
}

/**
 * Generate a summary report for a scored lead set.
 *
 * @param {Object[]} scoredLeads
 * @returns {Object}
 */
function generateReport(scoredLeads) {
  const tiers = segmentByTier(scoredLeads);
  const industries = segmentByIndustry(scoredLeads);

  const avgScore =
    scoredLeads.length > 0
      ? Math.round(
          scoredLeads.reduce((s, l) => s + l.lead_score, 0) /
            scoredLeads.length,
        )
      : 0;

  return {
    generated_at: new Date().toISOString(),
    total_leads: scoredLeads.length,
    average_score: avgScore,
    tiers: {
      HOT: tiers.HOT.length,
      WARM: tiers.WARM.length,
      COLD: tiers.COLD.length,
    },
    industries: Object.fromEntries(
      Object.entries(industries).map(([k, v]) => [k, v.length]),
    ),
    top_leads: scoredLeads.slice(0, 10).map((l) => ({
      company: l.company || l.company_name,
      city: l.city,
      lead_score: l.lead_score,
      tier: l.tier,
      industry: l.industry_detected || l.industry,
    })),
  };
}

module.exports = {
  scoreLead,
  scoreLeads,
  segmentByIndustry,
  segmentByTier,
  generateReport,
  // individual dimension helpers (useful for testing)
  scoreContactCompleteness,
  scoreBusinessQuality,
  detectIndustry,
  scoreGeography,
  getTier,
};
