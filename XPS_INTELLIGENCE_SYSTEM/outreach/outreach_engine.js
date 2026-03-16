const fs = require("fs");
const path = require("path");
const { logOutreach } = require("./outreach_log");

const LEADS_FILE = path.join(
  __dirname,
  "../data/datasets/XPS_LEAD_INTELLIGENCE_SYSTEM/contractor_database.csv",
);
const TEMPLATES_FILE = path.join(__dirname, "templates/outreach_templates.csv");

// Parse a CSV line handling quoted fields
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Parse CSV file into array of objects using the header row
function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  // Strip BOM if present
  const content = raw.replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || "").trim();
    });
    return obj;
  });
}

// Render a template by replacing {{variable}} placeholders with lead data
function renderTemplate(template, lead) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    // Map common template keys to lead fields
    const fieldMap = {
      name: lead.Contact_Name || lead.Company_Name || "there",
      company: lead.Company_Name || "",
      city: lead.City || "",
      email: lead.Email || "",
      phone: lead.Phone || "",
    };
    return fieldMap[key] !== undefined ? fieldMap[key] : match;
  });
}

// Simulate sending an email (replace with SMTP/SendGrid in production)
function sendEmail(to, subject, body, lead) {
  // TODO: integrate with SMTP or SendGrid using environment credentials
  // Example: nodemailer.createTransport({ host: process.env.SMTP_HOST, ... })
  console.log(`[OutreachEngine] Sending email to: ${to}`);
  console.log(`  Subject : ${subject}`);
  console.log(`  Body    : ${body}`);
  return { success: true, simulated: true };
}

// Select the best template for a given lead (uses template 1 for first contact)
function selectTemplate(templates, lead) {
  return templates.find((t) => t.Template_ID === "1") || templates[0];
}

// Load leads eligible for first outreach (Status is empty or 'new')
function getEligibleLeads(leads) {
  return leads.filter((lead) => {
    const status = (lead.Status || "").toLowerCase();
    return status === "" || status === "new";
  });
}

// Main outreach run: load leads, select template, send outreach, log results
function runOutreach() {
  console.log("[OutreachEngine] Starting outreach run...");

  if (!fs.existsSync(LEADS_FILE)) {
    console.log("[OutreachEngine] Leads file not found:", LEADS_FILE);
    return { sent: 0, skipped: 0 };
  }

  if (!fs.existsSync(TEMPLATES_FILE)) {
    console.log("[OutreachEngine] Templates file not found:", TEMPLATES_FILE);
    return { sent: 0, skipped: 0 };
  }

  const leads = parseCsv(LEADS_FILE);
  const templates = parseCsv(TEMPLATES_FILE);

  if (templates.length === 0) {
    console.log("[OutreachEngine] No templates found.");
    return { sent: 0, skipped: 0 };
  }

  const eligible = getEligibleLeads(leads);
  console.log(
    `[OutreachEngine] ${eligible.length} eligible lead(s) out of ${leads.length} total.`,
  );

  let sent = 0;
  let skipped = 0;

  eligible.forEach((lead) => {
    if (!lead.Email) {
      console.log(
        `[OutreachEngine] Skipping lead ${lead.ID} (${lead.Company_Name}) — no email address.`,
      );
      skipped++;
      return;
    }

    const template = selectTemplate(templates, lead);
    const subject = renderTemplate(template.Subject, lead);
    const body = renderTemplate(template.Message, lead);
    const result = sendEmail(lead.Email, subject, body, lead);

    logOutreach({
      type: "initial_outreach",
      lead_id: lead.ID,
      company: lead.Company_Name,
      email: lead.Email,
      template_id: template.Template_ID,
      subject: subject,
      result: result.success ? "sent" : "failed",
      simulated: result.simulated || false,
    });

    sent++;
  });

  console.log(
    `[OutreachEngine] Outreach complete. Sent: ${sent}, Skipped: ${skipped}`,
  );
  return { sent, skipped };
}

module.exports = {
  runOutreach,
  runOutreachCampaign: runOutreach, // alias for pipeline compatibility
  parseCsv,
  renderTemplate,
  selectTemplate,
  getEligibleLeads,
};

// Run directly if called as main script
if (require.main === module) {
  runOutreach();
}
