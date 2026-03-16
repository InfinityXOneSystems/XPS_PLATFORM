import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface CommandBarProps {
  onCommand?: (command: string) => void
}

export function CommandBar({ onCommand }: CommandBarProps) {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('command-input')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return

    const cmd = command.trim().toLowerCase()
    setHistory((prev) => [...prev, command])
    setHistoryIndex(-1)

    if (cmd.startsWith('run scraper') || cmd.startsWith('scrape')) {
      const city = cmd.replace(/^(run scraper|scrape)/, '').trim()
      toast.success(`Starting scraper${city ? ` for ${city}` : ''}...`)
      onCommand?.(`scraper:${city}`)
    } else if (cmd.startsWith('show top leads') || cmd.startsWith('show a+ leads')) {
      toast.success('Displaying top leads')
      onCommand?.('leads:top')
    } else if (cmd.startsWith('generate outreach')) {
      toast.success('Generating outreach email...')
      onCommand?.('email:generate')
    } else if (cmd === 'help') {
      toast.info('Available commands: scrape [city], show A+ leads, generate outreach')
    } else {
      toast.error('Unknown command. Type "help" for available commands.')
    }

    setCommand('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCommand(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1
        if (newIndex >= history.length) {
          setHistoryIndex(-1)
          setCommand('')
        } else {
          setHistoryIndex(newIndex)
          setCommand(history[newIndex])
        }
      }
    }
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <motion.form
        onSubmit={handleSubmit}
        className="glass-panel px-6 py-4 rounded-2xl min-w-[600px]"
        animate={{
          boxShadow: isFocused
            ? '0 0 30px rgba(217, 179, 66, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5)'
            : '0 10px 40px rgba(0, 0, 0, 0.5)'
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Terminal size={16} className="text-background" weight="bold" />
            </div>
            <span className="text-primary font-mono text-lg glow-text-gold">{'>'}</span>
          </div>
          
          <div className="relative flex-1">
            <Input
              id="command-input"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Type command... (⌘K to focus)"
              className="w-full font-mono text-sm border-2 border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground"
              style={{
                background: 'rgba(0, 0, 0, 0.70)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            />
            <div 
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                padding: '2px',
                background: 'linear-gradient(135deg, var(--gradient-gold-start) 0%, var(--gradient-gold-mid) 25%, var(--gradient-silver-start) 50%, var(--gradient-gold-mid) 75%, var(--gradient-gold-start) 100%)',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                backgroundSize: '200% 200%',
                animation: 'gradient-shift 3s linear infinite',
              }}
            />
          </div>
          
          <AnimatePresence>
            {command && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <kbd className="px-2 py-1 text-[10px] font-mono bg-white/5 border border-white/10 rounded">
                  Enter
                </kbd>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: isFocused ? 1 : 0, height: isFocused ? 'auto' : 0 }}
          className="overflow-hidden"
        >
          <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Quick commands:
            </span>
            {['scrape tampa', 'show A+ leads', 'generate outreach'].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => setCommand(cmd)}
                className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/40 transition-colors text-muted-foreground hover:text-primary"
              >
                {cmd}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.form>
    </motion.div>
  )
}
