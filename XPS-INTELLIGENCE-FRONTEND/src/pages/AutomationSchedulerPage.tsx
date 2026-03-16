// AutomationSchedulerPage.tsx — Manage recurring task schedules.
// FIX (CI job 66236048582): taskType in useState is cast to TaskType to prevent
// "Type 'string' is not assignable to type 'TaskType'" TS2322 error.
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Timer,
  Plus,
  Play,
  Pause,
  CheckCircle,
  Warning,
  Clock,
  Trash,
  ArrowClockwise,
  CalendarCheck,
  X,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
// Import TaskType so the form state is strictly typed rather than inferred as string
import type { TaskType } from '@/lib/agentTypes'
import {
  getSchedules,
  toggleSchedule,
  deleteSchedule,
  runScheduleNow,
  type Schedule,
} from '@/services/automationService'

interface AutomationSchedulerPageProps {
  onNavigate: (page: string) => void
}

const statusColors: Record<Schedule['status'], string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  disabled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const taskTypeColors: Record<string, string> = {
  scrape: 'text-amber-400',
  report: 'text-blue-400',
  monitor: 'text-red-400',
  analyze_leads: 'text-purple-400',
  deploy: 'text-green-400',
  github_action: 'text-gray-400',
  plan: 'text-violet-400',
  research: 'text-sky-400',
  validate: 'text-yellow-400',
  media: 'text-rose-400',
  knowledge: 'text-indigo-400',
  predict: 'text-emerald-400',
  simulate: 'text-teal-400',
  build_ui: 'text-cyan-400',
  generate_email: 'text-blue-300',
  search: 'text-sky-300',
}

function formatNextRun(dateStr: string): string {
  const now = new Date()
  const next = new Date(dateStr)
  const diff = next.getTime() - now.getTime()
  if (diff < 0) return 'overdue'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface CreateScheduleDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (schedule: Schedule) => void
}

