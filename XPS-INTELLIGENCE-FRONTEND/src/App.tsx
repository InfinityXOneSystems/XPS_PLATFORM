import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { ThemeProvider } from '@/hooks/use-theme'
import { useIsMobile } from '@/hooks/use-mobile'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { MobileMenu } from '@/components/MobileMenu'
import { AIChatPanel } from '@/components/AIChatPanel'
import { HomePage } from '@/pages/HomePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LeadsPage } from '@/pages/LeadsPage'
import { ScraperPage } from '@/pages/ScraperPage'
import { CanvasPage } from '@/pages/CanvasPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProspectsPage } from '@/pages/ProspectsPage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { RoadmapPage } from '@/pages/RoadmapPage'
import { AgentPage } from '@/pages/AgentPage'
import { SystemLogsPage } from '@/pages/SystemLogsPage'
import { TaskQueuePage } from '@/pages/TaskQueuePage'
import { CodeEditorPage } from '@/pages/CodeEditorPage'
import { SandboxPage } from '@/pages/SandboxPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { ContractorsPage } from '@/pages/ContractorsPage'
import { AutomationPage } from '@/pages/AutomationPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { DocsPage } from '@/pages/DocsPage'
import { useLeads } from '@/hooks/useLeadsApi'
import { wsClient } from '@/lib/websocket'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [showChat, setShowChat] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  
  const { data: _leads = [], isLoading, error } = useLeads()

  useEffect(() => {
    const authToken = localStorage.getItem('auth_token')
    if (authToken && !wsClient.isConnected()) {
      wsClient.connect()
    }
  }, [])

  useEffect(() => {
    if (error) {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://xpsintelligencesystem-production.up.railway.app/api'
      toast.warning('Backend unavailable — running in demo mode', {
        description: `Could not reach ${apiUrl}. Showing demo data.`,
        duration: 8000,
        id: 'api-connection-error',
      })
    }
  }, [error])

  const LEADS_REQUIRED_PAGES = new Set(['home', 'dashboard', 'leads', 'prospects', 'leaderboard'])

  const renderPage = () => {
    if (LEADS_REQUIRED_PAGES.has(currentPage) && isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading leads...</p>
          </div>
        </div>
      )
    }
    
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentPage} />
      case 'leads':
        return <LeadsPage onNavigate={setCurrentPage} />
      case 'prospects':
        return <ProspectsPage onNavigate={setCurrentPage} />
      case 'scraper':
        return <ScraperPage onNavigate={setCurrentPage} />
      case 'canvas':
        return <CanvasPage onNavigate={setCurrentPage} />
      case 'contractors':
        return <ContractorsPage onNavigate={setCurrentPage} />
      case 'pipeline':
        return <PipelinePage onNavigate={setCurrentPage} />
      case 'leaderboard':
        return <LeaderboardPage onNavigate={setCurrentPage} />
      case 'roadmap':
        return <RoadmapPage onNavigate={setCurrentPage} />
      case 'settings':
        return <SettingsPage onNavigate={setCurrentPage} />
      case 'agent':
        return <AgentPage onNavigate={setCurrentPage} />
      case 'logs':
        return <SystemLogsPage onNavigate={setCurrentPage} />
      case 'tasks':
        return <TaskQueuePage onNavigate={setCurrentPage} />
      case 'editor':
        return <CodeEditorPage onNavigate={setCurrentPage} />
      case 'sandbox':
        return <SandboxPage onNavigate={setCurrentPage} />
      case 'automation':
        return <AutomationPage onNavigate={setCurrentPage} />
      case 'reports':
        return <ReportsPage onNavigate={setCurrentPage} />
      case 'docs':
        return <DocsPage onNavigate={setCurrentPage} />
      default:
        return <HomePage onNavigate={setCurrentPage} />
    }
  }

  return (
    <ThemeProvider>
      <div className="h-screen w-screen flex flex-col overflow-hidden relative bg-background text-foreground transition-colors duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,197,94,0.08),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(234,179,8,0.06),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(239,68,68,0.04),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,197,94,0.02)_0%,transparent_25%,rgba(234,179,8,0.015)_50%,transparent_75%,rgba(239,68,68,0.01)_100%)] pointer-events-none" />
        
        <div className="relative flex-1 flex overflow-hidden">
          {!isMobile && <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />}
          
          {isMobile && (
            <MobileMenu 
              isOpen={mobileMenuOpen}
              onClose={() => setMobileMenuOpen(false)}
              currentPage={currentPage}
              onNavigate={setCurrentPage}
            />
          )}
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
            
            <main className="flex-1 overflow-y-auto p-6 md:p-12">
              <div className="max-w-[1800px] mx-auto">
                {renderPage()}
              </div>
            </main>
          </div>

          {showChat && !isMobile && (
            <AIChatPanel 
              onClose={() => setShowChat(false)}
            />
          )}
        </div>

        <Toaster position="top-right" />
      </div>
    </ThemeProvider>
  )
}

export default App
