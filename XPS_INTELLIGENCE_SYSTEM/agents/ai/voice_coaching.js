"use strict";

require("dotenv").config();
const OpenAI = require("openai");

const KEYWORDS = {
  objection_handling: [
    "not interested",
    "too expensive",
    "already have",
    "no budget",
    "call back later",
    "think about it",
    "send me info",
    "not right now",
    "busy",
    "don't need",
  ],
  rapport: [
    "how are you",
    "great question",
    "understand",
    "appreciate",
    "i hear you",
    "makes sense",
    "absolutely",
    "totally",
    "definitely",
    "of course",
  ],
  next_step: [
    "follow up",
    "next week",
    "schedule",
    "meeting",
    "demo",
    "call back",
    "appointment",
    "calendar",
    "tuesday",
    "wednesday",
    "thursday",
    "time works",
  ],
  pricing: [
    "price",
    "cost",
    "how much",
    "fee",
    "charge",
    "investment",
    "budget",
    "afford",
    "expensive",
    "cheap",
    "discount",
    "payment",
  ],
};

function detectSignals(transcript) {
  const lower = transcript.toLowerCase();
  return {
    objection_handling: KEYWORDS.objection_handling.filter((kw) =>
      lower.includes(kw),
    ),
    rapport: KEYWORDS.rapport.filter((kw) => lower.includes(kw)),
    next_step: KEYWORDS.next_step.filter((kw) => lower.includes(kw)),
    pricing: KEYWORDS.pricing.filter((kw) => lower.includes(kw)),
  };
}

function ruleBasedAnalysis(transcript, leadData = {}) {
  const signals = detectSignals(transcript);
  const wordCount = transcript.split(/\s+/).length;

  let score = 50;
  const feedback = [];
  const strengths = [];
  const improvements = [];

  // Objection handling
  if (signals.objection_handling.length > 0 && signals.rapport.length > 0) {
    strengths.push("Acknowledged objections while maintaining rapport.");
    score += 10;
  } else if (
    signals.objection_handling.length > 0 &&
    signals.rapport.length === 0
  ) {
    improvements.push(
      "Objections were raised but little rapport language detected. Try empathy phrases.",
    );
    score -= 5;
  }

  // Rapport building
  if (signals.rapport.length >= 3) {
    strengths.push(
      "Strong rapport-building language used throughout the call.",
    );
    score += 10;
  } else if (signals.rapport.length === 0) {
    improvements.push(
      'No rapport-building language detected. Use phrases like "I understand" or "That makes sense".',
    );
    score -= 10;
  }

  // Next step commitment
  if (signals.next_step.length > 0) {
    strengths.push("A next step or follow-up was mentioned.");
    score += 15;
  } else {
    improvements.push(
      "No clear next step identified in the transcript. Always close with a specific commitment.",
    );
    score -= 15;
    feedback.push(
      "Critical: Always end the call with a confirmed next action (demo, callback, email).",
    );
  }

  // Pricing discussion
  if (signals.pricing.length > 0) {
    strengths.push("Pricing was discussed — good for qualifying stage.");
  }

  // Call length proxy via word count
  if (wordCount < 100) {
    improvements.push(
      "Call appears very short. Consider engaging the prospect more before pitching.",
    );
    score -= 10;
  } else if (wordCount > 500) {
    strengths.push("Good call length — sufficient time to build value.");
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));

  const suggestions =
    improvements.length > 0
      ? `Focus on: ${improvements.join(" | ")}`
      : "Great call overall! Keep up the momentum and ensure consistent follow-through.";

  return { score, feedback, strengths, improvements, suggestions };
}

class VoiceCallCoachingAI {
  constructor() {
    this._openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  async analyzeCall(transcript, leadData = {}) {
    if (this._openai) {
      return this._analyzeWithAI(transcript, leadData);
    }
    return ruleBasedAnalysis(transcript, leadData);
  }

  async _analyzeWithAI(transcript, leadData) {
    const systemPrompt = `You are an expert sales call coach for the flooring and construction industry.
Analyze the provided call transcript and return a JSON object with:
{
  "score": <0-100 integer>,
  "feedback": ["<actionable feedback item>", ...],
  "strengths": ["<what the rep did well>", ...],
  "improvements": ["<specific improvement>", ...],
  "suggestions": "<1-2 sentence coaching summary>"
}
Evaluate: objection handling, rapport building, next step commitment, pricing discussion, overall professionalism.`;

    const userPrompt = `Lead: ${JSON.stringify(leadData)}

Transcript:
${transcript}`;

    try {
      const completion = await this._openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.4,
      });

      const raw = completion.choices[0].message.content.trim();
      const parsed = JSON.parse(
        raw.replace(/^```json\n?/, "").replace(/\n?```$/, ""),
      );
      return {
        score: parsed.score ?? 50,
        feedback: parsed.feedback ?? [],
        strengths: parsed.strengths ?? [],
        improvements: parsed.improvements ?? [],
        suggestions: parsed.suggestions ?? "",
      };
    } catch (err) {
      console.error(
        "[VoiceCallCoachingAI] OpenAI error, falling back to rule-based:",
        err.message,
      );
      return ruleBasedAnalysis(transcript, leadData);
    }
  }

  async generateCoachingTips(repStats = {}) {
    const {
      avg_score = 0,
      total_calls = 0,
      closed = 0,
      objections_handled = 0,
      follow_ups_set = 0,
    } = repStats;

    const closeRate =
      total_calls > 0 ? ((closed / total_calls) * 100).toFixed(1) : 0;

    if (this._openai) {
      try {
        const prompt = `Sales rep performance stats:
- Average call score: ${avg_score}/100
- Total calls: ${total_calls}
- Closed deals: ${closed} (${closeRate}% close rate)
- Objections handled: ${objections_handled}
- Follow-ups scheduled: ${follow_ups_set}

Provide 5 specific, actionable coaching tips to improve this rep's performance in flooring/construction sales. Be direct and practical.`;

        const completion = await this._openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 400,
          temperature: 0.5,
        });

        return {
          tips: completion.choices[0].message.content.trim(),
          stats: repStats,
        };
      } catch (err) {
        console.error(
          "[VoiceCallCoachingAI] Coaching tips OpenAI error:",
          err.message,
        );
      }
    }

    // Rule-based coaching tips
    const tips = [];
    if (avg_score < 60)
      tips.push(
        "Focus on rapport: open every call with a genuine question about their business.",
      );
    if (parseFloat(closeRate) < 20)
      tips.push(
        "Improve your close rate by always confirming a specific next step before ending the call.",
      );
    if (objections_handled < total_calls * 0.5)
      tips.push(
        'Practice objection handling with the "Feel, Felt, Found" framework.',
      );
    if (follow_ups_set < total_calls * 0.7)
      tips.push(
        'Book follow-ups before ending the call — never rely on "I\'ll call you."',
      );
    tips.push(
      "Record and review your top-performing calls weekly to reinforce winning patterns.",
    );

    return { tips: tips.join("\n"), stats: repStats };
  }
}

module.exports = VoiceCallCoachingAI;
