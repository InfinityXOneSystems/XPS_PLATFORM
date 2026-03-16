"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROPOSALS_DIR = path.join(__dirname, "../../data/proposals");

class ProposalGenerator {
  constructor() {
    fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
  }

  /**
   * Generates a proposal for a lead.
   * @param {Object} lead - Lead data object
   * @param {string} serviceType - e.g. 'Epoxy Flooring', 'Concrete Polishing'
   * @param {Object} customFields - Optional overrides: { estimatedValue, terms, contactName, contactEmail, contactPhone }
   * @returns {{ id, html, text, filePath }}
   */
  generateProposal(lead, serviceType = "Flooring Services", customFields = {}) {
    const id = crypto.randomUUID();
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const company = lead.company_name || lead.name || "Valued Client";
    const city = lead.city || "";
    const state = lead.state || "";
    const location = [city, state].filter(Boolean).join(", ");

    const estimatedValue = customFields.estimatedValue || "$2,500 – $15,000";
    const terms =
      customFields.terms ||
      "Net 30 days from invoice date. 50% deposit required to schedule.";
    const contactName =
      customFields.contactName || process.env.CONTACT_NAME || "Sales Team";
    const contactEmail =
      customFields.contactEmail ||
      process.env.OUTREACH_EMAIL ||
      "sales@xpsintelligence.com";
    const contactPhone =
      customFields.contactPhone || process.env.CONTACT_PHONE || "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposal – ${company}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #b8860b; }
    .header { border-bottom: 3px solid #b8860b; padding-bottom: 12px; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .label { font-weight: bold; color: #555; }
    .value-box { background: #f9f5e3; border-left: 4px solid #b8860b; padding: 12px 16px; margin: 12px 0; font-size: 1.2em; }
    .footer { border-top: 1px solid #ccc; padding-top: 12px; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Service Proposal</h1>
    <p><span class="label">Date:</span> ${date}</p>
    <p><span class="label">Proposal ID:</span> ${id}</p>
  </div>

  <div class="section">
    <h2>Prepared For</h2>
    <p><strong>${company}</strong>${location ? `<br />${location}` : ""}</p>
    ${lead.email ? `<p>Email: ${lead.email}</p>` : ""}
    ${lead.phone ? `<p>Phone: ${lead.phone}</p>` : ""}
  </div>

  <div class="section">
    <h2>Service Description</h2>
    <p>We are pleased to present this proposal for <strong>${serviceType}</strong> services${location ? ` in the ${location} area` : ""}. Our team specializes in delivering high-quality results tailored to your business needs.</p>
    <p>Services include site preparation, material supply, professional installation, and post-installation cleanup and inspection.</p>
  </div>

  <div class="section">
    <h2>Estimated Project Value</h2>
    <div class="value-box">${estimatedValue}</div>
    <p>Final pricing will be confirmed after an on-site assessment. This estimate is based on standard project scope and may vary based on site conditions.</p>
  </div>

  <div class="section">
    <h2>Terms &amp; Conditions</h2>
    <p>${terms}</p>
  </div>

  <div class="section">
    <h2>Next Steps</h2>
    <ol>
      <li>Review this proposal and reach out with any questions.</li>
      <li>Schedule a free on-site consultation.</li>
      <li>Receive a final, itemized quote.</li>
      <li>Sign agreement and submit deposit to secure your project date.</li>
    </ol>
  </div>

  <div class="footer">
    <p><strong>Contact Us</strong><br />
    ${contactName}<br />
    ${contactEmail ? `Email: ${contactEmail}<br />` : ""}
    ${contactPhone ? `Phone: ${contactPhone}` : ""}
    </p>
    <p>This proposal is valid for 30 days from the date above.</p>
  </div>
</body>
</html>`;

    const text = `SERVICE PROPOSAL
================
Date: ${date}
Proposal ID: ${id}

Prepared For: ${company}${location ? ` | ${location}` : ""}
${lead.email ? `Email: ${lead.email}` : ""}
${lead.phone ? `Phone: ${lead.phone}` : ""}

SERVICE: ${serviceType}
We propose professional ${serviceType} services tailored to your business.

ESTIMATED VALUE: ${estimatedValue}

TERMS: ${terms}

CONTACT: ${contactName} | ${contactEmail}${contactPhone ? ` | ${contactPhone}` : ""}

This proposal is valid for 30 days.`;

    const filePath = path.join(PROPOSALS_DIR, `proposal_${id}.html`);
    fs.writeFileSync(filePath, html, "utf8");

    return { id, html, text, filePath };
  }
}

module.exports = ProposalGenerator;
