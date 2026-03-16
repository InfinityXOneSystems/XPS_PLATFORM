export const designSystem = {
  colors: {
    background: {
      primary: '#000000',
      secondary: '#050505',
      tertiary: '#0A0A0A',
      card: '#0A0A0A',
    },
    
    gradients: {
      gold: {
        start: 'oklch(0.82 0.15 70)',
        mid: 'oklch(0.75 0.14 55)',
        end: 'oklch(0.68 0.12 45)',
        css: 'linear-gradient(135deg, oklch(0.82 0.15 70) 0%, oklch(0.75 0.14 55) 50%, oklch(0.68 0.12 45) 100%)',
      },
      silver: {
        start: 'oklch(0.78 0.02 240)',
        mid: 'oklch(0.68 0.04 250)',
        end: 'oklch(0.58 0.03 260)',
        css: 'linear-gradient(135deg, oklch(0.78 0.02 240) 0%, oklch(0.68 0.04 250) 50%, oklch(0.58 0.03 260) 100%)',
      },
      bronze: {
        start: 'oklch(0.72 0.14 50)',
        mid: 'oklch(0.65 0.12 40)',
        end: 'oklch(0.58 0.10 35)',
        css: 'linear-gradient(135deg, oklch(0.72 0.14 50) 0%, oklch(0.65 0.12 40) 50%, oklch(0.58 0.10 35) 100%)',
      },
    },

    metallic: {
      gold: '#D4AF37',
      goldMuted: '#E6C65C',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
    },

    border: {
      default: 'rgba(212, 175, 55, 0.25)',
      hover: 'rgba(212, 175, 55, 0.6)',
      gold: 'rgba(212, 175, 55, 0.35)',
      subtle: 'rgba(255, 255, 255, 0.08)',
    },

    text: {
      primary: '#FFFFFF',
      secondary: '#9CA3AF',
      muted: '#6B7280',
      gold: '#D4AF37',
    },

    status: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
    },

    charts: {
      gold: '#D4AF37',
      teal: '#14B8A6',
      slate: '#64748B',
      green: '#84CC16',
    },
  },

  typography: {
    fontFamily: {
      primary: "'Montserrat', 'Inter', sans-serif",
      secondary: "'Inter', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    
    scale: {
      pageTitle: {
        size: '48px',
        weight: '700',
        lineHeight: '1.2',
      },
      sectionHeader: {
        size: '22px',
        weight: '600',
        lineHeight: '1.4',
      },
      metricNumber: {
        size: '36px',
        weight: '700',
        lineHeight: '1.2',
      },
      cardLabel: {
        size: '12px',
        weight: '600',
        lineHeight: '1.5',
        letterSpacing: '0.15em',
        textTransform: 'uppercase' as const,
      },
      body: {
        size: '14px',
        weight: '400',
        lineHeight: '1.6',
      },
      small: {
        size: '11px',
        weight: '500',
        lineHeight: '1.5',
      },
    },
  },

  radius: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '24px',
    full: '9999px',
  },

  spacing: {
    card: {
      padding: '24px',
      gap: '16px',
    },
    section: {
      padding: '32px',
      gap: '24px',
    },
  },

  elevation: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    glow: '0 0 14px rgba(212, 175, 55, 0.2)',
    glowStrong: '0 0 24px rgba(212, 175, 55, 0.4)',
  },

  animations: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      smooth: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },

  glass: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropBlur: 'blur(16px)',
    border: 'rgba(255, 255, 255, 0.12)',
  },
} as const

export type DesignSystem = typeof designSystem
