/**
 * @file Sidebar.tsx
 * @module components/Sidebar
 * @description Primary navigation sidebar for the XPS Intelligence platform.
 *   Renders collapsible primary (business) and utility (tools) menu sections
 *   with animated transitions. Controlled by the parent layout via currentPage
 *   and onNavigate props.
 *
 * @quantum-standard Quantum Standard — single authoritative import per symbol;
 *   no duplicate identifiers; full JSDoc header on every component file.
 *
 * @author XPS Intelligence System
 * @since 1.0.0
 */
import { motion } from 'framer-motion'
import { 
  House,
  Users,
  Buildings,
  Trophy,
  MagnifyingGlass,
  FunnelSimple, 
  MapTrifold,
  Robot, 
  GearSix,
  Square,
  Brain,
  Scroll,
  Queue,
  Code,
  Browser,
  ChartBar,
  FileText,
  Lightning,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import logoImage from '@/assets/images/XPS-Logo-Transparent.webp'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  collapsed?: boolean
}

const primaryMenuItems = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'contractors', label: 'Contractors', icon: Buildings },
  { id: 'prospects', label: 'Prospects', icon: MagnifyingGlass },
  { id: 'pipeline', label: 'Pipeline', icon: FunnelSimple },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'roadmap', label: 'Roadmap', icon: MapTrifold },
  { id: 'reports', label: 'Reports', icon: ChartBar },
]

const utilityMenuItems = [
  { id: 'agent', label: 'Agent', icon: Brain },
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

export function Sidebar({ currentPage, onNavigate, collapsed = false }: SidebarProps) {
  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'bg-background h-full flex flex-col relative border-r border-border-subtle',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      <div className="relative p-6 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0 w-12 h-12">
            <div 
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, rgba(234,179,8,0.05) 50%, transparent 100%)',
                filter: 'blur(10px)',
              }}
            />
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <img 
                src={logoImage}
                alt="XPS XPRESS Logo"
                className="w-full h-full object-contain"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.3)) drop-shadow(0 0 3px rgba(234,179,8,0.2))'
                }}
              />
            </div>
          </div>
          {!collapsed && (
            <motion.div 
              className="flex-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-xs font-bold text-foreground tracking-tight leading-tight">
                XPS INTELLIGENCE
              </h1>
            </motion.div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-6 space-y-8 overflow-y-auto">
        <div className="space-y-2">
          {primaryMenuItems.map((item, index) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            
            return (
              <motion.button
                key={`${item.id}-${item.label}`}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onNavigate(item.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-150 relative',
                  'text-sm font-semibold',
                  isActive
                    ? 'bg-[rgba(34,197,94,0.12)] border border-success text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
                )}
              >
                <Icon 
                  size={22} 
                  weight="regular"
                  strokeWidth={1.5}
                  className="relative z-10" 
                />
                {!collapsed && (
                  <span className="relative z-10">{item.label}</span>
                )}
              </motion.button>
            )
          })}
        </div>

        <div className="border-t border-border-subtle pt-6">
          {!collapsed && (
            <div className="px-2 mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Tools
            </div>
          )}
          <div className="space-y-2">
            {utilityMenuItems.map((item, index) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              
              return (
                <motion.button
                  key={`${item.id}-${item.label}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (primaryMenuItems.length + index) * 0.05 }}
                  onClick={() => onNavigate(item.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-150 relative',
                    'text-sm font-semibold',
                    isActive
                      ? 'bg-[rgba(34,197,94,0.12)] border border-success text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
                  )}
                >
                  <Icon 
                    size={22} 
                    weight="regular"
                    strokeWidth={1.5}
                    className="relative z-10" 
                  />
                  {!collapsed && (
                    <span className="relative z-10">{item.label}</span>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>
      </nav>
    </motion.aside>
  )
}
