import { proxyToBackend } from './_proxyHelper.js'

/**
 * GET /api/leads
 *
 * Proxies to the Railway backend's /api/leads endpoint.
 * Falls back to a minimal mock payload when the backend is unreachable,
 * so the frontend degrades gracefully instead of showing an error screen.
 */

const MOCK_LEADS = [
  {
    id: '1',
    company: 'ABC Roofing Inc',
    email: 'contact@abcroofing.example',
    phone: '555-0101',
    score: 92,
    location: 'Dallas, TX',
    source: 'mock',
  },
  {
    id: '2',
    company: 'XYZ Flooring Services',
    email: 'info@xyzflooring.example',
    phone: '555-0202',
    score: 87,
    location: 'Orlando, FL',
    source: 'mock',
  },
  {
    id: '3',
    company: 'Premier Epoxy Contractors',
    email: 'sales@premierepoxy.example',
    phone: '555-0303',
    score: 78,
    location: 'Phoenix, AZ',
    source: 'mock',
  },
]

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    return await proxyToBackend('/api/leads', req, res)
  } catch (err) {
    console.warn('Backend leads unreachable, returning mock data:', err.message)
    return res.status(200).json({
      leads: MOCK_LEADS,
      total: MOCK_LEADS.length,
      source: 'mock',
      timestamp: new Date().toISOString(),
    })
  }
}
