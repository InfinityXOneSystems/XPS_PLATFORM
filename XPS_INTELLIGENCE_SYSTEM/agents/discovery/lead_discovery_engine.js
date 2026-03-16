const fs = require("fs");

const queries = require("../../data/national/search_queries.json");

function discover() {
  queries.forEach((q) => {
    console.log("Searching:", q);
  });
}

discover();
