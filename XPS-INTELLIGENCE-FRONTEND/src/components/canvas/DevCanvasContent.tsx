import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Code, Terminal, GitDiff, Scroll, Play, FloppyDisk } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { DevCanvasData } from '@/types/canvas'

interface DevCanvasContentProps {
  data: DevCanvasData
}

const modeIcons = {
  editor: Code,
  diff: GitDiff,
  logs: Scroll,
  terminal: Terminal
}

const modeTitles = {
  editor: 'Code Editor',
  diff: 'Diff Viewer',
  logs: 'Logs',
  terminal: 'Terminal'
}

export function DevCanvasContent({ data }: DevCanvasContentProps) {
  const [activeTab, setActiveTab] = useState<string>(data.mode)
  const [code, setCode] = useState<string>(data.content || '')
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '$ XPS Intelligence Dev Console',
    '$ Ready for commands...'
  ])
  const Icon = modeIcons[data.mode]

  const handleSave = () => {
    toast.success('Code saved successfully!')
  }

  const handleRun = () => {
    toast.success('Code execution started...')
  }

  const handleTerminalCommand = () => {
    if (!terminalInput.trim()) return
    
    setTerminalOutput((prev) => [
      ...prev,
      `$ ${terminalInput}`,
      `Executed: ${terminalInput}`
    ])
    setTerminalInput('')
  }

  return (
    <div className="h-full flex flex-col bg-black/40">
      <div className="border-b border-border/30 bg-black/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon size={18} weight="duotone" className="text-primary" />
            <span className="font-semibold text-sm">{modeTitles[data.mode]}</span>
            {data.filename && (
              <>
                <div className="h-4 w-px bg-border" />
                <span className="text-xs text-muted-foreground font-mono">{data.filename}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data.language && (
              <Badge variant="outline" className="text-xs">
                {data.language}
              </Badge>
            )}
            <Button size="sm" variant="ghost" onClick={handleSave} className="h-8">
              <FloppyDisk size={14} className="mr-1.5" />
              Save
            </Button>
            <Button size="sm" onClick={handleRun} className="h-8">
              <Play size={14} weight="fill" className="mr-1.5" />
              Run
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border/20 bg-black/20 px-4">
          <TabsList className="h-9 bg-transparent">
            <TabsTrigger value="editor" className="text-xs">
              <Code size={14} className="mr-1.5" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="diff" className="text-xs">
              <GitDiff size={14} className="mr-1.5" />
              Diff
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">
              <Scroll size={14} className="mr-1.5" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="terminal" className="text-xs">
              <Terminal size={14} className="mr-1.5" />
              Terminal
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="editor" className="h-full m-0">
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-full w-full resize-none font-mono text-sm bg-transparent border-none focus-visible:ring-0 text-green-400 p-4 leading-relaxed"
              placeholder="// Start coding..."
            />
          </TabsContent>

          <TabsContent value="diff" className="h-full m-0">
            <ScrollArea className="h-full">
              <pre className="p-4 text-xs font-mono leading-relaxed">
                <code className="text-muted-foreground">
                  {data.mode === 'diff' ? data.content : '// No diff to display'}
                </code>
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-1 text-xs font-mono">
                {data.mode === 'logs' && data.content ? (
                  data.content.split('\n').map((line, i) => (
                    <div key={i} className="text-green-500">{line}</div>
                  ))
                ) : (
                  <div className="text-muted-foreground">No logs available...</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="terminal" className="h-full m-0">
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-1 text-xs font-mono">
                  {terminalOutput.map((line, i) => (
                    <div key={i} className={line.startsWith('$') ? 'text-primary' : 'text-foreground'}>
                      {line}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t border-border/30 bg-black/40 px-4 py-3 flex items-center gap-2">
                <span className="text-primary text-sm font-mono">$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTerminalCommand()}
                  placeholder="Type command..."
                  className="flex-1 bg-transparent text-sm outline-none text-foreground font-mono"
                />
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
