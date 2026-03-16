import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendUp, ChartLine, CurrencyDollar, Phone, Envelope, ChatCircleText, CaretUp } from '@phosphor-icons/react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { BackButton } from '@/components/BackButton'
import { useLeads } from '@/hooks/useLeadsApi'
import type { Lead } from '@/types/lead'

// Pre-compute static trend data at module load (simulated sparkline data)
const STATIC_TREND_DATA = Array.from({ length: 12 }, (_, i) => ({
  value: Math.floor(35 + (i * 6.5) + Math.random() * 8)
}))

interface DashboardPageProps {
  onNavigate: (page: string) => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { data: leads = [] } = useLeads()
  const isMobile = useIsMobile()
  const [metricOrder, setMetricOrder] = useState(['unansweredLeads', 'aPlusOpportunities', 'responseRate', 'revenuePipeline'])

  const metrics = useMemo(() => {
    const aPlusLeads = leads.filter((l) => l.rating === 'A+').length
    const unanswered = leads.filter((l) => l.status === 'new').length
    const responseRate = 23.5
    const revenuePipeline = leads.reduce((sum, lead) => sum + (lead.revenue || 0), 0)

    return {
      totalLeads: leads.length,
      unansweredLeads: unanswered,
      aPlusOpportunities: aPlusLeads,
      responseRate,
      revenuePipeline
    }
  }, [leads])

  const trendData = STATIC_TREND_DATA

