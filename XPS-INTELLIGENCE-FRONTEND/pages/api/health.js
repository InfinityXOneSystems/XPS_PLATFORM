import { proxyToBackend } from './_proxyHelper.js'

/**
 * GET /api/health
 *
 * Returns the health status of both this Vercel edge and the Railway backend.
 * Always responds with HTTP 200 so monitoring tools can distinguish between
 * "Vercel is up but Railway is down" vs "everything is healthy".
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const result = {
    vercel: { status: 'ok', timestamp: new Date().toISOString() },
    backend: { status: 'unknown' },
  }

  try {
    // Proxy a lightweight health check to Railway.
    const backendUrl = process.env.BACKEND_URL || 'https://xpsintelligencesystem-production.up.railway.app'
    const upstream = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    const data = await upstream.json().catch(() => ({}))
    result.backend = { status: upstream.ok ? 'ok' : 'degraded', ...data }
  } catch (err) {
    result.backend = { status: 'unreachable', error: err.message }
  }

  const overallOk = result.vercel.status === 'ok' && result.backend.status === 'ok'
  return res.status(overallOk ? 200 : 503).json(result)
}
