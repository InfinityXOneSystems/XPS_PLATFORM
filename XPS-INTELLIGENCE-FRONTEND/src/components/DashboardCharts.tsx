import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Lead } from '@/types/lead'

// Pre-compute mock revenue data once at module load (simulated chart data)
const REVENUE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const STATIC_REVENUE_DATA = REVENUE_MONTHS.map((month, i) => ({
  month,
  revenue: Math.floor(Math.random() * 100000) + 50000 + (i * 10000)
}))

interface DashboardChartsProps {
  leads: Lead[]
}

export function DashboardCharts({ leads }: DashboardChartsProps) {
  const scoreDistribution = useMemo(() => {
    const ranges = [
      { name: '90-100', min: 90, max: 100, count: 0 },
      { name: '80-89', min: 80, max: 89, count: 0 },
      { name: '70-79', min: 70, max: 79, count: 0 },
      { name: '60-69', min: 60, max: 69, count: 0 },
      { name: 'Below 60', min: 0, max: 59, count: 0 }
    ]

    leads.forEach((lead) => {
      const range = ranges.find((r) => lead.opportunityScore >= r.min && lead.opportunityScore <= r.max)
      if (range) range.count++
    })

    return ranges
  }, [leads])

  const pipelineData = useMemo(() => {
    const statusMap: Record<string, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      closed: 0,
      lost: 0
    }

    leads.forEach((lead) => {
      statusMap[lead.status] = (statusMap[lead.status] || 0) + 1
    })

    return Object.entries(statusMap)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count
      }))
  }, [leads])

  const revenueData = STATIC_REVENUE_DATA

  const COLORS = [
    'oklch(0.82 0.15 70)',
    'oklch(0.75 0 0)',
    'oklch(0.72 0.14 50)',
    'oklch(0.42 0.14 20)',
    'oklch(0.38 0.13 20)',
    'oklch(0.35 0.12 15)'
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-[18px] p-6 transition-all duration-200 group"
        style={{
          background: 'var(--card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid var(--border-subtle)',
        }}
        whileHover={{
          boxShadow: 'var(--glow-gold)',
        }}
      >
        <h3 className="text-[22px] font-semibold mb-6 text-foreground">Opportunity Score Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={scoreDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="name"
              stroke="#9CA3AF"
              style={{ fontSize: '12px', fontFamily: 'Montserrat, Inter, sans-serif' }}
            />
            <YAxis
              stroke="#9CA3AF"
              style={{ fontSize: '12px', fontFamily: 'Montserrat, Inter, sans-serif' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--foreground)'
              }}
            />
            <Bar dataKey="count" fill="oklch(0.82 0.15 70)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-[18px] p-6 transition-all duration-200 group"
        style={{
          background: 'var(--card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid var(--border-subtle)',
        }}
        whileHover={{
          boxShadow: 'var(--glow-gold)',
        }}
      >
        <h3 className="text-[22px] font-semibold mb-6 text-foreground">Lead Pipeline</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pipelineData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#D4AF37"
              dataKey="value"
            >
              {pipelineData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--foreground)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-[18px] p-6 transition-all duration-200 lg:col-span-2 group"
        style={{
          background: 'var(--card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid var(--border-subtle)',
        }}
        whileHover={{
          boxShadow: 'var(--glow-gold)',
        }}
      >
        <h3 className="text-[22px] font-semibold mb-6 text-foreground">Revenue Pipeline</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.42 0.14 20)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="oklch(0.42 0.14 20)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="month"
              stroke="#9CA3AF"
              style={{ fontSize: '12px', fontFamily: 'Montserrat, Inter, sans-serif' }}
            />
            <YAxis
              stroke="#9CA3AF"
              style={{ fontSize: '12px', fontFamily: 'Montserrat, Inter, sans-serif' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--foreground)'
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="oklch(0.42 0.14 20)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  )
}
