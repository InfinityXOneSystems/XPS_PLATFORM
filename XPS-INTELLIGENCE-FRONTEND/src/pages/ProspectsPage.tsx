import { motion } from 'framer-motion'
import { BackButton } from '@/components/BackButton'
import { MagnifyingGlass, Robot } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface ProspectsPageProps {
  onNavigate: (page: string) => void
}

export function ProspectsPage({ onNavigate }: ProspectsPageProps) {
  return (
    <div className="space-y-10">
      <BackButton onBack={() => onNavigate('home')} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Prospects</h1>
          <p className="text-muted-foreground mt-2 text-base">
            Search and discover new lead opportunities
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-16 text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="p-6 rounded-2xl bg-success/10">
            <MagnifyingGlass size={64} className="text-success" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-4">Find Your Next Lead</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Use the Lead Scraper to discover new prospects in your target markets. 
            If you're not selling, you should be searching.
          </p>
          <Button
            onClick={() => onNavigate('scraper')}
            size="lg"
            className="bg-success hover:bg-success/90"
          >
            <Robot size={20} className="mr-2" />
            Go to Lead Scraper
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
