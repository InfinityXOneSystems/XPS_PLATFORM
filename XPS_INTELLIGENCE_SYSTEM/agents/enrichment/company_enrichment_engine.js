"use strict";

const axios = require("axios");
const cheerio = require("cheerio");

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const REQUEST_TIMEOUT_MS = 10000;

class CompanyEnrichmentEngine {
  async enrichLead(lead) {
    const enriched = { ...lead };
    if (!enriched.website) return enriched;

    try {
      const url = enriched.website.startsWith("http")
        ? enriched.website
        : `https://${enriched.website}`;

      const res = await axios.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)" },
        maxRedirects: 5,
      });
      const $ = cheerio.load(res.data);

      // Meta description
      const metaDesc =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        null;
      if (metaDesc) enriched.description = metaDesc.trim();

      // Emails from mailto links
      const emails = new Set();
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const email = href.replace("mailto:", "").split("?")[0].trim();
        if (email) emails.add(email);
      });

      // Emails from page text
      const bodyText = $("body").text();
      const textMatches = bodyText.match(EMAIL_REGEX) || [];
      textMatches.forEach((e) => emails.add(e));

      if (emails.size > 0) {
        enriched.email = [...emails][0];
        enriched.allEmails = [...emails];
      }

      // LinkedIn URL from links
      $('a[href*="linkedin.com"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        if (!enriched.linkedin && href.includes("/company/")) {
          enriched.linkedin = href;
        }
      });

      // Try contact page if no email found
      if (!enriched.email) {
        enriched.email = (await this._tryContactPage(url, $)) || null;
      }

      // Employee count heuristic from "about" text
      const aboutText = (
        $('#about, .about, [class*="about"]').text() || ""
      ).toLowerCase();
      const empMatch = aboutText.match(
        /(\d+)\+?\s*(employees?|staff|team members?)/,
      );
      if (empMatch) enriched.employeeCount = parseInt(empMatch[1], 10);
    } catch (err) {
      enriched.enrichmentError = err.message;
    }

    return enriched;
  }

  async _tryContactPage(baseUrl, $) {
    const contactHref = $('a[href*="contact"]').first().attr("href");
    if (!contactHref) return null;
    try {
      const contactUrl = contactHref.startsWith("http")
        ? contactHref
        : new URL(contactHref, baseUrl).href;
      const res = await axios.get(contactUrl, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)" },
      });
      const $c = cheerio.load(res.data);
      const emails = new Set();
      $c('a[href^="mailto:"]').each((_, el) => {
        const href = $c(el).attr("href") || "";
        const email = href.replace("mailto:", "").split("?")[0].trim();
        if (email) emails.add(email);
      });
      const textMatches = $c("body").text().match(EMAIL_REGEX) || [];
      textMatches.forEach((e) => emails.add(e));
      return emails.size > 0 ? [...emails][0] : null;
    } catch {
      return null;
    }
  }

  async enrichBatch(leads) {
    const AsyncScrapingEngine = require("../scraping/async_scraping_engine");
    const tasks = leads.map((lead) => () => this.enrichLead(lead));
    const results = await AsyncScrapingEngine.runBatch(tasks, 5);
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { ...leads[i], enrichmentError: r.reason?.message },
    );
  }
}

module.exports = CompanyEnrichmentEngine;
