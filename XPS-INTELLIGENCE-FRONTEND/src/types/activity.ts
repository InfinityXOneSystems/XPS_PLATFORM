export type ActivityType = 
  | 'lead_added' 
  | 'lead_updated' 
  | 'lead_assigned'
  | 'email_sent'
  | 'call_made'
  | 'scraper_started'
  | 'scraper_completed'
  | 'score_updated'
  | 'note_added'
  | 'status_changed'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: number
  leadId?: string
  leadName?: string
  userId?: string
  userName?: string
  metadata?: Record<string, unknown>
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  read: boolean
  actionUrl?: string
  actionLabel?: string
}
