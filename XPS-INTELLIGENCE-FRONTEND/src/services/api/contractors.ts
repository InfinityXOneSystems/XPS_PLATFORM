import { api } from '@/lib/api'

export interface Contractor {
  id: string
  name: string
  company: string
  email: string
  phone: string
  website?: string
  city: string
  state: string
  category: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  score: number
  source: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ContractorFilters {
  status?: string
  category?: string
  city?: string
  state?: string
  search?: string
  page?: number
  limit?: number
}

function buildQuery(filters?: ContractorFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  )
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const contractorsApi = {
  list: (filters?: ContractorFilters) =>
    api.get<{ contractors: Contractor[]; total: number; page: number; pages: number }>(
      `/contractors/list${buildQuery(filters)}`
    ),
  create: (data: Omit<Contractor, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Contractor>('/contractors/create', data),
  update: (id: string, data: Partial<Contractor>) =>
    api.put<Contractor>(`/contractors/${id}`, data),
  delete: (id: string) => api.delete<void>(`/contractors/${id}`),
  bulkUpdate: (ids: string[], data: Partial<Contractor>) =>
    api.post<{ updated: number }>('/contractors/bulk-update', { ids, data }),
  export: (format: 'csv' | 'excel' | 'pdf') =>
    api.get<{ url: string }>(`/contractors/export?format=${encodeURIComponent(format)}`),
}
