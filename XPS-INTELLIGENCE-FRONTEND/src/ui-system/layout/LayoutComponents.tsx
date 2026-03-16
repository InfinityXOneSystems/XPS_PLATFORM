import React from 'react'
import { cn } from '@/lib/utils'

export interface LayoutContainerProps {
  children: React.ReactNode
  className?: string
}

export const AppLayout: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <div className={cn(
      'min-h-screen w-full bg-background text-foreground',
      'relative overflow-hidden',
      className
    )}>
      {children}
    </div>
  )
}

export const NavigationRail: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full w-[280px]',
      'bg-card/50 backdrop-blur-xl border-r border-border-subtle',
      'flex flex-col',
      'z-40',
      'transition-transform duration-300',
      className
    )}>
      {children}
    </aside>
  )
}

export const TopCommandBar: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <header className={cn(
      'fixed top-0 right-0 left-[280px]',
      'h-16 bg-card/30 backdrop-blur-md border-b border-border-subtle',
      'flex items-center px-6',
      'z-30',
      className
    )}>
      {children}
    </header>
  )
}

export const MainWorkspace: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <main className={cn(
      'ml-[280px] mt-16',
      'min-h-[calc(100vh-4rem)]',
      'p-8',
      className
    )}>
      <div className="max-w-[1800px] mx-auto">
        {children}
      </div>
    </main>
  )
}

export const RightContextPanel: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <aside className={cn(
      'fixed right-0 top-16 h-[calc(100vh-4rem)] w-[400px]',
      'bg-card/50 backdrop-blur-xl border-l border-border-subtle',
      'flex flex-col',
      'z-30',
      'transition-transform duration-300',
      className
    )}>
      {children}
    </aside>
  )
}

export const GridContainer: React.FC<LayoutContainerProps & { columns?: number }> = ({
  children,
  className,
  columns = 12
}) => {
  return (
    <div className={cn(
      'grid gap-6',
      columns === 12 && 'grid-cols-12',
      columns === 6 && 'grid-cols-6',
      columns === 4 && 'grid-cols-4',
      columns === 3 && 'grid-cols-3',
      columns === 2 && 'grid-cols-2',
      className
    )}>
      {children}
    </div>
  )
}

export const FlexContainer: React.FC<LayoutContainerProps & {
  direction?: 'row' | 'column'
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
}> = ({
  children,
  className,
  direction = 'row',
  gap = 4,
  align = 'stretch',
  justify = 'start'
}) => {
  return (
    <div className={cn(
      'flex',
      direction === 'column' && 'flex-col',
      `gap-${gap}`,
      align === 'start' && 'items-start',
      align === 'center' && 'items-center',
      align === 'end' && 'items-end',
      align === 'stretch' && 'items-stretch',
      justify === 'start' && 'justify-start',
      justify === 'center' && 'justify-center',
      justify === 'end' && 'justify-end',
      justify === 'between' && 'justify-between',
      justify === 'around' && 'justify-around',
      className
    )}>
      {children}
    </div>
  )
}

export const Section: React.FC<LayoutContainerProps & { title?: string }> = ({
  children,
  className,
  title
}) => {
  return (
    <section className={cn('space-y-4', className)}>
      {title && (
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

export const Panel: React.FC<LayoutContainerProps & { variant?: 'glass' | 'solid' }> = ({
  children,
  className,
  variant = 'glass'
}) => {
  return (
    <div className={cn(
      'rounded-xl p-6',
      variant === 'glass' && 'bg-card/50 backdrop-blur-xl border border-border-subtle',
      variant === 'solid' && 'bg-card border border-border',
      className
    )}>
      {children}
    </div>
  )
}

export const ModalOverlay: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <div className={cn(
      'fixed inset-0 z-50',
      'bg-background/80 backdrop-blur-sm',
      'flex items-center justify-center',
      'p-4',
      className
    )}>
      {children}
    </div>
  )
}

export const CommandPalette: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <div className={cn(
      'fixed top-[20%] left-1/2 -translate-x-1/2',
      'w-full max-w-2xl',
      'bg-card/95 backdrop-blur-2xl',
      'border border-border-subtle rounded-xl',
      'shadow-[0_20px_70px_rgba(0,0,0,0.3)]',
      'z-50',
      className
    )}>
      {children}
    </div>
  )
}

export const ResponsiveGrid: React.FC<LayoutContainerProps> = ({ children, className }) => {
  return (
    <div className={cn(
      'grid gap-6',
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-3',
      'xl:grid-cols-4',
      className
    )}>
      {children}
    </div>
  )
}
