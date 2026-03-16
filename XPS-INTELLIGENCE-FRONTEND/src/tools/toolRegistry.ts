import type { ToolDefinition, ToolCategory, AgentSettings } from '@/types/tools'

export const DEFAULT_TOOLS: ToolDefinition[] = [
  // AI Models
  {
    name: 'set_ollama_model',
    description: 'Switch the active Ollama model for agent inference',
    parameters: [
      { name: 'model', type: 'string', description: 'Model name (e.g. llama3, mistral)', required: true },
    ],
    executionEndpoint: '/api/agent/model',
    category: 'ai_models',
    enabled: true,
  },
  {
    name: 'set_llm_parameters',
    description: 'Configure temperature and token limits for LLM inference',
    parameters: [
      { name: 'temperature', type: 'number', description: 'Sampling temperature 0.0–2.0', required: true, default: 0.7 },
      { name: 'max_tokens', type: 'number', description: 'Maximum output tokens', required: true, default: 2048 },
    ],
    executionEndpoint: '/api/agent/parameters',
    category: 'ai_models',
    enabled: true,
  },

  // Agent Runtime
  {
    name: 'run_planner_agent',
    description: 'Invoke the LangGraph planner agent to decompose a goal into tasks',
    parameters: [
      { name: 'goal', type: 'string', description: 'High-level goal for the planner', required: true },
    ],
    executionEndpoint: '/api/agent/planner',
    category: 'agent_runtime',
    enabled: true,
  },
  {
    name: 'run_supervisor_agent',
    description: 'Invoke the supervisor agent to coordinate worker agents',
    parameters: [
      { name: 'task_plan', type: 'string', description: 'JSON task plan from planner', required: true },
      { name: 'concurrency', type: 'number', description: 'Max concurrent workers', default: 3 },
    ],
    executionEndpoint: '/api/agent/supervisor',
    category: 'agent_runtime',
    enabled: true,
  },
  {
    name: 'run_worker_agent',
    description: 'Dispatch a single worker agent to complete a specific task',
    parameters: [
      { name: 'task', type: 'string', description: 'Task description for the worker', required: true },
      { name: 'tools', type: 'array', description: 'Tool names the worker may use' },
    ],
    executionEndpoint: '/api/agent/worker',
    category: 'agent_runtime',
    enabled: true,
  },

  // Scraping System
  {
    name: 'scrape_leads',
    description: 'Scrape companies and extract leads using Playwright browser automation',
    parameters: [
      { name: 'industry', type: 'string', description: 'Target industry or niche', required: true },
      { name: 'location', type: 'string', description: 'Geographic location or city', required: true },
      { name: 'max_results', type: 'number', description: 'Maximum leads to extract', default: 50 },
    ],
    executionEndpoint: '/api/scraper/run',
    category: 'scraping',
    enabled: true,
  },
  {
    name: 'scrape_search_engine',
    description: 'Scrape search engine results for a given query',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query string', required: true },
      { name: 'engine', type: 'string', description: 'Search engine (google, bing)', default: 'google' },
      { name: 'depth', type: 'number', description: 'Pages to crawl', default: 3 },
    ],
    executionEndpoint: '/api/scraper/search',
    category: 'scraping',
    enabled: true,
  },
  {
    name: 'extract_emails',
    description: 'Extract email addresses from a website or crawled pages',
    parameters: [
      { name: 'url', type: 'string', description: 'Target website URL', required: true },
      { name: 'depth', type: 'number', description: 'Crawl depth for nested pages', default: 2 },
    ],
    executionEndpoint: '/api/scraper/emails',
    category: 'scraping',
    enabled: true,
  },

  // GitHub Integration
  {
    name: 'create_pull_request',
    description: 'Create a GitHub pull request with specified changes',
    parameters: [
      { name: 'repo', type: 'string', description: 'Repository in owner/repo format', required: true },
      { name: 'title', type: 'string', description: 'Pull request title', required: true },
      { name: 'body', type: 'string', description: 'Pull request description' },
      { name: 'branch', type: 'string', description: 'Source branch name', required: true },
    ],
    executionEndpoint: '/api/github/pull-request',
    category: 'github',
    enabled: false,
  },
  {
    name: 'trigger_workflow',
    description: 'Trigger a GitHub Actions workflow dispatch event',
    parameters: [
      { name: 'repo', type: 'string', description: 'Repository in owner/repo format', required: true },
      { name: 'workflow_id', type: 'string', description: 'Workflow filename or ID', required: true },
      { name: 'inputs', type: 'string', description: 'JSON workflow inputs' },
    ],
    executionEndpoint: '/api/github/workflow',
    category: 'github',
    enabled: false,
  },
  {
    name: 'edit_file',
    description: 'Edit a file in a GitHub repository via the API',
    parameters: [
      { name: 'repo', type: 'string', description: 'Repository in owner/repo format', required: true },
      { name: 'path', type: 'string', description: 'File path in the repository', required: true },
      { name: 'content', type: 'string', description: 'New file content', required: true },
      { name: 'message', type: 'string', description: 'Commit message', required: true },
    ],
    executionEndpoint: '/api/github/file',
    category: 'github',
    enabled: false,
  },
  {
    name: 'create_issue',
    description: 'Automatically create a GitHub issue with AI-generated content',
    parameters: [
      { name: 'repo', type: 'string', description: 'Repository in owner/repo format', required: true },
      { name: 'title', type: 'string', description: 'Issue title', required: true },
      { name: 'body', type: 'string', description: 'Issue body (markdown)', required: true },
      { name: 'labels', type: 'array', description: 'Label names to apply' },
    ],
    executionEndpoint: '/api/github/issue',
    category: 'github',
    enabled: false,
  },

  // Deployment
  {
    name: 'deploy_vercel',
    description: 'Trigger a Vercel deployment for the specified project',
    parameters: [
      { name: 'project_id', type: 'string', description: 'Vercel project ID', required: true },
      { name: 'environment', type: 'string', description: 'Target environment (production, preview)', default: 'preview' },
    ],
    executionEndpoint: '/api/deployment/vercel',
    category: 'deployment',
    enabled: false,
  },
  {
    name: 'build_docker',
    description: 'Build and push a Docker container image',
    parameters: [
      { name: 'image_name', type: 'string', description: 'Docker image name and tag', required: true },
      { name: 'dockerfile', type: 'string', description: 'Path to Dockerfile', default: './Dockerfile' },
    ],
    executionEndpoint: '/api/deployment/docker',
    category: 'deployment',
    enabled: false,
  },

  // Memory Layer
  {
    name: 'store_memory',
    description: 'Store a key-value pair in Redis agent memory',
    parameters: [
      { name: 'key', type: 'string', description: 'Memory key', required: true },
      { name: 'value', type: 'string', description: 'Value to store', required: true },
      { name: 'ttl', type: 'number', description: 'Time-to-live in seconds', default: 3600 },
    ],
    executionEndpoint: '/api/memory/redis',
    category: 'memory',
    enabled: true,
  },
  {
    name: 'vector_search',
    description: 'Perform semantic search over the vector database',
    parameters: [
      { name: 'query', type: 'string', description: 'Natural language search query', required: true },
      { name: 'top_k', type: 'number', description: 'Number of results to return', default: 10 },
      { name: 'collection', type: 'string', description: 'Vector collection name', default: 'default' },
    ],
    executionEndpoint: '/api/memory/vector-search',
    category: 'memory',
    enabled: false,
  },

  // Developer Tools
  {
    name: 'generate_code',
    description: 'Generate source code from a natural language description',
    parameters: [
      { name: 'description', type: 'string', description: 'What to build', required: true },
      { name: 'language', type: 'string', description: 'Programming language', default: 'typescript' },
      { name: 'framework', type: 'string', description: 'Framework or library to use' },
    ],
    executionEndpoint: '/api/developer/codegen',
    category: 'developer',
    enabled: true,
  },
  {
    name: 'debug_code',
    description: 'Analyze code and suggest fixes for bugs or errors',
    parameters: [
      { name: 'code', type: 'string', description: 'Code snippet to debug', required: true },
      { name: 'error', type: 'string', description: 'Error message or stack trace' },
      { name: 'language', type: 'string', description: 'Programming language', default: 'typescript' },
    ],
    executionEndpoint: '/api/developer/debug',
    category: 'developer',
    enabled: true,
  },
  {
    name: 'generate_route',
    description: 'Generate a backend API route with handlers and validation',
    parameters: [
      { name: 'route', type: 'string', description: 'Route path (e.g. /api/users)', required: true },
      { name: 'method', type: 'string', description: 'HTTP method', default: 'GET' },
      { name: 'framework', type: 'string', description: 'Backend framework', default: 'express' },
    ],
    executionEndpoint: '/api/developer/route-gen',
    category: 'developer',
    enabled: true,
  },

  // Frontend Builder
  {
    name: 'generate_page',
    description: 'Generate a full React page component from a description',
    parameters: [
      { name: 'description', type: 'string', description: 'Page purpose and requirements', required: true },
      { name: 'route', type: 'string', description: 'Page route/path' },
      { name: 'style', type: 'string', description: 'Styling approach (tailwind, css, styled)', default: 'tailwind' },
    ],
    executionEndpoint: '/api/frontend/page-gen',
    category: 'frontend',
    enabled: true,
  },
  {
    name: 'generate_component',
    description: 'Generate a reusable React component and register it',
    parameters: [
      { name: 'name', type: 'string', description: 'Component name', required: true },
      { name: 'description', type: 'string', description: 'Component purpose', required: true },
      { name: 'props', type: 'string', description: 'JSON props definition' },
    ],
    executionEndpoint: '/api/frontend/component-gen',
    category: 'frontend',
    enabled: true,
  },

  // Media Tools
  {
    name: 'generate_image',
    description: 'Generate an AI image from a text prompt',
    parameters: [
      { name: 'prompt', type: 'string', description: 'Image generation prompt', required: true },
      { name: 'size', type: 'string', description: 'Image dimensions (e.g. 1024x1024)', default: '1024x1024' },
      { name: 'style', type: 'string', description: 'Image style (realistic, artistic, etc.)' },
    ],
    executionEndpoint: '/api/media/image-gen',
    category: 'media',
    enabled: false,
  },
  {
    name: 'edit_image',
    description: 'Edit or transform an existing image using AI',
    parameters: [
      { name: 'image_url', type: 'string', description: 'Source image URL', required: true },
      { name: 'instruction', type: 'string', description: 'Editing instruction', required: true },
    ],
    executionEndpoint: '/api/media/image-edit',
    category: 'media',
    enabled: false,
  },

  // Business Tools
  {
    name: 'scrape_market_leads',
    description: 'Scrape market data and extract B2B leads for a target segment',
    parameters: [
      { name: 'industry', type: 'string', description: 'Target industry', required: true },
      { name: 'location', type: 'string', description: 'Target location', required: true },
      { name: 'company_size', type: 'string', description: 'Company size filter (SMB, enterprise)', default: 'SMB' },
    ],
    executionEndpoint: '/api/business/lead-scrape',
    category: 'business',
    enabled: true,
  },
  {
    name: 'generate_outreach',
    description: 'Generate personalized outreach email sequences for leads',
    parameters: [
      { name: 'lead_name', type: 'string', description: 'Lead or company name', required: true },
      { name: 'industry', type: 'string', description: 'Lead industry', required: true },
      { name: 'value_prop', type: 'string', description: 'Your value proposition' },
      { name: 'sequence_length', type: 'number', description: 'Number of emails in sequence', default: 3 },
    ],
    executionEndpoint: '/api/business/outreach-gen',
    category: 'business',
    enabled: true,
  },
  {
    name: 'export_crm',
    description: 'Export leads and contact data to CRM format (CSV, HubSpot, Salesforce)',
    parameters: [
      { name: 'format', type: 'string', description: 'Export format (csv, hubspot, salesforce)', default: 'csv' },
      { name: 'filters', type: 'string', description: 'JSON filter criteria for leads' },
    ],
    executionEndpoint: '/api/business/crm-export',
    category: 'business',
    enabled: true,
  },

  // Integrations
  {
    name: 'call_external_api',
    description: 'Make an authenticated call to a registered external API',
    parameters: [
      { name: 'service', type: 'string', description: 'Registered service name', required: true },
      { name: 'endpoint', type: 'string', description: 'API endpoint path', required: true },
      { name: 'method', type: 'string', description: 'HTTP method', default: 'GET' },
      { name: 'body', type: 'string', description: 'JSON request body' },
    ],
    executionEndpoint: '/api/integrations/call',
    category: 'integrations',
    enabled: false,
  },
]

