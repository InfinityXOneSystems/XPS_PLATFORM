"use strict";
/**
 * Instagram Business Account Scraper
 *
 * Extracts public business profile info from Instagram using Playwright.
 * Only public accounts are targeted.  No login required.
 */

const { chromium } = require("playwright");

const DEFAULT_TIMEOUT = 25_000;

/**
 * Scrape a public Instagram business account.
 * @param {string} handle  e.g. "acmeflooring" (no @)
 * @returns {Promise<object>}
 */
async function scrapeInstagram(handle) {
  let browser;
  const cleanHandle = handle.replace("@", "");
  const url = `https://www.instagram.com/${cleanHandle}/`;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT,
    });

    // Try to get shared_data JSON embedded in the page
    const sharedData = await page.evaluate(() => {
      const scripts = [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ];
      for (const s of scripts) {
        try {
          return JSON.parse(s.textContent);
        } catch (_) {}
      }
      return null;
    });

    let name = "",
      bio = "",
      website = "",
      followers = "",
      posts = "";

    if (sharedData) {
      name = sharedData.name || cleanHandle;
      bio = sharedData.description || "";
      website = sharedData.url || "";
      followers =
        sharedData.interactionStatistic
          ?.find((s) => s.interactionType?.includes("Follow"))
          ?.userInteractionCount?.toString() || "";
    } else {
      // Fallback: parse visible meta tags
      name = await page
        .$eval('meta[property="og:title"]', (el) => el.content)
        .catch(() => cleanHandle);
      bio = await page
        .$eval('meta[name="description"]', (el) => el.content)
        .catch(() => "");
    }

    return {
      source: "instagram",
      handle: cleanHandle,
      company: name,
      bio,
      website,
      followers,
      posts,
      profileUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeInstagramBatch(handles, concurrency = 2) {
  const results = [];
  const queue = [...handles];

  async function worker() {
    while (queue.length > 0) {
      const h = queue.shift();
      try {
        const lead = await scrapeInstagram(h);
        results.push(lead);
        console.log(`[Instagram] ✓ @${lead.handle}`);
      } catch (err) {
        console.error(`[Instagram] ✗ ${h}: ${err.message}`);
        results.push({ source: "instagram", handle: h, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

module.exports = { scrapeInstagram, scrapeInstagramBatch };

if (require.main === module) {
  const handles = process.argv.slice(2);
  if (!handles.length) {
    console.error("Usage: node instagram_scraper.js <handle> [handle2 ...]");
    process.exit(1);
  }
  scrapeInstagramBatch(handles).then((r) =>
    console.log(JSON.stringify(r, null, 2)),
  );
}