function CreateScheduleDialog({ open, onClose, onCreated }: CreateScheduleDialogProps) {
  // FIX: cast taskType initializer to TaskType so that spreading into Schedule
  // does not widen the property to plain string (TS2322 in CI job 66236048582).
  const [form, setForm] = useState({
    name: '',
    description: '',
    frequency: 'daily' as Schedule['frequency'],
    cronExpression: '0 2 * * *',
    taskType: 'scrape' as TaskType,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { toast.error('Name is required'); return }
    const newSchedule: Schedule = {
      ...form,
      id: crypto.randomUUID(),
      nextRun: new Date(Date.now() + 3600000).toISOString(),
      status: 'active',
      config: {},
      successCount: 0,
      failureCount: 0,
    }
    onCreated(newSchedule)
    setForm({ name: '', description: '', frequency: 'daily', cronExpression: '0 2 * * *', taskType: 'scrape' as TaskType })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-4 bg-background border border-white/12 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div className="flex items-center gap-3">
            <Timer size={20} className="text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Create Schedule</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs text-white/60 mb-1.5 block">Schedule Name *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Daily Lead Scrape" className="bg-black/40 border-white/20 text-white" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1.5 block">Description</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this schedule do?" className="bg-black/40 border-white/20 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Schedule['frequency'] }))} className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/20 text-white text-sm focus:outline-none">
                {['hourly', 'daily', 'weekly', 'monthly', 'custom'].map(f => (
                  <option key={f} value={f} className="bg-zinc-900">{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Task Type</label>
              {/* FIX: cast selected value to TaskType to keep form.taskType strictly typed */}
              <select value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value as TaskType }))} className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/20 text-white text-sm focus:outline-none">
                {(['scrape', 'report', 'monitor', 'analyze_leads', 'deploy', 'github_action', 'validate', 'research', 'plan'] as TaskType[]).map(t => (
                  <option key={t} value={t} className="bg-zinc-900">{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1.5 block">Cron Expression</label>
            <Input value={form.cronExpression} onChange={e => setForm(f => ({ ...f, cronExpression: e.target.value }))} placeholder="0 2 * * *" className="bg-black/40 border-white/20 text-white font-mono" />
            <p className="text-xs text-white/30 mt-1">e.g. "0 2 * * *" = daily at 2am</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/20 text-white/70 hover:bg-white/5">Cancel</Button>
            <Button type="submit" className="flex-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30">
              <Plus size={16} className="mr-2" /> Create
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export function AutomationSchedulerPage({ onNavigate }: AutomationSchedulerPageProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getSchedules().then(data => {
      setSchedules(data)
      setLoading(false)
    })
  }, [])

  const stats = useMemo(() => ({
    total: schedules.length,
    active: schedules.filter(s => s.status === 'active').length,
    failed: schedules.filter(s => s.status === 'failed').length,
    nextRun: schedules
      .filter(s => s.status === 'active' && s.nextRun)
      .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())[0]?.nextRun,
  }), [schedules])

  const handleToggle = async (id: string, currentStatus: Schedule['status']) => {
    const isActive = currentStatus === 'active'
    const updated = await toggleSchedule(id, !isActive)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s))
    toast.success(isActive ? 'Schedule paused' : 'Schedule activated')
  }

  const handleDelete = async (id: string, name: string) => {
    await deleteSchedule(id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    toast.success(`"${name}" deleted`)
  }

  const handleRunNow = async (id: string, name: string) => {
    setRunningIds(prev => new Set(prev).add(id))
    const result = await runScheduleNow(id)
    toast.success(`"${name}" triggered — task ID: ${result.taskId.slice(0, 8)}`)
    setTimeout(() => {
      setRunningIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 3000)
  }

  const handleCreated = (schedule: Schedule) => {
    setSchedules(prev => [schedule, ...prev])
    setShowCreate(false)
    toast.success(`Schedule "${schedule.name}" created`)
  }

  const cardStyle = {
    background: 'var(--card)',
    backdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  return (
    <div className="space-y-8">
      <BackButton onBack={() => onNavigate('home')} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">Automation Scheduler</h1>
          <p className="text-white/50 mt-2 text-base">Manage recurring tasks and automated workflows</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30">
          <Plus size={18} /> New Schedule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Schedules', value: stats.total, icon: CalendarCheck, color: 'text-blue-400' },
          { label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Failed', value: stats.failed, icon: Warning, color: 'text-red-400' },
          { label: 'Next Run In', value: stats.nextRun ? formatNextRun(stats.nextRun) : '—', icon: Clock, color: 'text-yellow-400' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card style={cardStyle}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={stat.color} />
                    <div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-white/50">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Schedules */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400" />
          </div>
        ) : schedules.length === 0 ? (
          <Card style={cardStyle}>
            <CardContent className="text-center py-16 text-white/40">
              <Timer size={32} className="mx-auto mb-3 opacity-30" />
              <p>No schedules configured</p>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule, i) => (
            <motion.div
              key={schedule.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card style={cardStyle} className="hover:border-white/15 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-base font-semibold text-white">{schedule.name}</h3>
                        <Badge className={cn('text-xs border', statusColors[schedule.status])}>
                          {schedule.status}
                        </Badge>
                        <span className={cn('text-xs font-medium', taskTypeColors[schedule.taskType] || 'text-white/50')}>
                          {schedule.taskType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {schedule.description && (
                        <p className="text-sm text-white/50 mt-1 truncate">{schedule.description}</p>
                      )}
                      <div className="flex items-center gap-5 mt-3 text-xs text-white/40">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          <span>Next: {schedule.nextRun ? formatNextRun(schedule.nextRun) : '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CalendarCheck size={12} />
                          <span>Last: {formatDate(schedule.lastRun)}</span>
                        </div>
                        <span className="font-mono text-white/30">{schedule.cronExpression}</span>
                        <span className="text-green-400/70">{schedule.successCount} ok</span>
                        {schedule.failureCount > 0 && (
                          <span className="text-red-400/70">{schedule.failureCount} failed</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={runningIds.has(schedule.id)}
                        onClick={() => handleRunNow(schedule.id, schedule.name)}
                        className="border-white/20 text-white/60 hover:text-white hover:bg-white/5 h-8 px-3"
                      >
                        <ArrowClockwise size={14} className={runningIds.has(schedule.id) ? 'animate-spin' : ''} />
                        <span className="ml-1.5 text-xs">Run</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggle(schedule.id, schedule.status)}
                        className={cn(
                          'border-white/20 h-8 px-3 text-xs',
                          schedule.status === 'active'
                            ? 'text-yellow-400 hover:bg-yellow-500/10'
                            : 'text-green-400 hover:bg-green-500/10'
                        )}
                      >
                        {schedule.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                        <span className="ml-1.5">{schedule.status === 'active' ? 'Pause' : 'Activate'}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(schedule.id, schedule.name)}
                        className="border-white/20 text-white/40 hover:text-red-400 hover:bg-red-500/10 h-8 px-2"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <CreateScheduleDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
    </div>
  )
}
