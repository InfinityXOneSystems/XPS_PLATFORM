import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Memory, HardDrive, WifiHigh, Warning } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  network: number
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <motion.div
        className={`h-2 rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  )
}

export function SystemMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 23,
    memory: 58,
    disk: 67,
    network: 12,
  })

  // Simulate live metrics when not connected to backend
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(20, Math.min(90, prev.memory + (Math.random() - 0.5) * 5)),
        disk: prev.disk,
        network: Math.max(0, Math.min(100, prev.network + (Math.random() - 0.5) * 15)),
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const items = [
    {
      label: 'CPU Usage',
      value: metrics.cpu,
      icon: Cpu,
      color: 'bg-blue-400',
      textColor: 'text-blue-400',
    },
    {
      label: 'Memory',
      value: metrics.memory,
      icon: Memory,
      color: 'bg-yellow-400',
      textColor: 'text-yellow-400',
    },
    {
      label: 'Disk Usage',
      value: metrics.disk,
      icon: HardDrive,
      color: 'bg-purple-400',
      textColor: 'text-purple-400',
    },
    {
      label: 'Network',
      value: metrics.network,
      icon: WifiHigh,
      color: 'bg-green-400',
      textColor: 'text-green-400',
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu size={16} className="text-blue-400" />
            System Monitor
          </span>
          <span className="flex items-center gap-1 text-xs text-yellow-400">
            <Warning size={12} />
            Demo mode
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Icon size={12} className={item.textColor} />
                  {item.label}
                </span>
                <span
                  className={`font-medium ${item.value > 80 ? 'text-red-400' : item.textColor}`}
                >
                  {Math.round(item.value)}%
                </span>
              </div>
              <ProgressBar
                value={item.value}
                color={item.value > 80 ? 'bg-red-400' : item.color}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
