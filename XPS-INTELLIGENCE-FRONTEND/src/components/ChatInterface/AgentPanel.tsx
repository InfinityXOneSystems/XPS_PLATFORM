import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@/services/chatService'
import type { ChatMessage } from '@/services/chatService'

interface AgentPanelProps {
  agentStatus: AgentStatus
  messages: ChatMessage[]
  className?: string
}

const statusColors: Record<AgentStatus['status'], string> = {
  idle: 'bg-white/30',
  running: 'bg-green-400 animate-pulse',
  error: 'bg-red-400',
  offline: 'bg-zinc-500',
}

const agentColors: Record<string, string> = {
  PlannerAgent: 'text-violet-400 border-violet-500/20',
  ResearchAgent: 'text-sky-400 border-sky-500/20',
  BuilderAgent: 'text-cyan-400 border-cyan-500/20',
  ScraperAgent: 'text-amber-400 border-amber-500/20',
  MediaAgent: 'text-rose-400 border-rose-500/20',
  ValidatorAgent: 'text-yellow-400 border-yellow-500/20',
  DevOpsAgent: 'text-green-400 border-green-500/20',
  MonitoringAgent: 'text-red-400 border-red-500/20',
  KnowledgeAgent: 'text-indigo-400 border-indigo-500/20',
  BusinessAgent: 'text-blue-400 border-blue-500/20',
  PredictionAgent: 'text-emerald-400 border-emerald-500/20',
  SimulationAgent: 'text-teal-400 border-teal-500/20',
  MetaAgent: 'text-purple-400 border-purple-500/20',
}

export function AgentPanel({ agentStatus, messages, className }: AgentPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const lastMessage = messages[messages.length - 1]
  const colorClass = agentColors[agentStatus.role] || 'text-white/60 border-white/10'
  const [textColor, borderColor] = colorClass.split(' ')

  return (
    <div className={cn('rounded-xl border bg-black/20 overflow-hidden transition-colors hover:bg-black/30', borderColor || 'border-white/10', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', statusColors[agentStatus.status])} />
          <span className={cn('text-sm font-semibold truncate', textColor)}>{agentStatus.role}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-white/30">{(agentStatus.successRate * 100).toFixed(0)}%</span>
          <span className="text-xs text-white/30">{agentStatus.tasksCompleted} tasks</span>
          {expanded ? <CaretDown size={12} className="text-white/30" /> : <CaretRight size={12} className="text-white/30" />}
        </div>
      </button>

      {/* Preview of last message */}
      {!expanded && lastMessage && (
        <div className="px-3 pb-3">
          <p className="text-xs text-white/40 truncate">{lastMessage.content}</p>
        </div>
      )}

      {/* Expanded messages */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 p-3 space-y-2 max-h-48 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-xs text-white/25 italic">No messages yet</p>
              ) : (
                messages.slice(-5).map(msg => (
                  <div key={msg.id} className={cn('text-xs rounded-lg px-3 py-2', msg.role === 'user' ? 'bg-white/5 text-white/60' : 'bg-black/30 text-white/80')}>
                    <span className="text-white/30 mr-1">{msg.role === 'user' ? 'You:' : `${agentStatus.role}:`}</span>
                    {msg.content}
                  </div>
                ))
              )}
            </div>
            {agentStatus.currentTask && (
              <div className="px-3 pb-3">
                <p className="text-xs text-white/30">
                  <span className="text-green-400">▶</span> {agentStatus.currentTask}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
