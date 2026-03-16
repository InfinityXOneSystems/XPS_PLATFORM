"use strict";

// TODO: Replace mock data generation with real API integrations:
//   - Google Places API for Google reviews
//   - Yelp Fusion API for Yelp reviews
//   - Facebook Graph API for Facebook reviews

class ReviewAggregator {
  async aggregateForLead(lead) {
    const { name = "", city = "", state = "" } = lead;

    // Mock realistic data until real API keys are configured
    const seed = this._hashString(`${name}${city}${state}`);
    const rating = this._mockRating(seed);
    const reviewCount = this._mockReviewCount(seed);

    const sources = [];
    if (reviewCount > 0) {
      sources.push({
        source: "Google",
        rating,
        count: Math.floor(reviewCount * 0.6),
      });
    }
    if (reviewCount > 5) {
      sources.push({
        source: "Yelp",
        rating: Math.max(1, rating - 0.3),
        count: Math.floor(reviewCount * 0.3),
      });
    }
    if (reviewCount > 15) {
      sources.push({
        source: "Facebook",
        rating: Math.min(5, rating + 0.1),
        count: Math.floor(reviewCount * 0.1),
      });
    }

    return {
      rating,
      reviewCount,
      sources,
      lastUpdated: new Date(),
    };
  }

  _hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (h * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(h);
  }

  _mockRating(seed) {
    const ratings = [3.5, 4.0, 4.2, 4.5, 4.7, 4.8, 5.0];
    return ratings[seed % ratings.length];
  }

  _mockReviewCount(seed) {
    const counts = [0, 3, 7, 12, 24, 38, 55, 80, 120, 200];
    return counts[seed % counts.length];
  }
}

module.exports = ReviewAggregator;
