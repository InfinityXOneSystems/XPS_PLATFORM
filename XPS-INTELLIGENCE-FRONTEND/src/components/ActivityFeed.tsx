import { motion } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  UserPlus, 
  PencilSimple, 
  UserCheck,
  EnvelopeSimple,
  Phone,
  Robot,
  CheckCircle,
  ChartLine,
  Note,
  ArrowsClockwise,
  Dot
} from '@phosphor-icons/react'
import type { Activity } from '@/types/activity'
import { formatTimeAgo, getActivityColor } from '@/lib/activityGenerator'

interface ActivityFeedProps {
  activities: Activity[]
  onActivityClick?: (activity: Activity) => void
}

const iconMap = {
  lead_added: UserPlus,
  lead_updated: PencilSimple,
  lead_assigned: UserCheck,
  email_sent: EnvelopeSimple,
  call_made: Phone,
  scraper_started: Robot,
  scraper_completed: CheckCircle,
  score_updated: ChartLine,
  note_added: Note,
  status_changed: ArrowsClockwise
}

export function ActivityFeed({ activities, onActivityClick }: ActivityFeedProps) {
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 pr-4">
        {activities.map((activity, index) => {
          const Icon = iconMap[activity.type] || Dot
          const colorClass = getActivityColor(activity.type)
          
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`p-3 rounded-lg bg-muted hover:bg-[rgba(212,175,55,0.08)] transition-all border border-transparent hover:border-border-subtle ${
                onActivityClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onActivityClick?.(activity)}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${colorClass}`}>
                  <Icon size={18} weight="regular" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {activity.description}
                  </p>
                </div>
              </div>
            </motion.div>
          )
        })}
        
        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Robot size={40} weight="thin" className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No recent activity</p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
