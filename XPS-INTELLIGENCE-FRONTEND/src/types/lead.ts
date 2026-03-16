export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'signed' | 'lost'
export type LeadRating = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'
export type LeadPriority = 'green' | 'yellow' | 'red'

export interface Lead {
  id: string
  company: string
  city: string
  state?: string
  phone: string
  email: string
  website?: string
  rating: LeadRating
  opportunityScore: number
  assignedRep?: string
  assignedInitials?: string
  status: LeadStatus
  priority?: LeadPriority
  isNew?: boolean
  notes?: string
  createdAt: string
  updatedAt?: string
  lastTouchedAt?: string
  lastTouchedBy?: string
  category?: string
  address?: string
  revenue?: number
  lat?: number
  lng?: number
}

export interface DashboardMetrics {
  totalLeads: number
  aPlusOpportunities: number
  emailsSent: number
  responseRate: number
  revenuePipeline: number
}

export interface ScraperConfig {
  city: string
  category: string
  maxResults: number
  sources: {
    googleMaps: boolean
    yelp: boolean
    directories: boolean
  }
}

export interface ScraperLog {
  id: string
  timestamp: string
  status: 'running' | 'completed' | 'failed'
  message: string
  config?: ScraperConfig
}

export type UserRole = 'admin' | 'sales_rep'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
}
