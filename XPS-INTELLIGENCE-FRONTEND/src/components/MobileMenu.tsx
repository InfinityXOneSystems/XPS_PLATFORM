import { motion, AnimatePresence } from 'framer-motion'
import { 
  House,
  ChartBar, 
  Users, 
  Buildings,
  Robot, 
  FunnelSimple, 
  GearSix,
  Square,
  X,
  Brain,
  Scroll,
  Queue,
  Code,
  Browser,
  Trophy,
  MagnifyingGlass,
  MapTrifold,
  Lightning,
  FileText,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import logoImage from '@/assets/images/XPS-Logo-Transparent.webp'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  currentPage: string
  onNavigate: (page: string) => void
}

const menuItems = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'dashboard', label: 'Dashboard', icon: ChartBar },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'contractors', label: 'Contractors', icon: Buildings },
  { id: 'prospects', label: 'Prospects', icon: MagnifyingGlass },
  { id: 'pipeline', label: 'Pipeline', icon: FunnelSimple },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'roadmap', label: 'Roadmap', icon: MapTrifold },
  { id: 'reports', label: 'Reports', icon: ChartBar },
  { id: 'agent', label: 'Agent Control', icon: Brain },
  { id: 'tasks', label: 'Task Queue', icon: Queue },
  { id: 'scraper', label: 'Scraper', icon: Robot },
  { id: 'editor', label: 'Code Editor', icon: Code },
  { id: 'sandbox', label: 'Sandbox', icon: Browser },
  { id: 'canvas', label: 'Canvas', icon: Square },
  { id: 'automation', label: 'Automation', icon: Lightning },
  { id: 'logs', label: 'System Logs', icon: Scroll },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: GearSix }
]

export function MobileMenu({ isOpen, onClose, currentPage, onNavigate }: MobileMenuProps) {
  const handleNavigate = (page: string) => {
    onNavigate(page)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-background border-r border-border-subtle z-50 flex flex-col"
          >
            <div className="relative p-6 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0 w-12 h-12">
                  <div 
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(192,192,192,0.1) 50%, transparent 100%)',
                      filter: 'blur(12px)',
                    }}
                  />
                  <div className="relative z-10 flex items-center justify-center w-full h-full">
                    <img 
                      src={logoImage}
                      alt="XPS XPRESS Logo"
                      className="w-full h-full object-contain"
                      style={{
                        filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.3)) drop-shadow(0 0 3px rgba(192,192,192,0.2))'
                      }}
                    />
                  </div>
                </div>
                <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                  XPS Intelligence
                </h1>
              </div>
              
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={24} weight="regular" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const isActive = currentPage === item.id
                
                return (
                  <motion.button
                    key={`${item.id}-${item.label}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150',
                      'text-sm font-semibold',
                      isActive
                        ? 'bg-[rgba(212,175,55,0.12)] border border-gold text-foreground'
                        : 'text-secondary hover:text-foreground hover:bg-muted border border-transparent'
                    )}
                  >
                    <Icon 
                      size={20} 
                      weight="regular"
                      strokeWidth={1.5}
                    />
                    <span>{item.label}</span>
                  </motion.button>
                )
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
