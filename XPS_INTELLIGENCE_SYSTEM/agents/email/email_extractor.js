const axios = require("axios");

async function extractEmails(url) {
  try {
    let res = await axios.get(url);

    let matches = res.data.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);

    return matches;
  } catch (e) {
    return null;
  }
}

module.exports = extractEmails;
