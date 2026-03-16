"use strict";

require("dotenv").config();
const OpenAI = require("openai");

const TEMPLATES = {
  cold_outreach: {
    subject: (lead) => `Quick question for ${lead.name || "your team"}`,
    body: (lead) => `Hi ${lead.name || "there"},

I came across your ${lead.industry || "flooring"} business in ${lead.city || "your area"} and wanted to reach out.

We help ${lead.industry || "flooring"} contractors like you generate high-quality leads and grow their pipeline with our intelligence platform.

Would you be open to a 15-minute call this week to explore if it's a fit?

Best regards,
XPS Intelligence Team`,
  },

  follow_up: {
    subject: (lead) => `Following up — ${lead.name || "your business"}`,
    body: (lead) => `Hi ${lead.name || "there"},

I wanted to follow up on my previous message. I know things get busy in the ${lead.industry || "flooring"} industry, especially in ${lead.city || "your market"}.

I'd love to show you how contractors in your area are using our platform to land more jobs.

Are you available for a quick call this week?

Best,
XPS Intelligence Team`,
  },

  closing: {
    subject: (lead) => `Ready to move forward, ${lead.name || "team"}?`,
    body: (lead) => `Hi ${lead.name || "there"},

We've spoken about how XPS Intelligence can help grow your ${lead.industry || "flooring"} business in ${lead.city || "your city"}.

I wanted to check — are you ready to get started? We can have your first batch of leads ready within 24 hours.

Let me know and I'll get everything set up today.

Best,
XPS Intelligence Team`,
  },

  reengagement: {
    subject: (lead) => `Still interested, ${lead.name || "team"}?`,
    body: (lead) => `Hi ${lead.name || "there"},

It's been a while since we last connected. I wanted to reach back out because we've recently added new ${lead.city || "local"} ${lead.industry || "flooring"} leads to our database.

If growing your business is still a priority, I'd love to reconnect.

Would a quick 10-minute call work for you this week?

Best,
XPS Intelligence Team`,
  },
};

function buildHtml(subject, plainText) {
  const escaped = plainText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <p>${escaped}</p>
</body>
</html>`;
}

class AIEmailGenerator {
  constructor() {
    this._openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  async generateEmail(
    lead = {},
    emailType = "cold_outreach",
    customPrompt = null,
  ) {
    if (this._openai) {
      return this._generateWithAI(lead, emailType, customPrompt);
    }
    return this._generateFromTemplate(lead, emailType);
  }

  async _generateWithAI(lead, emailType, customPrompt) {
    const systemPrompt = `You are an expert B2B sales copywriter specializing in the flooring and construction industry.
Write concise, personalized, and professional outreach emails.
Always respond with valid JSON only: {"subject": "...", "body": "..."}`;

    const userPrompt =
      customPrompt ||
      `Write a ${emailType.replace(/_/g, " ")} email for:
Company: ${lead.name || "Unknown"}
Industry: ${lead.industry || "flooring contractor"}
City: ${lead.city || "Unknown"}
State: ${lead.state || ""}
Rating: ${lead.rating || "N/A"}
Reviews: ${lead.review_count || 0}

Keep the email under 150 words. Sound human and genuine. No fluff.`;

    try {
      const completion = await this._openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const raw = completion.choices[0].message.content.trim();
      const parsed = JSON.parse(
        raw.replace(/^```json\n?/, "").replace(/\n?```$/, ""),
      );
      const subject =
        parsed.subject || `Outreach for ${lead.name || "your business"}`;
      const body = parsed.body || raw;
      return {
        subject,
        body,
        html: buildHtml(subject, body),
        plain_text: body,
      };
    } catch (err) {
      console.error(
        "[AIEmailGenerator] OpenAI error, falling back to template:",
        err.message,
      );
      return this._generateFromTemplate(lead, emailType);
    }
  }

  _generateFromTemplate(lead, emailType) {
    const tpl = TEMPLATES[emailType] || TEMPLATES.cold_outreach;
    const subject = tpl.subject(lead);
    const body = tpl.body(lead);
    return { subject, body, html: buildHtml(subject, body), plain_text: body };
  }
}

module.exports = AIEmailGenerator;
