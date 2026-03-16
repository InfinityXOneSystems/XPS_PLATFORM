"use strict";
/**
 * Twitter / X Scraper — extracts public business profile information
 *
 * Targets public nitter instances (open-source Twitter front-end)
 * to avoid rate limits and login walls.  Falls back to direct
 * twitter.com scraping via Playwright if nitter is unavailable.
 *
 * NOTE: Only public, non-authenticated data is collected.
 */

const { chromium } = require("playwright");

const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
];

const DEFAULT_TIMEOUT = 25_000;

/**
 * Try to fetch from nitter; fall back to direct X.com
 */
async function scrapeTwitterProfile(handle, page) {
  for (const base of NITTER_INSTANCES) {
    try {
      const url = `${base}/${handle.replace("@", "")}`;
      const resp = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT,
      });
      if (resp && resp.status() < 400) return { via: "nitter", url };
    } catch (_) {
      /* try next */
    }
  }
  // direct fallback
  const url = `https://twitter.com/${handle.replace("@", "")}`;
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT,
  });
  return { via: "twitter", url };
}

/**
 * Scrape a Twitter/X business handle.
 * @param {string} handle  e.g. "@acmeflooring" or "acmeflooring"
 * @returns {Promise<object>}
 */
async function scrapeTwitter(handle) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    });
    const page = await context.newPage();
    const { url } = await scrapeTwitterProfile(handle, page);

    const name = await page
      .$eval('.profile-card-fullname, [data-testid="UserName"] span', (el) =>
        el.textContent.trim(),
      )
      .catch(() => handle);
    const bio = await page
      .$eval('.profile-card-bio, [data-testid="UserDescription"]', (el) =>
        el.textContent.trim(),
      )
      .catch(() => "");
    const website = await page
      .$eval(
        '.profile-card-website a, [data-testid="UserUrl"] a',
        (el) => el.href || el.textContent.trim(),
      )
      .catch(() => "");
    const location = await page
      .$eval(
        '.profile-card-location span, [data-testid="UserLocation"] span',
        (el) => el.textContent.trim(),
      )
      .catch(() => "");
    const followers = await page
      .$eval('.profile-stat-num, [href$="/followers"] span', (el) =>
        el.textContent.trim(),
      )
      .catch(() => "");

    return {
      source: "twitter",
      handle: handle.replace("@", ""),
      company: name,
      bio,
      website,
      location,
      followers,
      profileUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Scrape multiple handles in parallel.
 */
async function scrapeTwitterBatch(handles, concurrency = 3) {
  const results = [];
  const queue = [...handles];

  async function worker() {
    while (queue.length > 0) {
      const h = queue.shift();
      try {
        const lead = await scrapeTwitter(h);
        results.push(lead);
        console.log(`[Twitter] ✓ @${lead.handle}`);
      } catch (err) {
        console.error(`[Twitter] ✗ ${h}: ${err.message}`);
        results.push({ source: "twitter", handle: h, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

module.exports = { scrapeTwitter, scrapeTwitterBatch };

if (require.main === module) {
  const handles = process.argv.slice(2);
  if (!handles.length) {
    console.error("Usage: node twitter_scraper.js <handle> [handle2 ...]");
    process.exit(1);
  }
  scrapeTwitterBatch(handles).then((r) =>
    console.log(JSON.stringify(r, null, 2)),
  );
}
