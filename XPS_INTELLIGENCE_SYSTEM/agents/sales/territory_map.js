"use strict";

const fs = require("fs");
const path = require("path");

const LEADS_FILE = path.join(__dirname, "../../leads/leads.json");

// Hardcoded approximate coordinates for major US cities (lat, lng)
const CITY_COORDS = {
  "new york": [40.7128, -74.006],
  "los angeles": [34.0522, -118.2437],
  chicago: [41.8781, -87.6298],
  houston: [29.7604, -95.3698],
  phoenix: [33.4484, -112.074],
  philadelphia: [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "san diego": [32.7157, -117.1611],
  dallas: [32.7767, -96.797],
  "san jose": [37.3382, -121.8863],
  austin: [30.2672, -97.7431],
  jacksonville: [30.3322, -81.6557],
  "fort worth": [32.7555, -97.3308],
  columbus: [39.9612, -82.9988],
  charlotte: [35.2271, -80.8431],
  indianapolis: [39.7684, -86.1581],
  "san francisco": [37.7749, -122.4194],
  seattle: [47.6062, -122.3321],
  denver: [39.7392, -104.9903],
  nashville: [36.1627, -86.7816],
  oklahoma: [35.4676, -97.5164],
  "oklahoma city": [35.4676, -97.5164],
  "el paso": [31.7619, -106.485],
  washington: [38.9072, -77.0369],
  boston: [42.3601, -71.0589],
  memphis: [35.1495, -90.049],
  louisville: [38.2527, -85.7585],
  portland: [45.5051, -122.675],
  "las vegas": [36.1699, -115.1398],
  milwaukee: [43.0389, -87.9065],
  albuquerque: [35.0844, -106.6504],
  tucson: [32.2226, -110.9747],
  fresno: [36.7378, -119.7871],
  sacramento: [38.5816, -121.4944],
  mesa: [33.4152, -111.8315],
  atlanta: [33.749, -84.388],
  omaha: [41.2565, -95.9345],
  "colorado springs": [38.8339, -104.8214],
  raleigh: [35.7796, -78.6382],
  "long beach": [33.77, -118.1937],
  "virginia beach": [36.8529, -75.978],
  minneapolis: [44.9778, -93.265],
  tampa: [27.9506, -82.4572],
  miami: [25.7617, -80.1918],
  cleveland: [41.4993, -81.6944],
  "kansas city": [39.0997, -94.5786],
  aurora: [39.7294, -104.8319],
  "new orleans": [29.9511, -90.0715],
  "st. louis": [38.627, -90.1994],
  pittsburgh: [40.4406, -79.9959],
  cincinnati: [39.1031, -84.512],
  "salt lake city": [40.7608, -111.891],
  orlando: [28.5383, -81.3792],
  detroit: [42.3314, -83.0458],
  richmond: [37.5407, -77.4361],
  "baton rouge": [30.4515, -91.1871],
  birmingham: [33.5207, -86.8025],
};

class TerritoryMapEngine {
  _loadLeads() {
    try {
      const raw = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  _normalize(str = "") {
    return str.toLowerCase().trim();
  }

  /**
   * Groups leads by US state with counts and sample leads.
   * @returns {{ [state]: { count, leads: [] } }}
   */
  getLeadsByState() {
    const leads = this._loadLeads();
    const result = {};
    for (const lead of leads) {
      const state = this._normalize(lead.state || "Unknown");
      if (!result[state])
        result[state] = { state: lead.state || "Unknown", count: 0, leads: [] };
      result[state].count += 1;
      if (result[state].leads.length < 5)
        result[state].leads.push(lead.company_name || lead.name);
    }
    return result;
  }

  /**
   * Groups leads by city and attaches coordinates for map rendering.
   * @returns {Array<{ city, state, count, lat, lng, leads: [] }>}
   */
  getLeadsByCity() {
    const leads = this._loadLeads();
    const cityMap = {};

    for (const lead of leads) {
      const city = lead.city || "Unknown";
      const state = lead.state || "";
      const key = `${this._normalize(city)}|${this._normalize(state)}`;

      if (!cityMap[key]) {
        const coords = CITY_COORDS[this._normalize(city)] || null;
        cityMap[key] = {
          city,
          state,
          count: 0,
          lat: coords ? coords[0] : null,
          lng: coords ? coords[1] : null,
          leads: [],
        };
      }
      cityMap[key].count += 1;
      if (cityMap[key].leads.length < 5)
        cityMap[key].leads.push(lead.company_name || lead.name);
    }

    return Object.values(cityMap).sort((a, b) => b.count - a.count);
  }

  /**
   * Returns data suitable for a heatmap: cities with lat/lng and weight (lead count).
   * Only includes cities where coordinates are known.
   */
  getHeatmapData() {
    return this.getLeadsByCity()
      .filter((c) => c.lat !== null && c.lng !== null)
      .map((c) => ({
        lat: c.lat,
        lng: c.lng,
        weight: c.count,
        city: c.city,
        state: c.state,
      }));
  }

  /**
   * Returns detailed statistics for a specific state.
   * @param {string} state - Full state name or abbreviation
   */
  getTerritoryStats(state) {
    const leads = this._loadLeads();
    const stateNorm = this._normalize(state);

    const stateLeads = leads.filter(
      (l) =>
        this._normalize(l.state || "") === stateNorm ||
        this._normalize(l.state || "").startsWith(stateNorm),
    );

    if (!stateLeads.length)
      return { state, count: 0, cities: {}, industries: {} };

    const cities = {};
    const industries = {};
    let totalScore = 0;
    let scoredCount = 0;

    for (const lead of stateLeads) {
      const city = lead.city || "Unknown";
      cities[city] = (cities[city] || 0) + 1;

      const industry = lead.industry || lead.category || "Unknown";
      industries[industry] = (industries[industry] || 0) + 1;

      if (lead.score !== undefined && lead.score !== null) {
        totalScore += Number(lead.score);
        scoredCount += 1;
      }
    }

    return {
      state,
      count: stateLeads.length,
      averageScore:
        scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : null,
      topCity:
        Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      cities,
      industries,
    };
  }
}

module.exports = TerritoryMapEngine;