const SETTINGS_KEY = 'xps_agent_settings'
const TOOLS_KEY = 'xps_tool_registry'

export const DEFAULT_SETTINGS: AgentSettings = {
  aiModels: {
    ollamaEndpoint: 'http://localhost:11434',
    selectedModel: 'llama3',
    temperature: 0.7,
    maxTokens: 2048,
  },
  agentRuntime: {
    orchestration: 'langgraph',
    concurrencyLimit: 5,
    enablePlanner: true,
    enableSupervisor: true,
    enableWorkers: true,
  },
  scraping: {
    playwrightEnabled: true,
    crawlerPoolSize: 3,
    searchEngineEnabled: true,
    emailExtractionEnabled: true,
    scrapingDepth: 3,
    scrapingConcurrency: 5,
  },
  github: {
    token: '',
    repoAccess: false,
    workflowTrigger: false,
    prCreation: false,
    fileEditing: false,
    issueAutomation: false,
  },
  deployment: {
    vercelToken: '',
    githubActionsEnabled: false,
    dockerEnabled: false,
  },
  memory: {
    redisUrl: 'redis://localhost:6379',
    vectorDbEnabled: false,
    structuredDbEnabled: false,
  },
  developer: {
    codeGenEnabled: true,
    debuggingEnabled: true,
    repoEditingEnabled: false,
    routeGenEnabled: true,
  },
  frontend: {
    pageGenEnabled: true,
    componentRegistryEnabled: true,
    layoutEditorEnabled: false,
    themeBuilderEnabled: false,
  },
  media: {
    imageGenEnabled: false,
    imageEditEnabled: false,
    videoCreateEnabled: false,
    videoEditEnabled: false,
  },
  business: {
    leadScrapingEnabled: true,
    outreachGenEnabled: true,
    analyticsEnabled: true,
    crmExportEnabled: true,
  },
  integrations: {
    groqApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    geminiApiKey: '',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: 'us-east-1',
    gcpProjectId: '',
    gcpApiKey: '',
    cloudflareAccountId: '',
    cloudflareApiToken: '',
    apiKeys: {},
    oauthConnectors: [],
    tokenVaultEnabled: false,
  },
}

