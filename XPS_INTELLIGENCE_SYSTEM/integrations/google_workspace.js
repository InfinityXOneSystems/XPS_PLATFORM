"use strict";

/**
 * Google Workspace Integration Module
 *
 * Provides connectors for:
 *  - Gmail (send/read outreach emails)
 *  - Google Sheets (export leads to spreadsheet)
 *  - Google Drive (store reports and exports)
 *  - Google Calendar (schedule scraping events)
 *
 * Requires environment variables:
 *  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *
 * Install: npm install googleapis
 */

const path = require("path");
const fs = require("fs");

// ── lazy googleapis import ─────────────────────────────────────────────────
function getGoogle() {
  try {
    return require("googleapis").google;
  } catch {
    throw new Error(
      "googleapis package not installed. Run: npm install googleapis",
    );
  }
}

// ── OAuth2 client factory ──────────────────────────────────────────────────
function createOAuthClient() {
  const google = getGoogle();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID, " +
        "GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables.",
    );
  }

  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob",
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

// ── Gmail ─────────────────────────────────────────────────────────────────

/**
 * Send an email via Gmail API.
 * @param {{ to: string, subject: string, body: string }} opts
 * @returns {Promise<object>} Gmail message resource
 */
async function gmailSendEmail({ to, subject, body }) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return result.data;
}

/**
 * List recent Gmail messages matching a query.
 * @param {{ query?: string, maxResults?: number }} opts
 * @returns {Promise<object[]>} Array of message metadata
 */
async function gmailListMessages({ query = "", maxResults = 20 } = {}) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });
  return res.data.messages || [];
}

// ── Google Sheets ─────────────────────────────────────────────────────────

/**
 * Create a new Google Sheets spreadsheet and populate it with leads.
 * @param {{ title?: string, leads: object[] }} opts
 * @returns {Promise<{ spreadsheetId: string, url: string }>}
 */
async function sheetsExportLeads({
  title = "XPS Lead Export",
  leads = [],
} = {}) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  // Build header row from first lead's keys (or a default set)
  const defaultHeaders = [
    "company",
    "phone",
    "email",
    "website",
    "city",
    "state",
    "rating",
    "reviews",
    "lead_score",
    "tier",
  ];
  const headers =
    leads.length > 0
      ? Object.keys(leads[0]).filter((k) => !k.startsWith("_"))
      : defaultHeaders;

  const rows = [
    headers,
    ...leads.map((lead) => headers.map((h) => lead[h] ?? "")),
  ];

  // Create spreadsheet
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `${title} — ${new Date().toISOString().split("T")[0]}`,
      },
      sheets: [{ properties: { title: "Leads" } }],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;

  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Leads!A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Append leads to an existing spreadsheet.
 * @param {{ spreadsheetId: string, leads: object[], sheetName?: string }} opts
 * @returns {Promise<object>} Append response
 */
async function sheetsAppendLeads({
  spreadsheetId,
  leads = [],
  sheetName = "Leads",
} = {}) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const headers =
    leads.length > 0
      ? Object.keys(leads[0]).filter((k) => !k.startsWith("_"))
      : [];

  const rows = leads.map((lead) => headers.map((h) => lead[h] ?? ""));

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
  return res.data;
}

// ── Google Drive ──────────────────────────────────────────────────────────

/**
 * Upload a file to Google Drive.
 * @param {{ name: string, filePath: string, mimeType?: string, folderId?: string }} opts
 * @returns {Promise<{ fileId: string, webViewLink: string }>}
 */
async function driveUploadFile({
  name,
  filePath,
  mimeType = "application/json",
  folderId,
} = {}) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const metadata = {
    name,
    parents: folderId ? [folderId] : [],
  };

  const res = await drive.files.create({
    requestBody: metadata,
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: "id, webViewLink",
  });

  return {
    fileId: res.data.id,
    webViewLink: res.data.webViewLink,
  };
}

/**
 * List files in a Google Drive folder.
 * @param {{ folderId?: string, query?: string, maxResults?: number }} opts
 * @returns {Promise<object[]>} Array of file metadata
 */
async function driveListFiles({ folderId, query, maxResults = 20 } = {}) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const q = [
    folderId ? `'${folderId}' in parents` : null,
    query || null,
    "trashed = false",
  ]
    .filter(Boolean)
    .join(" and ");

  const res = await drive.files.list({
    q,
    pageSize: maxResults,
    fields: "files(id, name, mimeType, webViewLink, modifiedTime)",
  });
  return res.data.files || [];
}

// ── Google Calendar ───────────────────────────────────────────────────────

/**
 * Create a calendar event to schedule a scraping run.
 * @param {{ summary?: string, startTime?: string, durationMinutes?: number }} opts
 * @returns {Promise<object>} Calendar event resource
 */
async function calendarScheduleScrape({
  summary = "XPS Lead Scraper Run",
  startTime,
  durationMinutes = 30,
} = {}) {
  const google = getGoogle();
  const auth = createOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const start = startTime ? new Date(startTime) : new Date();
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description:
        "Automated lead scraping run scheduled by XPS Lead Intelligence Platform.",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
  return res.data;
}

// ── Workspace status check ─────────────────────────────────────────────────

/**
 * Check if Google Workspace credentials are configured.
 * @returns {{ configured: boolean, missing: string[] }}
 */
function checkWorkspaceConfig() {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ];
  const missing = required.filter((k) => !process.env[k]);
  return {
    configured: missing.length === 0,
    missing,
  };
}

module.exports = {
  gmailSendEmail,
  gmailListMessages,
  sheetsExportLeads,
  sheetsAppendLeads,
  driveUploadFile,
  driveListFiles,
  calendarScheduleScrape,
  checkWorkspaceConfig,
};
