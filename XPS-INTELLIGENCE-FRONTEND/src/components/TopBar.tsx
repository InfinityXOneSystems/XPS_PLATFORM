import { motion } from 'framer-motion'
import { Sun, Moon, List } from '@phosphor-icons/react'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

interface TopBarProps {
  onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { theme, toggleTheme } = useTheme()
  const isMobile = useIsMobile()

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="border-b border-border-subtle px-4 md:px-8 py-3"
      style={{
        background: 'var(--card)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      <div className="flex items-center justify-between max-w-[1800px] mx-auto">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="rounded-lg border border-border-subtle hover:border-gold/50 transition-all"
            style={{
              background: 'var(--card)',
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            }}
          >
            <List size={24} weight="regular" className="text-foreground" />
          </Button>
        )}
        
        <div className={isMobile ? 'flex-1' : 'w-full'} />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-lg border border-border-subtle hover:border-gold/50 transition-all"
          style={{
            background: 'var(--card)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          }}
        >
          {theme === 'dark' ? (
            <Sun size={18} weight="duotone" className="text-gold" />
          ) : (
            <Moon size={18} weight="duotone" className="text-gold" />
          )}
        </Button>
      </div>
    </motion.div>
  )
}
