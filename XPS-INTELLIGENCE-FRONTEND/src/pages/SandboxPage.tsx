import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Browser,
  Terminal,
  Play,
  Stop,
  Trash,
  ArrowClockwise,
  Lock,
  Globe,
  CheckCircle,
  XCircle,
  Spinner,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { cn } from '@/lib/utils'

interface SandboxPageProps {
  onNavigate: (page: string) => void
}

type LogLevel = 'info' | 'success' | 'error' | 'warn' | 'cmd'

interface ConsoleEntry {
  id: string
  level: LogLevel
  message: string
  timestamp: string
}

const SAFE_URLS = [
  'https://example.com',
  'https://httpbin.org/get',
  'https://jsonplaceholder.typicode.com/todos/1',
]

function levelColor(level: LogLevel) {
  switch (level) {
    case 'success': return 'text-green-400'
    case 'error':   return 'text-red-400'
    case 'warn':    return 'text-yellow-400'
    case 'cmd':     return 'text-cyan-400'
    default:        return 'text-foreground/80'
  }
}

function levelIcon(level: LogLevel) {
  switch (level) {
    case 'success': return <CheckCircle size={12} weight="fill" className="text-green-400 shrink-0" />
    case 'error':   return <XCircle size={12} weight="fill" className="text-red-400 shrink-0" />
    case 'warn':    return <XCircle size={12} className="text-yellow-400 shrink-0" />
    default:        return <span className="w-3 shrink-0" />
  }
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

export function SandboxPage({ onNavigate }: SandboxPageProps) {
  const [activeTab, setActiveTab] = useState<'browser' | 'console'>('browser')
  const [urlInput, setUrlInput] = useState('https://example.com')
  const [currentUrl, setCurrentUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    {
      id: '1',
      level: 'info',
      message: 'XPS Sandbox Console ready. Connect backend sandbox runtime for full execution.',
      timestamp: timestamp(),
    },
  ])
  const [cmdInput, setCmdInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const log = (message: string, level: LogLevel = 'info') => {
    setConsoleEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), level, message, timestamp: timestamp() },
    ])
  }

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleEntries])

  const navigateTo = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    setCurrentUrl(url)
    setUrlInput(url)
    setIsLoading(true)
    setIframeKey((k) => k + 1)
    log(`Navigating to: ${url}`, 'cmd')
    setTimeout(() => {
      setIsLoading(false)
      log(`Page loaded: ${url}`, 'success')
    }, 1500)
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigateTo(urlInput)
  }

  const handleReload = () => {
    if (currentUrl) {
      setIsLoading(true)
      setIframeKey((k) => k + 1)
      log(`Reloading: ${currentUrl}`, 'cmd')
      setTimeout(() => {
        setIsLoading(false)
        log('Page reloaded', 'success')
      }, 1000)
    }
  }

  const handleClearConsole = () => {
    setConsoleEntries([])
    log('Console cleared', 'info')
  }

  const SANDBOX_COMMANDS: Record<string, () => Promise<void>> = {
    help: async () => {
      log('Available commands: help, status, agents, memory, clear, ping', 'info')
    },
    status: async () => {
      log('Sandbox status: ACTIVE', 'success')
      log('Runtime: Browser sandbox (no backend connection)', 'info')
      log('Memory: localStorage (persisted)', 'info')
      log('Workers: 0 active', 'info')
    },
    agents: async () => {
      const roles = [
        'PlannerAgent', 'ResearchAgent', 'BuilderAgent', 'ScraperAgent',
        'MediaAgent', 'ValidatorAgent', 'DevOpsAgent', 'MonitoringAgent',
        'KnowledgeAgent', 'BusinessAgent', 'PredictionAgent', 'SimulationAgent',
      ]
      log(`Registered agents (${roles.length}):`, 'info')
      roles.forEach((r) => log(`  • ${r}`, 'info'))
    },
    memory: async () => {
      try {
        const raw = localStorage.getItem('xps_agent_memory')
        if (raw) {
          const store = JSON.parse(raw)
          log(`Memory entries: ${store.entries?.length ?? 0}`, 'info')
          log(`Last updated: ${store.lastUpdated ?? 'unknown'}`, 'info')
        } else {
          log('No memory entries found', 'warn')
        }
      } catch {
        log('Failed to read memory store', 'error')
      }
    },
    clear: async () => {
      setConsoleEntries([])
    },
    ping: async () => {
      log('pong ✓', 'success')
    },
  }

  const runCommand = async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return
    log(`$ ${trimmed}`, 'cmd')
    setIsRunning(true)
    await new Promise((r) => setTimeout(r, 200))

    const parts = trimmed.split(/\s+/)
    const cmd = parts[0].toLowerCase()

    if (cmd in SANDBOX_COMMANDS) {
      await SANDBOX_COMMANDS[cmd]()
    } else {
      log(`Unknown command: ${cmd}. Type 'help' for available commands.`, 'warn')
    }
    setIsRunning(false)
  }

  const handleCmdSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runCommand(cmdInput)
    setCmdInput('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton onBack={() => onNavigate('home')} />
        <div className="flex items-center gap-3">
          <Browser size={24} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sandbox</h1>
            <p className="text-sm text-muted-foreground">Browser panel and sandbox console</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge
            variant="outline"
            className="bg-green-500/10 text-green-400 border-green-500/30 text-xs"
          >
            ● Active
          </Badge>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('browser')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors',
            activeTab === 'browser'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
          )}
        >
          <Globe size={15} />
          Browser Panel
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors',
            activeTab === 'console'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
          )}
        >
          <Terminal size={15} />
          Sandbox Console
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'browser' ? (
          <motion.div
            key="browser"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* URL Bar */}
            <Card className="bg-muted/10 border-border/50">
              <CardContent className="p-3">
                <form onSubmit={handleUrlSubmit} className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1 bg-background/50 border border-border/50 rounded-md px-3">
                    <Lock size={13} className="text-muted-foreground shrink-0" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Enter URL…"
                      className="border-0 bg-transparent p-0 h-8 focus-visible:ring-0 text-sm"
                    />
                    {isLoading && <Spinner size={13} className="animate-spin text-primary shrink-0" />}
                  </div>
                  <Button type="submit" size="sm" disabled={isLoading}>
                    <Play size={13} weight="fill" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleReload} disabled={!currentUrl || isLoading}>
                    <ArrowClockwise size={13} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCurrentUrl('')
                      setUrlInput('')
                    }}
                    disabled={!currentUrl}
                  >
                    <Stop size={13} />
                  </Button>
                </form>

                {/* Quick links */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Quick:</span>
                  {SAFE_URLS.map((u) => (
                    <button
                      key={u}
                      onClick={() => navigateTo(u)}
                      className="text-xs text-primary/80 hover:text-primary underline underline-offset-2"
                    >
                      {u.replace('https://', '')}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* iframe */}
            <Card className="bg-muted/10 border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {currentUrl ? (
                  <div className="relative">
                    {isLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
                        <Spinner size={28} className="animate-spin text-primary" />
                      </div>
                    )}
                    <iframe
                      key={iframeKey}
                      src={currentUrl}
                      title="Sandbox Browser"
                      className="w-full h-[500px] border-0"
                      sandbox="allow-scripts allow-forms allow-popups"
                      onLoad={() => setIsLoading(false)}
                      onError={() => {
                        setIsLoading(false)
                        log(`Failed to load: ${currentUrl}`, 'error')
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-center px-8">
                    <Globe size={48} className="text-muted-foreground/30" />
                    <p className="text-muted-foreground">Enter a URL above to browse in the sandbox</p>
                    <p className="text-sm text-muted-foreground/60">
                      Sandbox browser restricts cross-origin access. Some sites may block embedding.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="console"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <Card className="bg-muted/10 border-border/50">
              <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Terminal size={14} />
                  Sandbox Console
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={handleClearConsole} className="h-7 gap-1 text-xs">
                  <Trash size={13} />
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4 space-y-3">
                {/* Log output */}
                <div className="h-[380px] overflow-y-auto bg-background/60 rounded-md border border-border/30 p-3 font-mono text-xs space-y-1">
                  {consoleEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      {levelIcon(entry.level)}
                      <span className="text-muted-foreground/50 shrink-0">{entry.timestamp}</span>
                      <span className={levelColor(entry.level)}>{entry.message}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>

                {/* Command input */}
                <form onSubmit={handleCmdSubmit} className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1 bg-background/50 border border-border/50 rounded-md px-3">
                    <span className="text-cyan-400 text-xs font-mono shrink-0">$</span>
                    <Input
                      value={cmdInput}
                      onChange={(e) => setCmdInput(e.target.value)}
                      placeholder="Type a command… (try 'help')"
                      className="border-0 bg-transparent p-0 h-8 focus-visible:ring-0 text-xs font-mono"
                      disabled={isRunning}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={isRunning || !cmdInput.trim()}>
                    <Play size={13} weight="fill" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
