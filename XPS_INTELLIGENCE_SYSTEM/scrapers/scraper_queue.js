"use strict";

const fs = require("fs");
const path = require("path");

const LOCATIONS_FILE = path.join(
  __dirname,
  "../data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/locations.csv",
);
const KEYWORDS_FILE = path.join(
  __dirname,
  "../data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/keywords.csv",
);
const PROGRESS_FILE = path.join(__dirname, "../data/scraper_progress.json");

// Parse a CSV string into an array of objects.
// Handles RFC 4180 quoted fields (fields containing commas or newlines
// must be wrapped in double-quotes; embedded double-quotes are escaped as "").
function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((obj, h, i) => {
      obj[h] = values[i] !== undefined ? values[i] : "";
      return obj;
    }, {});
  });
}

// Split a single CSV line respecting double-quoted fields.
function splitCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Load all locations from CSV.
function loadLocations() {
  const content = fs.readFileSync(LOCATIONS_FILE, "utf8");
  return parseCsv(content);
}

// Load all search keywords from CSV.
function loadKeywords() {
  const content = fs.readFileSync(KEYWORDS_FILE, "utf8");
  return parseCsv(content);
}

// Load scraping progress (which location IDs have been completed).
function loadProgress() {
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(
        "[scraper_queue] Warning: could not read progress file:",
        err.message,
      );
    }
    return { completedIds: [], updatedAt: null };
  }
}

// Persist scraping progress.
function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Return the next batch of locations that have not yet been scraped.
// Optionally filter to a single state abbreviation (e.g. 'TX').
function getNextBatch(batchSize, stateFilter) {
  batchSize = batchSize || 10;
  const locations = loadLocations();
  const progress = loadProgress();
  const completed = new Set(progress.completedIds || []);

  let pending = locations.filter((loc) => !completed.has(loc.ID));
  if (stateFilter) {
    pending = pending.filter((loc) => loc.State === stateFilter);
  }
  return pending.slice(0, batchSize);
}

// Return specific locations by city+state pairs, regardless of progress state.
// targets can be:
//   - An array of { city, state } objects
//   - A comma-separated string in "City:State" format, e.g. "Rockford:IL,Columbus:OH,Tempe:AZ"
function getTargetCities(targets) {
  const locations = loadLocations();

  let pairs;
  if (typeof targets === "string") {
    pairs = targets.split(",").map((t) => {
      const [city, state] = t.trim().split(":");
      return { city: (city || "").trim(), state: (state || "").trim() };
    });
  } else {
    pairs = Array.isArray(targets) ? targets : [];
  }

  return locations.filter((loc) =>
    pairs.some(
      (t) =>
        t.city.toLowerCase() === loc.City.toLowerCase() &&
        t.state.toUpperCase() === loc.State.toUpperCase(),
    ),
  );
}

// Return all pending locations grouped by state.
function getPendingByState() {
  const locations = loadLocations();
  const progress = loadProgress();
  const completed = new Set(progress.completedIds || []);
  const pending = locations.filter((loc) => !completed.has(loc.ID));

  return pending.reduce((acc, loc) => {
    if (!acc[loc.State]) acc[loc.State] = [];
    acc[loc.State].push(loc);
    return acc;
  }, {});
}

// Mark a location ID as successfully scraped.
function markComplete(locationId) {
  const progress = loadProgress();
  if (!progress.completedIds.includes(locationId)) {
    progress.completedIds.push(locationId);
  }
  saveProgress(progress);
}

// Reset progress so all locations are scraped again on the next run.
function resetProgress() {
  saveProgress({ completedIds: [] });
  console.log(
    "[scraper_queue] Progress reset. All locations will be re-scraped.",
  );
}

// Build the full list of (location × keyword) search tasks for a given
// set of locations and keywords.
function generateSearchTasks(locations, keywords) {
  const tasks = [];
  for (const location of locations) {
    for (const keyword of keywords) {
      tasks.push({
        locationId: location.ID,
        city: location.City,
        state: location.State,
        country: location.Country,
        keyword: keyword.Keyword,
        category: keyword.Category,
      });
    }
  }
  return tasks;
}

// Return a summary of overall scraping coverage.
function getCoverageSummary() {
  const locations = loadLocations();
  const progress = loadProgress();
  const completed = new Set(progress.completedIds || []);

  const stateMap = {};
  for (const loc of locations) {
    if (!stateMap[loc.State]) stateMap[loc.State] = { total: 0, done: 0 };
    stateMap[loc.State].total += 1;
    if (completed.has(loc.ID)) stateMap[loc.State].done += 1;
  }

  return {
    totalLocations: locations.length,
    completedLocations: completed.size,
    pendingLocations: locations.length - completed.size,
    byState: stateMap,
  };
}

module.exports = {
  loadLocations,
  loadKeywords,
  loadProgress,
  saveProgress,
  getNextBatch,
  getTargetCities,
  getPendingByState,
  markComplete,
  resetProgress,
  generateSearchTasks,
  getCoverageSummary,
};
