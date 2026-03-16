"use strict";

const SCRIPT_TYPES = [
  "cold_call",
  "follow_up",
  "closing",
  "objection_handling",
];

class SalesScriptGenerator {
  /**
   * Generates a personalized sales script for a lead.
   * @param {Object} lead
   * @param {string} scriptType - 'cold_call'|'follow_up'|'closing'|'objection_handling'
   * @returns {{ opening, body, closing, objections, full_script }}
   */
  generateScript(lead, scriptType = "cold_call") {
    if (!SCRIPT_TYPES.includes(scriptType)) {
      throw new Error(
        `Invalid scriptType. Must be one of: ${SCRIPT_TYPES.join(", ")}`,
      );
    }

    const company = lead.company_name || lead.name || "your company";
    const city = lead.city || "your area";
    const state = lead.state || "";
    const location = [city, state].filter(Boolean).join(", ");
    const industry =
      lead.industry || lead.category || "flooring and construction";
    const rating = lead.rating ? ` (rated ${lead.rating}★)` : "";
    const rep = process.env.CONTACT_NAME || "our team";
    const ourCompany = process.env.COMPANY_NAME || "XPS Intelligence";

    let opening, body, closing;
    const objections = this._buildObjections(company, industry, location);

    switch (scriptType) {
      case "cold_call":
        opening = `Hi, may I speak with the owner or manager at ${company}? 
Hi there, my name is [Your Name] with ${ourCompany}. I'm reaching out to ${company}${rating} because we help ${industry} contractors in ${location} win more high-value jobs — I wanted to take 60 seconds to share how.`;

        body = `We work specifically with contractors like you in ${location} to connect them with pre-qualified leads who are actively searching for ${industry} services.

Most of our clients see an increase in booked jobs within the first 30 days. We handle the lead generation so you can focus on the work.

We have a few open spots in the ${location} area this month and thought ${company} would be a great fit based on your reputation${rating}.`;

        closing = `I'd love to set up a quick 15-minute call to walk you through what we're seeing in your market. 
Would [day] or [day] work better for you?

If they're busy: "No problem at all — can I send you a quick overview by email and follow up next week?"`;
        break;

      case "follow_up":
        opening = `Hi, this is [Your Name] from ${ourCompany} — I reached out to ${company} last week about lead generation for ${industry} contractors in ${location}. I wanted to follow up and see if you had a chance to look over what I sent.`;

        body = `I know things get busy, so I kept it brief. Essentially, we help ${industry} businesses in ${location} fill their pipeline with pre-screened, ready-to-buy customers.

I've been putting together a short market report for the ${location} area and I thought it would be valuable for ${company}. It shows the volume of active searches happening in your market right now.`;

        closing = `I can send that over today — is this still the best email to reach you? 
Or if you have 10 minutes this week, I can walk you through it live. What does your schedule look like?`;
        break;

      case "closing":
        opening = `Hi [Name], it's [Your Name] from ${ourCompany}. I wanted to touch base with ${company} — last time we spoke you were interested in growing your ${industry} client base in ${location}.`;

        body = `I have everything ready to get you started — the onboarding takes about 20 minutes and you'd be live and receiving leads within 48 hours.

We currently have ${location} area slots open, but they fill up fast because contractors in your market are seeing strong results. I'd hate for ${company} to miss out on the Q${this._currentQuarter()} push.

To recap the investment: [recap pricing/offer]. And our guarantee is [state guarantee].`;

        closing = `I can have the agreement over to you within the hour. Should I send it to [email on file] or is there a better address?

If hesitant: "What would need to happen for this to make sense for ${company} right now?"`;
        break;

      case "objection_handling":
        opening = `Thank you for being upfront with me — I hear that a lot from successful contractors, and I want to make sure I address it directly.`;

        body = `[Tailor response to the specific objection — see objection section below.]

The most important thing to know about ${company} is that you're already doing the hard part — delivering great ${industry} work in ${location}. We just make sure the right customers find you before they find your competitors.`;

        closing = `Does that help clarify things? I want to make sure this is a fit before we move forward — what other concerns do you have?`;
        break;
    }

    const full_script = `=== ${scriptType.toUpperCase().replace(/_/g, " ")} SCRIPT ===
Company: ${company} | Location: ${location} | Industry: ${industry}
Generated: ${new Date().toLocaleDateString()}

--- OPENING ---
${opening}

--- BODY ---
${body}

--- CLOSING ---
${closing}

--- COMMON OBJECTIONS ---
${objections.map((o, i) => `${i + 1}. ${o.objection}\n   Response: ${o.response}`).join("\n\n")}
`;

    return { opening, body, closing, objections, full_script };
  }

  _buildObjections(company, industry, location) {
    return [
      {
        objection: "We're not interested / We don't need more leads.",
        response: `That's completely fair — many of our best clients said the same thing before they saw how many ${industry} searches go unanswered in ${location} each month. I'd just love to show you the data, no obligation.`,
      },
      {
        objection: "We're too busy right now.",
        response: `That's actually the best time to talk — setting up the pipeline now means when things slow down seasonally, ${company} is already capturing jobs. It takes less than 20 minutes to get set up.`,
      },
      {
        objection: "We tried something like this before and it didn't work.",
        response: `I completely understand that frustration. Can you tell me what happened? Most of the time it comes down to lead quality or follow-up timing — both of which we've specifically engineered to fix.`,
      },
      {
        objection: "What's the cost?",
        response: `Great question — it depends on your target area and volume. For most ${industry} contractors in ${location}, the ROI is clear within the first job. Let me show you a few examples from similar businesses.`,
      },
      {
        objection: "I need to think about it.",
        response: `Absolutely — what specific part would you like to think through? I want to make sure you have all the information you need, and I can also send a written summary so you can review it on your own time.`,
      },
    ];
  }

  _currentQuarter() {
    return Math.ceil((new Date().getMonth() + 1) / 3);
  }
}

module.exports = SalesScriptGenerator;
