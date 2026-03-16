"use strict";

const fs = require("fs");
const path = require("path");

// Target cities for export: [city name, state abbreviation]
const TARGET_CITIES = [
  { city: "Columbus", state: "OH" },
  { city: "Tempe", state: "AZ" },
  { city: "Rockford", state: "IL" },
];

const ROOT = path.resolve(__dirname, "..");

// Prefer primary leads/ folder, fall back to data/leads/
function resolveLeadFile(filename) {
  const primary = path.join(ROOT, "leads", filename);
  const legacy = path.join(ROOT, "data", "leads", filename);
  return fs.existsSync(primary) ? primary : legacy;
}

// Prefer scored leads; fall back to raw leads.
const leadsFile = resolveLeadFile("scored_leads.json");
const fallbackFile = resolveLeadFile("leads.json");

let leads = [];
try {
  leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
} catch {
  try {
    leads = JSON.parse(fs.readFileSync(fallbackFile, "utf8"));
  } catch {
    console.warn("[city_export] No leads file found — writing empty exports.");
  }
}

// Create exports directory.
const exportDir = path.resolve(__dirname, "..", "data", "exports");
fs.mkdirSync(exportDir, { recursive: true });

const CSV_HEADERS = [
  "company",
  "phone",
  "email",
  "website",
  "address",
  "city",
  "state",
  "rating",
  "reviews",
  "lead_score",
  "tier",
];

function escapeCsvField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvRow(lead) {
  return CSV_HEADERS.map((h) => escapeCsvField(lead[h] ?? "")).join(",");
}

const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

for (const { city, state } of TARGET_CITIES) {
  // Match on city name (case-insensitive) and state abbreviation.
  const filtered = leads.filter((l) => {
    const lCity = (l.city || "").trim();
    const lState = (l.state || "").trim().toUpperCase();
    return (
      lCity.toLowerCase() === city.toLowerCase() &&
      lState === state.toUpperCase()
    );
  });

  const slug = `${city.toLowerCase().replace(/\s+/g, "_")}_${state.toLowerCase()}`;

  // Write CSV
  const csvPath = path.join(exportDir, `leads_${slug}_${date}.csv`);
  const csvContent =
    [CSV_HEADERS.join(","), ...filtered.map(buildCsvRow)].join("\n") + "\n";
  fs.writeFileSync(csvPath, csvContent, "utf8");

  // Write Markdown summary
  const mdPath = path.join(exportDir, `summary_${slug}.md`);
  const hotCount = filtered.filter((l) => l.tier === "HOT").length;
  const warmCount = filtered.filter((l) => l.tier === "WARM").length;
  const coldCount = filtered.filter((l) => l.tier === "COLD").length;
  const mdContent = [
    `# Lead Export — ${city}, ${state}`,
    "",
    `> Generated: ${date}`,
    "",
    `**Total leads:** ${filtered.length}`,
    "",
    `| Tier | Count |`,
    `|------|-------|`,
    `| HOT  | ${hotCount}  |`,
    `| WARM | ${warmCount} |`,
    `| COLD | ${coldCount} |`,
    "",
    filtered.length > 0
      ? `## Top Leads\n\n| Company | Phone | Website | Score |\n|---------|-------|---------|-------|\n` +
        filtered
          .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
          .slice(0, 20)
          .map(
            (l) =>
              `| ${escapeCsvField(l.company)} | ${l.phone || ""} | ${l.website || ""} | ${l.lead_score || 0} |`,
          )
          .join("\n")
      : "_No leads found for this city yet._",
    "",
  ].join("\n");

  fs.writeFileSync(mdPath, mdContent, "utf8");

  console.log(
    `[city_export] ${city}, ${state}: ${filtered.length} leads → ${csvPath}`,
  );
}
