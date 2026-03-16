import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Package, Play, Stop, ArrowClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getDockerContainers, dockerAction, type DockerContainer } from '@/services/localMachineService'

interface DockerManagerProps {
  open: boolean
  onClose: () => void
}

const statusColors: Record<DockerContainer['status'], string> = {
  running: 'bg-green-500/15 text-green-400 border-green-500/30',
  stopped: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  exited: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function DockerManager({ open, onClose }: DockerManagerProps) {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getDockerContainers().then(data => {
      if (!cancelled) {
        setContainers(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [open])

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    const result = await dockerAction(id, action)
    if (result.success) {
      if (action === 'remove') {
        setContainers(prev => prev.filter(c => c.id !== id))
      } else {
        setContainers(prev => prev.map(c => {
          if (c.id !== id) return c
          return { ...c, status: action === 'start' ? 'running' : 'stopped' }
        }))
      }
      toast.success(result.message)
    }
    setActionLoading(prev => ({ ...prev, [id]: false }))
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl mx-4 bg-background border border-white/12 rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/8 shrink-0">
              <Package size={18} className="text-blue-400" />
              <h2 className="text-base font-bold text-white flex-1">Docker Manager</h2>
              <Button variant="ghost" size="sm" onClick={() => {
                setLoading(true)
                getDockerContainers().then(data => { setContainers(data); setLoading(false) })
              }} className="text-white/40 hover:text-white h-7 px-2">
                <ArrowClockwise size={14} />
              </Button>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Container list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
                </div>
              ) : containers.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">No containers found</div>
              ) : (
                containers.map(container => (
                  <div
                    key={container.id}
                    className="rounded-xl border border-white/8 bg-black/20 p-4 hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{container.name}</p>
                          <Badge className={cn('text-xs border', statusColors[container.status])}>
                            {container.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/40 font-mono mt-1 truncate">{container.image}</p>
                        {container.ports.length > 0 && (
                          <p className="text-xs text-white/30 mt-1">Ports: {container.ports.join(', ')}</p>
                        )}
                        {container.status === 'running' && (
                          <p className="text-xs text-white/30 mt-1">
                            CPU: {container.cpuPercent?.toFixed(1)}% · Mem: {container.memoryUsage}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {container.status !== 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading[container.id]}
                            onClick={() => handleAction(container.id, 'start')}
                            className="h-7 px-2 border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs"
                          >
                            <Play size={12} />
                          </Button>
                        )}
                        {container.status === 'running' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading[container.id]}
                              onClick={() => handleAction(container.id, 'stop')}
                              className="h-7 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                            >
                              <Stop size={12} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading[container.id]}
                              onClick={() => handleAction(container.id, 'restart')}
                              className="h-7 px-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-xs"
                            >
                              <ArrowClockwise size={12} className={actionLoading[container.id] ? 'animate-spin' : ''} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/8 flex justify-between items-center shrink-0">
              <p className="text-xs text-white/30">
                {containers.filter(c => c.status === 'running').length}/{containers.length} running
              </p>
              <Button variant="outline" onClick={onClose} className="border-white/20 text-white/60 hover:bg-white/5">Close</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
