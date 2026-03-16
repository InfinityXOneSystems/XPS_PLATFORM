"use strict";
/**
 * Facebook Business Page Scraper
 *
 * Extracts public business information from Facebook pages using Playwright.
 * Only public, non-authenticated content is accessed.
 */

const { chromium } = require("playwright");

const DEFAULT_TIMEOUT = 30_000;

/**
 * Scrape a public Facebook business page.
 * @param {string} pageSlug  e.g. "acmeflooring" or full URL
 * @returns {Promise<object>}
 */
async function scrapeFacebookPage(pageSlug) {
  let browser;
  const url = pageSlug.startsWith("http")
    ? pageSlug
    : `https://www.facebook.com/${pageSlug}/about`;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      locale: "en-US",
    });
    const page = await context.newPage();

    // Dismiss cookie consent if present
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT,
    });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /allow|accept|ok/i.test(b.textContent),
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(1500);

    const name = await page
      .$eval("h1", (el) => el.textContent.trim())
      .catch(() => pageSlug);
    const phone = await page
      .$eval('[href^="tel:"]', (el) => el.textContent.trim())
      .catch(() => "");
    const website = await page
      .$eval('[href*="l.facebook.com/l.php"]', (el) => {
        const u = new URL(el.href);
        return u.searchParams.get("u") || "";
      })
      .catch(() => "");
    const address = await page
      .$$eval('[class*="address"] span', (els) =>
        els.map((e) => e.textContent.trim()).join(", "),
      )
      .catch(() => "");
    const email = await page
      .$eval('[href^="mailto:"]', (el) => el.href.replace("mailto:", ""))
      .catch(() => "");
    const about = await page
      .$eval('[id*="about"] p, .aboutSection p', (el) => el.textContent.trim())
      .catch(() => "");

    return {
      source: "facebook",
      company: name,
      phone,
      website,
      address,
      email,
      about,
      profileUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeFacebookBatch(slugs, concurrency = 2) {
  const results = [];
  const queue = [...slugs];

  async function worker() {
    while (queue.length > 0) {
      const slug = queue.shift();
      try {
        const lead = await scrapeFacebookPage(slug);
        results.push(lead);
        console.log(`[Facebook] ✓ ${lead.company}`);
      } catch (err) {
        console.error(`[Facebook] ✗ ${slug}: ${err.message}`);
        results.push({ source: "facebook", slug, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

module.exports = { scrapeFacebookPage, scrapeFacebookBatch };

if (require.main === module) {
  const slugs = process.argv.slice(2);
  if (!slugs.length) {
    console.error("Usage: node facebook_scraper.js <slug> [slug2 ...]");
    process.exit(1);
  }
  scrapeFacebookBatch(slugs).then((r) =>
    console.log(JSON.stringify(r, null, 2)),
  );
}
