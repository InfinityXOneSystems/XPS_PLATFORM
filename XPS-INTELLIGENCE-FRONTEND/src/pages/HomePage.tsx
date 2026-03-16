import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Phone, Envelope, Star, Clock } from '@phosphor-icons/react'
import { useLeads } from '@/hooks/useLeadsApi'

interface HomePageProps {
  onNavigate: (page: string) => void
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { data: leads = [] } = useLeads()
  
  const greenLeads = leads.filter(lead => lead.priority === 'green')
  const yellowLeads = leads.filter(lead => lead.priority === 'yellow')
  const redLeads = leads.filter(lead => lead.priority === 'red')
  const topLeads = leads.filter(lead => lead.rating === 'A+').slice(0, 3)

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div
          className="inline-block px-4 py-2 rounded-full bg-success/10 text-success mb-4"
          style={{
            borderRadius: '2rem',
          }}
        >
          <span className="text-sm font-medium">
            AI-Powered Lead Intelligence
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          XPS INTELLIGENCE
        </h1>
        <p className="text-xl text-muted-foreground">
          AI Operating System for Lead Intelligence
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => onNavigate('leads')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass-card p-8 rounded-2xl text-left hover:border-success transition-all priority-green"
        >
          <div className="text-5xl font-bold text-success mb-2">{greenLeads.length}</div>
          <div className="text-lg font-medium">Green Priority</div>
          <div className="text-sm text-muted-foreground">Hot leads ready to close</div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => onNavigate('leads')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass-card p-8 rounded-2xl text-left hover:border-warning transition-all priority-yellow"
        >
          <div className="text-5xl font-bold text-warning mb-2">{yellowLeads.length}</div>
          <div className="text-lg font-medium">Yellow Priority</div>
          <div className="text-sm text-muted-foreground">Warm leads in progress</div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => onNavigate('leads')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass-card p-8 rounded-2xl text-left hover:border-danger transition-all priority-red"
        >
          <div className="text-5xl font-bold text-danger mb-2">{redLeads.length}</div>
          <div className="text-lg font-medium">Red Priority</div>
          <div className="text-sm text-muted-foreground">Needs immediate attention</div>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass-card p-6 rounded-2xl">
            <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
            <div className="space-y-3">
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
                onClick={() => onNavigate('dashboard')}
              >
                View Dashboard
              </Button>
              <Button
                className="w-full bg-success hover:bg-success/90 text-white"
                size="lg"
                onClick={() => onNavigate('leads')}
              >
                Manage Leads
              </Button>
              <Button
                className="w-full"
                variant="outline"
                size="lg"
                onClick={() => onNavigate('scraper')}
              >
                Run Lead Scraper
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Top A+ Opportunities</h2>
              <Star size={24} className="text-warning" weight="duotone" />
            </div>
            {topLeads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No A+ leads yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topLeads.map((lead, index) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    style={{
                      borderLeft: '3px solid var(--color-success)'
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{lead.company}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock size={14} />
                        <span className="text-xs">
                          Score: {lead.opportunityScore}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-success/20 transition-colors"
                        style={{
                          background: 'var(--color-success)',
                          color: 'white'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={16} weight="duotone" />
                      </a>
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-primary/20 transition-colors"
                        style={{
                          background: 'var(--color-primary)',
                          color: 'white'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Envelope size={16} weight="duotone" />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
