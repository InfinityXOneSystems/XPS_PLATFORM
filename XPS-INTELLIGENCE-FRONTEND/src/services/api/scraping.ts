import { api } from '@/lib/api'

export interface ScrapeJob {
  id: string
  target: string
  category: string
  city: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped'
  progress: number
  totalFound: number
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface ScrapeResult {
  id: string
  jobId: string
  name: string
  company: string
  email?: string
  phone?: string
  website?: string
  address?: string
  source: string
  scrapedAt: string
}

export const scrapingApi = {
  start: (config: { city: string; category: string; maxResults: number; sources: string[] }) =>
    api.post<ScrapeJob>('/scraping/start', config),
  stop: (jobId: string) => api.post<void>(`/scraping/${jobId}/stop`, {}),
  getStatus: (jobId: string) => api.get<ScrapeJob>(`/scraping/${jobId}/status`),
  getResults: (jobId: string) =>
    api.get<{ results: ScrapeResult[] }>(`/scraping/${jobId}/results`),
  listJobs: () => api.get<{ jobs: ScrapeJob[] }>('/scraping/jobs'),
  schedule: (config: { city: string; category: string; cron: string }) =>
    api.post<{ scheduleId: string }>('/scraping/schedule', config),
}
