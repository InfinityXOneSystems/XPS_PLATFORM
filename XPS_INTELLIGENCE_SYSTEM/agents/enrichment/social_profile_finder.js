"use strict";

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

class SocialProfileFinder {
  async findProfiles(lead) {
    const { name = "", city = "", state = "", website = null } = lead;
    const slug = slugify(name);
    const citySlug = slugify(city);

    const profiles = {
      facebook: null,
      instagram: null,
      twitter: null,
      linkedin: null,
      yelp: null,
    };

    if (!slug) return profiles;

    // Construct likely social URLs based on company name
    // NOTE: These are candidate URLs — not verified reachable.
    // TODO: Use each platform's official search API or a people-data provider
    //       to verify profile existence before storing.

    profiles.facebook = `https://www.facebook.com/${slug}`;
    profiles.instagram = `https://www.instagram.com/${slug}`;
    profiles.twitter = `https://twitter.com/${slug}`;
    profiles.linkedin = `https://www.linkedin.com/company/${slug}`;

    // Yelp URL includes city/state for better matching
    if (city && state) {
      const yelpCity = citySlug;
      const yelpState = state.toLowerCase().replace(/\s+/g, "-");
      profiles.yelp = `https://www.yelp.com/biz/${slug}-${yelpCity}-${yelpState}`;
    } else {
      profiles.yelp = `https://www.yelp.com/biz/${slug}`;
    }

    // If website is provided, look for social links from the site's footer/header
    if (website) {
      try {
        const axios = require("axios");
        const cheerio = require("cheerio");
        const url = website.startsWith("http") ? website : `https://${website}`;
        const res = await axios.get(url, {
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; XPSBot/1.0)" },
          maxRedirects: 5,
        });
        const $ = cheerio.load(res.data);
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href") || "";
          if (
            !profiles.facebook &&
            /facebook\.com\/(?!sharer|share)/i.test(href)
          )
            profiles.facebook = href;
          if (!profiles.instagram && /instagram\.com\//i.test(href))
            profiles.instagram = href;
          if (!profiles.twitter && /twitter\.com\/(?!intent)/i.test(href))
            profiles.twitter = href;
          if (!profiles.linkedin && /linkedin\.com\/company\//i.test(href))
            profiles.linkedin = href;
          if (!profiles.yelp && /yelp\.com\/biz\//i.test(href))
            profiles.yelp = href;
        });
      } catch {
        // Website fetch failed — keep constructed URLs
      }
    }

    return profiles;
  }
}

module.exports = SocialProfileFinder;
