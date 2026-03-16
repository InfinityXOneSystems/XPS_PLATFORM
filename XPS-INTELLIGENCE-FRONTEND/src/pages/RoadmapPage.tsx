import { motion } from 'framer-motion'
import { BackButton } from '@/components/BackButton'
import { MapTrifold, CheckCircle, Circle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'

interface RoadmapPageProps {
  onNavigate: (page: string) => void
}

const roadmapItems = [
  {
    phase: 'Phase 1',
    title: 'Foundation',
    status: 'in-progress',
    items: [
      { label: 'Lead management system', completed: true },
      { label: 'Team accountability tracking', completed: true },
      { label: 'Priority system (Green/Yellow/Red)', completed: true },
      { label: 'Lead scraper integration', completed: false },
      { label: 'Automated lead distribution', completed: false },
    ]
  },
  {
    phase: 'Phase 2',
    title: 'Optimization',
    status: 'planned',
    items: [
      { label: 'Email campaign automation', completed: false },
      { label: 'SMS outreach integration', completed: false },
      { label: 'Advanced analytics dashboard', completed: false },
      { label: 'CRM integrations', completed: false },
      { label: 'Mobile app development', completed: false },
    ]
  },
  {
    phase: 'Phase 3',
    title: 'Scaling',
    status: 'planned',
    items: [
      { label: 'Multi-team management', completed: false },
      { label: 'Advanced reporting & forecasting', completed: false },
      { label: 'AI-powered lead scoring', completed: false },
      { label: 'Custom workflow builder', completed: false },
      { label: 'API access for partners', completed: false },
    ]
  },
]

export function RoadmapPage({ onNavigate }: RoadmapPageProps) {
  return (
    <div className="space-y-10">
      <BackButton onBack={() => onNavigate('home')} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <MapTrifold size={40} className="text-primary" weight="fill" />
            Product Roadmap
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Our vision and journey to build the best lead intelligence system
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {roadmapItems.map((phase, phaseIndex) => {
          const completedCount = phase.items.filter(item => item.completed).length
          const progress = (completedCount / phase.items.length) * 100
          
          return (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: phaseIndex * 0.1 }}
            >
              <Card className="glass-card p-8">
                <div className="flex items-start gap-6 mb-6">
                  <div className="text-4xl font-bold text-primary">
                    {phaseIndex + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-2xl font-bold">{phase.title}</h3>
                        <p className="text-sm text-muted-foreground uppercase tracking-wider">
                          {phase.phase} • {phase.status === 'in-progress' ? 'In Progress' : 'Planned'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-success">
                          {completedCount}/{phase.items.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                      </div>
                    </div>
                    
                    <div className="w-full bg-muted rounded-full h-3 mb-6">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, delay: phaseIndex * 0.1 + 0.3 }}
                        className="bg-success h-full rounded-full"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      {phase.items.map((item, itemIndex) => (
                        <motion.div
                          key={itemIndex}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: phaseIndex * 0.1 + itemIndex * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          {item.completed ? (
                            <CheckCircle size={24} weight="fill" className="text-success flex-shrink-0" />
                          ) : (
                            <Circle size={24} className="text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>
                            {item.label}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
