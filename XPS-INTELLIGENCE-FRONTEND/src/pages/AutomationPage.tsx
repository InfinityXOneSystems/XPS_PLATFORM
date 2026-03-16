import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Lightning,
  Plus,
  Play,
  Pause,
  Trash,
  Clock,
  LinkSimple,
  Robot,
  CheckCircle,
  Warning,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { BackButton } from '@/components/BackButton'
import { toast } from 'sonner'
// TaskType from AgentTypes union for type safety in Workflow.taskType.
import type { TaskType } from '@/lib/agentTypes'

interface AutomationPageProps {
  onNavigate: (page: string) => void
}

interface Workflow {
  id: string
  name: string
  description: string
  trigger: string
  actions: string[]
  enabled: boolean
  lastRun?: string
  nextRun?: string
  status: 'active' | 'paused' | 'error'
  runs: number
  // taskType uses TaskType union for strict type checking (not plain string).
  taskType: TaskType
}

const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: '1',
    name: 'Daily Lead Scraper',
    description: 'Automatically scrape flooring contractors in California every day at 6 AM',
    trigger: 'Schedule: 0 6 * * *',
    actions: ['Scrape Google Maps', 'Filter duplicates', 'Save to database', 'Send email report'],
    enabled: true,
    lastRun: '2 hours ago',
    nextRun: 'Tomorrow 6:00 AM',
    status: 'active',
    runs: 47,
    // Cast to TaskType for strict type checking.
    taskType: 'scrape' as TaskType,
  },
  {
    id: '2',
    name: 'New Lead Notification',
    description: 'Send Slack notification when new high-score lead is found',
    trigger: 'Webhook: /api/leads/new',
    actions: ['Check lead score', 'If score > 80', 'Send Slack message', 'Add to priority list'],
    enabled: true,
    lastRun: '15 min ago',
    nextRun: 'On trigger',
    status: 'active',
    runs: 234,
    taskType: 'analyze_leads' as TaskType,
  },
  {
    id: '3',
    name: 'Weekly Report Generator',
    description: 'Generate and email weekly analytics report every Monday',
    trigger: 'Schedule: 0 9 * * 1',
    actions: ['Fetch analytics data', 'Generate PDF report', 'Send email to team'],
    enabled: false,
    lastRun: '7 days ago',
    nextRun: 'Paused',
    status: 'paused',
    runs: 12,
    taskType: 'report' as TaskType,
  },
  {
    id: '4',
    name: 'Contractor Follow-up',
    description: 'Automatically send follow-up email after 3 days of no response',
    trigger: 'Schedule: 0 10 * * *',
    actions: ['Find unresponsive leads', 'Check last contact date', 'Send follow-up email'],
    enabled: true,
    lastRun: '1 day ago',
    nextRun: 'Tomorrow 10:00 AM',
    status: 'error',
    runs: 89,
    taskType: 'generate_email' as TaskType,
  },
]

const STATUS_CONFIG: Record<
  Workflow['status'],
  { icon: React.ElementType; color: string; label: string }
> = {
  active: { icon: CheckCircle, color: 'text-green-400', label: 'Active' },
  paused: { icon: Pause, color: 'text-yellow-400', label: 'Paused' },
  error: { icon: Warning, color: 'text-red-400', label: 'Error' },
}

const TRIGGER_ICONS: Record<string, React.ElementType> = {
  Schedule: Clock,
  Webhook: LinkSimple,
  Manual: Robot,
}

export function AutomationPage({ onNavigate }: AutomationPageProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>(MOCK_WORKFLOWS)

  const toggleWorkflow = (id: string) => {
    setWorkflows(prev =>
      prev.map(w => {
        if (w.id !== id) return w
        const willEnable = !w.enabled
        toast.success(willEnable ? 'Workflow enabled' : 'Workflow paused')
        return {
          ...w,
          enabled: willEnable,
          status: (willEnable ? 'active' : 'paused') as Workflow['status'],
        }
      })
    )
  }

  const runWorkflow = (id: string) => {
    const workflow = workflows.find(w => w.id === id)
    toast.success(`Running: ${workflow?.name}`)
  }

  const deleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id))
    toast.success('Workflow deleted')
  }

  const activeCount = workflows.filter(w => w.status === 'active').length
  const totalRuns = workflows.reduce((sum, w) => sum + w.runs, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton onBack={() => onNavigate('home')} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Automation</h1>
            <p className="text-sm text-muted-foreground">Manage automated workflows and schedules</p>
          </div>
        </div>
        <Button size="sm" onClick={() => toast.info('Workflow builder coming soon')}>
          <Plus size={16} className="mr-2" />
          New Workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Workflows', value: workflows.length, color: 'text-foreground' },
          { label: 'Active', value: activeCount, color: 'text-green-400' },
          { label: 'Total Runs', value: totalRuns, color: 'text-blue-400' },
          {
            label: 'Errors',
            value: workflows.filter(w => w.status === 'error').length,
            color: 'text-red-400',
          },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflows */}
      <div className="space-y-4">
        {workflows.map((workflow, i) => {
          const StatusIcon = STATUS_CONFIG[workflow.status].icon
          const triggerType =
            Object.keys(TRIGGER_ICONS).find(k => workflow.trigger.startsWith(k)) || 'Manual'
          const TriggerIcon = TRIGGER_ICONS[triggerType] || Robot

          return (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                className={`transition-colors ${
                  workflow.status === 'error' ? 'border-red-500/30' : 'hover:border-primary/30'
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                        <Lightning size={18} className="text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          {workflow.name}
                          <StatusIcon size={14} className={STATUS_CONFIG[workflow.status].color} />
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {workflow.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={workflow.enabled}
                        onCheckedChange={() => toggleWorkflow(workflow.id)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Trigger */}
                  <div className="flex items-center gap-2 text-xs">
                    <TriggerIcon size={14} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Trigger:</span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                      {workflow.trigger}
                    </code>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1">
                    {workflow.actions.map((action, j) => (
                      <span
                        key={j}
                        className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                      >
                        {action}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Last run: {workflow.lastRun || 'Never'}</span>
                      <span>Next: {workflow.nextRun || 'N/A'}</span>
                      <span>{workflow.runs} total runs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => runWorkflow(workflow.id)}>
                        <Play size={14} className="mr-1" />
                        Run
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('Edit coming soon')}
                      >
                        <ArrowsClockwise size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWorkflow(workflow.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
