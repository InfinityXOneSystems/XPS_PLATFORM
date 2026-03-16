const fs = require("fs");

const states = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
];

const categories = [
  "epoxy flooring contractor",
  "polished concrete contractor",
  "concrete polishing",
  "concrete floor coating",
  "industrial epoxy flooring",
  "commercial concrete polishing",
];

let queries = [];

states.forEach((s) => {
  categories.forEach((c) => {
    queries.push(c + " " + s);
  });
});

fs.writeFileSync(
  "data/national/search_queries.json",
  JSON.stringify(queries, null, 2),
);

console.log("Generated nationwide search queries:", queries.length);
