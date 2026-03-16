import { Groq } from 'groq-sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' })
  }

  if (!process.env.AI_GROQ_API_KEY) {
    return res.status(503).json({ error: 'LLM not configured — AI_GROQ_API_KEY is missing' })
  }

  try {
    const groq = new Groq({ apiKey: process.env.AI_GROQ_API_KEY })
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: message.trim() }],
      max_tokens: 512,
    })

    return res.status(200).json({
      reply: response.choices[0]?.message?.content || 'Empty response from LLM',
    })
  } catch (err) {
    console.error('Groq chat error:', err)
    return res.status(500).json({ error: 'LLM request failed', details: err.message })
  }
}

