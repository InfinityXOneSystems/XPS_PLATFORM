import React from 'react'
import { cn } from '@/lib/utils'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive'
  glowOnHover?: boolean
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', glowOnHover = false, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-card backdrop-blur-xl border border-border-subtle',
      elevated: 'bg-elevated backdrop-blur-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
      interactive: 'bg-card backdrop-blur-xl border border-border-subtle cursor-pointer transition-all duration-200'
    }

    const hoverStyles = glowOnHover
      ? 'hover:border-border-hover hover:shadow-[0_0_28px_rgba(255,223,0,0.45),0_0_12px_rgba(255,223,0,0.25)] hover:scale-[1.02]'
      : ''

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl',
          variantStyles[variant],
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'

export interface MetricCardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  icon?: React.ReactNode
  variant?: 'gold' | 'silver' | 'bronze' | 'maroon' | 'default'
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  icon,
  variant = 'default'
}) => {
  const variantClasses = {
    gold: 'border-[#D4AF37]/30 hover:border-[#D4AF37]/60 hover:shadow-[0_0_28px_rgba(212,175,55,0.45)]',
    silver: 'border-[#C0C0C0]/30 hover:border-[#C0C0C0]/60 hover:shadow-[0_0_28px_rgba(192,192,192,0.40)]',
    bronze: 'border-[#CD7F32]/30 hover:border-[#CD7F32]/60 hover:shadow-[0_0_28px_rgba(205,127,50,0.40)]',
    maroon: 'border-[#8B0023]/30 hover:border-[#8B0023]/60 hover:shadow-[0_0_28px_rgba(139,0,35,0.40)]',
    default: 'border-border-subtle hover:border-border-hover'
  }

  return (
    <GlassCard className={cn('p-6 transition-all duration-200', variantClasses[variant])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">
            {label}
          </p>
          <p className="text-4xl font-bold text-foreground mb-1">{value}</p>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium',
              trend.direction === 'up' ? 'text-success' : 'text-destructive'
            )}>
              <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-muted-foreground opacity-40">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  )
}

export interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  size = 'md'
}) => {
  const statusStyles = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    info: 'bg-info/10 text-info border-info/20',
    neutral: 'bg-muted text-muted-foreground border-border-subtle'
  }

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-md border font-medium',
      statusStyles[status],
      sizeStyles[size]
    )}>
      {children}
    </span>
  )
}

export interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'silver' | 'bronze' | 'maroon' | 'cyan'
  size?: 'sm' | 'md' | 'lg'
}

export const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant = 'gold', size = 'md', children, ...props }, ref) => {
    const variantStyles = {
      gold: 'bg-gradient-to-r from-[#D4AF37] via-[#E6C65C] to-[#F0E68C] hover:brightness-110',
      silver: 'bg-gradient-to-r from-[#E8E8E8] via-[#C0C0C0] to-[#A0A0A0] hover:brightness-110',
      bronze: 'bg-gradient-to-r from-[#E39D5E] via-[#CD7F32] to-[#B5722D] hover:brightness-110',
      maroon: 'bg-gradient-to-r from-[#B03040] via-[#8B0023] to-[#6B001C] hover:brightness-110',
      cyan: 'bg-gradient-to-r from-[#00E5FF] via-[#4AF0FF] to-[#00E5FF] hover:brightness-110'
    }

    const sizeStyles = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-2.5 text-base',
      lg: 'px-8 py-3 text-lg'
    }

    return (
      <button
        ref={ref}
        className={cn(
          'rounded-xl font-semibold text-black transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

GradientButton.displayName = 'GradientButton'

export interface LoadingStateProps {
  message?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-4">
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-2 border-border-subtle" />
      <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
    </div>
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
)

export interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon
}) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    {icon && (
      <div className="text-muted-foreground opacity-40 mb-2">
        {icon}
      </div>
    )}
    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
    {description && (
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {description}
      </p>
    )}
    {action && (
      <GradientButton onClick={action.onClick} className="mt-4">
        {action.label}
      </GradientButton>
    )}
  </div>
)
