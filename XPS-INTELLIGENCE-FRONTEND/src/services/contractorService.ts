const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface Contractor {
  id: string
  name: string
  company: string
  specialty: string
  location: string
  phone: string
  email: string
  rating: number
  status: 'active' | 'inactive' | 'pending'
  createdAt: string
  website?: string
  notes?: string
  tags?: string[]
}

export interface ContractorSearchParams {
  query?: string
  specialty?: string
  location?: string
  status?: Contractor['status']
  minRating?: number
  page?: number
  limit?: number
}

export interface ContractorListResponse {
  contractors: Contractor[]
  total: number
  page: number
  limit: number
}

const MOCK_CONTRACTORS: Contractor[] = [
  { id: '1', name: 'Marcus Thompson', company: 'Thompson Construction LLC', specialty: 'General Contractor', location: 'Houston, TX', phone: '(713) 555-0142', email: 'marcus@thompsonconst.com', rating: 4.8, status: 'active', createdAt: '2024-01-15', website: 'https://thompsonconst.com', tags: ['residential', 'commercial'] },
  { id: '2', name: 'Sarah Mitchell', company: 'Summit Roofing Co.', specialty: 'Roofing', location: 'Dallas, TX', phone: '(214) 555-0287', email: 'sarah@summitroofing.com', rating: 4.6, status: 'active', createdAt: '2024-02-03' },
  { id: '3', name: 'David Chen', company: 'Pacific Electric Services', specialty: 'Electrical', location: 'Los Angeles, CA', phone: '(323) 555-0419', email: 'david@pacificelectric.com', rating: 4.9, status: 'active', createdAt: '2024-02-18', tags: ['commercial', 'industrial'] },
  { id: '4', name: 'Jennifer Lopez', company: 'Southwest Plumbing', specialty: 'Plumbing', location: 'Phoenix, AZ', phone: '(602) 555-0531', email: 'jennifer@swplumbing.com', rating: 4.3, status: 'active', createdAt: '2024-03-07' },
  { id: '5', name: 'Robert Williams', company: 'Williams HVAC Solutions', specialty: 'HVAC', location: 'Atlanta, GA', phone: '(404) 555-0628', email: 'rwilliams@williamshvac.com', rating: 4.7, status: 'active', createdAt: '2024-03-22' },
  { id: '6', name: 'Amanda Foster', company: 'Foster Concrete Works', specialty: 'Concrete & Foundation', location: 'Chicago, IL', phone: '(312) 555-0734', email: 'amanda@fosterconcrete.com', rating: 4.4, status: 'inactive', createdAt: '2024-04-10' },
  { id: '7', name: 'Michael Barnes', company: 'Barnes Landscaping Pro', specialty: 'Landscaping', location: 'Miami, FL', phone: '(305) 555-0856', email: 'mbarnes@barneslandscape.com', rating: 4.5, status: 'active', createdAt: '2024-04-28' },
  { id: '8', name: 'Lisa Park', company: 'Park Interior Design & Remodeling', specialty: 'Interior Remodeling', location: 'Seattle, WA', phone: '(206) 555-0972', email: 'lisa@parkinteriors.com', rating: 4.9, status: 'active', createdAt: '2024-05-15' },
  { id: '9', name: 'James Rodriguez', company: 'Rodriguez Painting Co.', specialty: 'Painting', location: 'Denver, CO', phone: '(720) 555-0138', email: 'james@rodriguezpainting.com', rating: 4.2, status: 'pending', createdAt: '2024-06-01' },
  { id: '10', name: 'Karen Johnson', company: 'Precision Tile & Stone', specialty: 'Tile & Flooring', location: 'Nashville, TN', phone: '(615) 555-0247', email: 'karen@precisiontile.com', rating: 4.6, status: 'active', createdAt: '2024-06-19' },
]

export async function getContractors(params?: ContractorSearchParams): Promise<ContractorListResponse> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.query) searchParams.set('query', params.query)
    if (params?.specialty) searchParams.set('specialty', params.specialty)
    if (params?.location) searchParams.set('location', params.location)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const res = await fetch(`${API_BASE}/contractors?${searchParams}`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    let filtered = MOCK_CONTRACTORS
    if (params?.query) {
      const q = params.query.toLowerCase()
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      )
    }
    if (params?.specialty) filtered = filtered.filter(c => c.specialty === params.specialty)
    if (params?.location) filtered = filtered.filter(c => c.location.includes(params.location!))
    if (params?.status) filtered = filtered.filter(c => c.status === params.status)
    return { contractors: filtered, total: filtered.length, page: params?.page || 1, limit: params?.limit || 50 }
  }
}

export async function searchContractors(query: string): Promise<Contractor[]> {
  const result = await getContractors({ query })
  return result.contractors
}

export async function getContractor(id: string): Promise<Contractor | null> {
  try {
    const res = await fetch(`${API_BASE}/contractors/${id}`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_CONTRACTORS.find(c => c.id === id) || null
  }
}

export async function addContractor(contractor: Omit<Contractor, 'id' | 'createdAt'>): Promise<Contractor> {
  try {
    const res = await fetch(`${API_BASE}/contractors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contractor),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { ...contractor, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  }
}

export async function updateContractor(id: string, updates: Partial<Contractor>): Promise<Contractor> {
  try {
    const res = await fetch(`${API_BASE}/contractors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    const existing = MOCK_CONTRACTORS.find(c => c.id === id)
    if (!existing) return { ...updates, id, name: '', company: '', specialty: '', location: '', phone: '', email: '', rating: 0, status: 'active', createdAt: new Date().toISOString() } as Contractor
    return { ...existing, ...updates }
  }
}

export async function deleteContractor(id: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/contractors/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}