  const unansweredLeads = useMemo(() => {
    return [...leads]
      .filter((l) => l.status === 'new')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [leads])

  const handleShareEmail = (lead: Lead) => {
    const subject = encodeURIComponent(`Re: ${lead.company}`)
    const body = encodeURIComponent(`Hi ${lead.company},\n\nI wanted to reach out regarding...`)
    window.open(`mailto:info@infinityxonesystems@gmail.com?subject=${subject}&body=${body}`, '_self')
    toast.success('Email draft opened')
  }

  const handleShareSMS = (lead: Lead) => {
    const message = encodeURIComponent(`Hi ${lead.company}, this is regarding your inquiry...`)
    window.location.href = `sms:${lead.phone}?body=${message}`
    toast.success('SMS draft opened')
  }

  const _handleReorderMetrics = (metricId: string, direction: 'up' | 'down') => {
    const currentIndex = metricOrder.indexOf(metricId)
    if (direction === 'up' && currentIndex > 0) {
      const newOrder = [...metricOrder]
      ;[newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]]
      setMetricOrder(newOrder)
    } else if (direction === 'down' && currentIndex < metricOrder.length - 1) {
      const newOrder = [...metricOrder]
      ;[newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]]
      setMetricOrder(newOrder)
    }
  }

  const metricConfig: Record<string, {
    title: string
    value: string | number
    icon: React.ReactNode
    gradient: string
    change: string
    positive: boolean
  }> = {
    unansweredLeads: {
      title: 'Unanswered Leads',
      value: metrics.unansweredLeads,
      icon: <Users size={18} weight="duotone" className="text-white" />,
      gradient: 'linear-gradient(135deg, var(--gradient-maroon-start), var(--gradient-maroon-end))',
      change: '+12%',
      positive: false
    },
    aPlusOpportunities: {
      title: 'A+ Opportunities',
      value: metrics.aPlusOpportunities,
      icon: <TrendUp size={18} weight="duotone" className="text-foreground" />,
      gradient: 'linear-gradient(135deg, var(--gradient-gold-start), var(--gradient-gold-end))',
      change: '+8%',
      positive: true
    },
    responseRate: {
      title: 'Response Rate',
      value: `${metrics.responseRate}%`,
      icon: <ChartLine size={18} weight="duotone" className="text-white" />,
      gradient: 'linear-gradient(135deg, var(--gradient-silver-start), var(--gradient-silver-end))',
      change: '+5%',
      positive: true
    },
    revenuePipeline: {
      title: 'Revenue Pipeline',
      value: `$${(metrics.revenuePipeline / 1000).toFixed(0)}K`,
      icon: <CurrencyDollar size={18} weight="duotone" className="text-white" />,
      gradient: 'linear-gradient(135deg, var(--gradient-bronze-start), var(--gradient-bronze-end))',
      change: '+18%',
      positive: true
    }
  }

  return (
    <div className="space-y-10 pb-10">
      <BackButton onBack={() => onNavigate('home')} />
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl p-8 overflow-hidden relative"
        style={{
          background: 'var(--card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '2px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Lead Growth</h3>
            <p className="text-sm text-muted-foreground mt-1.5">Last 30 days</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
            <CaretUp size={18} weight="bold" className="text-success" />
            <span className="text-base font-bold text-success">24%</span>
          </div>
        </div>
        <div className="h-32 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--gradient-gold-start)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--gradient-gold-start)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="var(--gradient-gold-start)"
                strokeWidth={3}
                fill="url(#areaGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metricOrder.map((metricId, index) => {
          const config = metricConfig[metricId]
          const _isFirst = index === 0
          const _isLast = index === metricOrder.length - 1
          
          return (
            <motion.div
              key={metricId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-2xl p-8 relative group"
              style={{
                background: 'var(--card)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                border: '2px solid var(--border-subtle)',
              }}
            >              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 rounded-2xl" style={{ background: config.gradient }}>
                  {config.icon}
                </div>
                <span className={`text-base font-bold ${config.positive ? 'text-success' : 'text-warning'}`}>
                  {config.change}
                </span>
              </div>
              
              <div className="text-4xl font-bold text-white mb-3">{config.value}</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                {config.title}
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-3xl p-8"
        style={{
          background: 'var(--card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '2px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold text-white">Priority Leads</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {unansweredLeads.length} awaiting response
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          {unansweredLeads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-base">
              No unanswered leads
            </div>
          ) : (
            unansweredLeads.slice(0, isMobile ? 5 : 10).map((lead, index) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + (index * 0.04) }}
                className="rounded-2xl p-6 transition-all duration-200"
                style={{
                  border: '2px solid var(--border-subtle)',
                  background: 'rgba(0, 0, 0, 0.2)'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="font-bold text-white text-lg">{lead.company}</h4>
                      <span
                        className="px-3 py-1 text-xs font-bold rounded-lg"
                        style={{
                          background: lead.rating === 'A+' 
                            ? 'linear-gradient(135deg, var(--gradient-gold-start), var(--gradient-gold-end))'
                            : lead.rating === 'A'
                            ? 'linear-gradient(135deg, var(--gradient-silver-start), var(--gradient-silver-end))'
                            : 'linear-gradient(135deg, var(--gradient-bronze-start), var(--gradient-bronze-end))',
                          color: '#FFFFFF'
                        }}
                      >
                        {lead.rating}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      <a 
                        href={`tel:${lead.phone}`}
                        className="flex items-center gap-2.5 text-sm text-white hover:text-gold transition-colors"
                      >
                        <Phone size={16} weight="duotone" />
                        {lead.phone}
                      </a>
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center gap-2.5 text-sm text-white hover:text-gold transition-colors"
                      >
                        <Envelope size={16} weight="duotone" />
                        {lead.email}
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-6">
                  <button
                    onClick={() => handleShareEmail(lead)}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl transition-all duration-200 active:scale-95 text-white text-sm font-bold"
                    style={{ 
                      border: '2px solid var(--border-subtle)',
                      background: 'linear-gradient(135deg, var(--gradient-gold-start), var(--gradient-gold-end))'
                    }}
                  >
                    <Envelope size={18} weight="duotone" />
                    Email
                  </button>
                  <button
                    onClick={() => handleShareSMS(lead)}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl transition-all duration-200 active:scale-95 text-white text-sm font-bold"
                    style={{ 
                      border: '2px solid var(--border-subtle)',
                      background: 'linear-gradient(135deg, var(--gradient-maroon-start), var(--gradient-maroon-end))'
                    }}
                  >
                    <ChatCircleText size={18} weight="duotone" />
                    SMS
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
