export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' })
  }

  const backendUrl =
    process.env.BACKEND_URL || 'https://xpsintelligencesystem-production.up.railway.app'

  try {
    const result = await fetch(`${backendUrl}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() }),
    })

    if (!result.ok) {
      const text = await result.text()
      console.error('Backend agent error:', result.status, text)
      return res.status(result.status).json({ error: `Backend agent request failed with status ${result.status}`, details: text })
    }

    const data = await result.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error('Agent proxy error:', err)
    return res.status(500).json({ error: 'Failed to reach backend agent', details: err.message })
  }
}

