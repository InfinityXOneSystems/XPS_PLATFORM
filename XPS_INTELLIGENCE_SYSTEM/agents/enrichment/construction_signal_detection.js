"use strict";

const PROJECT_KEYWORDS = [
  "just completed",
  "recently finished",
  "new project",
  "just installed",
  "new installation",
  "renovation complete",
  "remodel complete",
  "project done",
];

const ACTIVE_KEYWORDS = [
  "hiring",
  "now hiring",
  "we are growing",
  "expanding",
  "new location",
  "open for projects",
  "taking new clients",
  "accepting new jobs",
];

const OPPORTUNITY_KEYWORDS = [
  "free estimate",
  "free quote",
  "contact us",
  "call now",
  "get started",
  "schedule today",
  "book now",
];

class ConstructionSignalDetector {
  detect(lead) {
    const text = [
      lead.name,
      lead.description,
      lead.category,
      lead.recentReviews,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const signals = [];
    let score = 0;

    // Check review velocity
    const reviewCount = lead.reviewCount || lead.review_count || 0;
    if (reviewCount >= 50) {
      signals.push("high review velocity");
      score += 20;
    } else if (reviewCount >= 20) {
      signals.push("moderate review velocity");
      score += 10;
    }

    // Recent rating signals growth
    const rating = lead.rating || 0;
    if (rating >= 4.5 && reviewCount >= 20) {
      signals.push("high satisfaction + volume");
      score += 15;
    }

    // Active project keywords
    for (const kw of PROJECT_KEYWORDS) {
      if (text.includes(kw)) {
        signals.push(`recent project mention: "${kw}"`);
        score += 15;
        break;
      }
    }

    for (const kw of ACTIVE_KEYWORDS) {
      if (text.includes(kw)) {
        signals.push(`growth signal: "${kw}"`);
        score += 10;
        break;
      }
    }

    for (const kw of OPPORTUNITY_KEYWORDS) {
      if (text.includes(kw)) {
        signals.push(`outreach opportunity: "${kw}"`);
        score += 5;
        break;
      }
    }

    // Website presence
    if (lead.website) {
      signals.push("has website");
      score += 5;
    }

    // Phone presence
    if (lead.phone) {
      signals.push("has phone");
      score += 5;
    }

    let opportunity_level;
    if (score >= 40) opportunity_level = "HIGH";
    else if (score >= 20) opportunity_level = "MEDIUM";
    else opportunity_level = "LOW";

    return { signals, score, opportunity_level };
  }
}

module.exports = ConstructionSignalDetector;
