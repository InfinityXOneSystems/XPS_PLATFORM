import { useState } from 'react'
import { motion } from 'framer-motion'
import { Cube, Play, Stop, Warning, CheckCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Container {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'error'
  ports: string
  created: string
}

const MOCK_CONTAINERS: Container[] = [
  {
    id: 'abc123',
    name: 'xps-backend',
    image: 'xps_intelligence:latest',
    status: 'running',
    ports: '3000:3000',
    created: '2 days ago',
  },
  {
    id: 'def456',
    name: 'postgres-db',
    image: 'postgres:15',
    status: 'running',
    ports: '5432:5432',
    created: '2 days ago',
  },
  {
    id: 'ghi789',
    name: 'redis-cache',
    image: 'redis:alpine',
    status: 'stopped',
    ports: '6379:6379',
    created: '1 day ago',
  },
  {
    id: 'jkl012',
    name: 'nginx-proxy',
    image: 'nginx:latest',
    status: 'error',
    ports: '80:80',
    created: '3 hours ago',
  },
]

const STATUS_CONFIG: Record<
  Container['status'],
  { icon: React.ElementType; color: string; bg: string }
> = {
  running: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/30',
  },
  stopped: {
    icon: Stop,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
  },
  error: { icon: Warning, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
}

export function DockerManager() {
  const [containers, setContainers] = useState<Container[]>(MOCK_CONTAINERS)
  const [loading, setLoading] = useState<string | null>(null)

  const toggleContainer = async (id: string) => {
    setLoading(id)
    await new Promise(r => setTimeout(r, 800))
    setContainers(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              status: (c.status === 'running' ? 'stopped' : 'running') as Container['status'],
            }
          : c
      )
    )
    setLoading(null)
    const container = containers.find(c => c.id === id)
    toast.success(`Container ${container?.status === 'running' ? 'stopped' : 'started'}`)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cube size={16} className="text-cyan-400" />
            Docker Containers
          </span>
          <Button variant="ghost" size="sm" onClick={() => toast.info('Refreshed')}>
            <ArrowsClockwise size={14} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {containers.map((container, i) => {
          const StatusIcon = STATUS_CONFIG[container.status].icon
          return (
            <motion.div
              key={container.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 rounded-lg border flex items-center justify-between ${STATUS_CONFIG[container.status].bg}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon size={14} className={STATUS_CONFIG[container.status].color} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {container.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {container.image} • {container.ports}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleContainer(container.id)}
                disabled={loading === container.id}
                className="ml-2 flex-shrink-0"
              >
                {loading === container.id ? (
                  <ArrowsClockwise size={12} className="animate-spin" />
                ) : container.status === 'running' ? (
                  <Stop size={12} />
                ) : (
                  <Play size={12} />
                )}
              </Button>
            </motion.div>
          )
        })}
      </CardContent>
    </Card>
  )
}
