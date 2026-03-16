import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChatWindow } from './ChatWindow'
import { AgentPanel } from './AgentPanel'
import type { ChatMessage, AgentStatus } from '@/services/chatService'
import { getChatHistory, getAgentStatus } from '@/services/chatService'
import type { AgentRole } from '@/lib/agentTypes'

interface MultiAgentChatProps {
  className?: string
}

export function MultiAgentChat({ className }: MultiAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentRole>('PlannerAgent')
  const [agentMessages, setAgentMessages] = useState<Record<string, ChatMessage[]>>({})
  const sessionId = 'multi-agent-session'

  useEffect(() => {
    getChatHistory(sessionId).then(setMessages)
    getAgentStatus().then(setAgentStatuses)
  }, [])

  const handleNewMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message])
    if (message.agentRole) {
      setAgentMessages(prev => ({
        ...prev,
        [message.agentRole!]: [...(prev[message.agentRole!] || []), message],
      }))
    }
  }

  return (
    <div className={`flex gap-4 h-full ${className || ''}`}>
      {/* Main orchestrator chat */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 flex flex-col rounded-2xl border border-white/10 bg-black/20 overflow-hidden"
        style={{ minHeight: '400px' }}
      >
        <div className="p-4 border-b border-white/8 shrink-0">
          <h3 className="text-sm font-bold text-white">Orchestrator Chat</h3>
          <p className="text-xs text-white/40">Commands all agents</p>
        </div>
        <ChatWindow
          messages={messages}
          onNewMessage={handleNewMessage}
          selectedAgent={selectedAgent}
          onAgentChange={setSelectedAgent}
          sessionId={sessionId}
          className="flex-1"
        />
      </motion.div>

      {/* Agent panels */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-72 shrink-0 space-y-2 overflow-y-auto"
      >
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider px-1 py-2">Agent Status</h3>
        {agentStatuses.map(status => (
          <AgentPanel
            key={status.role}
            agentStatus={status}
            messages={agentMessages[status.role] || []}
          />
        ))}
      </motion.div>
    </div>
  )
}
