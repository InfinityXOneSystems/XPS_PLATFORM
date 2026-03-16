const axios = require("axios");

async function findEmails(url) {
  try {
    let html = (await axios.get(url, { timeout: 5000 })).data;

    let emails = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);

    return emails;
  } catch (e) {
    return [];
  }
}

module.exports = findEmails;
