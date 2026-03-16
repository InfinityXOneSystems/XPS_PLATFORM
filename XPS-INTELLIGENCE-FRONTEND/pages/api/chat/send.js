import { Groq } from 'groq-sdk'

/**
 * POST /api/chat/send
 *
 * Accepts { message, agentRole?, sessionId? } and returns a SendMessageResponse
 * that matches the shape expected by src/services/chatService.ts.
 *
 * Calls Groq directly from Vercel — no Railway round-trip required for chat,
 * which eliminates cross-origin issues between Vercel and Railway.
 *
 * Required env vars (set in Vercel project settings):
 *   AI_GROQ_API_KEY — Groq API key (server-side only, never VITE_-prefixed)
 */

const AGENT_SYSTEM_PROMPTS = {
  PlannerAgent: 'You are a PlannerAgent for the XPS Intelligence platform. Break down goals into clear, actionable execution steps.',
  ResearchAgent: 'You are a ResearchAgent. Gather information, synthesize findings, and surface key insights from the web and documents.',
  BuilderAgent: 'You are a BuilderAgent. Generate clean, production-ready code and scaffold UI components on request.',
  ScraperAgent: 'You are a ScraperAgent. Collect and structure large-scale web data including contractor leads, company info, and contact details.',
  MediaAgent: 'You are a MediaAgent. Assist with image, audio, and video generation and editing tasks.',
  ValidatorAgent: 'You are a ValidatorAgent. Run tests, lint checks, and type validation. Report issues clearly.',
  DevOpsAgent: 'You are a DevOpsAgent. Manage deployments, infrastructure, and CI/CD pipelines.',
  MonitoringAgent: 'You are a MonitoringAgent. Watch system health, report anomalies, and surface alerts.',
  KnowledgeAgent: 'You are a KnowledgeAgent. Store, retrieve, and synthesize memory across agent interactions.',
  BusinessAgent: 'You are a BusinessAgent. Discover leads, analyze markets, and drive contractor business intelligence.',
  PredictionAgent: 'You are a PredictionAgent. Score leads, forecast pipelines, and surface predictive insights.',
  SimulationAgent: 'You are a SimulationAgent. Run scenario simulations and what-if analyses.',
  MetaAgent: 'You are a MetaAgent. Continuously analyze and redesign the XPS Intelligence system architecture for self-improvement.',
}

const DEFAULT_SYSTEM_PROMPT =
  'You are an XPS Intelligence Agent — an autonomous AI assistant for contractor lead generation, business intelligence, and system automation. Respond with actionable, structured insights.'

function randomId() {
  return crypto.randomUUID()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, agentRole, sessionId } = req.body || {}

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' })
  }

  if (!process.env.AI_GROQ_API_KEY) {
    return res.status(503).json({ error: 'LLM not configured — AI_GROQ_API_KEY is missing' })
  }

  const resolvedRole = agentRole || 'PlannerAgent'
  const systemPrompt = AGENT_SYSTEM_PROMPTS[resolvedRole] || DEFAULT_SYSTEM_PROMPT

  try {
    const groq = new Groq({ apiKey: process.env.AI_GROQ_API_KEY })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.trim() },
      ],
      max_tokens: 1024,
    })

    const content = completion.choices[0]?.message?.content || 'No response from LLM'

    return res.status(200).json({
      id: randomId(),
      reply: {
        id: randomId(),
        role: 'assistant',
        content,
        agentRole: resolvedRole,
        timestamp: new Date().toISOString(),
        status: 'sent',
      },
      agentRole: resolvedRole,
      sessionId: sessionId || randomId(),
    })
  } catch (err) {
    console.error('Chat send error:', err)
    return res.status(500).json({ error: 'Chat request failed', details: err.message })
  }
}
