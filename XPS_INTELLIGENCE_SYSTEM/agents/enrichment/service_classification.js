"use strict";

const FLOORING_KEYWORDS = {
  hardwood: ["hardwood", "hard wood", "wood floor", "wood flooring"],
  carpet: ["carpet", "carpeting", "carpet installation"],
  tile: ["tile", "ceramic", "porcelain", "mosaic"],
  vinyl: ["vinyl", "lvp", "lvt", "luxury vinyl", "sheet vinyl"],
  epoxy: ["epoxy", "epoxy coating", "garage floor coating"],
  laminate: ["laminate", "laminate flooring", "pergo"],
  refinishing: [
    "refinish",
    "refinishing",
    "sand and finish",
    "floor restoration",
  ],
};

const CONSTRUCTION_KEYWORDS = {
  general: [
    "general contractor",
    "general contracting",
    "construction",
    "remodel",
    "remodeling",
    "renovation",
  ],
  roofing: ["roofing", "roof repair", "roof installation", "shingles"],
  painting: [
    "painting",
    "interior painting",
    "exterior painting",
    "paint contractor",
  ],
  drywall: ["drywall", "sheetrock", "plastering"],
  plumbing: ["plumbing", "plumber", "pipe repair"],
  electrical: ["electrical", "electrician", "wiring"],
  hvac: ["hvac", "heating", "cooling", "air conditioning", "furnace"],
  concrete: ["concrete", "concrete contractor", "flatwork", "stamped concrete"],
};

class ServiceClassificationEngine {
  classify(lead) {
    const text = [lead.name, lead.description, lead.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const specializations = [];
    const secondary_services = [];
    let primary_service = "General Contractor";
    let industry = "Construction";

    // Check flooring specializations
    for (const [spec, keywords] of Object.entries(FLOORING_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        specializations.push(spec);
        if (specializations.length === 1) {
          primary_service = `${spec.charAt(0).toUpperCase() + spec.slice(1)} Flooring`;
          industry = "Flooring";
        } else {
          secondary_services.push(
            `${spec.charAt(0).toUpperCase() + spec.slice(1)} Flooring`,
          );
        }
      }
    }

    // Check construction specializations
    for (const [spec, keywords] of Object.entries(CONSTRUCTION_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        if (industry !== "Flooring" && specializations.length === 0) {
          primary_service = spec.charAt(0).toUpperCase() + spec.slice(1);
          industry = "Construction";
          specializations.push(spec);
        } else {
          secondary_services.push(spec.charAt(0).toUpperCase() + spec.slice(1));
        }
      }
    }

    // If still general, try to infer from industry category
    if (primary_service === "General Contractor" && lead.category) {
      primary_service = lead.category;
    }

    return { primary_service, secondary_services, industry, specializations };
  }
}

module.exports = ServiceClassificationEngine;
