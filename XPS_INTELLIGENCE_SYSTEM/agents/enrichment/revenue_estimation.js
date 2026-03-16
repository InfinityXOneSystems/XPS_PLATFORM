"use strict";

const CITY_SIZE_MULTIPLIERS = {
  large: 1.5, // >500k population
  medium: 1.1, // 100k–500k
  small: 0.85, // <100k
};

const LARGE_CITIES = new Set([
  "new york",
  "los angeles",
  "chicago",
  "houston",
  "phoenix",
  "philadelphia",
  "san antonio",
  "san diego",
  "dallas",
  "san jose",
  "austin",
  "jacksonville",
  "fort worth",
  "columbus",
  "charlotte",
  "indianapolis",
  "san francisco",
  "seattle",
  "denver",
  "nashville",
  "oklahoma city",
  "el paso",
  "washington",
  "las vegas",
  "louisville",
  "memphis",
  "portland",
  "baltimore",
  "milwaukee",
  "albuquerque",
]);

const MEDIUM_CITIES = new Set([
  "tucson",
  "fresno",
  "sacramento",
  "mesa",
  "kansas city",
  "atlanta",
  "omaha",
  "colorado springs",
  "raleigh",
  "miami",
  "cleveland",
  "virginia beach",
  "long beach",
  "minneapolis",
  "tampa",
  "new orleans",
  "bakersfield",
  "wichita",
  "arlington",
  "aurora",
  "anaheim",
  "santa ana",
  "corpus christi",
  "riverside",
]);

class RevenueEstimationEngine {
  estimate(lead) {
    const factors = [];
    let score = 0;

    const employees = lead.employeeCount || 0;
    if (employees >= 50) {
      score += 40;
      factors.push("large team (50+ employees)");
    } else if (employees >= 20) {
      score += 25;
      factors.push("medium team (20–49 employees)");
    } else if (employees >= 5) {
      score += 15;
      factors.push("small team (5–19 employees)");
    } else if (employees > 0) {
      score += 5;
      factors.push("micro team (<5 employees)");
    }

    const reviewCount = lead.reviewCount || lead.review_count || 0;
    if (reviewCount >= 100) {
      score += 20;
      factors.push("high review volume (100+)");
    } else if (reviewCount >= 30) {
      score += 12;
      factors.push("moderate reviews (30–99)");
    } else if (reviewCount >= 10) {
      score += 6;
      factors.push("some reviews (10–29)");
    }

    const rating = lead.rating || 0;
    if (rating >= 4.5) {
      score += 10;
      factors.push("excellent rating (4.5+)");
    } else if (rating >= 4.0) {
      score += 6;
      factors.push("good rating (4.0–4.4)");
    }

    const yearsInBusiness = lead.yearsInBusiness || 0;
    if (yearsInBusiness >= 20) {
      score += 15;
      factors.push("20+ years in business");
    } else if (yearsInBusiness >= 10) {
      score += 10;
      factors.push("10–19 years in business");
    } else if (yearsInBusiness >= 5) {
      score += 5;
      factors.push("5–9 years in business");
    }

    const cityKey = (lead.city || "").toLowerCase();
    let cityMultiplier = CITY_SIZE_MULTIPLIERS.small;
    if (LARGE_CITIES.has(cityKey)) {
      cityMultiplier = CITY_SIZE_MULTIPLIERS.large;
      factors.push("large metro market");
    } else if (MEDIUM_CITIES.has(cityKey)) {
      cityMultiplier = CITY_SIZE_MULTIPLIERS.medium;
      factors.push("medium metro market");
    }

    const adjustedScore = score * cityMultiplier;

    let estimated_revenue, revenue_range, confidence;

    if (adjustedScore >= 60) {
      estimated_revenue = "$2M–$10M";
      revenue_range = "$1M–$15M";
      confidence = "HIGH";
    } else if (adjustedScore >= 35) {
      estimated_revenue = "$500K–$2M";
      revenue_range = "$250K–$5M";
      confidence = "MEDIUM";
    } else if (adjustedScore >= 15) {
      estimated_revenue = "$100K–$500K";
      revenue_range = "$50K–$1M";
      confidence = "LOW";
    } else {
      estimated_revenue = "<$100K";
      revenue_range = "$0–$250K";
      confidence = "LOW";
    }

    return { estimated_revenue, revenue_range, confidence, factors };
  }
}

module.exports = RevenueEstimationEngine;
