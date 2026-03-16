/**
 * _proxyHelper.js — Shared utility for Vercel serverless proxy functions.
 *
 * Forwards requests to the Railway backend, using BACKEND_URL env var.
 * Falls back to the production Railway URL if BACKEND_URL is not set.
 */

const DEFAULT_BACKEND = 'https://xpsintelligencesystem-production.up.railway.app'

/**
 * Proxy an incoming Vercel API request to the Railway backend.
 *
 * @param {string} backendPath   - Path on the backend (e.g. "/api/leads")
 * @param {object} req           - Vercel request object
 * @param {object} res           - Vercel response object
 */
export async function proxyToBackend(backendPath, req, res) {
  const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND
  const url = `${backendUrl}${backendPath}`

  const options = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  }

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    options.body = JSON.stringify(req.body)
  }

  const upstream = await fetch(url, options)

  // Forward the status code and JSON body from the backend.
  let data
  const contentType = upstream.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await upstream.json()
  } else {
    data = { text: await upstream.text(), contentType }
  }

  return res.status(upstream.status).json(data)
}
