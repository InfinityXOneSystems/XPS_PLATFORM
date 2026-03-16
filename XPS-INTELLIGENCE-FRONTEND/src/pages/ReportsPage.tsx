import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChartBar,
  TrendUp,
  TrendDown,
  Users,
  Robot,
  Export,
  Calendar,
  CurrencyDollar,
  Target,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/BackButton'
import { toast } from 'sonner'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

interface ReportsPageProps {
  onNavigate: (page: string) => void
}

const LEAD_DATA = [
  { month: 'Sep', leads: 120, converted: 18 },
  { month: 'Oct', leads: 180, converted: 29 },
  { month: 'Nov', leads: 145, converted: 22 },
  { month: 'Dec', leads: 200, converted: 35 },
  { month: 'Jan', leads: 165, converted: 28 },
  { month: 'Feb', leads: 240, converted: 48 },
  { month: 'Mar', leads: 285, converted: 61 },
]

const SCRAPE_DATA = [
  { day: 'Mon', results: 145 },
  { day: 'Tue', results: 232 },
  { day: 'Wed', results: 187 },
  { day: 'Thu', results: 298 },
  { day: 'Fri', results: 256 },
  { day: 'Sat', results: 89 },
  { day: 'Sun', results: 45 },
]

interface Metric {
  label: string
  value: string
  change: string
  up: boolean
  icon: React.ElementType
  color: string
}

const METRICS: Metric[] = [
  {
    label: 'Total Leads',
    value: '1,335',
    change: '+18%',
    up: true,
    icon: Users,
    color: 'text-blue-400',
  },
  {
    label: 'Conversion Rate',
    value: '21.4%',
    change: '+3.2%',
    up: true,
    icon: Target,
    color: 'text-green-400',
  },
  {
    label: 'Revenue (est.)',
    value: '$48,200',
    change: '+12%',
    up: true,
    icon: CurrencyDollar,
    color: 'text-yellow-400',
  },
  {
    label: 'Agent Tasks',
    value: '4,891',
    change: '+31%',
    up: true,
    icon: Robot,
    color: 'text-purple-400',
  },
]

export function ReportsPage({ onNavigate }: ReportsPageProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton onBack={() => onNavigate('home')} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Business intelligence and performance metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border border-border rounded-md p-1">
            {(['7d', '30d', '90d'] as const).map(p => (
              <Button
                key={p}
                variant={period === p ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p)}
                className="text-xs"
              >
                {p}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info('Export coming soon')}>
            <Export size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRICS.map((metric, i) => {
          const Icon = metric.icon
          const TrendIcon = metric.up ? TrendUp : TrendDown
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={18} className={metric.color} />
                    <div
                      className={`flex items-center gap-1 text-xs ${metric.up ? 'text-green-400' : 'text-red-400'}`}
                    >
                      <TrendIcon size={12} />
                      {metric.change}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-foreground">{metric.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{metric.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendUp size={16} className="text-green-400" />
              Lead Growth
            </CardTitle>
            <CardDescription className="text-xs">Monthly leads and conversions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={LEAD_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke="#22c55e"
                  fill="rgba(34,197,94,0.1)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="converted"
                  stroke="#eab308"
                  fill="rgba(234,179,8,0.1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ChartBar size={16} className="text-blue-400" />
              Scraping Activity
            </CardTitle>
            <CardDescription className="text-xs">Daily scraping results this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={SCRAPE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="results" fill="rgba(59,130,246,0.6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar size={16} className="text-purple-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                time: '2 min ago',
                event: 'Scraper completed: 47 new leads in Los Angeles, CA',
                type: 'success',
              },
              {
                time: '15 min ago',
                event: 'Agent workflow: Daily follow-up emails sent to 12 leads',
                type: 'info',
              },
              {
                time: '1 hour ago',
                event: 'Lead converted: Diamond Coatings - $8,500 contract',
                type: 'success',
              },
              {
                time: '2 hours ago',
                event: 'Automation error: Weekly report email delivery failed',
                type: 'error',
              },
              {
                time: '4 hours ago',
                event: 'New leads added: 23 flooring contractors in Phoenix',
                type: 'info',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    item.type === 'success'
                      ? 'bg-green-400'
                      : item.type === 'error'
                        ? 'bg-red-400'
                        : 'bg-blue-400'
                  }`}
                />
                <div className="flex-1">
                  <span className="text-foreground">{item.event}</span>
                  <span className="text-xs text-muted-foreground ml-2">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
