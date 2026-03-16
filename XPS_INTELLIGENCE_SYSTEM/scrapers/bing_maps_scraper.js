"use strict";

const { chromium } = require("playwright");

const RESULT_LOAD_MS = 2000;
const MAX_RESULTS_PER_QUERY = 20;
const NAVIGATION_TIMEOUT_MS = 30000;

/**
 * Scrape Bing Maps for contractor leads matching a keyword in a given city/state.
 *
 * @param {string} keyword  - Search keyword, e.g. "epoxy flooring contractor"
 * @param {string} city     - City name, e.g. "Columbus"
 * @param {string} state    - State abbreviation, e.g. "OH"
 * @returns {Promise<Array>} Array of lead objects
 */
async function scrapeBingMaps(keyword, city, state) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const leads = [];

  try {
    const query = encodeURIComponent(`${keyword} ${city} ${state}`);
    const url = `https://www.bing.com/maps?q=${query}`;

    console.log(`[bing_maps] Searching: ${keyword} | ${city}, ${state}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForTimeout(RESULT_LOAD_MS);

    // Wait for the results list
    const listSelector = ".b_resultList, #b_results, .listings-container";
    try {
      await page.waitForSelector(listSelector, { timeout: 15000 });
    } catch (_) {
      console.warn(
        `[bing_maps] No results list found for: ${keyword} in ${city}, ${state}`,
      );
      return leads;
    }

    // Extract all listing cards; pass max and keyword into evaluate scope
    const rawLeads = await page.evaluate(
      ({ max, kw }) => {
        const cards = Array.from(
          document.querySelectorAll(
            '.entity-card, .listing-card, [class*="entityCard"]',
          ),
        ).slice(0, max);

        return cards.map((card) => {
          const company =
            card
              .querySelector('a[class*="title"], .entityCard-title, h2')
              ?.textContent?.trim() || "";
          const phone =
            card
              .querySelector('[class*="phone"], [data-cid*="phone"]')
              ?.textContent?.trim() || "";
          const website =
            card.querySelector('a[class*="website"], a[href*="http"]')?.href ||
            "";
          const address =
            card
              .querySelector('[class*="address"], .address')
              ?.textContent?.trim() || "";
          const ratingText =
            card.querySelector('[class*="rating"]')?.textContent?.trim() || "";
          const ratingMatch = ratingText.match(/([\d.]+)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
          const reviewsText =
            card
              .querySelector('[class*="review"]')
              ?.textContent?.replace(/,/g, "") || "";
          const reviewsMatch = reviewsText.match(/(\d+)/);
          const reviews = reviewsMatch ? parseInt(reviewsMatch[1], 10) : 0;
          const category =
            card.querySelector('[class*="category"]')?.textContent?.trim() ||
            "";

          return {
            company,
            phone,
            website,
            address,
            rating,
            reviews,
            category,
            keyword: kw,
          };
        });
      },
      { max: MAX_RESULTS_PER_QUERY, kw: keyword },
    );

    for (const lead of rawLeads) {
      if (lead.company) {
        leads.push({
          company: lead.company,
          phone: lead.phone,
          website: lead.website,
          address: lead.address,
          city,
          state,
          rating: lead.rating,
          reviews: lead.reviews,
          category: lead.category,
          keyword: lead.keyword,
          source: "bing_maps",
          scraped_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error(
      `[bing_maps] Fatal error for "${keyword}" in ${city}, ${state}: ${err.message}`,
    );
  } finally {
    await browser.close();
  }

  console.log(
    `[bing_maps] Collected ${leads.length} leads for "${keyword}" in ${city}, ${state}`,
  );
  return leads;
}

module.exports = { scrapeBingMaps };
