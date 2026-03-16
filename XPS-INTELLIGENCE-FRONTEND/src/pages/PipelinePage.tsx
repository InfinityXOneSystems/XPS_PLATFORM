import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  ArrowsClockwise,
  Play,
  Pause,
  Trash,
  Lightning,
  Robot,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { orchestrator } from '@/lib/orchestrator'
import type { OrchestratorState, AgentSlot } from '@/lib/orchestrator'
import { agentPlanner } from '@/lib/agentPlanner'
import type { AgentPlan } from '@/lib/agentTypes'
import { cn } from '@/lib/utils'

interface PipelinePageProps {
  onNavigate: (page: string) => void
}

function agentStatusColor(status: AgentSlot['status']) {
  switch (status) {
    case 'running':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    case 'completed':
      return 'text-green-400 bg-green-500/10 border-green-500/30'
    case 'failed':
      return 'text-red-400 bg-red-500/10 border-red-500/30'
    default:
      return 'text-muted-foreground bg-muted/20 border-border/30'
  }
}

function AgentCard({ agent }: { agent: AgentSlot }) {
  const isActive = agent.status === 'running'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-xl border p-3 flex flex-col gap-1.5 transition-colors duration-300',
        agentStatusColor(agent.status)
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <ArrowsClockwise size={13} className="animate-spin" />
          ) : agent.status === 'completed' ? (
            <CheckCircle size={13} weight="fill" />
          ) : agent.status === 'failed' ? (
            <XCircle size={13} weight="fill" />
          ) : (
            <Clock size={13} />
          )}
          <span className="text-xs font-semibold truncate max-w-[110px]">{agent.role}</span>
        </div>
        <span className="text-[10px] opacity-70 capitalize">{agent.status}</span>
      </div>
      <div className="flex gap-3 text-[10px] opacity-60">
        <span>✓ {agent.tasksCompleted}</span>
        <span>✗ {agent.tasksFailed}</span>
      </div>
    </motion.div>
  )
}

function TaskRow({
  task,
  phase,
}: {
  task: { id: string; description: string; status: string; assignedAgent?: string; type: string }
  phase: 'queue' | 'running' | 'completed' | 'failed'
}) {
  const colors = {
    queue: 'border-border/30 text-muted-foreground',
    running: 'border-amber-500/40 text-amber-300',
    completed: 'border-green-500/40 text-green-300',
    failed: 'border-red-500/40 text-red-300',
  }

  const icons = {
    queue: <Clock size={12} className="shrink-0 text-muted-foreground" />,
    running: <ArrowsClockwise size={12} className="shrink-0 text-amber-400 animate-spin" />,
    completed: <CheckCircle size={12} weight="fill" className="shrink-0 text-green-400" />,
    failed: <XCircle size={12} weight="fill" className="shrink-0 text-red-400" />,
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={cn('flex items-center gap-2 py-1.5 px-2 rounded-lg border text-xs', colors[phase])}
    >
      {icons[phase]}
      <span className="flex-1 truncate">{task.description}</span>
      {task.assignedAgent && (
        <span className="text-[10px] opacity-50 shrink-0 font-mono">{task.assignedAgent}</span>
      )}
    </motion.div>
  )
}

const QUICK_COMMANDS = [
  'Scrape epoxy contractors in Dallas, TX',
  'Analyze and score all recent leads',
  'Deploy frontend to production',
  'Search for concrete companies in Austin',
]

