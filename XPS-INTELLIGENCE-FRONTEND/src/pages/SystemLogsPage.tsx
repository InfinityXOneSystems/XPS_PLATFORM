import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal,
  Trash,
  ArrowDown,
  FunnelSimple,
  Robot,
  CheckCircle,
  WarningCircle,
  XCircle,
  Info,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { agentPlanner } from '@/lib/agentPlanner'
import { cn } from '@/lib/utils'
import type { AgentPlan, AgentTask } from '@/lib/agentTypes'

interface SystemLogsPageProps {
  onNavigate: (page: string) => void
}

type LogLevel = 'info' | 'success' | 'warning' | 'error'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
}

function levelFromStatus(status: AgentTask['status']): LogLevel {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'running') return 'info'
  return 'info'
}

function planToLogs(plan: AgentPlan): LogEntry[] {
  const entries: LogEntry[] = [
    {
      id: `${plan.id}-plan`,
      timestamp: plan.createdAt,
      level: 'info',
      source: 'AgentPlanner',
      message: `Plan created: "${plan.userCommand}" (${plan.tasks.length} tasks)`,
    },
  ]

  for (const task of plan.tasks) {
    if (task.startedAt) {
      entries.push({
        id: `${task.id}-start`,
        timestamp: task.startedAt,
        level: 'info',
        source: `Task:${task.type}`,
        message: `Started: ${task.description}`,
      })
    }

    for (const call of task.toolCalls ?? []) {
      call.logMessages.forEach((msg, i) => {
        entries.push({
          id: `${call.id}-log-${i}`,
          timestamp: call.startedAt,
          level: 'info',
          source: call.toolName,
          message: msg,
        })
      })
    }

    if (task.completedAt) {
      entries.push({
        id: `${task.id}-end`,
        timestamp: task.completedAt,
        level: levelFromStatus(task.status),
        source: `Task:${task.type}`,
        message:
          task.status === 'completed'
            ? `Completed: ${task.result ?? task.description}`
            : `Failed: ${task.error ?? 'Unknown error'}`,
      })
    }
  }

  return entries
}

function buildLogsFromHistory(history: AgentPlan[]): LogEntry[] {
  return history
    .flatMap(planToLogs)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
}

const LOG_LEVEL_BG: Record<LogLevel, string> = {
  info: 'bg-blue-500/10',
  success: 'bg-green-500/10',
  warning: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
}

function LevelIcon({ level }: { level: LogLevel }) {
  const cls = `${LOG_LEVEL_STYLES[level]} shrink-0`
  if (level === 'success') return <CheckCircle size={12} weight="fill" className={cls} />
  if (level === 'error') return <XCircle size={12} weight="fill" className={cls} />
  if (level === 'warning') return <WarningCircle size={12} weight="fill" className={cls} />
  return <Info size={12} weight="fill" className={cls} />
}

function LogRow({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-start gap-2 px-3 py-1.5 rounded text-xs font-mono hover:bg-muted/20 transition-colors',
        LOG_LEVEL_BG[entry.level]
      )}
    >
      <span className="text-muted-foreground/60 shrink-0 mt-0.5 w-20 text-right">{time}</span>
      <LevelIcon level={entry.level} />
      <span
        className={cn(
          'shrink-0 w-28 truncate font-semibold',
          LOG_LEVEL_STYLES[entry.level]
        )}
      >
        {entry.source}
      </span>
      <span className="text-foreground/80 break-all">{entry.message}</span>
    </motion.div>
  )
}

const LEVEL_OPTIONS: { label: string; value: LogLevel | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
]

export function SystemLogsPage({ onNavigate }: SystemLogsPageProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshLogs = useCallback(() => {
    const history = agentPlanner.getHistory()
    setLogs(buildLogsFromHistory(history))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLogs()
    const interval = setInterval(refreshLogs, 1500)
    return () => clearInterval(interval)
  }, [refreshLogs])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter)

  const counts: Record<LogLevel, number> = { info: 0, success: 0, warning: 0, error: 0 }
  for (const log of logs) counts[log.level]++

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-background p-6 max-w-5xl mx-auto"
    >
      <BackButton onBack={() => onNavigate('home')} />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
          <Terminal size={22} weight="duotone" className="text-slate-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">System Logs</h1>
          <p className="text-sm text-muted-foreground">Real-time activity from agents and tools</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(Object.entries(counts) as [LogLevel, number][])
            .filter(([, count]) => count > 0)
            .map(([level, count]) => (
              <Badge
                key={level}
                variant="outline"
                className={cn(
                  'text-xs capitalize',
                  level === 'info' && 'border-blue-500/30 text-blue-400',
                  level === 'success' && 'border-green-500/30 text-green-400',
                  level === 'warning' && 'border-yellow-500/30 text-yellow-400',
                  level === 'error' && 'border-red-500/30 text-red-400'
                )}
              >
                {count} {level}
              </Badge>
            ))}
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Robot size={16} weight="duotone" className="text-amber-400" />
              Agent Activity Log
              {logs.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  {filtered.length} entries
                </span>
              )}
            </CardTitle>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter buttons */}
              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                <FunnelSimple size={12} className="text-muted-foreground ml-1" />
                {LEVEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded transition-colors',
                      filter === opt.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Auto-scroll toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoScroll((v) => !v)}
                className={cn(
                  'text-xs h-7 gap-1',
                  autoScroll ? 'text-amber-400' : 'text-muted-foreground'
                )}
              >
                <ArrowDown size={12} />
                Auto-scroll
              </Button>

              {/* Clear */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  agentPlanner.clearHistory()
                  setLogs([])
                }}
                className="text-xs h-7 gap-1 text-muted-foreground hover:text-red-400"
              >
                <Trash size={12} />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="h-[520px] overflow-y-auto bg-background/50 rounded-b-lg p-2 space-y-0.5"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                <Terminal size={36} weight="duotone" className="mb-2" />
                <p className="text-sm">
                  {logs.length === 0
                    ? 'No logs yet. Run an agent command to see activity.'
                    : `No ${filter} entries.`}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((entry) => (
                  <LogRow key={entry.id} entry={entry} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
