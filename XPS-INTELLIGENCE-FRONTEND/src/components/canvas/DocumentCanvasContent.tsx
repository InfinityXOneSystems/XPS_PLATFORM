import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileText, File, FileCode } from '@phosphor-icons/react'
import type { DocumentCanvasData } from '@/types/canvas'

interface DocumentCanvasContentProps {
  data: DocumentCanvasData
}

const documentIcons = {
  proposal: FileText,
  invoice: File,
  contract: FileCode,
  'business-plan': FileText
}

const documentTitles = {
  proposal: 'Business Proposal',
  invoice: 'Invoice',
  contract: 'Contract',
  'business-plan': 'Business Plan'
}

export function DocumentCanvasContent({ data }: DocumentCanvasContentProps) {
  const Icon = documentIcons[data.type]
  const title = documentTitles[data.type]

  return (
    <div className="h-full flex flex-col bg-white/5">
      <div className="border-b border-border/30 bg-black/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon size={24} weight="duotone" className="text-primary" />
            <div>
              <h3 className="font-semibold text-sm">{data.metadata?.title || title}</h3>
              {data.metadata?.client && (
                <p className="text-xs text-muted-foreground mt-0.5">Client: {data.metadata.client}</p>
              )}
            </div>
          </div>
          {data.metadata?.date && (
            <Badge variant="outline" className="text-xs">
              {data.metadata.date}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-2xl min-h-[800px] p-12">
            <div 
              className="prose prose-sm text-black"
              dangerouslySetInnerHTML={{ __html: data.content || '<p class="text-gray-400">Document content will appear here...</p>' }}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
