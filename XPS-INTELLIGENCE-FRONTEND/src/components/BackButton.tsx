import { ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface BackButtonProps {
  onBack: () => void
  label?: string
}

export function BackButton({ onBack, label = 'Back' }: BackButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Button
        variant="ghost"
        onClick={onBack}
        className="group -ml-2 mb-4 hover:bg-muted/50"
      >
        <ArrowLeft 
          size={18} 
          weight="bold" 
          className="mr-2 transition-transform group-hover:-translate-x-1" 
        />
        <span className="font-medium">{label}</span>
      </Button>
    </motion.div>
  )
}
