import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Terminal, ArrowUp } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { executeCommand, type CommandResult } from '@/services/localMachineService'

interface CommandExecutorProps {
  open: boolean
  onClose: () => void
}

export function CommandExecutor({ open, onClose }: CommandExecutorProps) {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<CommandResult[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history])

  const handleRun = async () => {
    if (!command.trim() || running) return
    const cmd = command.trim()
    setCommandHistory(prev => [cmd, ...prev.slice(0, 49)])
    setCommand('')
    setHistoryIndex(-1)
    setRunning(true)
    const result = await executeCommand(cmd)
    setHistory(prev => [...prev, result])
    setRunning(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRun()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(nextIndex)
      if (commandHistory[nextIndex]) setCommand(commandHistory[nextIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(nextIndex)
      setCommand(nextIndex === -1 ? '' : commandHistory[nextIndex])
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl mx-4 bg-background border border-white/12 rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/8 shrink-0">
              <Terminal size={18} className="text-green-400" />
              <h2 className="text-base font-bold text-white flex-1">Command Executor</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistory([])}
                className="text-white/40 hover:text-white h-7 px-2 text-xs"
              >
                Clear
              </Button>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Output */}
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto p-4 bg-black/40 font-mono text-xs space-y-4 min-h-[200px]"
            >
              {history.length === 0 && (
                <p className="text-white/25">Type a command below and press Enter to execute...</p>
              )}
              {history.map((result, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">$</span>
                    <span className="text-yellow-300">{result.command}</span>
                    <span className={`ml-auto text-xs ${result.exitCode === 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                      [{result.exitCode}] {result.durationMs}ms
                    </span>
                  </div>
                  {result.stdout && (
                    <pre className="text-white/80 whitespace-pre-wrap break-all pl-4">{result.stdout}</pre>
                  )}
                  {result.stderr && (
                    <pre className="text-red-400/80 whitespace-pre-wrap break-all pl-4">{result.stderr}</pre>
                  )}
                </div>
              ))}
              {running && (
                <div className="flex items-center gap-2 text-white/40">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white/40" />
                  <span>Running...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/8 flex items-center gap-2 shrink-0">
              <span className="text-green-400 font-mono text-sm shrink-0">$</span>
              <Input
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter command... (↑↓ for history)"
                className="flex-1 font-mono text-sm bg-black/40 border-white/20 text-white placeholder:text-white/20"
                disabled={running}
                autoFocus={open}
              />
              <Button
                onClick={handleRun}
                disabled={!command.trim() || running}
                className="bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 disabled:opacity-50 shrink-0"
              >
                <ArrowUp size={14} />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
