import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Robot,
  Play,
  ClockCounterClockwise,
  Wrench,
  CheckCircle,
  XCircle,
  WarningCircle,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { AgentTimeline } from '@/components/AgentTimeline'
import { agentPlanner } from '@/lib/agentPlanner'
import { cn } from '@/lib/utils'
import type { AgentPlan, ToolCall } from '@/lib/agentTypes'

interface AgentPageProps {
  onNavigate: (page: string) => void
}

const EXAMPLE_COMMANDS = [
  'Scrape epoxy companies in Orlando, FL',
  'Generate outreach email for top 10 leads',
  'Build analytics dashboard for Q2 pipeline',
  'Deploy backend to production',
  'Trigger GitHub Actions CI workflow',
]

function ToolLogEntry({ call }: { call: ToolCall }) {
  const isSuccess = call.status === 'completed'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs font-mono border-b border-border/30 pb-2 last:border-0"
    >
      <div className="flex items-center gap-2 mb-1">
        {isSuccess ? (
          <CheckCircle size={12} weight="fill" className="text-green-400 shrink-0" />
        ) : (
          <XCircle size={12} weight="fill" className="text-red-400 shrink-0" />
        )}
        <span className="text-foreground/80 font-semibold">{call.toolName}</span>
        {call.completedAt && call.startedAt && (
          <span className="text-muted-foreground ml-auto">
            {((new Date(call.completedAt).getTime() - new Date(call.startedAt).getTime()) / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {call.logMessages.map((msg, i) => (
        <div key={i} className="text-muted-foreground pl-4">
          {msg}
        </div>
      ))}
    </motion.div>
  )
}

function collectToolCalls(plan: AgentPlan): ToolCall[] {
  return plan.tasks.flatMap((t) => t.toolCalls ?? [])
}

export function AgentPage({ onNavigate }: AgentPageProps) {
  const [command, setCommand] = useState('')
  const [activePlan, setActivePlan] = useState<AgentPlan | null>(null)
  const [history, setHistory] = useState<AgentPlan[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const handleRun = useCallback(async () => {
    const cmd = command.trim()
    if (!cmd || isRunning) return
    setError(null)
    setIsRunning(true)
    abortRef.current = false

    try {
      const plan = await agentPlanner.createPlan(cmd)
      setActivePlan(plan)

      await agentPlanner.executePlan(plan, (updated) => {
        setActivePlan({ ...updated })
      })

      setHistory(agentPlanner.getHistory().slice(0, 5))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute plan')
    } finally {
      setIsRunning(false)
    }
  }, [command, isRunning])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleRun()
  }

  const allToolCalls = activePlan ? collectToolCalls(activePlan) : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-background p-6 max-w-4xl mx-auto"
    >
      <BackButton onBack={() => onNavigate('home')} />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Robot size={22} weight="duotone" className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Agent</h1>
          <p className="text-sm text-muted-foreground">Autonomous task execution engine</p>
        </div>
      </div>

      {/* Command Input */}
      <Card className="mb-6 border-border/50">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command… e.g. 'Scrape epoxy companies in Orlando'"
              className="flex-1 bg-muted/30"
              disabled={isRunning}
            />
            <Button
              onClick={handleRun}
              disabled={!command.trim() || isRunning}
              className="shrink-0 gap-2"
            >
              <Play size={14} weight="fill" />
              {isRunning ? 'Running…' : 'Run'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_COMMANDS.map((ex) => (
              <button
                key={ex}
                onClick={() => !isRunning && setCommand(ex)}
                className={cn(
                  'text-xs px-2 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors',
                  isRunning && 'opacity-40 cursor-not-allowed'
                )}
              >
                {ex}
              </button>
            ))}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mt-3 text-sm text-red-400"
            >
              <WarningCircle size={14} weight="fill" />
              {error}
            </motion.div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Plan Timeline */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Robot size={16} weight="duotone" className="text-amber-400" />
              Active Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentTimeline plan={activePlan} isRunning={isRunning} />
          </CardContent>
        </Card>

        {/* Tool Execution Log */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench size={16} weight="duotone" className="text-blue-400" />
              Tool Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allToolCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                <Wrench size={28} weight="duotone" className="mb-2" />
                <p className="text-xs">Tool calls will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <AnimatePresence>
                  {allToolCalls.map((call) => (
                    <ToolLogEntry key={call.id} call={call} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan History */}
      <AnimatePresence>
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClockCounterClockwise size={16} weight="duotone" className="text-purple-400" />
                  Recent Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((plan) => (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {plan.status === 'completed' ? (
                          <CheckCircle size={14} weight="fill" className="text-green-400 shrink-0" />
                        ) : plan.status === 'failed' ? (
                          <XCircle size={14} weight="fill" className="text-red-400 shrink-0" />
                        ) : (
                          <WarningCircle size={14} weight="fill" className="text-yellow-400 shrink-0" />
                        )}
                        <span className="text-sm text-foreground/80 truncate">{plan.userCommand}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs capitalize',
                            plan.status === 'completed' && 'border-green-500/30 text-green-400',
                            plan.status === 'failed' && 'border-red-500/30 text-red-400',
                            plan.status === 'partial' && 'border-yellow-500/30 text-yellow-400'
                          )}
                        >
                          {plan.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {plan.tasks.length} task{plan.tasks.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
