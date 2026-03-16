import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  X,
  CheckCircle,
  Info,
  Warning,
  XCircle,
  ArrowRight
} from '@phosphor-icons/react'
import type { Notification } from '@/types/activity'
import { formatTimeAgo } from '@/lib/activityGenerator'

interface NotificationPanelProps {
  notifications: Notification[]
  onNotificationRead?: (id: string) => void
  onNotificationClick?: (notification: Notification) => void
  onClearAll?: () => void
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success/10'
  },
  info: {
    icon: Info,
    color: 'text-info',
    bgColor: 'bg-info/10'
  },
  warning: {
    icon: Warning,
    color: 'text-warning',
    bgColor: 'bg-warning/10'
  },
  error: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  }
}

export function NotificationPanel({
  notifications,
  onNotificationRead,
  onNotificationClick,
  onClearAll
}: NotificationPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const unreadCount = notifications.filter(n => !n.read).length
  
  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissedIds(prev => new Set(prev).add(id))
    onNotificationRead?.(id)
  }
  
  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      onNotificationRead?.(notification.id)
    }
    onNotificationClick?.(notification)
  }
  
  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id))
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-gold text-background">
              {unreadCount}
            </Badge>
          )}
        </div>
        {visibleNotifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear All
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[450px]">
        <div className="space-y-2 pr-4">
          <AnimatePresence>
            {visibleNotifications.map((notification, _index) => {
              const config = typeConfig[notification.type]
              const Icon = config.icon
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`p-4 rounded-lg border transition-all ${
                      notification.read
                        ? 'bg-muted border-border-subtle'
                        : 'glass-card border-gold/30'
                    } ${
                      onNotificationClick || notification.actionUrl
                        ? 'cursor-pointer hover:border-gold'
                        : ''
                    }`}
                    onClick={() => handleClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor} ${config.color} shrink-0`}>
                        <Icon size={18} weight="bold" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-foreground">
                            {notification.title}
                          </h4>
                          <button
                            onClick={(e) => handleDismiss(notification.id, e)}
                            className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                          >
                            <X size={14} className="text-muted-foreground" />
                          </button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.timestamp)}
                          </span>
                          
                          {notification.actionLabel && (
                            <button className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-muted transition-colors">
                              {notification.actionLabel}
                              <ArrowRight size={12} weight="bold" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          
          {visibleNotifications.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bell size={40} weight="thin" className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No notifications</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
