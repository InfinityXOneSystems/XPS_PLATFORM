import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Pulse,
  ChatCircle,
  Wrench,
  ArrowsClockwise,
  CheckCircle,
  XCircle,
  CircleNotch,
  Brain,
  MagnifyingGlass,
  Download,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { loadToolRegistry, getEnabledTools } from '@/tools/toolRegistry'
import type { ToolCall, ActivityEntry, ActivityEntryType } from '@/types/tools'

const CrosshairIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="#800000" strokeWidth="2" fill="none" />
    <circle cx="12" cy="12" r="5" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
    <line x1="12" y1="1" x2="12" y2="7" stroke="#800000" strokeWidth="2" />
    <line x1="12" y1="17" x2="12" y2="23" stroke="#800000" strokeWidth="2" />
    <line x1="1" y1="12" x2="7" y2="12" stroke="#800000" strokeWidth="2" />
    <line x1="17" y1="12" x2="23" y2="12" stroke="#800000" strokeWidth="2" />
    <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
  </svg>
)

const _AGENT_COMMANDS = [
  'scrape epoxy companies Orlando',
  'generate outreach email',
  'build analytics dashboard',
  'deploy backend',
  'analyze leads',
]

const _isAgentCommand = (text: string): boolean => {
  const lower = text.toLowerCase()
  return (
    lower.startsWith('scrape ') ||
    lower.startsWith('deploy ') ||
    lower.startsWith('build ') ||
    lower.includes('generate') ||
    lower.includes('analyze leads') ||
    lower.includes('run scraper') ||
    lower.includes('github action')
  )
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCall?: ToolCall
}

interface AIChatPanelProps {
  onClose?: () => void
}

