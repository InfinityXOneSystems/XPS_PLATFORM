export type CanvasMode = 'scraper' | 'data' | 'document' | 'dev' | 'media'

export interface ScraperCanvasData {
  isActive: boolean
  logs: string[]
  browserUrl?: string
  screenshot?: string
}

export interface DataCanvasData {
  type: 'table' | 'chart' | 'map'
  content: unknown
}

export interface DocumentCanvasData {
  type: 'proposal' | 'invoice' | 'contract' | 'business-plan'
  content: string
  metadata?: {
    title?: string
    date?: string
    client?: string
  }
}

export interface DevCanvasData {
  mode: 'editor' | 'diff' | 'logs' | 'terminal'
  content: string
  language?: string
  filename?: string
}

export interface MediaCanvasData {
  type: 'logo' | 'avatar' | 'video' | 'image'
  url?: string
  status?: 'loading' | 'ready' | 'error'
}

export interface CanvasState {
  mode: CanvasMode
  data: ScraperCanvasData | DataCanvasData | DocumentCanvasData | DevCanvasData | MediaCanvasData | null
  isFullscreen: boolean
}
