import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  MagnifyingGlass,
  ArrowSquareOut,
  Code,
  Robot,
  Gear,
  Globe,
  Lightning,
  ChartBar,
  HardDrive,
  Question,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BackButton } from '@/components/BackButton'

interface DocsPageProps {
  onNavigate: (page: string) => void
}

interface DocArticle {
  title: string
  description: string
  time: string
}

interface DocSection {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  articles: DocArticle[]
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'quickstart',
    title: 'Quick Start',
    description: 'Get up and running in minutes',
    icon: Lightning,
    color: 'text-yellow-400',
    articles: [
      {
        title: 'Installation & Setup',
        description: 'Install dependencies and configure the system',
        time: '5 min',
      },
      {
        title: 'Connect to Backend',
        description: 'Configure the XPS Intelligence backend API',
        time: '10 min',
      },
      {
        title: 'First Scrape Job',
        description: 'Run your first contractor scraping job',
        time: '5 min',
      },
    ],
  },
  {
    id: 'agents',
    title: 'Agent System',
    description: 'Multi-agent orchestration guide',
    icon: Robot,
    color: 'text-purple-400',
    articles: [
      {
        title: 'Agent Overview',
        description: 'Understanding the 13 specialized agents',
        time: '8 min',
      },
      { title: 'PlannerAgent', description: 'Task decomposition and planning', time: '6 min' },
      { title: 'ScraperAgent', description: 'Web scraping configuration', time: '10 min' },
      { title: 'BuilderAgent', description: 'Code generation capabilities', time: '8 min' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings Guide',
    description: 'Configure all system settings',
    icon: Gear,
    color: 'text-blue-400',
    articles: [
      {
        title: 'API Token Vault',
        description: 'Securely store and manage API keys',
        time: '5 min',
      },
      {
        title: 'Service Integrations',
        description: 'Connect GitHub, Google, AWS and more',
        time: '15 min',
      },
      {
        title: 'Agent Configuration',
        description: 'Tune agent performance and resources',
        time: '8 min',
      },
      {
        title: 'Security Settings',
        description: '2FA, IP whitelist, encryption settings',
        time: '10 min',
      },
    ],
  },
  {
    id: 'scraping',
    title: 'Scraping System',
    description: 'Large-scale web data collection',
    icon: Globe,
    color: 'text-green-400',
    articles: [
      {
        title: 'Scraping Overview',
        description: 'Architecture and capabilities',
        time: '7 min',
      },
      {
        title: 'Target Configuration',
        description: 'Set up scraping targets and filters',
        time: '8 min',
      },
      {
        title: 'Scheduling Jobs',
        description: 'Automate recurring scrape jobs',
        time: '5 min',
      },
      {
        title: 'Proxy Configuration',
        description: 'Configure proxy rotation',
        time: '10 min',
      },
    ],
  },
  {
    id: 'contractors',
    title: 'Contractor Database',
    description: 'Lead management guide',
    icon: ChartBar,
    color: 'text-orange-400',
    articles: [
      {
        title: 'Database Overview',
        description: 'Understanding the lead pipeline',
        time: '5 min',
      },
      {
        title: 'Filtering & Search',
        description: 'Find and filter contractors',
        time: '4 min',
      },
      {
        title: 'Bulk Operations',
        description: 'Email, tag, and update in bulk',
        time: '6 min',
      },
      { title: 'Export Options', description: 'Export to CSV, Excel, PDF', time: '3 min' },
    ],
  },
  {
    id: 'local-machine',
    title: 'Local Machine Access',
    description: 'File system and Docker management',
    icon: HardDrive,
    color: 'text-cyan-400',
    articles: [
      {
        title: 'MCP Connection Setup',
        description: 'Configure local machine access',
        time: '10 min',
      },
      {
        title: 'File Browser',
        description: 'Navigate and manage local files',
        time: '5 min',
      },
      {
        title: 'Command Executor',
        description: 'Run shell commands from the UI',
        time: '5 min',
      },
      { title: 'Docker Manager', description: 'Manage Docker containers', time: '7 min' },
    ],
  },
  {
    id: 'api',
    title: 'API Reference',
    description: 'Complete API documentation',
    icon: Code,
    color: 'text-pink-400',
    articles: [
      {
        title: 'Authentication',
        description: 'JWT tokens and API key management',
        time: '5 min',
      },
      {
        title: 'Contractors API',
        description: 'CRUD operations for lead database',
        time: '10 min',
      },
      {
        title: 'Agent Orchestration API',
        description: 'Execute and monitor agents',
        time: '12 min',
      },
      {
        title: 'Scraping API',
        description: 'Start, stop, and monitor scrape jobs',
        time: '8 min',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: Question,
    color: 'text-red-400',
    articles: [
      {
        title: 'Backend Connection Issues',
        description: 'Fix API connection problems',
        time: '5 min',
      },
      {
        title: 'Scraper Not Working',
        description: 'Debug scraping failures',
        time: '8 min',
      },
      {
        title: 'Agent Errors',
        description: 'Diagnose agent execution errors',
        time: '6 min',
      },
      {
        title: 'Performance Issues',
        description: 'Optimize system performance',
        time: '10 min',
      },
    ],
  },
]

export function DocsPage({ onNavigate }: DocsPageProps) {
  const [search, setSearch] = useState('')
  const [selectedSection, setSelectedSection] = useState<string | null>(null)

  const filteredSections = DOC_SECTIONS.filter(section => {
    if (!search) return true
    return (
      section.title.toLowerCase().includes(search.toLowerCase()) ||
      section.articles.some(a => a.title.toLowerCase().includes(search.toLowerCase()))
    )
  })

  const section = selectedSection ? DOC_SECTIONS.find(s => s.id === selectedSection) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton
          onBack={() => (selectedSection ? setSelectedSection(null) : onNavigate('home'))}
        />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentation</h1>
          <p className="text-sm text-muted-foreground">
            {selectedSection ? section?.title : 'Guides, API reference, and troubleshooting'}
          </p>
        </div>
      </div>

      {!selectedSection && (
        <>
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search documentation..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSections.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => setSelectedSection(s.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon size={20} className={s.color} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{s.title}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {s.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        {s.articles.length} articles
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {selectedSection && section && (
        <div className="space-y-3">
          {section.articles.map((article, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-primary" />
                      <span className="text-sm font-medium text-foreground">{article.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                      {article.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{article.time} read</span>
                    <ArrowSquareOut size={14} className="text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
