"use strict";
/**
 * LinkedIn Scraper — extracts company pages and employee listings
 *
 * Uses Playwright in headless mode.  Results are normalized to the
 * platform's lead schema.
 *
 * NOTE: Respect robots.txt and LinkedIn's Terms of Service.  Only use
 *       this scraper on publicly accessible, non-gated pages.
 */

const { chromium } = require("playwright");

const DEFAULT_TIMEOUT = 30_000;

/**
 * Scrape a LinkedIn company page.
 * @param {string} companySlug  e.g. "acme-flooring"
 * @returns {Promise<object>}   normalized lead object
 */
async function scrapeLinkedInCompany(companySlug) {
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
    const url = `https://www.linkedin.com/company/${companySlug}/about/`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT,
    });

    // Basic public company info (visible without login on some pages)
    const name = await page
      .$eval("h1", (el) => el.textContent.trim())
      .catch(() => "");
    const tagline = await page
      .$eval(".org-top-card-summary__tagline", (el) => el.textContent.trim())
      .catch(() => "");
    const website = await page
      .$eval('[data-field="website"] a', (el) => el.href)
      .catch(() => "");
    const industry = await page
      .$eval(".org-top-card-summary-info-list__info-item", (el) =>
        el.textContent.trim(),
      )
      .catch(() => "");
    const size = await page
      .$$eval(
        ".org-about-company-module__company-size-definition-text span",
        (els) => els.map((e) => e.textContent.trim()).join(" "),
      )
      .catch(() => "");
    const description = await page
      .$eval(".org-about-us-organization-description__text", (el) =>
        el.textContent.trim(),
      )
      .catch(() => "");

    return {
      source: "linkedin",
      company: name || companySlug,
      website,
      industry,
      tagline,
      employees: size,
      description,
      profileUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Scrape multiple LinkedIn company pages in parallel.
 * @param {string[]} slugs
 * @param {number}   concurrency
 * @returns {Promise<object[]>}
 */
async function scrapeLinkedInBatch(slugs, concurrency = 3) {
  const results = [];
  const queue = [...slugs];

  async function worker() {
    while (queue.length > 0) {
      const slug = queue.shift();
      try {
        const lead = await scrapeLinkedInCompany(slug);
        results.push(lead);
        console.log(`[LinkedIn] ✓ ${lead.company}`);
      } catch (err) {
        console.error(`[LinkedIn] ✗ ${slug}: ${err.message}`);
        results.push({ source: "linkedin", company: slug, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

module.exports = { scrapeLinkedInCompany, scrapeLinkedInBatch };

/* CLI usage: node scrapers/social/linkedin_scraper.js acme-flooring */
if (require.main === module) {
  const slugs = process.argv.slice(2);
  if (!slugs.length) {
    console.error("Usage: node linkedin_scraper.js <slug> [slug2 ...]");
    process.exit(1);
  }
  scrapeLinkedInBatch(slugs).then((r) =>
    console.log(JSON.stringify(r, null, 2)),
  );
}
