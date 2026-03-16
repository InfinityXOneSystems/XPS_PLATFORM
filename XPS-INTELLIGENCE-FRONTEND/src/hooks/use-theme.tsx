import { createContext, useContext, useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeKV] = useKV<Theme>('app-theme', 'dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme || 'dark')
  }, [theme, mounted])

  const toggleTheme = () => {
    setThemeKV((currentTheme) => currentTheme === 'light' ? 'dark' : 'light')
  }

  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme: theme || 'dark', setTheme: setThemeKV, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
