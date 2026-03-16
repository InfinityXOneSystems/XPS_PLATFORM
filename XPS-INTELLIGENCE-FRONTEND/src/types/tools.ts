export type ToolCategory =
  | 'ai_models'
  | 'agent_runtime'
  | 'scraping'
  | 'github'
  | 'deployment'
  | 'memory'
  | 'developer'
  | 'frontend'
  | 'media'
  | 'business'
  | 'integrations'

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required?: boolean
  default?: string | number | boolean
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  executionEndpoint: string
  category: ToolCategory
  enabled: boolean
}

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ToolCall {
  id: string
  toolName: string
  parameters: Record<string, unknown>
  status: ToolCallStatus
  progress?: number
  result?: string
  error?: string
  timestamp: Date
}

export type ActivityEntryType =
  | 'thinking'
  | 'tool_call'
  | 'scraping'
  | 'extraction'
  | 'info'
  | 'success'
  | 'error'

export interface ActivityEntry {
  id: string
  type: ActivityEntryType
  message: string
  toolCall?: ToolCall
  timestamp: Date
}

export interface AgentSettings {
  aiModels: {
    ollamaEndpoint: string
    selectedModel: string
    temperature: number
    maxTokens: number
  }
  agentRuntime: {
    orchestration: string
    concurrencyLimit: number
    enablePlanner: boolean
    enableSupervisor: boolean
    enableWorkers: boolean
  }
  scraping: {
    playwrightEnabled: boolean
    crawlerPoolSize: number
    searchEngineEnabled: boolean
    emailExtractionEnabled: boolean
    scrapingDepth: number
    scrapingConcurrency: number
  }
  github: {
    token: string
    repoAccess: boolean
    workflowTrigger: boolean
    prCreation: boolean
    fileEditing: boolean
    issueAutomation: boolean
  }
  deployment: {
    vercelToken: string
    githubActionsEnabled: boolean
    dockerEnabled: boolean
  }
  memory: {
    redisUrl: string
    vectorDbEnabled: boolean
    structuredDbEnabled: boolean
  }
  developer: {
    codeGenEnabled: boolean
    debuggingEnabled: boolean
    repoEditingEnabled: boolean
    routeGenEnabled: boolean
  }
  frontend: {
    pageGenEnabled: boolean
    componentRegistryEnabled: boolean
    layoutEditorEnabled: boolean
    themeBuilderEnabled: boolean
  }
  media: {
    imageGenEnabled: boolean
    imageEditEnabled: boolean
    videoCreateEnabled: boolean
    videoEditEnabled: boolean
  }
  business: {
    leadScrapingEnabled: boolean
    outreachGenEnabled: boolean
    analyticsEnabled: boolean
    crmExportEnabled: boolean
  }
  integrations: {
    // Named API keys for supported providers
    groqApiKey: string
    openaiApiKey: string
    anthropicApiKey: string
    geminiApiKey: string
    awsAccessKeyId: string
    awsSecretAccessKey: string
    awsRegion: string
    gcpProjectId: string
    gcpApiKey: string
    cloudflareAccountId: string
    cloudflareApiToken: string
    // Generic additional keys
    apiKeys: Record<string, string>
    oauthConnectors: string[]
    tokenVaultEnabled: boolean
  }
}
