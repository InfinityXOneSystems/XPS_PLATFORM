"use strict";

const CompanyEnrichmentEngine = require("./company_enrichment_engine");
const TechnologyStackDetector = require("./technology_stack_detection");
const ReviewAggregator = require("./review_aggregator");
const RevenueEstimationEngine = require("./revenue_estimation");
const ServiceClassificationEngine = require("./service_classification");
const ConstructionSignalDetector = require("./construction_signal_detection");
const SocialProfileFinder = require("./social_profile_finder");

class CompanyIntelligenceProfileBuilder {
  constructor() {
    this.enrichmentEngine = new CompanyEnrichmentEngine();
    this.techDetector = new TechnologyStackDetector();
    this.reviewAggregator = new ReviewAggregator();
    this.revenueEngine = new RevenueEstimationEngine();
    this.serviceClassifier = new ServiceClassificationEngine();
    this.signalDetector = new ConstructionSignalDetector();
    this.socialFinder = new SocialProfileFinder();
  }

  async buildProfile(lead) {
    const profile = { ...lead, builtAt: new Date().toISOString() };

    // Run independent enrichment steps in parallel
    const [enriched, reviewData, socialProfiles] = await Promise.all([
      this.enrichmentEngine.enrichLead(lead).catch((err) => {
        console.error("[ProfileBuilder] Enrichment error:", err.message);
        return lead;
      }),
      this.reviewAggregator.aggregateForLead(lead).catch(() => null),
      this.socialFinder.findProfiles(lead).catch(() => null),
    ]);

    Object.assign(profile, enriched);
    if (reviewData) {
      profile.reviewData = reviewData;
      profile.rating = profile.rating || reviewData.rating;
      profile.reviewCount = profile.reviewCount || reviewData.reviewCount;
    }
    if (socialProfiles) profile.socialProfiles = socialProfiles;

    // Tech detection (requires website)
    if (profile.website) {
      try {
        const url = profile.website.startsWith("http")
          ? profile.website
          : `https://${profile.website}`;
        profile.techStack = await this.techDetector.detect(url);
      } catch (err) {
        console.error("[ProfileBuilder] Tech detection error:", err.message);
      }
    }

    // Sequential steps that depend on enriched data
    profile.revenue = this.revenueEngine.estimate(profile);
    profile.services = this.serviceClassifier.classify(profile);
    profile.constructionSignals = this.signalDetector.detect(profile);

    // Composite lead score
    profile.intelligenceScore = this._computeScore(profile);

    return profile;
  }

  _computeScore(profile) {
    let score = 0;
    if (profile.website) score += 10;
    if (profile.email) score += 15;
    if (profile.phone) score += 10;
    if ((profile.reviewCount || 0) > 10) score += 5;
    if ((profile.rating || 0) > 4) score += 10;
    if (profile.linkedin) score += 5;
    if (profile.constructionSignals?.opportunity_level === "HIGH") score += 20;
    else if (profile.constructionSignals?.opportunity_level === "MEDIUM")
      score += 10;
    if (profile.revenue?.confidence === "HIGH") score += 15;
    return score;
  }
}

module.exports = CompanyIntelligenceProfileBuilder;