export function PipelinePage({ onNavigate }: PipelinePageProps) {
  const [orchState, setOrchState] = useState<OrchestratorState>(orchestrator.getState())
  const [history, setHistory] = useState<AgentPlan[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [selectedCommand, setSelectedCommand] = useState('')
  const abortRef = useRef({ aborted: false })

  useEffect(() => {
    const unsub = orchestrator.subscribe((state) => {
      setOrchState(state)
    })
    setHistory(orchestrator.getHistory())
    return unsub
  }, [])

  const handleRun = useCallback(
    async (cmd: string) => {
      if (!cmd.trim() || isRunning) return
      setIsRunning(true)
      abortRef.current.aborted = false

      try {
        const plan = await agentPlanner.createPlan(cmd)
        await orchestrator.executePlan(plan, () => {}, abortRef.current)
        setHistory(orchestrator.getHistory())
      } finally {
        setIsRunning(false)
      }
    },
    [isRunning, abortRef]
  )

  const activeAgents = orchState.agents.filter((a) => a.status === 'running')
  const idleAgents = orchState.agents.filter((a) => a.status === 'idle')
  const busyCount = activeAgents.length
  const queueCount = orchState.queue.length
  const completedCount = orchState.completed.length
  const failedCount = orchState.failed.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-background p-6 max-w-6xl mx-auto"
    >
      <BackButton onBack={() => onNavigate('home')} />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <GitBranch size={22} weight="duotone" className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Agent Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Parallel task execution across 12 specialized agents
          </p>
        </div>
        {isRunning && (
          <Badge variant="outline" className="ml-auto text-amber-400 border-amber-500/30 gap-1.5">
            <ArrowsClockwise size={12} className="animate-spin" />
            Executing
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Agents', value: busyCount, color: 'text-amber-400' },
          { label: 'Queued', value: queueCount, color: 'text-blue-400' },
          { label: 'Completed', value: completedCount, color: 'text-green-400' },
          { label: 'Failed', value: failedCount, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Launch + Task queues */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Quick launch */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightning size={14} className="text-amber-400" />
                Quick Launch
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    setSelectedCommand(cmd)
                    handleRun(cmd)
                  }}
                  disabled={isRunning}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors',
                    isRunning && 'opacity-40 cursor-not-allowed',
                    selectedCommand === cmd && isRunning && 'border-amber-500/40 text-amber-300'
                  )}
                >
                  {cmd}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Task queue columns */}
          <div className="grid grid-cols-3 gap-3">
            {/* Running */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                  <Play size={11} weight="fill" />
                  Running ({orchState.running.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 min-h-[80px]">
                <AnimatePresence>
                  {orchState.running.map((t) => (
                    <TaskRow key={t.id} task={t} phase="running" />
                  ))}
                </AnimatePresence>
                {orchState.running.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">No active tasks</p>
                )}
              </CardContent>
            </Card>

            {/* Queue */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-blue-400">
                  <Pause size={11} weight="fill" />
                  Queued ({orchState.queue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 min-h-[80px]">
                <AnimatePresence>
                  {orchState.queue.map((t) => (
                    <TaskRow key={t.id} task={t} phase="queue" />
                  ))}
                </AnimatePresence>
                {orchState.queue.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">Queue empty</p>
                )}
              </CardContent>
            </Card>

            {/* Completed + Failed */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-green-400">
                  <CheckCircle size={11} weight="fill" />
                  Done ({orchState.completed.length + orchState.failed.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 min-h-[80px] overflow-y-auto max-h-48">
                <AnimatePresence>
                  {orchState.failed.map((t) => (
                    <TaskRow key={t.id} task={t} phase="failed" />
                  ))}
                  {orchState.completed.map((t) => (
                    <TaskRow key={t.id} task={t} phase="completed" />
                  ))}
                </AnimatePresence>
                {orchState.completed.length === 0 && orchState.failed.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">No completed tasks</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Execution history */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Execution History</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => setHistory([])}
                >
                  <Trash size={11} className="mr-1" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No execution history yet</p>
              )}
              {history.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-2 text-xs py-1.5 border-b border-border/20 last:border-0"
                >
                  {plan.status === 'completed' ? (
                    <CheckCircle size={12} weight="fill" className="text-green-400 shrink-0" />
                  ) : plan.status === 'failed' ? (
                    <XCircle size={12} weight="fill" className="text-red-400 shrink-0" />
                  ) : (
                    <Clock size={12} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate text-foreground/80">{plan.userCommand}</span>
                  <span className="text-muted-foreground shrink-0">{plan.tasks.length} tasks</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Agent status grid */}
        <div className="flex flex-col gap-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Robot size={14} className="text-primary" />
                Agent Fleet
                <span className="ml-auto text-xs text-muted-foreground">
                  {idleAgents.length} idle · {busyCount} active
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {orchState.agents.map((agent) => (
                <AgentCard key={agent.role} agent={agent} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
