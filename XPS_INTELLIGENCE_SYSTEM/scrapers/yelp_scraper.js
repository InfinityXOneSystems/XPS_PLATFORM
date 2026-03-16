"use strict";

/**
 * yelp_scraper.js
 *
 * Playwright-based scraper for contractor leads from Yelp.
 *
 * Extracts: company name, phone, website, rating, review count, address,
 *           city, state, category.
 *
 * Environment variables (all optional):
 *   SCRAPER_RATE_LIMIT_MS – ms to wait between requests (default: 2000)
 *
 * Usage:
 *   const { scrapeYelp } = require('./yelp_scraper');
 *   const leads = await scrapeYelp('epoxy flooring contractor', 'Columbus', 'OH');
 */

const { chromium } = require("playwright");

const RESULT_LOAD_MS = 3000;
const MAX_RESULTS_PER_QUERY = 20;
const NAVIGATION_TIMEOUT_MS = 30_000;
const RATE_LIMIT_MS = parseInt(process.env.SCRAPER_RATE_LIMIT_MS || "2000", 10);

/**
 * Scrape Yelp for contractor leads matching a keyword in a given city/state.
 *
 * @param {string} keyword  - Search keyword, e.g. "epoxy flooring contractor"
 * @param {string} city     - City name, e.g. "Columbus"
 * @param {string} state    - State abbreviation, e.g. "OH"
 * @returns {Promise<Array>} Array of lead objects
 */
async function scrapeYelp(keyword, city, state) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const page = await context.newPage();
  const leads = [];

  try {
    const location = encodeURIComponent(`${city}, ${state}`);
    const term = encodeURIComponent(keyword);
    const url = `https://www.yelp.com/search?find_desc=${term}&find_loc=${location}`;

    console.log(`[yelp] Searching: ${keyword} | ${city}, ${state}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForTimeout(RESULT_LOAD_MS);

    // Wait for at least one business card to appear
    await page
      .waitForSelector(
        '[data-testid*="serp-ia-card"], li[data-testid], .businessName__09f24__',
        { timeout: 12_000 },
      )
      .catch(() => {
        console.warn(
          `[yelp] No result cards found for: ${keyword} in ${city}, ${state}`,
        );
      });

    // Extract listing data from the DOM
    const rawLeads = await page.evaluate(
      ({ max, kw }) => {
        const results = [];

        // Yelp renders business cards as <li> items inside the search results
        const cards = Array.from(
          document.querySelectorAll(
            'ul[class*="list__"] > li, li[data-testid]',
          ),
        ).slice(0, max);

        for (const card of cards) {
          // Company name – inside an <a> or <h3>/<h4>
          const nameEl =
            card.querySelector('[class*="businessName"] a') ||
            card.querySelector("h3 a, h4 a");
          const company = nameEl?.textContent?.trim() || "";
          if (!company) continue;

          // Rating – aria-label="X star rating" or text like "4.5"
          const ratingEl = card.querySelector(
            '[aria-label*="star rating"], [class*="rating"]',
          );
          const ratingLabel = ratingEl?.getAttribute("aria-label") || "";
          const ratingMatch =
            ratingLabel.match(/([\d.]+)/) ||
            (ratingEl?.textContent || "").match(/([\d.]+)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

          // Review count
          const reviewEl = card.querySelector(
            '[class*="reviewCount"], [aria-label*="review"]',
          );
          const reviewText =
            reviewEl?.getAttribute("aria-label") || reviewEl?.textContent || "";
          const reviewsMatch = reviewText.replace(/,/g, "").match(/(\d+)/);
          const reviews = reviewsMatch ? parseInt(reviewsMatch[1], 10) : 0;

          // Address / neighbourhood snippet
          const addressEl = card.querySelector(
            '[class*="secondaryAttributes"] address, address, [class*="neighborhood"]',
          );
          const address = addressEl?.textContent?.trim() || "";

          // Phone (may not be visible in search results)
          const phoneEl = card.querySelector(
            '[class*="phone"], [href^="tel:"]',
          );
          const phone =
            phoneEl?.getAttribute("href")?.replace("tel:", "") ||
            phoneEl?.textContent?.trim() ||
            "";

          // Website link
          const websiteEl = card.querySelector(
            'a[href*="biz_redir"], a[class*="website"]',
          );
          const website = websiteEl?.href || "";

          // Category
          const catEl = card.querySelector('[class*="priceCategory"] span');
          const category = catEl?.textContent?.trim() || "";

          results.push({
            company,
            phone,
            website,
            address,
            rating,
            reviews,
            category,
            keyword: kw,
          });
        }
        return results;
      },
      { max: MAX_RESULTS_PER_QUERY, kw: keyword },
    );

    for (const lead of rawLeads) {
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
        source: "yelp",
        scraped_at: new Date().toISOString(),
      });
    }

    // Respectful rate limit
    await page.waitForTimeout(RATE_LIMIT_MS);
  } catch (err) {
    console.error(
      `[yelp] Error for "${keyword}" in ${city}, ${state}: ${err.message}`,
    );
  } finally {
    await browser.close();
  }

  console.log(
    `[yelp] Collected ${leads.length} leads for "${keyword}" in ${city}, ${state}`,
  );
  return leads;
}

module.exports = { scrapeYelp };
