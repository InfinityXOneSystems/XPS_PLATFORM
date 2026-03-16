const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "../data/outreach/outreach_log.json");

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveLog(entries) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
}

function logOutreach(entry) {
  const entries = loadLog();
  entries.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  saveLog(entries);
  console.log(
    `[OutreachLog] ${entry.type} logged for lead ${entry.lead_id} (${entry.company})`,
  );
}

function getLogByLeadId(leadId) {
  return loadLog().filter((e) => String(e.lead_id) === String(leadId));
}

function getAllLog() {
  return loadLog();
}

module.exports = { logOutreach, getLogByLeadId, getAllLog };
