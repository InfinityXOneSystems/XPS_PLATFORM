import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExecutionCanvas } from '@/components/ExecutionCanvas'
import { ScraperCanvasContent } from '@/components/canvas/ScraperCanvasContent'
import { DataCanvasContent } from '@/components/canvas/DataCanvasContent'
import { DocumentCanvasContent } from '@/components/canvas/DocumentCanvasContent'
import { DevCanvasContent } from '@/components/canvas/DevCanvasContent'
import { MediaCanvasContent } from '@/components/canvas/MediaCanvasContent'
import type { CanvasState, CanvasMode, ScraperCanvasData, DataCanvasData, DocumentCanvasData, DevCanvasData, MediaCanvasData } from '@/types/canvas'
import { BackButton } from '@/components/BackButton'

export function CanvasPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [canvasState, setCanvasState] = useState<CanvasState>({
    mode: 'scraper',
    data: {
      isActive: false,
      logs: [
        '[12:34:01] Initializing scraper...',
        '[12:34:02] Connected to target',
        '[12:34:05] Extracting data from 25 sources',
        '[12:34:10] Processing results...'
      ]
    },
    isFullscreen: false
  })

  const handleModeChange = (mode: CanvasMode) => {
    const defaultData = getDefaultDataForMode(mode)
    setCanvasState((prev) => ({
      ...prev,
      mode,
      data: defaultData
    }))
  }

  const handleToggleFullscreen = () => {
    setCanvasState((prev) => ({
      ...prev,
      isFullscreen: !prev.isFullscreen
    }))
  }

  const renderCanvasContent = () => {
    switch (canvasState.mode) {
      case 'scraper':
        return <ScraperCanvasContent data={canvasState.data as ScraperCanvasData} />
      case 'data':
        return <DataCanvasContent data={canvasState.data as DataCanvasData} />
      case 'document':
        return <DocumentCanvasContent data={canvasState.data as DocumentCanvasData} />
      case 'dev':
        return <DevCanvasContent data={canvasState.data as DevCanvasData} />
      case 'media':
        return <MediaCanvasContent data={canvasState.data as MediaCanvasData} />
      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col space-y-10">
      <BackButton onBack={() => onNavigate('home')} />
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Execution Canvas</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Universal content rendering system with multiple modes
        </p>
      </div>

      <motion.div
        className="flex-1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ExecutionCanvas
          canvasState={canvasState}
          onToggleFullscreen={handleToggleFullscreen}
          onModeChange={handleModeChange}
        >
          {renderCanvasContent()}
        </ExecutionCanvas>
      </motion.div>
    </div>
  )
}

function getDefaultDataForMode(mode: CanvasMode): ScraperCanvasData | DataCanvasData | DocumentCanvasData | DevCanvasData | MediaCanvasData | null {
  switch (mode) {
    case 'scraper':
      return {
        isActive: false,
        logs: [
          '[12:34:01] Initializing scraper...',
          '[12:34:02] Connected to target',
          '[12:34:05] Extracting data from 25 sources',
          '[12:34:10] Processing results...'
        ],
        browserUrl: 'https://example.com'
      }
    case 'data':
      return {
        type: 'chart',
        content: null
      }
    case 'document':
      return {
        type: 'proposal',
        content: '<h1>Business Proposal</h1><p>This is a sample proposal document...</p>',
        metadata: {
          title: 'Q1 2024 Business Proposal',
          date: 'March 15, 2024',
          client: 'Acme Corporation'
        }
      }
    case 'dev':
      return {
        mode: 'editor',
        content: `function greet(name: string) {\n  console.log(\`Hello, \${name}!\`);\n}\n\ngreet('World');`,
        language: 'typescript',
        filename: 'example.ts'
      }
    case 'media':
      return {
        type: 'logo',
        status: 'ready'
      }
    default:
      return null
  }
}
