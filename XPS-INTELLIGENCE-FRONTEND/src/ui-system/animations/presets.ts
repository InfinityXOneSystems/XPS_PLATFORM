export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },
  
  slideInFromRight: {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 100, opacity: 0 },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  
  slideInFromLeft: {
    initial: { x: -100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -100, opacity: 0 },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  
  slideInFromBottom: {
    initial: { y: 50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 50, opacity: 0 },
    transition: { type: 'spring', stiffness: 400, damping: 25 }
  },
  
  scaleIn: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
  },
  
  hoverLift: {
    whileHover: {
      scale: 1.02,
      transition: { duration: 0.15 }
    },
    whileTap: {
      scale: 0.98
    }
  },
  
  hoverGlow: {
    whileHover: {
      boxShadow: '0 0 28px rgba(255, 223, 0, 0.45), 0 0 12px rgba(255, 223, 0, 0.25)',
      borderColor: 'rgba(212, 175, 55, 0.6)',
      transition: { duration: 0.15 }
    }
  },
  
  pulseGlow: {
    animate: {
      boxShadow: [
        '0 0 28px rgba(255, 223, 0, 0.45), 0 0 12px rgba(255, 223, 0, 0.25)',
        '0 0 45px rgba(255, 223, 0, 0.65), 0 0 20px rgba(255, 223, 0, 0.35)',
        '0 0 28px rgba(255, 223, 0, 0.45), 0 0 12px rgba(255, 223, 0, 0.25)'
      ]
    },
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },
  
  shimmer: {
    animate: {
      backgroundPosition: ['200% 0', '-200% 0']
    },
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'linear'
    }
  },
  
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05
      }
    }
  },
  
  rotateIn: {
    initial: { rotate: -10, opacity: 0 },
    animate: { rotate: 0, opacity: 1 },
    exit: { rotate: 10, opacity: 0 },
    transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }
  },
  
  expandHeight: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  }
}

export const easings = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
}

export const durations = {
  instant: 0.05,
  fast: 0.1,
  normal: 0.2,
  slow: 0.3,
  slower: 0.5,
  slowest: 1
}
