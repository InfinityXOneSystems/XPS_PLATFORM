"use strict";

/**
 * directory_scraper.js
 *
 * Playwright-based scraper for contractor leads from popular contractor
 * directories: Angi (formerly Angie's List) and HomeAdvisor.
 *
 * Extracts: company name, phone, website, rating, review count, address,
 *           city, state, category.
 *
 * Environment variables (all optional):
 *   SCRAPER_RATE_LIMIT_MS – ms to wait between requests (default: 2000)
 *
 * Usage:
 *   const { scrapeAngi, scrapeHomeAdvisor } = require('./directory_scraper');
 *   const leads = await scrapeAngi('epoxy flooring', 'Columbus', 'OH');
 *   const leads = await scrapeHomeAdvisor('flooring contractor', 'Dallas', 'TX');
 */

const { chromium } = require("playwright");

const RESULT_LOAD_MS = 3000;
const MAX_RESULTS_PER_QUERY = 20;
const NAVIGATION_TIMEOUT_MS = 30_000;
const RATE_LIMIT_MS = parseInt(process.env.SCRAPER_RATE_LIMIT_MS || "2000", 10);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeContext(browser) {
  return browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

// ---------------------------------------------------------------------------
// Angi scraper
// ---------------------------------------------------------------------------

/**
 * Scrape Angi for contractor leads.
 *
 * @param {string} keyword  - Service keyword, e.g. "epoxy flooring"
 * @param {string} city     - City name
 * @param {string} state    - State abbreviation
 * @returns {Promise<Array>}
 */
async function scrapeAngi(keyword, city, state) {
  const browser = await chromium.launch({ headless: true });
  const context = await makeContext(browser);
  const page = await context.newPage();
  const leads = [];

  try {
    const task = encodeURIComponent(keyword);
    const url = `https://www.angi.com/companylist/us/${state.toLowerCase()}/${city.toLowerCase().replace(/\s+/g, "-")}/${task}.htm`;
    const fallbackUrl = `https://www.angi.com/nearme/${task}/in-${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}`;

    console.log(`[angi] Searching: ${keyword} | ${city}, ${state}`);

    let navigated = false;
    for (const target of [url, fallbackUrl]) {
      try {
        await page.goto(target, {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT_MS,
        });
        await page.waitForTimeout(RESULT_LOAD_MS);
        navigated = true;
        break;
      } catch (_) {
        // try next URL pattern
      }
    }

    if (!navigated) {
      console.warn(
        `[angi] Could not navigate to Angi for: ${keyword} in ${city}, ${state}`,
      );
      return leads;
    }

    await page
      .waitForSelector(
        '[class*="companyInfo"], [class*="provider-card"], [data-testid*="provider"]',
        { timeout: 12_000 },
      )
      .catch(() => {
        console.warn(
          `[angi] No cards found for: ${keyword} in ${city}, ${state}`,
        );
      });

    const rawLeads = await page.evaluate(
      ({ max, kw }) => {
        const results = [];
        const cards = Array.from(
          document.querySelectorAll(
            '[class*="providerCard"], [class*="companyInfo"], [data-testid*="provider-card"]',
          ),
        ).slice(0, max);

        for (const card of cards) {
          const company =
            card
              .querySelector(
                "h2, h3, [class*='companyName'], [class*='businessName']",
              )
              ?.textContent?.trim() || "";
          if (!company) continue;

          const ratingEl = card.querySelector(
            '[class*="rating"], [aria-label*="star"]',
          );
          const ratingText =
            ratingEl?.getAttribute("aria-label") || ratingEl?.textContent || "";
          const ratingMatch = ratingText.match(/([\d.]+)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

          const reviewEl = card.querySelector(
            '[class*="review"], [class*="ratingCount"]',
          );
          const reviewText = reviewEl?.textContent?.replace(/,/g, "") || "";
          const reviewsMatch = reviewText.match(/(\d+)/);
          const reviews = reviewsMatch ? parseInt(reviewsMatch[1], 10) : 0;

          const addressEl = card.querySelector(
            "address, [class*='address'], [class*='location']",
          );
          const address = addressEl?.textContent?.trim() || "";

          const phoneEl = card.querySelector(
            "[href^='tel:'], [class*='phone']",
          );
          const phone =
            phoneEl?.getAttribute("href")?.replace("tel:", "") ||
            phoneEl?.textContent?.trim() ||
            "";

          const websiteEl = card.querySelector(
            "a[href*='website'], a[class*='website']",
          );
          const website = websiteEl?.href || "";

          const catEl = card.querySelector(
            "[class*='category'], [class*='serviceType']",
          );
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
        source: "angi",
        scraped_at: new Date().toISOString(),
      });
    }

    await page.waitForTimeout(RATE_LIMIT_MS);
  } catch (err) {
    console.error(
      `[angi] Error for "${keyword}" in ${city}, ${state}: ${err.message}`,
    );
  } finally {
    await browser.close();
  }

  console.log(
    `[angi] Collected ${leads.length} leads for "${keyword}" in ${city}, ${state}`,
  );
  return leads;
}

// ---------------------------------------------------------------------------
// HomeAdvisor scraper
// ---------------------------------------------------------------------------

/**
 * Scrape HomeAdvisor for contractor leads.
 *
 * @param {string} keyword  - Service keyword, e.g. "flooring contractor"
 * @param {string} city     - City name
 * @param {string} state    - State abbreviation
 * @returns {Promise<Array>}
 */
async function scrapeHomeAdvisor(keyword, city, state) {
  const browser = await chromium.launch({ headless: true });
  const context = await makeContext(browser);
  const page = await context.newPage();
  const leads = [];

  try {
    const task = encodeURIComponent(keyword);
    const citySlug = `${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}`;
    const url = `https://www.homeadvisor.com/task.${task}.${citySlug}.html`;

    console.log(`[homeadvisor] Searching: ${keyword} | ${city}, ${state}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForTimeout(RESULT_LOAD_MS);

    await page
      .waitForSelector(
        '[class*="ProCard"], [class*="professional-card"], [data-testid*="pro-card"]',
        { timeout: 12_000 },
      )
      .catch(() => {
        console.warn(
          `[homeadvisor] No cards found for: ${keyword} in ${city}, ${state}`,
        );
      });

    const rawLeads = await page.evaluate(
      ({ max, kw }) => {
        const results = [];
        const cards = Array.from(
          document.querySelectorAll(
            '[class*="ProCard"], [class*="professional-card"], [data-testid*="pro-card"]',
          ),
        ).slice(0, max);

        for (const card of cards) {
          const company =
            card
              .querySelector(
                "h2, h3, [class*='business-name'], [class*='proName']",
              )
              ?.textContent?.trim() || "";
          if (!company) continue;

          const ratingEl = card.querySelector(
            '[class*="rating"], [aria-label*="star"]',
          );
          const ratingText =
            ratingEl?.getAttribute("aria-label") || ratingEl?.textContent || "";
          const ratingMatch = ratingText.match(/([\d.]+)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

          const reviewEl = card.querySelector(
            '[class*="review"], [class*="reviewCount"]',
          );
          const reviewText = reviewEl?.textContent?.replace(/,/g, "") || "";
          const reviewsMatch = reviewText.match(/(\d+)/);
          const reviews = reviewsMatch ? parseInt(reviewsMatch[1], 10) : 0;

          const addressEl = card.querySelector(
            "address, [class*='location'], [class*='city']",
          );
          const address = addressEl?.textContent?.trim() || "";

          const phoneEl = card.querySelector(
            "[href^='tel:'], [class*='phone']",
          );
          const phone =
            phoneEl?.getAttribute("href")?.replace("tel:", "") ||
            phoneEl?.textContent?.trim() ||
            "";

          const websiteEl = card.querySelector("a[href*='website']");
          const website = websiteEl?.href || "";

          const catEl = card.querySelector(
            "[class*='category'], [class*='serviceType']",
          );
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
        source: "homeadvisor",
        scraped_at: new Date().toISOString(),
      });
    }

    await page.waitForTimeout(RATE_LIMIT_MS);
  } catch (err) {
    console.error(
      `[homeadvisor] Error for "${keyword}" in ${city}, ${state}: ${err.message}`,
    );
  } finally {
    await browser.close();
  }

  console.log(
    `[homeadvisor] Collected ${leads.length} leads for "${keyword}" in ${city}, ${state}`,
  );
  return leads;
}

module.exports = { scrapeAngi, scrapeHomeAdvisor };
