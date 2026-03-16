const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeWebsite(url) {
  try {
    let html = (await axios.get(url, { timeout: 8000 })).data;

    const $ = cheerio.load(html);

    let email = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);

    let phone = $("a[href^='tel']").text();

    return {
      email: email ? email[0] : "",
      phone: phone,
    };
  } catch (e) {
    return {};
  }
}

module.exports = scrapeWebsite;
