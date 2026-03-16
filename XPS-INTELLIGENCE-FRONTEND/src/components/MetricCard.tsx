import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendUp, TrendDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  delay?: number
}

export function MetricCard({ title, value, change, icon, delay = 0 }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const targetValue = typeof value === 'number' ? value : parseInt(value.toString().replace(/[^0-9]/g, '')) || 0

  useEffect(() => {
    if (typeof value !== 'number') return
    
    const duration = 1000
    const steps = 30
    const increment = targetValue / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current += increment
      if (step >= steps) {
        setDisplayValue(targetValue)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [targetValue, value])

  const formattedValue = typeof value === 'number' ? displayValue.toLocaleString() : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="rounded-[18px] p-6 cursor-pointer relative overflow-hidden group transition-all duration-300"
      style={{
        background: 'rgba(0, 0, 0, 0.70)',
        backdropFilter: 'blur(60px) saturate(180%)',
        WebkitBackdropFilter: 'blur(60px) saturate(180%)',
        border: '2px solid var(--border-subtle)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div 
        className="absolute inset-[-2px] rounded-[18px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
        style={{ 
          background: 'linear-gradient(90deg, var(--gold-1), var(--gold-2), var(--gold-3), var(--gold-1))',
          backgroundSize: '300% 100%',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '2px',
          animation: 'gold-gradient-shift 3s ease-in-out infinite',
        }}
      />
      <div 
        className="absolute inset-0 rounded-[18px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
        style={{
          boxShadow: '0 0 30px rgba(212, 175, 55, 0.4), 0 0 60px rgba(212, 175, 55, 0.2)',
          animation: 'gold-glow-pulse 2s ease-in-out infinite',
        }}
      />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            {title}
          </p>
          <p className="text-[36px] font-bold text-foreground mt-2 leading-tight" style={{
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            {formattedValue}
          </p>
          {change !== undefined && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.2 }}
              className="flex items-center gap-1.5 mt-3"
            >
              {change >= 0 ? (
                <TrendUp size={14} className="text-success" weight="bold" />
              ) : (
                <TrendDown size={14} className="text-destructive" weight="bold" />
              )}
              <span
                className={cn(
                  'text-xs font-semibold',
                  change >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {Math.abs(change)}%
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </motion.div>
          )}
        </div>
        {icon && (
          <motion.div
            className="text-gold/60 group-hover:text-gold transition-colors duration-300"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.2 }}
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(212, 175, 55, 0.3))'
            }}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