export function loadSettings(): AgentSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed && typeof parsed === 'object') {
        const typed = parsed as Partial<AgentSettings>
        return {
          ...DEFAULT_SETTINGS,
          ...typed,
          integrations: {
            ...DEFAULT_SETTINGS.integrations,
            ...(typed.integrations ?? {}),
          },
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: AgentSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadToolRegistry(): ToolDefinition[] {
  try {
    const stored = localStorage.getItem(TOOLS_KEY)
    if (stored) {
      const saved: ToolDefinition[] = JSON.parse(stored)
      return DEFAULT_TOOLS.map((tool) => {
        const override = saved.find((t) => t.name === tool.name)
        return override ? { ...tool, enabled: override.enabled } : tool
      })
    }
  } catch {
    // ignore parse errors
  }
  return [...DEFAULT_TOOLS]
}

export function saveToolRegistry(tools: ToolDefinition[]): void {
  localStorage.setItem(TOOLS_KEY, JSON.stringify(tools))
}

export function getEnabledTools(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.filter((t) => t.enabled)
}

export function getToolsByCategory(tools: ToolDefinition[], category: ToolCategory): ToolDefinition[] {
  return tools.filter((t) => t.category === category)
}

/**
 * Exhaustive tuple of every valid ToolCategory value.
 * Must stay in sync with the ToolCategory union in src/types/tools.ts.
 * Used by isToolCategory() to perform a runtime membership check so that
 * callers receiving an ExtendedCategory (e.g. 'system', 'advanced') can
 * narrow the type to ToolCategory before passing it to getToolsByCategory.
 */
export const TOOL_CATEGORY_VALUES: readonly ToolCategory[] = [
  'ai_models',
  'agent_runtime',
  'scraping',
  'github',
  'deployment',
  'memory',
  'developer',
  'frontend',
  'media',
  'business',
  'integrations',
] as const

/**
 * Type guard: returns true when `value` is a valid ToolCategory.
 *
 * Use this to narrow an ExtendedCategory (or arbitrary string) before
 * passing it as the `category` argument of getToolsByCategory.
 *
 * @example
 *   if (isToolCategory(activeCategory)) {
 *     const tools = getToolsByCategory(allTools, activeCategory)
 *   }
 */
export function isToolCategory(value: unknown): value is ToolCategory {
  // Safe runtime check — no unsafe cast required.
  return typeof value === 'string' && (TOOL_CATEGORY_VALUES as readonly string[]).includes(value)
}

export function findTool(tools: ToolDefinition[], name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name)
}
