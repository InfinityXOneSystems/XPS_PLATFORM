const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { parseCsv, renderTemplate } = require("./outreach_engine");
const { logOutreach, getLogByLeadId, getAllLog } = require("./outreach_log");

const LEADS_FILE = path.join(
  __dirname,
  "../data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/contractor_database.csv",
);
const TEMPLATES_FILE = path.join(__dirname, "templates/outreach_templates.csv");

// Number of days to wait before sending a follow-up
const FOLLOW_UP_DAYS = 3;

// How many follow-ups to send per lead before stopping
const MAX_FOLLOW_UPS = 2;

function daysBetween(dateStr) {
  const past = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - past) / (1000 * 60 * 60 * 24));
}

// Simulate sending an email for follow-up
function sendFollowUp(to, subject, body) {
  // TODO: integrate with SMTP or SendGrid using environment credentials
  console.log(`[FollowUpScheduler] Sending follow-up to: ${to}`);
  console.log(`  Subject : ${subject}`);
  console.log(`  Body    : ${body}`);
  return { success: true, simulated: true };
}

// Select follow-up template: use template 2 for first follow-up, template 3 for second
function selectFollowUpTemplate(templates, followUpCount) {
  const templateId = String(followUpCount + 2); // follow-up #1 → template 2, #2 → template 3
  return (
    templates.find((t) => t.Template_ID === templateId) ||
    templates[templates.length - 1]
  );
}

// Find leads that were initially contacted but need a follow-up
function getFollowUpCandidates(leads, allLog) {
  return leads.filter((lead) => {
    if (!lead.Email) return false;

    const leadLog = allLog.filter((e) => String(e.lead_id) === String(lead.ID));
    const initialOutreach = leadLog.filter(
      (e) => e.type === "initial_outreach" && e.result === "sent",
    );
    if (initialOutreach.length === 0) return false;

    const followUps = leadLog.filter(
      (e) => e.type === "follow_up" && e.result === "sent",
    );
    if (followUps.length >= MAX_FOLLOW_UPS) return false;

    // Use the most recent contact timestamp
    const allContacts = [...initialOutreach, ...followUps].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );
    const lastContact = allContacts[0];
    return daysBetween(lastContact.timestamp) >= FOLLOW_UP_DAYS;
  });
}

function runFollowUps() {
  console.log("[FollowUpScheduler] Checking for follow-up candidates...");

  if (!fs.existsSync(LEADS_FILE) || !fs.existsSync(TEMPLATES_FILE)) {
    console.log(
      "[FollowUpScheduler] Leads or templates file not found. Skipping.",
    );
    return { sent: 0 };
  }

  const leads = parseCsv(LEADS_FILE);
  const templates = parseCsv(TEMPLATES_FILE);
  if (templates.length === 0) return { sent: 0 };

  // Lazily load all log entries once
  const allLog = getAllLog();

  const candidates = getFollowUpCandidates(leads, allLog);
  console.log(
    `[FollowUpScheduler] ${candidates.length} lead(s) due for follow-up.`,
  );

  let sent = 0;
  candidates.forEach((lead) => {
    const leadLog = allLog.filter((e) => String(e.lead_id) === String(lead.ID));
    const followUps = leadLog.filter(
      (e) => e.type === "follow_up" && e.result === "sent",
    );
    const followUpNumber = followUps.length + 1;

    const template = selectFollowUpTemplate(templates, followUps.length);
    const subject = renderTemplate(template.Subject, lead);
    const body = renderTemplate(template.Message, lead);
    const result = sendFollowUp(lead.Email, subject, body);

    logOutreach({
      type: "follow_up",
      lead_id: lead.ID,
      company: lead.Company_Name,
      email: lead.Email,
      template_id: template.Template_ID,
      follow_up_number: followUpNumber,
      subject: subject,
      result: result.success ? "sent" : "failed",
      simulated: result.simulated || false,
    });

    sent++;
  });

  console.log(`[FollowUpScheduler] Follow-up run complete. Sent: ${sent}`);
  return { sent };
}

// Schedule: run follow-up check every day at 9:00 AM
function startScheduler() {
  console.log(
    "[FollowUpScheduler] Scheduler started. Follow-ups will run daily at 9:00 AM.",
  );
  cron.schedule("0 9 * * *", () => {
    console.log("[FollowUpScheduler] Running scheduled follow-up check...");
    runFollowUps();
  });
}

module.exports = { startScheduler, runFollowUps, getFollowUpCandidates };

// Start scheduler if run directly
if (require.main === module) {
  runFollowUps(); // run once immediately on start
  startScheduler();
}