// ─── Tool Call Display ────────────────────────────────────────────────────────

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const statusIcon = {
    pending: <CircleNotch size={12} className="animate-spin text-white/50" />,
    running: <ArrowsClockwise size={12} className="animate-spin text-yellow-400" />,
    completed: <CheckCircle size={12} className="text-green-400" weight="fill" />,
    failed: <XCircle size={12} className="text-red-400" weight="fill" />,
  }[toolCall.status]

  const statusColor = {
    pending: 'border-white/10',
    running: 'border-yellow-400/30',
    completed: 'border-green-400/20',
    failed: 'border-red-400/20',
  }[toolCall.status]

  return (
    <div
      className={cn('rounded-lg p-2.5 text-xs border mt-2', statusColor)}
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Wrench size={11} className="text-yellow-400 shrink-0" />
        <code className="font-mono text-yellow-400 flex-1 truncate">{toolCall.toolName}</code>
        {statusIcon}
      </div>

      {Object.keys(toolCall.parameters).length > 0 && (
        <div className="space-y-0.5 mb-1.5">
          {Object.entries(toolCall.parameters).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="text-white/40 shrink-0">{k}:</span>
              <span className="text-white/70 truncate">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {toolCall.progress !== undefined && toolCall.status === 'running' && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-white/40">Progress</span>
            <span className="text-white/60">{toolCall.progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-yellow-400"
              initial={{ width: 0 }}
              animate={{ width: `${toolCall.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {toolCall.result && toolCall.status === 'completed' && (
        <div className="mt-1.5 pt-1.5 border-t border-white/8">
          <p className="text-white/60 line-clamp-3">{toolCall.result}</p>
        </div>
      )}

      {toolCall.error && toolCall.status === 'failed' && (
        <div className="mt-1.5 pt-1.5 border-t border-red-400/20">
          <p className="text-red-400/80">{toolCall.error}</p>
        </div>
      )}
    </div>
  )
}

// ─── Activity Entry ───────────────────────────────────────────────────────────

const activityIcons: Record<ActivityEntryType, React.ReactNode> = {
  thinking: <Brain size={11} className="text-blue-400" />,
  tool_call: <Wrench size={11} className="text-yellow-400" />,
  scraping: <MagnifyingGlass size={11} className="text-purple-400" />,
  extraction: <Download size={11} className="text-cyan-400" />,
  info: <Pulse size={11} className="text-white/40" />,
  success: <CheckCircle size={11} className="text-green-400" weight="fill" />,
  error: <XCircle size={11} className="text-red-400" weight="fill" />,
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex items-start gap-1.5 py-1">
      <span className="mt-0.5 shrink-0">{activityIcons[entry.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/60 leading-snug">{entry.message}</p>
        {entry.toolCall && <ToolCallCard toolCall={entry.toolCall} />}
      </div>
      <span className="text-[10px] text-white/25 shrink-0 mt-0.5 font-mono">
        {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AIChatPanel({ onClose }: AIChatPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'activity'>('chat')
  const [enabledTools] = useState(() => getEnabledTools(loadToolRegistry()))
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm Lead Sniper, your AI command center. I can find leads, write code, deploy apps, scrape markets, and execute any command through registered tools. Try asking me something!",
      timestamp: new Date(),
    },
  ])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activityScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (activityScrollRef.current) {
      activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight
    }
  }, [activity])

  const addActivity = useCallback((type: ActivityEntryType, message: string, toolCall?: ToolCall) => {
    setActivity((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), type, message, toolCall, timestamp: new Date() },
    ])
  }, [])

  const simulateToolCall = useCallback(
    async (toolName: string, parameters: Record<string, unknown>): Promise<string> => {
      const callId = Date.now().toString()
      const toolCall: ToolCall = {
        id: callId,
        toolName,
        parameters,
        status: 'running',
        progress: 0,
        timestamp: new Date(),
      }

      addActivity('tool_call', `Calling tool: ${toolName}`, { ...toolCall })

      // Simulate progress
      for (let p = 20; p <= 80; p += 20) {
        await new Promise((r) => setTimeout(r, 300))
        addActivity('tool_call', `Tool ${toolName} running…`, { ...toolCall, progress: p })
      }

      await new Promise((r) => setTimeout(r, 400))

      const result = `Tool "${toolName}" completed successfully with parameters: ${JSON.stringify(parameters)}`
      addActivity('success', `Tool ${toolName} finished`, {
        ...toolCall,
        status: 'completed',
        progress: 100,
        result,
      })

      return result
    },
    [addActivity]
  )

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)

    addActivity('thinking', `Processing: "${currentInput.slice(0, 60)}${currentInput.length > 60 ? '…' : ''}"`)

    try {
      const toolList = enabledTools
        .map((t) => `- ${t.name}: ${t.description} (params: ${t.parameters.map((p) => p.name).join(', ')})`)
        .join('\n')

      const promptText = `You are Lead Sniper, an AI command center for an autonomous agent platform. You can access registered tools to build software, scrape markets, deploy infrastructure, and automate business operations.

Available tools:
${toolList}

When you need to use a tool, include a line in your response formatted as:
[TOOL_CALL: tool_name | param1=value1 | param2=value2]

User query: ${currentInput}

Provide a helpful response. If the task requires a tool, call it. Keep the explanation concise.`

      addActivity('thinking', 'Querying AI model…')

      const response = await window.spark.llm(promptText, 'gpt-4o-mini')

      // Match tool call syntax: [TOOL_CALL: tool_name | param1=value1 | param2=value2]
      const TOOL_CALL_PATTERN = /\[TOOL_CALL:\s*([^|\]]+)(?:\s*\|([^\]]*))?\]/g
      let match
      let cleanResponse = response
      const toolResults: string[] = []

      while ((match = TOOL_CALL_PATTERN.exec(response)) !== null) {
        const toolName = match[1].trim()
        const paramStr = match[2] ?? ''
        const parameters: Record<string, string> = {}

        if (paramStr) {
          paramStr.split('|').forEach((pair) => {
            const [k, ...vParts] = pair.split('=')
            if (k) parameters[k.trim()] = vParts.join('=').trim()
          })
        }

        addActivity('tool_call', `Agent triggered tool: ${toolName}`)
        const result = await simulateToolCall(toolName, parameters)
        toolResults.push(result)
        cleanResponse = cleanResponse.replace(match[0], `\n_Tool ${toolName} executed._\n`)
      }

      if (toolResults.length > 0) {
        addActivity('info', `${toolResults.length} tool(s) executed`)
      }

      addActivity('success', 'Response ready')

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanResponse.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      addActivity('error', 'Error processing request')
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      className="h-full w-80 flex flex-col border-l border-border-subtle"
      style={{
        background: 'var(--card)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CrosshairIcon />
          <h2 className="font-bold text-foreground">Lead Sniper</h2>
          <Badge variant="outline" className="text-xs">AI Agent</Badge>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border-subtle shrink-0">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'chat' ? 'text-foreground border-b-2 border-yellow-400' : 'text-muted-foreground'
          )}
        >
          <ChatCircle size={13} />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors relative',
            activeTab === 'activity' ? 'text-foreground border-b-2 border-yellow-400' : 'text-muted-foreground'
          )}
        >
          <Pulse size={13} />
          Activity
          {activity.length > 0 && (
            <Badge className="absolute top-1 right-3 h-4 min-w-4 px-1 text-[10px] bg-yellow-500 text-black">
              {activity.length > 99 ? '99+' : activity.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div className="max-w-[85%] text-sm text-foreground">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="text-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
                    <span className="w-2 h-2 bg-gold rounded-full animate-pulse delay-75" />
                    <span className="w-2 h-2 bg-gold rounded-full animate-pulse delay-150" />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="flex-1 overflow-y-auto p-3" ref={activityScrollRef}>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Pulse size={28} className="text-white/15 mb-2" />
              <p className="text-xs text-white/30">No activity yet</p>
              <p className="text-xs text-white/20 mt-0.5">Send a message to see agent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {activity.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ActivityRow entry={entry} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border-subtle shrink-0">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask or run a command..."
              className="w-full text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-offset-0 px-4 py-3 rounded-xl border-2 border-transparent"
              style={{
                background: 'rgba(0, 0, 0, 0.70)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
              disabled={isLoading}
            />
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                padding: '2px',
                background:
                  'linear-gradient(135deg, var(--gradient-gold-start) 0%, var(--gradient-gold-mid) 25%, var(--gradient-silver-start) 50%, var(--gradient-gold-mid) 75%, var(--gradient-gold-start) 100%)',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                backgroundSize: '200% 200%',
                animation: 'gradient-shift 3s linear infinite',
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 12 L19 5 L12 19 L10 14 L5 12 Z"
                fill="oklch(0.42 0.14 20)"
                stroke="oklch(0.42 0.14 20)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Powered by GPT-4 · Tool-enabled</p>
      </div>
    </motion.div>
  )
}
