import { motion } from 'framer-motion'
import { Lightning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CommandSuggestionsProps {
  onSelectCommand: (cmd: string) => void
  className?: string
}

const SUGGESTED_COMMANDS = [
  { category: 'Scraping', commands: [
    'Scrape 500 general contractors in Texas',
    'Find roofing companies in Florida with email addresses',
    'Collect HVAC leads in Atlanta area',
  ]},
  { category: 'Analysis', commands: [
    'Analyze lead quality for this week',
    'Score all new leads from latest scrape',
    'Generate pipeline performance report',
  ]},
  { category: 'Development', commands: [
    'Build a new dashboard component for revenue metrics',
    'Fix any TypeScript errors in the frontend',
    'Deploy the latest build to Vercel',
  ]},
  { category: 'System', commands: [
    'Check system health and agent status',
    'Show memory usage and task queue',
    'Trigger GitHub Actions workflow for CI/CD',
  ]},
  { category: 'Research', commands: [
    'Research top contractor directories in the US',
    'Find new sources for roofing company leads',
    'Summarize competitor analysis for XPS',
  ]},
]

export function CommandSuggestions({ onSelectCommand, className }: CommandSuggestionsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Lightning size={14} className="text-yellow-400" />
        <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Quick Commands</p>
      </div>
      {SUGGESTED_COMMANDS.map(group => (
        <div key={group.category}>
          <p className="text-xs font-semibold text-white/30 mb-2 uppercase tracking-wide">{group.category}</p>
          <div className="space-y-1.5">
            {group.commands.map(cmd => (
              <motion.button
                key={cmd}
                onClick={() => onSelectCommand(cmd)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/70 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-white hover:border-yellow-500/20 transition-all"
              >
                {cmd}
              </motion.button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
