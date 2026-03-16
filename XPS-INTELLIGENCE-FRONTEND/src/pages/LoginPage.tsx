import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import logoImage from '@/assets/images/XPS-Logo-Transparent.webp'

interface LoginPageProps {
  onLogin: () => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email && password) {
      setIsLoading(true)
      setLoadingProgress(0)
      
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 100)

      setTimeout(() => {
        clearInterval(interval)
        setLoadingProgress(100)
        setTimeout(() => {
          onLogin()
        }, 300)
      }, 1200)
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(212,175,55,0.12),transparent_50%)] pointer-events-none dark:opacity-100 opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(192,192,192,0.09),transparent_50%)] pointer-events-none dark:opacity-100 opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_80%,rgba(139,0,35,0.06),transparent_40%)] pointer-events-none dark:opacity-100 opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(212,175,55,0.03)_0%,transparent_30%,rgba(192,192,192,0.02)_60%,transparent_100%)] pointer-events-none dark:opacity-100 opacity-40" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="relative rounded-3xl p-[1px]">
          <div 
            className="absolute inset-0 rounded-3xl opacity-100"
            style={{
              background: 'linear-gradient(135deg, oklch(0.92 0.22 95) 0%, oklch(0.88 0.01 0) 25%, oklch(0.92 0.22 95) 50%, oklch(0.88 0.01 0) 75%, oklch(0.92 0.22 95) 100%)',
              backgroundSize: '200% 200%',
              animation: 'gradient-shift 3s linear infinite',
            }}
          />
          <div 
            className="glass-card rounded-3xl p-10 sm:p-12 relative"
            style={{
              background: 'var(--card)',
              backdropFilter: 'blur(60px) saturate(200%)',
              WebkitBackdropFilter: 'blur(60px) saturate(200%)',
            }}
          >
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-6" style={{ width: '118px', height: '118px' }}>
              <div 
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(192,192,192,0.18) 40%, rgba(255,223,0,0.12) 60%, transparent 100%)',
                  filter: 'blur(18px)',
                }}
              />
              <div 
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'radial-gradient(circle, rgba(255,223,0,0.15) 0%, rgba(212,175,55,0.08) 50%, transparent 70%)',
                  filter: 'blur(24px)',
                  animation: 'pulse-glow 3s ease-in-out infinite',
                }}
              />
              <div className="relative z-10 flex items-center justify-center w-full h-full">
                <img 
                  src={logoImage}
                  alt="XPS XPRESS Logo"
                  className="w-full h-full object-contain"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.4)) drop-shadow(0 0 4px rgba(192,192,192,0.25)) drop-shadow(0 0 12px rgba(255,223,0,0.2))'
                  }}
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">
              XPS INTELLIGENCE
            </h1>
            <p className="text-muted-foreground text-center text-sm">
              Enterprise-grade intelligence platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium text-center block">
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  style={{
                    background: 'rgba(0, 0, 0, 0.70)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                  className="h-12 text-foreground text-center placeholder:text-muted-foreground border-2 border-transparent transition-all duration-200 disabled:opacity-50"
                  required
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium text-center block">
                Password
              </Label>
              <div className="relative">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    style={{
                      background: 'rgba(0, 0, 0, 0.70)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                    }}
                    className="h-12 text-foreground text-center placeholder:text-muted-foreground pr-12 border-2 border-transparent transition-all duration-200 disabled:opacity-50"
                    required
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors disabled:opacity-50 z-10"
                  >
                    {showPassword ? (
                      <EyeSlash size={20} weight="regular" />
                    ) : (
                      <Eye size={20} weight="regular" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">Authenticating...</span>
                    <span>{loadingProgress}%</span>
                  </div>
                  <Progress value={loadingProgress} className="h-1.5" />
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 font-semibold rounded-xl relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(255,223,0,0.45)] disabled:opacity-70 disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(135deg, oklch(0.92 0.22 95) 0%, oklch(0.88 0.01 0) 50%, oklch(0.92 0.22 95) 100%)',
                color: '#1a1a1a',
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
