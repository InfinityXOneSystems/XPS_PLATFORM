import { motion } from 'framer-motion'
import { BackButton } from '@/components/BackButton'
import { Trophy, Medal, Crown } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { useLeads } from '@/hooks/useLeadsApi'

interface LeaderboardPageProps {
  onNavigate: (page: string) => void
}

interface RepStats {
  name: string
  initials: string
  leadsAssigned: number
  leadsClosed: number
  totalRevenue: number
}

export function LeaderboardPage({ onNavigate }: LeaderboardPageProps) {
  const { data: leads = [] } = useLeads()

  const statsByRep = leads.reduce((acc, lead) => {
    const rep = lead.assignedInitials || lead.assignedRep || 'Unassigned'
    if (!acc[rep]) {
      acc[rep] = {
        name: lead.assignedRep || rep,
        initials: lead.assignedInitials || rep.substring(0, 2).toUpperCase(),
        leadsAssigned: 0,
        leadsClosed: 0,
        totalRevenue: 0
      }
    }
    acc[rep].leadsAssigned++
    if (lead.status === 'signed') {
      acc[rep].leadsClosed++
      acc[rep].totalRevenue += lead.revenue || 0
    }
    return acc
  }, {} as Record<string, RepStats>)

  const sortedReps = Object.values(statsByRep).sort((a, b) => b.leadsClosed - a.leadsClosed)

  return (
    <div className="space-y-10">
      <BackButton onBack={() => onNavigate('home')} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Trophy size={40} className="text-warning" weight="fill" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Performance rankings and achievements
          </p>
        </div>
      </div>

      {sortedReps.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-16 text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="p-6 rounded-2xl bg-warning/10">
              <Trophy size={64} className="text-warning" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">No Data Yet</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start assigning leads to team members to see performance rankings
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sortedReps.map((rep, index) => {
            const Icon = index === 0 ? Crown : index === 1 ? Medal : Trophy
            const iconColor = index === 0 ? 'text-warning' : index === 1 ? 'text-muted-foreground' : 'text-danger'
            
            return (
              <motion.div
                key={rep.initials}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`glass-card p-8 ${index === 0 ? 'border-warning/30' : ''}`}>
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`text-4xl font-bold ${iconColor}`}>
                        #{index + 1}
                      </div>
                      <Icon size={48} className={iconColor} weight={index === 0 ? 'fill' : 'regular'} />
                      <div>
                        <h3 className="text-2xl font-bold">{rep.name}</h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {rep.initials}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-12">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary">{rep.leadsAssigned}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Assigned</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-success">{rep.leadsClosed}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Closed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-warning">
                          ${(rep.totalRevenue / 1000).toFixed(0)}K
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
