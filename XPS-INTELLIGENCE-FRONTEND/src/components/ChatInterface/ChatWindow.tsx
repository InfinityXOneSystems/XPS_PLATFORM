import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PaperPlaneTilt, Robot } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { sendMessage, type ChatMessage } from '@/services/chatService'
import type { AgentRole } from '@/lib/agentTypes'

interface ChatWindowProps {
  messages: ChatMessage[]
  onNewMessage: (message: ChatMessage) => void
  selectedAgent?: AgentRole
  onAgentChange?: (agent: AgentRole) => void
  sessionId?: string
  className?: string
}

const AGENTS: AgentRole[] = [
  'PlannerAgent', 'ResearchAgent', 'BuilderAgent', 'ScraperAgent', 'MediaAgent',
  'ValidatorAgent', 'DevOpsAgent', 'MonitoringAgent', 'KnowledgeAgent',
  'BusinessAgent', 'PredictionAgent', 'SimulationAgent', 'MetaAgent',
]

const agentColors: Record<string, string> = {
  PlannerAgent: 'text-violet-400',
  ResearchAgent: 'text-sky-400',
  BuilderAgent: 'text-cyan-400',
  ScraperAgent: 'text-amber-400',
  MediaAgent: 'text-rose-400',
  ValidatorAgent: 'text-yellow-400',
  DevOpsAgent: 'text-green-400',
  MonitoringAgent: 'text-red-400',
  KnowledgeAgent: 'text-indigo-400',
  BusinessAgent: 'text-blue-400',
  PredictionAgent: 'text-emerald-400',
  SimulationAgent: 'text-teal-400',
  MetaAgent: 'text-purple-400',
}

export function ChatWindow({ messages, onNewMessage, selectedAgent = 'PlannerAgent', onAgentChange, sessionId, className }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
    }
    onNewMessage(userMsg)
    const text = input.trim()
    setInput('')
    setSending(true)
    const result = await sendMessage({ message: text, agentRole: selectedAgent, sessionId })
    onNewMessage(result.reply)
    setSending(false)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Agent selector */}
      <div className="flex items-center gap-2 p-3 border-b border-white/8 shrink-0">
        <Robot size={14} className="text-white/40 shrink-0" />
        <select
          value={selectedAgent}
          onChange={e => onAgentChange?.(e.target.value as AgentRole)}
          className="flex-1 bg-black/40 border border-white/15 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        >
          {AGENTS.map(a => (
            <option key={a} value={a} className="bg-zinc-900">{a}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}
            >
              {msg.agentRole && (
                <span className={cn('text-xs font-medium px-2', agentColors[msg.agentRole] || 'text-white/50')}>
                  {msg.agentRole}
                </span>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-100 rounded-br-sm'
                    : msg.role === 'system'
                      ? 'bg-white/5 border border-white/10 text-white/50 text-xs italic'
                      : 'bg-white/8 border border-white/12 text-white/90 rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
              <span className="text-xs text-white/25 px-2">
                {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{selectedAgent} thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/8 flex gap-2 shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={`Message ${selectedAgent}...`}
          className="flex-1 bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm"
          disabled={sending}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50 shrink-0"
        >
          <PaperPlaneTilt size={16} />
        </Button>
      </div>
    </div>
  )
}
