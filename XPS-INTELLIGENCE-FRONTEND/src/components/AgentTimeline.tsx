import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  Clock,
  CircleNotch,
  Robot,
  EnvelopeSimple,
  ChartBar,
  RocketLaunch,
  Layout,
  MagnifyingGlass,
  FileText,
  GithubLogo,
  Brain,
  Binoculars,
  CheckSquare,
  Pulse,
  Image,
  BookOpen,
  ChartLine,
  PlayCircle,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentPlan, AgentTask, TaskType, TaskStatus } from '@/lib/agentTypes'

interface AgentTimelineProps {
  plan: AgentPlan | null
  isRunning: boolean
}

const TASK_ICONS: Record<TaskType, React.ElementType> = {
  scrape: Robot,
  generate_email: EnvelopeSimple,
  analyze_leads: ChartBar,
  deploy: RocketLaunch,
  build_ui: Layout,
  search: MagnifyingGlass,
  report: FileText,
  github_action: GithubLogo,
  plan: Brain,
  research: Binoculars,
  validate: CheckSquare,
  monitor: Pulse,
  media: Image,
  knowledge: BookOpen,
  predict: ChartLine,
  simulate: PlayCircle,
}

const TASK_COLORS: Record<TaskType, string> = {
  scrape: 'text-amber-400',
  generate_email: 'text-blue-400',
  analyze_leads: 'text-purple-400',
  deploy: 'text-green-400',
  build_ui: 'text-cyan-400',
  search: 'text-orange-400',
  report: 'text-slate-400',
  github_action: 'text-pink-400',
  plan: 'text-violet-400',
  research: 'text-sky-400',
  validate: 'text-yellow-400',
  monitor: 'text-red-400',
  media: 'text-rose-400',
  knowledge: 'text-indigo-400',
  predict: 'text-emerald-400',
  simulate: 'text-teal-400',
}

const TASK_BADGE_VARIANTS: Record<TaskType, string> = {
  scrape: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  generate_email: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  analyze_leads: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  deploy: 'bg-green-500/10 text-green-400 border-green-500/20',
  build_ui: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  search: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  report: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  github_action: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  plan: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  research: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  validate: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  monitor: 'bg-red-500/10 text-red-400 border-red-500/20',
  media: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  knowledge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  predict: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  simulate: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'completed') {
    return <CheckCircle size={20} weight="fill" className="text-green-400 shrink-0" />
  }
  if (status === 'failed') {
    return <XCircle size={20} weight="fill" className="text-red-400 shrink-0" />
  }
  if (status === 'running') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="shrink-0"
      >
        <CircleNotch size={20} weight="bold" className="text-amber-400" />
      </motion.div>
    )
  }
  return <Clock size={20} weight="regular" className="text-muted-foreground shrink-0" />
}

function formatDuration(task: AgentTask): string | null {
  if (!task.startedAt || !task.completedAt) return null
  const ms = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function TaskItem({ task, index }: { task: AgentTask; index: number }) {
  const Icon = TASK_ICONS[task.type]
  const iconColor = TASK_COLORS[task.type]
  const badgeClass = TASK_BADGE_VARIANTS[task.type]
  const duration = formatDuration(task)
  const label = task.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="flex gap-3 group"
    >
      <div className="flex flex-col items-center">
        <StatusIcon status={task.status} />
        <div className="w-px flex-1 mt-1 bg-border/50 min-h-[24px]" />
      </div>

      <div
        className={cn(
          'flex-1 pb-4 rounded-lg px-3 py-2 mb-1 border transition-colors',
          task.status === 'running' && 'border-amber-500/30 bg-amber-500/5',
          task.status === 'completed' && 'border-green-500/20 bg-green-500/5',
          task.status === 'failed' && 'border-red-500/20 bg-red-500/5',
          task.status === 'pending' && 'border-border/50 bg-muted/20'
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Icon size={14} weight="duotone" className={iconColor} />
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full border',
              badgeClass
            )}
          >
            {label}
          </span>
          {duration && (
            <span className="text-xs text-muted-foreground ml-auto">{duration}</span>
          )}
        </div>

        <p className="text-sm text-foreground/80 mt-1">{task.description}</p>

        {task.status === 'running' && task.toolCalls && task.toolCalls.length > 0 && (
          <AnimatePresence>
            {task.toolCalls[0].logMessages.map((log, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-muted-foreground font-mono mt-1"
              >
                {log}
              </motion.p>
            ))}
          </AnimatePresence>
        )}

        {task.status === 'completed' && task.result && (
          <p className="text-xs text-green-400/80 font-mono mt-1">{task.result}</p>
        )}

        {task.status === 'failed' && task.error && (
          <p className="text-xs text-red-400/80 font-mono mt-1">Error: {task.error}</p>
        )}
      </div>
    </motion.div>
  )
}

export function AgentTimeline({ plan, isRunning }: AgentTimelineProps) {
  if (!plan) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="text-center space-y-2">
          <Robot size={32} weight="duotone" className="mx-auto text-muted-foreground/40" />
          <p className="text-sm">No plan running. Enter a command above to start.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground/70 truncate max-w-[70%]">
          "{plan.userCommand}"
        </p>
        <div className="flex items-center gap-2">
          {isRunning && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="text-xs text-amber-400 font-medium"
            >
              Running…
            </motion.span>
          )}
          <Badge
            variant="outline"
            className={cn(
              'text-xs capitalize',
              plan.status === 'completed' && 'border-green-500/30 text-green-400',
              plan.status === 'failed' && 'border-red-500/30 text-red-400',
              plan.status === 'partial' && 'border-yellow-500/30 text-yellow-400',
              plan.status === 'running' && 'border-amber-500/30 text-amber-400',
              plan.status === 'pending' && 'border-border text-muted-foreground'
            )}
          >
            {plan.status}
          </Badge>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {plan.tasks.map((task, index) => (
          <TaskItem key={task.id} task={task} index={index} />
        ))}
      </AnimatePresence>
    </div>
  )
}
