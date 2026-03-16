import { useState, useRef, useEffect } from 'react'
import { Terminal, Play, X, ClipboardText, Clock } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useLocalMachine } from '@/hooks/useLocalMachine'

const MAX_HISTORY_SIZE = 50

const SAMPLE_COMMANDS = [
  'ls -la',
  'pwd',
  'echo "Hello World"',
  'date',
  'whoami',
  'ps aux | head -10',
]

export function CommandExecutor() {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)
  const { commandOutput, executeCommand, setCommandOutput } = useLocalMachine()

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [commandOutput])

  const handleRun = async () => {
    if (!command.trim()) return
    setHistory(prev => [command, ...prev.slice(0, MAX_HISTORY_SIZE - 1)])
    setHistoryIndex(-1)
    await executeCommand(command)
    setCommand('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRun()
    } else if (e.key === 'ArrowUp') {
      const newIndex = Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(newIndex)
      setCommand(history[newIndex] || '')
    } else if (e.key === 'ArrowDown') {
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      setCommand(newIndex === -1 ? '' : history[newIndex])
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Terminal size={16} className="text-green-400" />
          Command Executor
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        {/* Quick commands */}
        <div className="flex flex-wrap gap-1">
          {SAMPLE_COMMANDS.map(cmd => (
            <button
              key={cmd}
              onClick={() => setCommand(cmd)}
              className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Output */}
        <div
          ref={outputRef}
          className="flex-1 bg-black/40 rounded-lg p-3 font-mono text-xs text-green-400 overflow-y-auto min-h-[200px] max-h-[400px]"
        >
          {commandOutput || (
            <span className="text-muted-foreground">No output yet. Run a command below.</span>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-mono text-sm">
              $
            </span>
            <Input
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
              className="pl-8 font-mono text-sm"
            />
          </div>
          <Button size="sm" onClick={handleRun} disabled={!command.trim()}>
            <Play size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCommandOutput('')}>
            <X size={14} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(commandOutput)
              toast.success('Copied!')
            }}
          >
            <ClipboardText size={14} />
          </Button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Clock size={11} />
              Recent commands
            </div>
            <div className="flex flex-wrap gap-1">
              {history.slice(0, 5).map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => setCommand(cmd)}
                  className="text-xs bg-muted/50 hover:bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground hover:text-foreground"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
