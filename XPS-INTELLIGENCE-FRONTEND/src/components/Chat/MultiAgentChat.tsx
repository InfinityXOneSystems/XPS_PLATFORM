import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Robot,
  Brain,
  Globe,
  Code,
  Image,
  CheckCircle,
  RocketLaunch,
  Eye,
  Briefcase,
  ChartLine,
  Cpu,
  Wrench,
  CaretDown,
  CaretUp,
  Circle,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AgentStatus {
  id: string
  name: string
  role: string
  status: 'idle' | 'running' | 'completed' | 'error'
  icon: React.ElementType
  color: string
  lastTask?: string
  tasksCompleted: number
}

const AGENTS: AgentStatus[] = [
  {
    id: 'planner',
    name: 'PlannerAgent',
    role: 'Task decomposition & planning',
    status: 'idle',
    icon: Brain,
    color: 'text-purple-400',
    tasksCompleted: 47,
  },
  {
    id: 'research',
    name: 'ResearchAgent',
    role: 'Web research & data gathering',
    status: 'idle',
    icon: Globe,
    color: 'text-blue-400',
    tasksCompleted: 123,
  },
  {
    id: 'builder',
    name: 'BuilderAgent',
    role: 'Code generation & editing',
    status: 'idle',
    icon: Code,
    color: 'text-green-400',
    tasksCompleted: 89,
  },
  {
    id: 'scraper',
    name: 'ScraperAgent',
    role: 'Web scraping & extraction',
    status: 'running',
    icon: Robot,
    color: 'text-yellow-400',
    lastTask: 'Scraping contractors in LA...',
    tasksCompleted: 234,
  },
  {
    id: 'media',
    name: 'MediaAgent',
    role: 'Image & video generation',
    status: 'idle',
    icon: Image,
    color: 'text-pink-400',
    tasksCompleted: 12,
  },
  {
    id: 'validator',
    name: 'ValidatorAgent',
    role: 'Output validation & testing',
    status: 'idle',
    icon: CheckCircle,
    color: 'text-cyan-400',
    tasksCompleted: 156,
  },
  {
    id: 'devops',
    name: 'DevOpsAgent',
    role: 'Deployment & infrastructure',
    status: 'idle',
    icon: RocketLaunch,
    color: 'text-orange-400',
    tasksCompleted: 34,
  },
  {
    id: 'monitoring',
    name: 'MonitoringAgent',
    role: 'System health monitoring',
    status: 'running',
    icon: Eye,
    color: 'text-red-400',
    lastTask: 'Monitoring system metrics...',
    tasksCompleted: 891,
  },
  {
    id: 'knowledge',
    name: 'KnowledgeAgent',
    role: 'Memory & knowledge management',
    status: 'idle',
    icon: Briefcase,
    color: 'text-indigo-400',
    tasksCompleted: 67,
  },
  {
    id: 'business',
    name: 'BusinessAgent',
    role: 'Business intelligence & leads',
    status: 'idle',
    icon: ChartLine,
    color: 'text-emerald-400',
    tasksCompleted: 45,
  },
  {
    id: 'prediction',
    name: 'PredictionAgent',
    role: 'Forecasting & predictions',
    status: 'idle',
    icon: ChartLine,
    color: 'text-teal-400',
    tasksCompleted: 23,
  },
  {
    id: 'simulation',
    name: 'SimulationAgent',
    role: 'System simulation & testing',
    status: 'idle',
    icon: Cpu,
    color: 'text-violet-400',
    tasksCompleted: 18,
  },
  {
    id: 'meta',
    name: 'MetaAgent',
    role: 'Architecture optimization',
    status: 'idle',
    icon: Wrench,
    color: 'text-amber-400',
    tasksCompleted: 9,
  },
]

const STATUS_DOT: Record<AgentStatus['status'], string> = {
  idle: 'bg-gray-500',
  running: 'bg-green-400 animate-pulse',
  completed: 'bg-blue-400',
  error: 'bg-red-400',
}

export function MultiAgentChat() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const runningCount = AGENTS.filter(a => a.status === 'running').length

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Robot size={16} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Agent Swarm</span>
            {runningCount > 0 && (
              <Badge
                variant="secondary"
                className="text-xs bg-green-400/20 text-green-400 border-green-400/30"
              >
                {runningCount} active
              </Badge>
            )}
          </div>
          {collapsed ? (
            <CaretDown size={14} className="text-muted-foreground" />
          ) : (
            <CaretUp size={14} className="text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="space-y-1">
              {AGENTS.map(agent => {
                const Icon = agent.icon
                const isExpanded = expanded === agent.id
                return (
                  <div
                    key={agent.id}
                    className="rounded-lg border border-border/50 overflow-hidden"
                  >
                    <button
                      className="w-full p-2 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setExpanded(isExpanded ? null : agent.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[agent.status]}`} />
                        <Icon size={13} className={agent.color} />
                        <span className="text-xs font-medium text-foreground">{agent.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {agent.tasksCompleted} tasks
                        </span>
                        {isExpanded ? (
                          <CaretUp size={12} className="text-muted-foreground" />
                        ) : (
                          <CaretDown size={12} className="text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 py-2 bg-muted/30 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">{agent.role}</p>
                            {agent.lastTask && (
                              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                <Circle size={8} weight="fill" className="animate-pulse" />
                                {agent.lastTask}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
