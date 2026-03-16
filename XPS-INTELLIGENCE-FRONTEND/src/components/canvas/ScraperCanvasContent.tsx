import { motion } from 'framer-motion'
import { Globe, Pulse } from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import type { ScraperCanvasData } from '@/types/canvas'

interface ScraperCanvasContentProps {
  data: ScraperCanvasData
}

export function ScraperCanvasContent({ data }: ScraperCanvasContentProps) {
  const [urlInput, setUrlInput] = useState(data.browserUrl || 'https://example.com')
  const [currentUrl, setCurrentUrl] = useState(data.browserUrl || 'https://example.com')

  const handleNavigate = () => {
    setCurrentUrl(urlInput)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 bg-black/40 relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center gap-2 p-3 bg-black/60 backdrop-blur-sm border-b border-border/50">
            <Globe size={16} className="text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              className="flex-1 h-8 text-xs font-mono bg-black/40"
              placeholder="Enter URL to preview..."
            />
            <Button size="sm" onClick={handleNavigate} className="h-8 text-xs">
              Go
            </Button>
          </div>
          
          <div className="flex-1 relative bg-white">
            <iframe
              src={currentUrl}
              className="w-full h-full border-none"
              title="Browser Preview"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </div>
        
        {data.isActive && (
          <div className="absolute top-16 right-4 z-10">
            <Badge className="bg-primary text-primary-foreground animate-pulse-glow">
              <Pulse size={12} weight="fill" className="mr-1.5" />
              Scraping
            </Badge>
          </div>
        )}
      </div>

      <div className="h-48 border-t border-border/50 bg-black/20">
        <div className="px-4 py-2 border-b border-border/30 bg-black/30">
          <span className="text-xs font-semibold text-muted-foreground">Console Output</span>
        </div>
        <ScrollArea className="h-[calc(100%-2.5rem)]">
          <div className="p-3 space-y-1 font-mono text-xs">
            {data.logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet...</p>
            ) : (
              data.logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-green-500"
                >
                  {log}
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
