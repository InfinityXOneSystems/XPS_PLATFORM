const { google } = require("googleapis");

async function createEvent() {
  const calendar = google.calendar({ version: "v3" });

  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: "Run Lead Scraper",
      start: { dateTime: new Date().toISOString() },
      end: { dateTime: new Date().toISOString() },
    },
  });
}

module.exports = { createEvent };
