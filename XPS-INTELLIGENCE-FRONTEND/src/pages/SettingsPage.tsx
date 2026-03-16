import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  Robot,
  Globe,
  GithubLogo,
  RocketLaunch,
  Database,
  Code,
  Layout,
  Image,
  Briefcase,
  Key,
  FloppyDisk,
  CheckCircle,
  ToggleLeft,
  Wrench,
  Desktop,
  Timer,
  Bell,
  Shield,
  Sliders,
  Cpu,
  CreditCard,
  Plugs,
  Warning,
} from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { toast } from 'sonner'
import {
  loadSettings,
  saveSettings,
  loadToolRegistry,
  saveToolRegistry,
  getToolsByCategory,
} from '@/tools/toolRegistry'
import type { AgentSettings, ToolCategory, ToolDefinition } from '@/types/tools'

type ExtendedCategory =
  | ToolCategory
  | 'local_machine'
  | 'agent_config'
  | 'automation'
  | 'notifications'
  | 'security'
  | 'ui_preferences'
  | 'system'
  | 'usage_billing'
  | 'webhooks_custom'
  | 'advanced'

const TOOL_CATEGORIES = new Set<string>([
  'ai_models', 'agent_runtime', 'scraping', 'github', 'deployment',
  'memory', 'developer', 'frontend', 'media', 'business', 'integrations',
])

const CATEGORIES: { key: ExtendedCategory; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: 'ai_models',
    label: 'AI Models',
    icon: <Brain size={18} />,
    description: 'Ollama & LLM configuration',
  },
  {
    key: 'agent_runtime',
    label: 'Agent Runtime',
    icon: <Robot size={18} />,
    description: 'LangGraph orchestration',
  },
  {
    key: 'scraping',
    label: 'Scraping System',
    icon: <Globe size={18} />,
    description: 'Browser automation & crawling',
  },
  {
    key: 'github',
    label: 'GitHub',
    icon: <GithubLogo size={18} />,
    description: 'Repository & workflow access',
  },
  {
    key: 'deployment',
    label: 'Deployment',
    icon: <RocketLaunch size={18} />,
    description: 'Vercel, Docker & CI/CD',
  },
  {
    key: 'memory',
    label: 'Memory Layer',
    icon: <Database size={18} />,
    description: 'Redis, vector & structured DB',
  },
  {
    key: 'developer',
    label: 'Developer Tools',
    icon: <Code size={18} />,
    description: 'Code gen, debugging & editing',
  },
  {
    key: 'frontend',
    label: 'Frontend Builder',
    icon: <Layout size={18} />,
    description: 'Page gen & component registry',
  },
  {
    key: 'media',
    label: 'Media Tools',
    icon: <Image size={18} />,
    description: 'Image & video generation',
  },
  {
    key: 'business',
    label: 'Business Tools',
    icon: <Briefcase size={18} />,
    description: 'Leads, outreach & CRM',
  },
  {
    key: 'integrations',
    label: 'Integrations',
    icon: <Key size={18} />,
    description: 'API keys, cloud accounts & OAuth',
  },
  {
    key: 'local_machine',
    label: 'Local Machine',
    icon: <Desktop size={18} />,
    description: 'MCP status, Docker, SSH & permissions',
  },
  {
    key: 'agent_config',
    label: 'Agent Config',
    icon: <Robot size={18} />,
    description: 'Enable/disable agents, concurrency, timeouts',
  },
  {
    key: 'automation',
    label: 'Automation',
    icon: <Timer size={18} />,
    description: 'Daily tasks, frequencies, retry logic, blackout periods',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <Bell size={18} />,
    description: 'Email, Slack, Discord, SMS & quiet hours',
  },
  {
    key: 'security',
    label: 'Security',
    icon: <Shield size={18} />,
    description: '2FA, session timeout, IP whitelist & audit log',
  },
  {
    key: 'ui_preferences',
    label: 'UI Preferences',
    icon: <Sliders size={18} />,
    description: 'Theme, language, timezone & date format',
  },
  {
    key: 'system',
    label: 'System',
    icon: <Cpu size={18} />,
    description: 'Log level, cache, memory limits & retry policy',
  },
  {
    key: 'usage_billing',
    label: 'Usage & Billing',
    icon: <CreditCard size={18} />,
    description: 'API calls, storage usage & cost per service',
  },
  {
    key: 'webhooks_custom',
    label: 'Webhooks',
    icon: <Plugs size={18} />,
    description: 'Create webhooks, test endpoints & view logs',
  },
  {
    key: 'advanced',
    label: 'Advanced',
    icon: <Warning size={18} />,
    description: 'Env vars, feature flags, debug mode & beta features',
  },
]

const cardStyle = {
  background: 'var(--card)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}

function SectionRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/8 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="py-3 border-b border-white/8 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
        </div>
        <span className="text-sm text-white/70 font-mono">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step ?? 1}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  )
}

