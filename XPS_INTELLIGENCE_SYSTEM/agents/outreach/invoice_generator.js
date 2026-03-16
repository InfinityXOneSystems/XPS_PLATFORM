"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INVOICES_DIR = path.join(__dirname, "../../data/invoices");

// Tax rate — can be overridden via env
const TAX_RATE = parseFloat(process.env.INVOICE_TAX_RATE || "0.08");

class InvoiceGenerator {
  constructor() {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
    this._counter = this._loadCounter();
  }

  _counterFile() {
    return path.join(INVOICES_DIR, ".invoice_counter");
  }

  _loadCounter() {
    try {
      return parseInt(fs.readFileSync(this._counterFile(), "utf8"), 10) || 1000;
    } catch {
      return 1000;
    }
  }

  _nextInvoiceNumber() {
    this._counter += 1;
    fs.writeFileSync(this._counterFile(), String(this._counter));
    return `INV-${this._counter}`;
  }

  /**
   * Generates an invoice.
   * @param {Object} lead - Lead / customer object
   * @param {Array}  services - [{ description: String, quantity: Number, unitPrice: Number }]
   * @param {number} amount - Total amount (used if services array is empty)
   * @param {string} dueDate - ISO date string or human-readable date
   * @returns {{ invoiceNumber, html, filePath }}
   */
  generateInvoice(lead, services = [], amount = 0, dueDate = null) {
    const invoiceNumber = this._nextInvoiceNumber();
    const issueDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dueDateStr = dueDate
      ? new Date(dueDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        );

    const company = lead.company_name || lead.name || "Client";
    const city = lead.city || "";
    const state = lead.state || "";
    const location = [city, state].filter(Boolean).join(", ");

    // Build line items
    let lineItems =
      services.length > 0
        ? services
        : [
            {
              description: "Professional Services",
              quantity: 1,
              unitPrice: amount,
            },
          ];
    lineItems = lineItems.map((s) => ({
      description: s.description || "Service",
      quantity: Number(s.quantity) || 1,
      unitPrice: Number(s.unitPrice) || 0,
      lineTotal: (Number(s.quantity) || 1) * (Number(s.unitPrice) || 0),
    }));

    const subtotal = lineItems.reduce((sum, s) => sum + s.lineTotal, 0);
    const taxAmount = subtotal * TAX_RATE;
    const total = subtotal + taxAmount;

    const fmt = (n) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

    const lineRowsHtml = lineItems
      .map(
        (s) =>
          `<tr>
            <td>${s.description}</td>
            <td style="text-align:center">${s.quantity}</td>
            <td style="text-align:right">${fmt(s.unitPrice)}</td>
            <td style="text-align:right">${fmt(s.lineTotal)}</td>
          </tr>`,
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #b8860b; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b8860b; padding-bottom: 16px; margin-bottom: 24px; }
    .invoice-meta p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #b8860b; color: #fff; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    .totals { width: 280px; margin-left: auto; }
    .totals td { padding: 6px 10px; }
    .totals .grand-total { font-weight: bold; font-size: 1.1em; border-top: 2px solid #b8860b; }
    .footer { border-top: 1px solid #ccc; padding-top: 12px; font-size: 0.85em; color: #666; margin-top: 24px; }
    .status-badge { display: inline-block; background: #fef3cd; color: #856404; border: 1px solid #ffc107; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>INVOICE</h1>
      <p>${process.env.CONTACT_NAME || "XPS Intelligence"}</p>
      <p>${process.env.CONTACT_EMAIL || process.env.OUTREACH_EMAIL || "billing@xpsintelligence.com"}</p>
      ${process.env.CONTACT_PHONE ? `<p>${process.env.CONTACT_PHONE}</p>` : ""}
    </div>
    <div class="invoice-meta">
      <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
      <p><strong>Issue Date:</strong> ${issueDate}</p>
      <p><strong>Due Date:</strong> ${dueDateStr}</p>
      <p><span class="status-badge">UNPAID</span></p>
    </div>
  </div>

  <div style="margin-bottom:24px">
    <h3>Bill To</h3>
    <p><strong>${company}</strong>${location ? `<br />${location}` : ""}</p>
    ${lead.email ? `<p>${lead.email}</p>` : ""}
    ${lead.phone ? `<p>${lead.phone}</p>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineRowsHtml}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(subtotal)}</td></tr>
    <tr><td>Tax (${(TAX_RATE * 100).toFixed(0)}%)</td><td style="text-align:right">${fmt(taxAmount)}</td></tr>
    <tr class="grand-total"><td>Total Due</td><td style="text-align:right">${fmt(total)}</td></tr>
  </table>

  <div class="footer">
    <p>Please remit payment by <strong>${dueDateStr}</strong>. Late payments may incur a 1.5% monthly fee.</p>
    <p>Thank you for your business.</p>
  </div>
</body>
</html>`;

    const filePath = path.join(INVOICES_DIR, `invoice_${invoiceNumber}.html`);
    fs.writeFileSync(filePath, html, "utf8");

    return { invoiceNumber, html, filePath, subtotal, taxAmount, total };
  }
}

module.exports = InvoiceGenerator;
