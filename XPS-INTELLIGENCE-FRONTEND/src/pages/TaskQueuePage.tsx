import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Queue,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Spinner,
  Robot,
  Trash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { agentPlanner } from '@/lib/agentPlanner'
import { cn } from '@/lib/utils'
import type { AgentPlan, AgentTask } from '@/lib/agentTypes'

interface TaskQueuePageProps {
  onNavigate: (page: string) => void
}

const AGENT_COLORS: Record<string, string> = {
  PlannerAgent: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ResearchAgent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BuilderAgent: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  ScraperAgent: 'bg-green-500/20 text-green-300 border-green-500/30',
  MediaAgent: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  ValidatorAgent: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DevOpsAgent: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  MonitoringAgent: 'bg-red-500/20 text-red-300 border-red-500/30',
  KnowledgeAgent: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  BusinessAgent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  PredictionAgent: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  SimulationAgent: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
}

function statusIcon(status: AgentTask['status']) {
  switch (status) {
    case 'pending':
      return <Clock size={14} className="text-muted-foreground" />
    case 'running':
      return <Spinner size={14} className="animate-spin text-yellow-400" />
    case 'completed':
      return <CheckCircle size={14} weight="fill" className="text-green-400" />
    case 'failed':
      return <XCircle size={14} weight="fill" className="text-red-400" />
  }
}

function TaskRow({ task }: { task: AgentTask }) {
  const agentClass = task.agent ? (AGENT_COLORS[task.agent] ?? 'bg-muted/30 text-muted-foreground') : 'bg-muted/30 text-muted-foreground'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2 px-3 rounded-md border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors"
    >
      <div className="shrink-0">{statusIcon(task.status)}</div>
      <span className="flex-1 text-sm text-foreground/90 truncate">{task.description}</span>
      {task.agent && (
        <Badge variant="outline" className={cn('text-xs border', agentClass)}>
          {task.agent}
        </Badge>
      )}
      <Badge variant="outline" className="text-xs font-mono">
        {task.type}
      </Badge>
    </motion.div>
  )
}

function PlanCard({ plan }: { plan: AgentPlan }) {
  const [expanded, setExpanded] = useState(plan.status === 'running')

  const pending = plan.tasks.filter((t) => t.status === 'pending').length
  const running = plan.tasks.filter((t) => t.status === 'running').length
  const completed = plan.tasks.filter((t) => t.status === 'completed').length
  const failed = plan.tasks.filter((t) => t.status === 'failed').length

  const statusColor = {
    pending: 'text-muted-foreground',
    running: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    partial: 'text-orange-400',
  }[plan.status]

  return (
    <Card className="bg-muted/10 border-border/50">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <Robot size={16} className="text-primary shrink-0" />
          <span className="flex-1 text-sm font-medium truncate">{plan.userCommand}</span>
          <span className={cn('text-xs font-semibold uppercase', statusColor)}>{plan.status}</span>
          <div className="flex gap-2 text-xs text-muted-foreground">
            {pending > 0 && <span>{pending} pending</span>}
            {running > 0 && <span className="text-yellow-400">{running} running</span>}
            {completed > 0 && <span className="text-green-400">{completed} done</span>}
            {failed > 0 && <span className="text-red-400">{failed} failed</span>}
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 pb-3 px-4 space-y-1.5">
              {plan.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export function TaskQueuePage({ onNavigate }: TaskQueuePageProps) {
  const [plans, setPlans] = useState<AgentPlan[]>([])
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setPlans(agentPlanner.getHistory())
  }, [])

  const runExamplePlan = async () => {
    setIsRunning(true)
    const commands = [
      'Scrape epoxy contractors in Miami, FL',
      'Research top construction companies in Atlanta',
      'Analyze and score Q2 lead pipeline',
    ]
    const command = commands[Math.floor(Math.random() * commands.length)]

    try {
      const plan = await agentPlanner.createPlan(command)
      await agentPlanner.executePlan(plan, (updated) => {
        const history = agentPlanner.getHistory()
        if (history.find((p) => p.id === updated.id)) {
          setPlans(history.map((p) => (p.id === updated.id ? updated : p)))
        } else {
          setPlans([updated, ...history])
        }
      })
    } finally {
      setIsRunning(false)
      setPlans(agentPlanner.getHistory())
    }
  }

  const clearQueue = () => {
    agentPlanner.clearHistory()
    setPlans([])
  }

  const pendingCount = plans.filter((p) => p.status === 'pending').length
  const runningCount = plans.filter((p) => p.status === 'running').length
  const completedCount = plans.filter((p) => p.status === 'completed').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton onBack={() => onNavigate('home')} />
        <div className="flex items-center gap-3">
          <Queue size={24} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Task Queue</h1>
            <p className="text-sm text-muted-foreground">Agent task orchestration and parallel execution</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Spinner size={20} className="text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-yellow-400">{runningCount}</p>
              <p className="text-xs text-muted-foreground">Running</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/10 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock size={20} className="text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle size={20} weight="fill" className="text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <Button onClick={runExamplePlan} disabled={isRunning} className="gap-2">
          <Play size={16} weight="fill" />
          {isRunning ? 'Running...' : 'Run Example Task'}
        </Button>
        <Button variant="outline" onClick={clearQueue} disabled={isRunning} className="gap-2">
          <Trash size={16} />
          Clear Queue
        </Button>
      </div>

      {/* Task Plans */}
      <div className="space-y-3">
        {plans.length === 0 ? (
          <Card className="bg-muted/10 border-border/50">
            <CardContent className="p-12 text-center">
              <Queue size={40} className="text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground">No tasks in queue.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Run an agent command from the chat or click &quot;Run Example Task&quot;.
              </p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Agent Roster */}
      <Card className="bg-muted/10 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Agent Roster</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(AGENT_COLORS).map(([name, cls]) => (
              <div
                key={name}
                className={cn(
                  'px-3 py-2 rounded-md border text-xs font-medium text-center',
                  cls
                )}
              >
                {name}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
