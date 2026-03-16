const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface ScrapingJob {
  id: string
  name: string
  target: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused'
  progress: number
  results: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  config?: ScrapingJobConfig
}

export interface ScrapingJobConfig {
  maxPages?: number
  rateLimit?: number
  usePlaywright?: boolean
  extractEmails?: boolean
  extractPhones?: boolean
  filters?: Record<string, string>
}

export interface ScrapingResult {
  id: string
  jobId: string
  company: string
  website?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  specialty?: string
  source: string
  scrapedAt: string
  confidence: number
}

export interface ScrapingStats {
  totalJobs: number
  activeJobs: number
  completedToday: number
  totalResultsToday: number
  totalResultsAllTime: number
  avgSuccessRate: number
  dataQualityScore: number
}

const MOCK_JOBS: ScrapingJob[] = [
  { id: '1', name: 'Texas GC Scrape', target: 'https://www.texascontractors.com', status: 'completed', progress: 100, results: 847, startedAt: '2024-12-01T06:00:00Z', completedAt: '2024-12-01T08:30:00Z' },
  { id: '2', name: 'Florida Roofers', target: 'https://floridacontractors.org', status: 'running', progress: 62, results: 312, startedAt: '2024-12-01T09:00:00Z' },
  { id: '3', name: 'California Electricians', target: 'https://cslb.ca.gov', status: 'queued', progress: 0, results: 0 },
  { id: '4', name: 'Atlanta HVAC Leads', target: 'https://yellowpages.com/atlanta-ga/hvac', status: 'paused', progress: 38, results: 156, startedAt: '2024-11-30T14:00:00Z' },
  { id: '5', name: 'NYC Plumbers DB', target: 'https://www1.nyc.gov/contractors', status: 'failed', progress: 15, results: 43, startedAt: '2024-11-30T10:00:00Z', errorMessage: 'Rate limit exceeded' },
]

const MOCK_RESULTS: ScrapingResult[] = [
  { id: '1', jobId: '1', company: 'Houston Build Co.', website: 'https://houstonbuild.com', email: 'info@houstonbuild.com', phone: '(713) 555-1234', city: 'Houston', state: 'TX', specialty: 'General Contractor', source: 'texascontractors.com', scrapedAt: '2024-12-01T07:30:00Z', confidence: 0.95 },
  { id: '2', jobId: '1', company: 'Lone Star Construction', email: 'contact@lonestar.com', phone: '(214) 555-5678', city: 'Dallas', state: 'TX', specialty: 'Commercial Construction', source: 'texascontractors.com', scrapedAt: '2024-12-01T07:31:00Z', confidence: 0.88 },
  { id: '3', jobId: '2', company: 'Miami Roofing Pros', website: 'https://miamiroofing.com', email: 'miami@roofpros.com', phone: '(305) 555-9012', city: 'Miami', state: 'FL', specialty: 'Roofing', source: 'floridacontractors.org', scrapedAt: '2024-12-01T09:45:00Z', confidence: 0.92 },
]

const MOCK_STATS: ScrapingStats = {
  totalJobs: 24,
  activeJobs: 2,
  completedToday: 3,
  totalResultsToday: 1358,
  totalResultsAllTime: 48291,
  avgSuccessRate: 0.87,
  dataQualityScore: 0.91,
}

export async function getScrapingJobs(): Promise<ScrapingJob[]> {
  try {
    const res = await fetch(`${API_BASE}/scraping/jobs`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_JOBS
  }
}

export async function createScrapingJob(
  config: Omit<ScrapingJob, 'id' | 'status' | 'progress' | 'results'>
): Promise<ScrapingJob> {
  try {
    const res = await fetch(`${API_BASE}/scraping/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return {
      ...config,
      id: crypto.randomUUID(),
      status: 'queued',
      progress: 0,
      results: 0,
    }
  }
}

export async function stopScrapingJob(id: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/scraping/jobs/${id}/stop`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}

export async function getScrapingResults(jobId?: string): Promise<ScrapingResult[]> {
  try {
    const url = jobId ? `${API_BASE}/scraping/results?jobId=${jobId}` : `${API_BASE}/scraping/results`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return jobId ? MOCK_RESULTS.filter(r => r.jobId === jobId) : MOCK_RESULTS
  }
}

export async function getScrapingStats(): Promise<ScrapingStats> {
  try {
    const res = await fetch(`${API_BASE}/scraping/stats`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_STATS
  }
}
