import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowsOut, ArrowsIn, Code, Database, FileText, Play, Image as ImageIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CanvasState, CanvasMode } from '@/types/canvas'

const modeIcons: Record<CanvasMode, React.ElementType> = {
  scraper: Play,
  data: Database,
  document: FileText,
  dev: Code,
  media: ImageIcon
}

const modeLabels: Record<CanvasMode, string> = {
  scraper: 'Scraper',
  data: 'Data',
  document: 'Document',
  dev: 'Dev',
  media: 'Media'
}

interface ExecutionCanvasProps {
  canvasState: CanvasState
  onToggleFullscreen: () => void
  onModeChange: (mode: CanvasMode) => void
  children: React.ReactNode
}

export function ExecutionCanvas({ 
  canvasState, 
  onToggleFullscreen, 
  onModeChange,
  children 
}: ExecutionCanvasProps) {
  const Icon = modeIcons[canvasState.mode]

  return (
    <div 
      className={cn(
        "relative flex flex-col bg-background/50 backdrop-blur-xl border border-border rounded-xl overflow-hidden transition-all duration-500",
        canvasState.isFullscreen 
          ? "fixed inset-4 z-50" 
          : "h-full"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-primary" weight="duotone" />
            <span className="font-semibold text-sm">{modeLabels[canvasState.mode]} Canvas</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1.5">
            {(Object.keys(modeIcons) as CanvasMode[]).map((mode) => {
              const ModeIcon = modeIcons[mode]
              return (
                <button
                  key={mode}
                  onClick={() => onModeChange(mode)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    canvasState.mode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <ModeIcon size={14} weight="duotone" className="inline mr-1" />
                  {modeLabels[mode]}
                </button>
              )
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            Active
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleFullscreen}
            className="h-8 w-8 p-0"
          >
            {canvasState.isFullscreen ? (
              <ArrowsIn size={16} />
            ) : (
              <ArrowsOut size={16} />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={canvasState.mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