function ToolList({
  tools,
  onToggle,
}: {
  tools: ToolDefinition[]
  onToggle: (name: string, enabled: boolean) => void
}) {
  if (tools.length === 0) return null
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Wrench size={14} className="text-white/50" />
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Registered Tools</p>
      </div>
      <div className="space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className="flex items-start justify-between p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex-1 mr-3">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-yellow-400">{tool.name}</code>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-white/50 border-white/20">
                  {tool.parameters.length} params
                </Badge>
              </div>
              <p className="text-xs text-white/50 mt-0.5">{tool.description}</p>
            </div>
            <Switch
              checked={tool.enabled}
              onCheckedChange={(v) => onToggle(tool.name, v)}
              className="shrink-0 mt-0.5"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function AIModelsPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.aiModels
  const update = (patch: Partial<AgentSettings['aiModels']>) =>
    onSettingsChange({ ...settings, aiModels: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Ollama Endpoint" description="Local Ollama server URL">
        <Input
          value={s.ollamaEndpoint}
          onChange={(e) => update({ ollamaEndpoint: e.target.value })}
          className="w-52 text-xs h-8 bg-black/40 text-white border-white/20"
        />
      </SectionRow>
      <SectionRow label="Active Model" description="Open-source LLM to use for inference">
        <Input
          value={s.selectedModel}
          onChange={(e) => update({ selectedModel: e.target.value })}
          className="w-36 text-xs h-8 bg-black/40 text-white border-white/20"
          placeholder="llama3"
        />
      </SectionRow>
      <SliderRow
        label="Temperature"
        description="Controls randomness in model output"
        value={s.temperature}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => update({ temperature: v })}
      />
      <SliderRow
        label="Max Tokens"
        description="Maximum tokens per response"
        value={s.maxTokens}
        min={256}
        max={8192}
        step={256}
        unit=" tok"
        onChange={(v) => update({ maxTokens: v })}
      />
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function AgentRuntimePanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.agentRuntime
  const update = (patch: Partial<AgentSettings['agentRuntime']>) =>
    onSettingsChange({ ...settings, agentRuntime: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Orchestration Engine" description="Agent runtime framework">
        <Input
          value={s.orchestration}
          onChange={(e) => update({ orchestration: e.target.value })}
          className="w-36 text-xs h-8 bg-black/40 text-white border-white/20"
        />
      </SectionRow>
      <SectionRow label="Planner Agent" description="Decomposes goals into task plans">
        <Switch checked={s.enablePlanner} onCheckedChange={(v) => update({ enablePlanner: v })} />
      </SectionRow>
      <SectionRow label="Supervisor Agent" description="Coordinates worker agents">
        <Switch checked={s.enableSupervisor} onCheckedChange={(v) => update({ enableSupervisor: v })} />
      </SectionRow>
      <SectionRow label="Worker Agents" description="Execute individual tasks in parallel">
        <Switch checked={s.enableWorkers} onCheckedChange={(v) => update({ enableWorkers: v })} />
      </SectionRow>
      <SliderRow
        label="Concurrency Limit"
        description="Maximum parallel agents"
        value={s.concurrencyLimit}
        min={1}
        max={20}
        onChange={(v) => update({ concurrencyLimit: v })}
      />
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function ScrapingPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.scraping
  const update = (patch: Partial<AgentSettings['scraping']>) =>
    onSettingsChange({ ...settings, scraping: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Playwright Browser" description="Headless browser automation">
        <Switch checked={s.playwrightEnabled} onCheckedChange={(v) => update({ playwrightEnabled: v })} />
      </SectionRow>
      <SectionRow label="Search Engine Scraping" description="Extract results from search engines">
        <Switch checked={s.searchEngineEnabled} onCheckedChange={(v) => update({ searchEngineEnabled: v })} />
      </SectionRow>
      <SectionRow label="Email Extraction" description="Detect and extract email addresses from pages">
        <Switch checked={s.emailExtractionEnabled} onCheckedChange={(v) => update({ emailExtractionEnabled: v })} />
      </SectionRow>
      <SliderRow
        label="Async Crawler Pool"
        description="Number of concurrent crawlers"
        value={s.crawlerPoolSize}
        min={1}
        max={20}
        onChange={(v) => update({ crawlerPoolSize: v })}
      />
      <SliderRow
        label="Scraping Depth"
        description="How many link levels deep to crawl"
        value={s.scrapingDepth}
        min={1}
        max={10}
        onChange={(v) => update({ scrapingDepth: v })}
      />
      <SliderRow
        label="Scraping Concurrency"
        description="Parallel scraping tasks"
        value={s.scrapingConcurrency}
        min={1}
        max={30}
        onChange={(v) => update({ scrapingConcurrency: v })}
      />
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function GitHubPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.github
  const update = (patch: Partial<AgentSettings['github']>) =>
    onSettingsChange({ ...settings, github: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="GitHub Token" description="Personal access token for API calls">
        <Input
          type="password"
          value={s.token}
          onChange={(e) => update({ token: e.target.value })}
          className="w-52 text-xs h-8 bg-black/40 text-white border-white/20"
          placeholder="ghp_..."
        />
      </SectionRow>
      <SectionRow label="Repository Access" description="Allow agent to read/write repositories">
        <Switch checked={s.repoAccess} onCheckedChange={(v) => update({ repoAccess: v })} />
      </SectionRow>
      <SectionRow label="Workflow Triggering" description="Allow agent to dispatch GitHub Actions">
        <Switch checked={s.workflowTrigger} onCheckedChange={(v) => update({ workflowTrigger: v })} />
      </SectionRow>
      <SectionRow label="Pull Request Creation" description="Automatically open pull requests">
        <Switch checked={s.prCreation} onCheckedChange={(v) => update({ prCreation: v })} />
      </SectionRow>
      <SectionRow label="File Editing" description="Allow agent to commit file changes">
        <Switch checked={s.fileEditing} onCheckedChange={(v) => update({ fileEditing: v })} />
      </SectionRow>
      <SectionRow label="Issue Automation" description="Auto-create and triage GitHub issues">
        <Switch checked={s.issueAutomation} onCheckedChange={(v) => update({ issueAutomation: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function DeploymentPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.deployment
  const update = (patch: Partial<AgentSettings['deployment']>) =>
    onSettingsChange({ ...settings, deployment: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Vercel Token" description="Token for Vercel deployment API">
        <Input
          type="password"
          value={s.vercelToken}
          onChange={(e) => update({ vercelToken: e.target.value })}
          className="w-52 text-xs h-8 bg-black/40 text-white border-white/20"
          placeholder="your_vercel_token"
        />
      </SectionRow>
      <SectionRow label="GitHub Actions Pipelines" description="Enable CI/CD via GitHub Actions">
        <Switch
          checked={s.githubActionsEnabled}
          onCheckedChange={(v) => update({ githubActionsEnabled: v })}
        />
      </SectionRow>
      <SectionRow label="Docker Container Builds" description="Build & push Docker images">
        <Switch checked={s.dockerEnabled} onCheckedChange={(v) => update({ dockerEnabled: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function MemoryPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.memory
  const update = (patch: Partial<AgentSettings['memory']>) =>
    onSettingsChange({ ...settings, memory: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Redis URL" description="Connection string for agent working memory">
        <Input
          value={s.redisUrl}
          onChange={(e) => update({ redisUrl: e.target.value })}
          className="w-52 text-xs h-8 bg-black/40 text-white border-white/20"
          placeholder="redis://localhost:6379"
        />
      </SectionRow>
      <SectionRow label="Vector Database" description="Semantic search & embeddings storage">
        <Switch checked={s.vectorDbEnabled} onCheckedChange={(v) => update({ vectorDbEnabled: v })} />
      </SectionRow>
      <SectionRow label="Structured Database" description="Relational data persistence layer">
        <Switch checked={s.structuredDbEnabled} onCheckedChange={(v) => update({ structuredDbEnabled: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function DeveloperPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.developer
  const update = (patch: Partial<AgentSettings['developer']>) =>
    onSettingsChange({ ...settings, developer: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Code Generation" description="Generate source code from natural language">
        <Switch checked={s.codeGenEnabled} onCheckedChange={(v) => update({ codeGenEnabled: v })} />
      </SectionRow>
      <SectionRow label="Debugging Agent" description="Analyze and fix bugs in code">
        <Switch checked={s.debuggingEnabled} onCheckedChange={(v) => update({ debuggingEnabled: v })} />
      </SectionRow>
      <SectionRow label="Repo Editing Agent" description="Allow agent to edit repository files">
        <Switch checked={s.repoEditingEnabled} onCheckedChange={(v) => update({ repoEditingEnabled: v })} />
      </SectionRow>
      <SectionRow label="Backend Route Generator" description="Auto-generate API routes and handlers">
        <Switch checked={s.routeGenEnabled} onCheckedChange={(v) => update({ routeGenEnabled: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function FrontendPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.frontend
  const update = (patch: Partial<AgentSettings['frontend']>) =>
    onSettingsChange({ ...settings, frontend: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Page Generator" description="Generate full React page components">
        <Switch checked={s.pageGenEnabled} onCheckedChange={(v) => update({ pageGenEnabled: v })} />
      </SectionRow>
      <SectionRow label="Component Registry" description="Register and reuse generated components">
        <Switch
          checked={s.componentRegistryEnabled}
          onCheckedChange={(v) => update({ componentRegistryEnabled: v })}
        />
      </SectionRow>
      <SectionRow label="Layout Editor" description="Visual layout editing interface">
        <Switch checked={s.layoutEditorEnabled} onCheckedChange={(v) => update({ layoutEditorEnabled: v })} />
      </SectionRow>
      <SectionRow label="Theme Builder" description="AI-driven theme and design token editor">
        <Switch checked={s.themeBuilderEnabled} onCheckedChange={(v) => update({ themeBuilderEnabled: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function MediaPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.media
  const update = (patch: Partial<AgentSettings['media']>) =>
    onSettingsChange({ ...settings, media: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Image Generation" description="Generate images from text prompts">
        <Switch checked={s.imageGenEnabled} onCheckedChange={(v) => update({ imageGenEnabled: v })} />
      </SectionRow>
      <SectionRow label="Image Editing" description="AI-powered image transformation">
        <Switch checked={s.imageEditEnabled} onCheckedChange={(v) => update({ imageEditEnabled: v })} />
      </SectionRow>
      <SectionRow label="Video Creation" description="Generate videos from prompts or images">
        <Switch checked={s.videoCreateEnabled} onCheckedChange={(v) => update({ videoCreateEnabled: v })} />
      </SectionRow>
      <SectionRow label="Video Editing" description="AI-powered video editing and splicing">
        <Switch checked={s.videoEditEnabled} onCheckedChange={(v) => update({ videoEditEnabled: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function BusinessPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.business
  const update = (patch: Partial<AgentSettings['business']>) =>
    onSettingsChange({ ...settings, business: { ...s, ...patch } })

  return (
    <>
      <SectionRow label="Lead Scraping" description="Automated market and company lead extraction">
        <Switch checked={s.leadScrapingEnabled} onCheckedChange={(v) => update({ leadScrapingEnabled: v })} />
      </SectionRow>
      <SectionRow label="Outreach Generation" description="AI-crafted personalized outreach sequences">
        <Switch checked={s.outreachGenEnabled} onCheckedChange={(v) => update({ outreachGenEnabled: v })} />
      </SectionRow>
      <SectionRow label="Analytics Dashboards" description="Automated analytics and reporting">
        <Switch checked={s.analyticsEnabled} onCheckedChange={(v) => update({ analyticsEnabled: v })} />
      </SectionRow>
      <SectionRow label="CRM Export" description="Export leads to CRM platforms">
        <Switch checked={s.crmExportEnabled} onCheckedChange={(v) => update({ crmExportEnabled: v })} />
      </SectionRow>
      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function ApiKeyRow({
  label,
  description,
  value,
  placeholder,
  onChange,
}: {
  label: string
  description?: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const toggle = () => {
    setVisible((prev) => {
      const next = !prev
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (next) {
        // Auto-hide key after 30 seconds for security
        hideTimerRef.current = setTimeout(() => setVisible(false), 30_000)
      }
      return next
    })
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/8 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-48 text-xs h-8 bg-black/40 text-white border-white/20 font-mono"
          placeholder={placeholder ?? 'sk-…'}
        />
        <button
          type="button"
          onClick={toggle}
          className="text-white/30 hover:text-white/70 transition-colors text-xs px-1"
          title={visible ? 'Hide (auto-hides in 30s)' : 'Show'}
          aria-label={visible ? 'Hide value (auto-hides in 30 seconds)' : 'Show value'}
          aria-pressed={visible}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  )
}

function IntegrationsPanel({
  settings,
  tools,
  onSettingsChange,
  onToolToggle,
}: {
  settings: AgentSettings
  tools: ToolDefinition[]
  onSettingsChange: (s: AgentSettings) => void
  onToolToggle: (name: string, enabled: boolean) => void
}) {
  const s = settings.integrations
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')

  const update = (patch: Partial<AgentSettings['integrations']>) =>
    onSettingsChange({ ...settings, integrations: { ...s, ...patch } })

  const addApiKey = () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return
    update({ apiKeys: { ...s.apiKeys, [newKeyName.trim()]: newKeyValue.trim() } })
    setNewKeyName('')
    setNewKeyValue('')
  }

  const removeApiKey = (key: string) => {
    const updated = { ...s.apiKeys }
    delete updated[key]
    update({ apiKeys: updated })
  }

  return (
    <>
      {/* Token Vault */}
      <SectionRow label="Token Vault" description="Stores credentials in browser local storage (plaintext JSON — do not store production secrets)">
        <Switch
          checked={s.tokenVaultEnabled}
          onCheckedChange={(v) => update({ tokenVaultEnabled: v })}
        />
      </SectionRow>

      {/* ─── AI Provider Keys ─── */}
      <div className="py-3 border-b border-white/8">
        <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-wider mb-1">AI Providers</p>
      </div>
      <ApiKeyRow
        label="Groq"
        description="Fast LLM inference via Groq Cloud"
        value={s.groqApiKey}
        placeholder="gsk_…"
        onChange={(v) => update({ groqApiKey: v })}
      />
      <ApiKeyRow
        label="OpenAI"
        description="GPT-4o and assistants API"
        value={s.openaiApiKey}
        placeholder="sk-…"
        onChange={(v) => update({ openaiApiKey: v })}
      />
      <ApiKeyRow
        label="Anthropic"
        description="Claude models via Anthropic API"
        value={s.anthropicApiKey}
        placeholder="sk-ant-…"
        onChange={(v) => update({ anthropicApiKey: v })}
      />
      <ApiKeyRow
        label="Google Gemini"
        description="Gemini Pro & Ultra via Google AI Studio"
        value={s.geminiApiKey}
        placeholder="AIza…"
        onChange={(v) => update({ geminiApiKey: v })}
      />

      {/* ─── Cloud Accounts ─── */}
      <div className="py-3 border-b border-white/8">
        <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-wider mb-1">Cloud Accounts</p>
      </div>
      <ApiKeyRow
        label="AWS Access Key ID"
        description="Amazon Web Services IAM access key"
        value={s.awsAccessKeyId}
        placeholder="AKIA…"
        onChange={(v) => update({ awsAccessKeyId: v })}
      />
      <ApiKeyRow
        label="AWS Secret Access Key"
        description="Paired secret for AWS IAM access key"
        value={s.awsSecretAccessKey}
        placeholder="wJalr…"
        onChange={(v) => update({ awsSecretAccessKey: v })}
      />
      <SectionRow label="AWS Region" description="Default AWS region for API calls">
        <Input
          value={s.awsRegion}
          onChange={(e) => update({ awsRegion: e.target.value })}
          className="w-36 text-xs h-8 bg-black/40 text-white border-white/20"
          placeholder="us-east-1"
        />
      </SectionRow>
      <ApiKeyRow
        label="GCP Project ID"
        description="Google Cloud Platform project identifier"
        value={s.gcpProjectId}
        placeholder="my-project-123"
        onChange={(v) => update({ gcpProjectId: v })}
      />
      <ApiKeyRow
        label="GCP API Key"
        description="Google Cloud Platform API key"
        value={s.gcpApiKey}
        placeholder="AIza…"
        onChange={(v) => update({ gcpApiKey: v })}
      />
      <ApiKeyRow
        label="Cloudflare Account ID"
        description="Cloudflare account identifier"
        value={s.cloudflareAccountId}
        placeholder="a1b2c3…"
        onChange={(v) => update({ cloudflareAccountId: v })}
      />
      <ApiKeyRow
        label="Cloudflare API Token"
        description="Scoped API token for Cloudflare services"
        value={s.cloudflareApiToken}
        placeholder="…"
        onChange={(v) => update({ cloudflareApiToken: v })}
      />

      {/* ─── Custom / Additional Keys ─── */}
      <div className="py-3 border-b border-white/8">
        <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-wider mb-1">Custom Keys</p>
      </div>
      <div className="py-3 border-b border-white/8">
        <div className="space-y-2 mb-3">
          {Object.entries(s.apiKeys).map(([name, value]) => (
            <div key={name} className="flex items-center gap-2">
              <code className="text-xs font-mono text-yellow-400 flex-1 truncate">{name}</code>
              <code className="text-xs font-mono text-white/30 flex-1 truncate">
                {value.slice(0, 8)}{'*'.repeat(Math.max(0, value.length - 8))}
              </code>
              <button
                onClick={() => removeApiKey(name)}
                className="text-white/30 hover:text-red-400 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          {Object.keys(s.apiKeys).length === 0 && (
            <p className="text-xs text-white/30 italic">No custom keys registered</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="text-xs h-8 bg-black/40 text-white border-white/20"
            placeholder="Service name"
          />
          <Input
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            className="text-xs h-8 bg-black/40 text-white border-white/20"
            placeholder="API key"
          />
          <Button size="sm" onClick={addApiKey} className="h-8 shrink-0">
            Add
          </Button>
        </div>
      </div>

      <ToolList tools={tools} onToggle={onToolToggle} />
    </>
  )
}

function ExtendedSectionRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/8 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function LocalMachinePanel() {
  const [mcpStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [sshHost, setSshHost] = useState('')
  const [dockerEnabled, setDockerEnabled] = useState(true)
  return (
    <>
      <ExtendedSectionRow label="MCP Connection" description="Model Context Protocol server for local machine access">
        <div className={`flex items-center gap-2 text-xs font-medium ${mcpStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${mcpStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
          {mcpStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </ExtendedSectionRow>
      <ExtendedSectionRow label="SSH Host" description="Remote machine connection via SSH">
        <Input value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="user@hostname" className="w-48 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Docker Integration" description="Enable Docker container management">
        <Switch checked={dockerEnabled} onCheckedChange={setDockerEnabled} />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="File System Access" description="Allow agents to read/write local files">
        <Switch checked={false} onCheckedChange={() => {}} />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Command Execution" description="Allow agents to execute shell commands">
        <Switch checked={false} onCheckedChange={() => {}} />
      </ExtendedSectionRow>
    </>
  )
}

function AgentConfigPanel() {
  const agents = ['PlannerAgent', 'ResearchAgent', 'BuilderAgent', 'ScraperAgent', 'MediaAgent', 'ValidatorAgent', 'DevOpsAgent', 'MonitoringAgent', 'KnowledgeAgent', 'BusinessAgent', 'PredictionAgent', 'SimulationAgent', 'MetaAgent']
  // Enable the first 11 core agents by default; MetaAgent and SimulationAgent
  // start disabled because they are experimental / resource-intensive.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(agents.map((a, i) => [a, i < 11])))
  const [concurrency, setConcurrency] = useState(3)
  const [taskTimeoutSecs, setTaskTimeoutSecs] = useState(30)
  return (
    <>
      <SliderRow label="Global Concurrency Limit" description="Max agents running simultaneously" value={concurrency} min={1} max={20} onChange={setConcurrency} unit=" agents" />
      <SliderRow label="Task Timeout" description="Default timeout per agent task" value={taskTimeoutSecs} min={5} max={300} onChange={setTaskTimeoutSecs} unit="s" />
      <div className="mt-2">
        <p className="text-xs text-white/50 mb-3 font-semibold uppercase tracking-wider">Agent Toggle</p>
        {agents.map(agent => (
          <ExtendedSectionRow key={agent} label={agent} description={enabled[agent] ? 'Active' : 'Disabled'}>
            <Switch checked={enabled[agent]} onCheckedChange={v => setEnabled(prev => ({ ...prev, [agent]: v }))} />
          </ExtendedSectionRow>
        ))}
      </div>
    </>
  )
}

function AutomationPanel() {
  const [dailyScrape, setDailyScrape] = useState(true)
  const [scrapeTime, setScrapeTime] = useState('02:00')
  const [retryAttempts, setRetryAttempts] = useState(3)
  const [blackoutStart, setBlackoutStart] = useState('08:00')
  const [blackoutEnd, setBlackoutEnd] = useState('18:00')
  return (
    <>
      <ExtendedSectionRow label="Daily Auto-Scrape" description="Automatically scrape leads every day">
        <Switch checked={dailyScrape} onCheckedChange={setDailyScrape} />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Scrape Start Time" description="Time for daily scraping task (24h format)">
        <Input value={scrapeTime} onChange={e => setScrapeTime(e.target.value)} type="time" className="w-28 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
      <SliderRow label="Retry Attempts" description="Number of times to retry failed tasks" value={retryAttempts} min={0} max={10} onChange={setRetryAttempts} unit=" retries" />
      <ExtendedSectionRow label="Blackout Window Start" description="No automated tasks before this time">
        <Input value={blackoutStart} onChange={e => setBlackoutStart(e.target.value)} type="time" className="w-28 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Blackout Window End" description="No automated tasks after this time">
        <Input value={blackoutEnd} onChange={e => setBlackoutEnd(e.target.value)} type="time" className="w-28 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
    </>
  )
}

function NotificationsPanel() {
  const [email, setEmail] = useState(true)
  const [slack, setSlack] = useState(false)
  const [discord, setDiscord] = useState(false)
  const [sms, setSms] = useState(false)
  const [slackWebhook, setSlackWebhook] = useState('')
  const [discordWebhook, setDiscordWebhook] = useState('')
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  return (
    <>
      <ExtendedSectionRow label="Email Notifications" description="Receive alerts via email"><Switch checked={email} onCheckedChange={setEmail} /></ExtendedSectionRow>
      <ExtendedSectionRow label="Slack" description="Post notifications to Slack channel"><Switch checked={slack} onCheckedChange={setSlack} /></ExtendedSectionRow>
      {slack && (
        <ExtendedSectionRow label="Slack Webhook URL" description="Incoming webhook for your Slack workspace">
          <Input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/..." className="w-64 text-xs h-8 bg-black/40 text-white border-white/20" />
        </ExtendedSectionRow>
      )}
      <ExtendedSectionRow label="Discord" description="Post notifications to Discord channel"><Switch checked={discord} onCheckedChange={setDiscord} /></ExtendedSectionRow>
      {discord && (
        <ExtendedSectionRow label="Discord Webhook URL" description="Incoming webhook for your Discord server">
          <Input value={discordWebhook} onChange={e => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-64 text-xs h-8 bg-black/40 text-white border-white/20" />
        </ExtendedSectionRow>
      )}
      <ExtendedSectionRow label="SMS Alerts" description="Receive critical alerts via SMS"><Switch checked={sms} onCheckedChange={setSms} /></ExtendedSectionRow>
      <ExtendedSectionRow label="Quiet Hours Start" description="Suppress non-critical notifications after this time">
        <Input value={quietStart} onChange={e => setQuietStart(e.target.value)} type="time" className="w-28 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Quiet Hours End" description="Resume notifications at this time">
        <Input value={quietEnd} onChange={e => setQuietEnd(e.target.value)} type="time" className="w-28 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
    </>
  )
}

function SecurityPanel() {
  const [twoFa, setTwoFa] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(60)
  const [ipWhitelist, setIpWhitelist] = useState('')
  const [auditLog, setAuditLog] = useState(true)
  return (
    <>
      <ExtendedSectionRow label="Two-Factor Authentication" description="Require 2FA for all logins"><Switch checked={twoFa} onCheckedChange={setTwoFa} /></ExtendedSectionRow>
      <SliderRow label="Session Timeout" description="Auto-logout after inactivity (minutes)" value={sessionTimeout} min={5} max={480} onChange={setSessionTimeout} unit=" min" />
      <ExtendedSectionRow label="IP Whitelist" description="Comma-separated list of allowed IPs (leave blank to allow all)">
        <Input value={ipWhitelist} onChange={e => setIpWhitelist(e.target.value)} placeholder="192.168.1.0/24, 10.0.0.1" className="w-56 text-xs h-8 bg-black/40 text-white border-white/20" />
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Audit Log" description="Log all admin actions and agent activity"><Switch checked={auditLog} onCheckedChange={setAuditLog} /></ExtendedSectionRow>
    </>
  )
}

function UIPreferencesPanel() {
  const [theme, setTheme] = useState('dark')
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('UTC')
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  return (
    <>
      <ExtendedSectionRow label="Theme" description="Color scheme for the interface">
        <select value={theme} onChange={e => setTheme(e.target.value)} className="px-3 py-1.5 rounded-md bg-black/40 border border-white/20 text-white text-xs focus:outline-none">
          {['dark', 'light', 'system'].map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
        </select>
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Language" description="Interface language">
        <select value={language} onChange={e => setLanguage(e.target.value)} className="px-3 py-1.5 rounded-md bg-black/40 border border-white/20 text-white text-xs focus:outline-none">
          {[['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German']].map(([v, l]) => <option key={v} value={v} className="bg-zinc-900">{l}</option>)}
        </select>
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Timezone" description="Default timezone for dates and schedules">
        <select value={timezone} onChange={e => setTimezone(e.target.value)} className="px-3 py-1.5 rounded-md bg-black/40 border border-white/20 text-white text-xs focus:outline-none">
          {['UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Europe/Paris'].map(tz => <option key={tz} value={tz} className="bg-zinc-900">{tz}</option>)}
        </select>
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Date Format" description="How dates are displayed throughout the app">
        <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className="px-3 py-1.5 rounded-md bg-black/40 border border-white/20 text-white text-xs focus:outline-none">
          {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map(f => <option key={f} value={f} className="bg-zinc-900">{f}</option>)}
        </select>
      </ExtendedSectionRow>
    </>
  )
}

function SystemPanel() {
  const [logLevel, setLogLevel] = useState('info')
  const [cacheEnabled, setCacheEnabled] = useState(true)
  const [memoryLimit, setMemoryLimit] = useState(2048)
  const [retryPolicy, setRetryPolicy] = useState('exponential')
  return (
    <>
      <ExtendedSectionRow label="Log Level" description="Verbosity of system logs">
        <select value={logLevel} onChange={e => setLogLevel(e.target.value)} className="px-3 py-1.5 rounded-md bg-black/40 border border-white/20 text-white text-xs focus:outline-none">
          {['debug', 'info', 'warning', 'error'].map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
        </select>
      </ExtendedSectionRow>
      <ExtendedSectionRow label="Response Cache" description="Cache API responses to reduce latency"><Switch checked={cacheEnabled} onCheckedChange={setCacheEnabled} /></ExtendedSectionRow>
      <SliderRow label="Memory Limit" description="Max memory allocation per agent task (MB)" value={memoryLimit} min={256} max={8192} step={256} onChange={setMemoryLimit} unit=" MB" />
      <ExtendedSectionRow label="Retry Policy" description="How failed tasks are retried">
        <select value={retryPolicy} onChange={e => setRetryPolicy(e.target.value)} className="px-3 py-1.5 rounded-md bg-black/40 border border-white/20 text-white text-xs focus:outline-none">
          {['none', 'linear', 'exponential'].map(p => <option key={p} value={p} className="bg-zinc-900">{p}</option>)}
        </select>
      </ExtendedSectionRow>
    </>
  )
}

function UsageBillingPanel() {
  const usageData = [
    { service: 'OpenAI GPT-4o', calls: 12847, tokens: '8.2M', cost: '$164.00' },
    { service: 'Groq Llama-3.3', calls: 4213, tokens: '2.1M', cost: '$2.10' },
    { service: 'Anthropic Claude', calls: 312, tokens: '640K', cost: '$9.60' },
    { service: 'Vercel Deployment', calls: 48, tokens: '—', cost: '$0.00' },
    { service: 'Storage (R2)', calls: 9821, tokens: '—', cost: '$3.20' },
  ]
  return (
    <>
      <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-xs text-yellow-400 font-semibold">This Month</p>
        <p className="text-2xl font-bold text-white mt-0.5">$178.90</p>
        <p className="text-xs text-white/40">Updated Dec 1, 2024</p>
      </div>
      {usageData.map(row => (
        <div key={row.service} className="flex items-center justify-between py-2.5 border-b border-white/8 last:border-0">
          <div>
            <p className="text-sm text-white">{row.service}</p>
            <p className="text-xs text-white/40">{row.calls.toLocaleString()} calls · {row.tokens} tokens</p>
          </div>
          <span className="text-sm font-mono font-medium text-yellow-400">{row.cost}</span>
        </div>
      ))}
    </>
  )
}

function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState([
    { id: '1', name: 'Slack Alerts', url: 'https://hooks.slack.com/xxx', active: true, events: ['task_failed'] },
    { id: '2', name: 'Discord Notify', url: 'https://discord.com/api/webhooks/xxx', active: false, events: ['plan_complete'] },
  ])
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  return (
    <>
      {webhooks.map(wh => (
        <div key={wh.id} className="py-3 border-b border-white/8 last:border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{wh.name}</p>
              <p className="text-xs text-white/40 font-mono truncate max-w-xs">{wh.url}</p>
              <p className="text-xs text-white/30 mt-0.5">Events: {wh.events.join(', ')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${wh.active ? 'text-green-400' : 'text-white/30'}`}>{wh.active ? 'Active' : 'Paused'}</span>
              <Switch
                checked={wh.active}
                onCheckedChange={v => setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, active: v } : w))}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="pt-3 space-y-2">
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">Add Webhook</p>
        <div className="flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="text-xs h-8 bg-black/40 text-white border-white/20" />
          <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="text-xs h-8 bg-black/40 text-white border-white/20 flex-1" />
          <Button size="sm" className="h-8 shrink-0" onClick={() => {
            if (newName && newUrl) {
              setWebhooks(prev => [...prev, { id: Date.now().toString(), name: newName, url: newUrl, active: true, events: ['task_failed'] }])
              setNewName(''); setNewUrl('')
            }
          }}>Add</Button>
        </div>
      </div>
    </>
  )
}

function AdvancedPanel() {
  const [debugMode, setDebugMode] = useState(false)
  const [betaFeatures, setBetaFeatures] = useState(false)
  const [envVars, setEnvVars] = useState('# Add environment variables\n# CUSTOM_VAR=value\n')
  return (
    <>
      <ExtendedSectionRow label="Debug Mode" description="Enable verbose debug logging (may impact performance)"><Switch checked={debugMode} onCheckedChange={setDebugMode} /></ExtendedSectionRow>
      <ExtendedSectionRow label="Beta Features" description="Enable experimental features not yet in stable release"><Switch checked={betaFeatures} onCheckedChange={setBetaFeatures} /></ExtendedSectionRow>
      <div className="py-3">
        <p className="text-sm font-medium text-white mb-1">Custom Environment Variables</p>
        <p className="text-xs text-white/40 mb-2">These are injected into all agent sandboxes at runtime</p>
        <textarea
          value={envVars}
          onChange={e => setEnvVars(e.target.value)}
          rows={6}
          className="w-full rounded-lg bg-black/60 border border-white/20 text-white/80 font-mono text-xs p-3 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        />
      </div>
      <div className="py-3 border-t border-white/8">
        <p className="text-sm font-medium text-white mb-2">Feature Flags</p>
        {[
          { key: 'multi_agent_parallel', label: 'Multi-Agent Parallel Execution', enabled: true },
          { key: 'vector_memory', label: 'Vector Memory Store', enabled: true },
          { key: 'self_compile_loop', label: 'Self-Compiling Loop (ALPHA)', enabled: false },
          { key: 'media_gen', label: 'Media Generation Pipeline', enabled: false },
        ].map(flag => (
          <ExtendedSectionRow key={flag.key} label={flag.label} description={flag.enabled ? 'Enabled' : 'Disabled'}>
            <Switch checked={flag.enabled} onCheckedChange={() => {}} />
          </ExtendedSectionRow>
        ))}
      </div>
    </>
  )
}

export function SettingsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [activeCategory, setActiveCategory] = useState<ExtendedCategory>('ai_models')
  const [settings, setSettings] = useState<AgentSettings>(loadSettings)
  const [tools, setTools] = useState<ToolDefinition[]>(loadToolRegistry)
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(() => {
    saveSettings(settings)
    saveToolRegistry(tools)
    setSaved(true)
    toast.success('Settings saved')
    setTimeout(() => setSaved(false), 2000)
  }, [settings, tools])

  const handleToolToggle = useCallback((name: string, enabled: boolean) => {
    setTools((prev) => prev.map((t) => (t.name === name ? { ...t, enabled } : t)))
  }, [])

  const activeCategory_ = CATEGORIES.find((c) => c.key === activeCategory)!
  const categoryTools = TOOL_CATEGORIES.has(activeCategory)
    ? getToolsByCategory(tools, activeCategory as ToolCategory)
    : []
  const enabledCount = tools.filter((t) => t.enabled).length

  const renderPanel = () => {
    const props = {
      settings,
      tools: categoryTools,
      onSettingsChange: setSettings,
      onToolToggle: handleToolToggle,
    }
    switch (activeCategory) {
      case 'ai_models':
        return <AIModelsPanel {...props} />
      case 'agent_runtime':
        return <AgentRuntimePanel {...props} />
      case 'scraping':
        return <ScrapingPanel {...props} />
      case 'github':
        return <GitHubPanel {...props} />
      case 'deployment':
        return <DeploymentPanel {...props} />
      case 'memory':
        return <MemoryPanel {...props} />
      case 'developer':
        return <DeveloperPanel {...props} />
      case 'frontend':
        return <FrontendPanel {...props} />
      case 'media':
        return <MediaPanel {...props} />
      case 'business':
        return <BusinessPanel {...props} />
      case 'integrations':
        return <IntegrationsPanel {...props} />
      case 'local_machine':
        return <LocalMachinePanel />
      case 'agent_config':
        return <AgentConfigPanel />
      case 'automation':
        return <AutomationPanel />
      case 'notifications':
        return <NotificationsPanel />
      case 'security':
        return <SecurityPanel />
      case 'ui_preferences':
        return <UIPreferencesPanel />
      case 'system':
        return <SystemPanel />
      case 'usage_billing':
        return <UsageBillingPanel />
      case 'webhooks_custom':
        return <WebhooksPanel />
      case 'advanced':
        return <AdvancedPanel />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <BackButton onBack={() => onNavigate('home')} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Command Center</h1>
          <p className="text-white/60 mt-1 text-sm">
            Configure your autonomous agent platform — {enabledCount} tools active
          </p>
        </div>
        <Button
          onClick={handleSave}
          className="flex items-center gap-2 shrink-0"
          style={{
            background: saved
              ? 'rgba(34,197,94,0.2)'
              : 'linear-gradient(135deg, var(--gradient-gold-start,#b8860b) 0%, var(--gradient-gold-mid,#ffd700) 100%)',
            border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none',
            color: saved ? 'rgb(134,239,172)' : 'black',
          }}
        >
          {saved ? <CheckCircle size={16} /> : <FloppyDisk size={16} />}
          {saved ? 'Saved' : 'Save Settings'}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex gap-6"
      >
        {/* Sidebar nav */}
        <div className="w-52 shrink-0">
          <Card style={cardStyle} className="overflow-hidden">
            <nav className="p-2">
              {CATEGORIES.map((cat) => {
                // FIX (CI job 66236048582): cat.key is ExtendedCategory which may include
                // non-ToolCategory values (e.g. 'system'). Guard with TOOL_CATEGORIES set
                // before passing to getToolsByCategory which expects ToolCategory.
                const catTools = TOOL_CATEGORIES.has(cat.key)
                  ? getToolsByCategory(tools, cat.key as ToolCategory)
                  : []
                const activeCount = catTools.filter((t) => t.enabled).length
                const isActive = cat.key === activeCategory
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(184,134,11,0.25) 0%, rgba(255,215,0,0.12) 100%)'
                        : 'transparent',
                      border: isActive ? '1px solid rgba(255,215,0,0.25)' : '1px solid transparent',
                    }}
                  >
                    <span className={isActive ? 'text-yellow-400' : 'text-white/50'}>{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {cat.label}
                      </p>
                    </div>
                    {activeCount > 0 && (
                      <span className="text-[10px] font-mono text-yellow-400/70 shrink-0">
                        {activeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </Card>
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <Card style={cardStyle} className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.2)' }}
                >
                  <span className="text-yellow-400">{activeCategory_.icon}</span>
                </div>
                <div>
                  <CardTitle className="text-white text-base">{activeCategory_.label}</CardTitle>
                  <CardDescription className="text-white/50 text-xs">{activeCategory_.description}</CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <ToggleLeft size={14} className="text-white/30" />
                  <span className="text-xs text-white/30">
                    {categoryTools.filter((t) => t.enabled).length}/{categoryTools.length} tools active
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">{renderPanel()}</CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
