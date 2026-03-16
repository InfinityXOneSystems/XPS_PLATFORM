"use strict";

const axios = require("axios");

const REQUEST_TIMEOUT_MS = 10000;

const SIGNATURES = [
  {
    name: "WordPress",
    pattern: /wp-content|wp-includes|wordpress/i,
    category: "cms",
  },
  {
    name: "Shopify",
    pattern: /cdn\.shopify\.com|shopify\.com\/s\//i,
    category: "ecommerce",
  },
  { name: "Wix", pattern: /wix\.com|wixstatic\.com/i, category: "cms" },
  {
    name: "Squarespace",
    pattern: /squarespace\.com|static1\.squarespace/i,
    category: "cms",
  },
  {
    name: "React",
    pattern: /react(?:\.min)?\.js|__reactFiber|data-reactroot/i,
    category: "framework",
  },
  {
    name: "Angular",
    pattern: /angular(?:\.min)?\.js|ng-version|ng-app/i,
    category: "framework",
  },
  {
    name: "Vue",
    pattern: /vue(?:\.min)?\.js|__vue__|data-v-/i,
    category: "framework",
  },
  {
    name: "jQuery",
    pattern: /jquery(?:\.min)?\.js|jQuery\(/i,
    category: "library",
  },
  {
    name: "Bootstrap",
    pattern: /bootstrap(?:\.min)?\.(?:js|css)/i,
    category: "library",
  },
  {
    name: "Tailwind",
    pattern: /tailwind(?:\.min)?\.css|tailwindcss/i,
    category: "library",
  },
  {
    name: "PHP",
    pattern: /\.php["'\s>?]|X-Powered-By:\s*PHP/i,
    category: "language",
  },
  {
    name: "Google Analytics",
    pattern: /google-analytics\.com\/analytics|gtag\(|UA-\d{4,}/i,
    category: "analytics",
  },
  {
    name: "Facebook Pixel",
    pattern: /connect\.facebook\.net|fbq\(|facebook-pixel/i,
    category: "analytics",
  },
];

class TechnologyStackDetector {
  async detect(url) {
    const result = {
      url,
      technologies: [],
      cms: null,
      analytics: [],
      ecommerce: null,
    };

    try {
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
      const res = await axios.get(normalizedUrl, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)" },
        maxRedirects: 5,
      });

      const html = res.data || "";
      const poweredBy = res.headers["x-powered-by"] || "";
      const combined = html + "\n" + poweredBy;

      for (const sig of SIGNATURES) {
        if (sig.pattern.test(combined)) {
          result.technologies.push(sig.name);
          if (sig.category === "cms" && !result.cms) result.cms = sig.name;
          if (sig.category === "analytics") result.analytics.push(sig.name);
          if (sig.category === "ecommerce" && !result.ecommerce)
            result.ecommerce = sig.name;
        }
      }
    } catch (err) {
      result.error = err.message;
    }

    return result;
  }
}

module.exports = TechnologyStackDetector;
