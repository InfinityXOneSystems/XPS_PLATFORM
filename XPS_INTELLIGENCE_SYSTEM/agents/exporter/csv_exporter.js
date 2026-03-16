const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const writer = createCsvWriter({
  path: "exports/leads_export.csv",
  header: [
    { id: "company", title: "COMPANY" },
    { id: "phone", title: "PHONE" },
    { id: "website", title: "WEBSITE" },
    { id: "rating", title: "RATING" },
    { id: "reviews", title: "REVIEWS" },
    { id: "address", title: "ADDRESS" },
    { id: "email", title: "EMAIL" },
    { id: "score", title: "SCORE" },
  ],
});

async function exportLeads(leads) {
  await writer.writeRecords(leads);

  console.log("Leads exported");
}

module.exports = exportLeads;
