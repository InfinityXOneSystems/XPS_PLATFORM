export type ContractorLeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'qualified'
  | 'proposal'
  | 'negotiating'
  | 'won'
  | 'lost'

export type ContactType = 'call' | 'email' | 'sms' | 'meeting' | 'note'

export interface ContactRecord {
  id: string
  date: string
  type: ContactType
  subject: string
  notes: string
  duration?: number
  outcome?: string
}

export interface ContractorRating {
  google: number
  yelp: number
  bbb: number
  trustpilot: number
  average: number
}

export interface SocialProfiles {
  facebook?: string
  linkedin?: string
  instagram?: string
  twitter?: string
}

export interface Contractor {
  id: string

  // Basic Info
  name: string
  industry: string[]
  license_number: string
  business_type: string
  years_in_business: number

  // Contact
  phone: string
  email: string
  website: string
  office_address: string
  service_areas: string[]
  hours_of_operation: string

  // Ratings
  rating: ContractorRating
  review_count: number

  // Financial
  estimated_revenue: string
  employee_count: number
  credit_rating: string
  price_range: string // '$' | '$$' | '$$$' | '$$$$'

  // Lead Management
  lead_status: ContractorLeadStatus
  last_contacted: string | null
  contact_history: ContactRecord[]
  notes: string
  tags: string[]
  lead_score: number // 0-100

  // Services
  services_offered: string[]
  certifications: string[]
  warranties: string[]
  service_radius: number // miles
  special_services: string[]

  // Social
  social_profiles: SocialProfiles
  website_quality_score: number
  social_followers_total: number

  // Metadata
  scraped_at: string
  data_source: string
  confidence_score: number // 0-100
  is_duplicate: boolean
  duplicate_of_id?: string

  // Timestamps
  created_at: string
  updated_at: string
}

export interface ContractorFilters {
  search: string
  industries: string[]
  states: string[]
  minRating: number
  maxRating: number
  priceRanges: string[]
  leadStatuses: ContractorLeadStatus[]
  minLeadScore: number
  maxLeadScore: number
  dataSources: string[]
  tags: string[]
  verifiedOnly: boolean
}

export const DEFAULT_FILTERS: ContractorFilters = {
  search: '',
  industries: [],
  states: [],
  minRating: 0,
  maxRating: 5,
  priceRanges: [],
  leadStatuses: [],
  minLeadScore: 0,
  maxLeadScore: 100,
  dataSources: [],
  tags: [],
  verifiedOnly: false,
}

export type ContractorViewMode = 'list' | 'card' | 'table'

export const LEAD_STATUS_LABELS: Record<ContractorLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
}

export const LEAD_STATUS_COLORS: Record<ContractorLeadStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  interested: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  qualified: 'bg-green-500/20 text-green-400 border-green-500/30',
  proposal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  negotiating: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  won: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
}
