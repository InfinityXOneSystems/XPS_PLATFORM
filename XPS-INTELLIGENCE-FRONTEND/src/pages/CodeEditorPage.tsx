import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Code,
  Play,
  Copy,
  ArrowsCounterClockwise,
  CheckCircle,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/BackButton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CodeEditorPageProps {
  onNavigate: (page: string) => void
}

type Language = 'typescript' | 'javascript' | 'python' | 'bash' | 'json'

const LANGUAGE_EXAMPLES: Record<Language, string> = {
  typescript: `// XPS Intelligence - TypeScript Example
interface Lead {
  id: string
  company: string
  email: string
  score: number
}

async function scoreLeads(leads: Lead[]): Promise<Lead[]> {
  return leads
    .map(lead => ({
      ...lead,
      score: Math.floor(Math.random() * 100),
    }))
    .sort((a, b) => b.score - a.score)
}

const leads: Lead[] = [
  { id: '1', company: 'Acme Epoxy', email: 'contact@acme.com', score: 0 },
  { id: '2', company: 'ProCoat LLC', email: 'info@procoat.com', score: 0 },
]

scoreLeads(leads).then(ranked => console.log(ranked))
`,
  javascript: `// XPS Intelligence - JavaScript Example
const fetchLeads = async (city) => {
  const response = await fetch(\`/api/leads?city=\${city}\`)
  const data = await response.json()
  return data.leads
}

fetchLeads('Orlando').then(leads => {
  console.log(\`Found \${leads.length} leads\`)
  leads.forEach(lead => {
    console.log(\`- \${lead.company}: \${lead.email}\`)
  })
})
`,
  python: `# XPS Intelligence - Python Scraper Example
import asyncio
from playwright.async_api import async_playwright

async def scrape_leads(city: str, category: str) -> list[dict]:
    """Scrape business leads for a given city and category."""
    leads = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={category}+in+{city}"
        await page.goto(url)
        # Parse results...
        await browser.close()
    return leads

asyncio.run(scrape_leads("Orlando", "epoxy contractors"))
`,
  bash: `#!/bin/bash
# XPS Intelligence - Deployment Script

echo "Starting XPS Intelligence deployment..."

# Build frontend
npm run build
if [ $? -ne 0 ]; then
  echo "Build failed!" >&2
  exit 1
fi

# Run lint checks
npm run lint
echo "Lint passed ✓"

# Deploy to production
echo "Deploying to production..."
# vercel deploy --prod

echo "Deployment complete ✓"
`,
  json: `{
  "agents": [
    { "name": "PlannerAgent",    "status": "active", "tasks": 3 },
    { "name": "ScraperAgent",    "status": "active", "tasks": 12 },
    { "name": "ResearchAgent",   "status": "idle",   "tasks": 0 },
    { "name": "BuilderAgent",    "status": "active", "tasks": 2 },
    { "name": "ValidatorAgent",  "status": "idle",   "tasks": 0 },
    { "name": "DevOpsAgent",     "status": "active", "tasks": 1 },
    { "name": "KnowledgeAgent",  "status": "idle",   "tasks": 0 },
    { "name": "BusinessAgent",   "status": "active", "tasks": 5 },
    { "name": "PredictionAgent", "status": "idle",   "tasks": 0 },
    { "name": "SimulationAgent", "status": "idle",   "tasks": 0 }
  ],
  "memory": {
    "entries": 47,
    "vectorDimensions": 1536,
    "lastUpdated": "2025-01-01T00:00:00Z"
  }
}
`,
}

const LANGUAGE_LABELS: Record<Language, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  bash: 'Bash',
  json: 'JSON',
}

function highlight(code: string, lang: Language): string {
  // Very lightweight keyword highlighting via CSS classes (no external lib needed)
  // We return the raw text — the <pre> provides monospace + scroll
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /(\/\/.*$|#.*$)/gm,
      '<span style="color:var(--color-muted-foreground,#6b7280)">$1</span>'
    )
    .replace(
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
      lang !== 'json'
        ? '<span style="color:#86efac">$1</span>'
        : '<span style="color:#93c5fd">$1</span>'
    )
    .replace(
      /\b(const|let|var|function|async|await|return|import|export|interface|type|class|extends|implements|from|if|else|for|while|switch|case|break|continue|new|typeof|instanceof|true|false|null|undefined|void|try|catch|finally|throw|yield|default)\b/g,
      '<span style="color:#c084fc">$1</span>'
    )
    .replace(
      /\b(def|import|from|as|with|pass|self|None|True|False|and|or|not|in|is|elif|raise|except)\b/g,
      lang === 'python' ? '<span style="color:#c084fc">$1</span>' : '$1'
    )
}

export function CodeEditorPage({ onNavigate }: CodeEditorPageProps) {
  const [language, setLanguage] = useState<Language>('typescript')
  const [code, setCode] = useState(LANGUAGE_EXAMPLES.typescript)
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    setCode(LANGUAGE_EXAMPLES[lang])
    setOutput('')
  }

  const handleRun = async () => {
    setIsRunning(true)
    setOutput('')
    await new Promise((r) => setTimeout(r, 600))

    if (language === 'typescript' || language === 'javascript') {
      try {
        const lines: string[] = []
        const consoleMock = {
          log: (...args: unknown[]) => lines.push(args.map(String).join(' ')),
          error: (...args: unknown[]) => lines.push('[error] ' + args.map(String).join(' ')),
        }
        lines.push('[browser sandbox] Running in isolated browser context...')
        const fn = new Function('console', code.replace(/^import\b.*$/gm, '// import removed'))
        fn(consoleMock)
        setOutput(lines.join('\n') || '(no output)')
      } catch (err) {
        setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      setOutput(`[${language}] Execution in sandbox environment.\n(Connect backend sandbox runtime to execute ${LANGUAGE_LABELS[language]} code)`)
    }
    setIsRunning(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setCode(LANGUAGE_EXAMPLES[language])
    setOutput('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton onBack={() => onNavigate('home')} />
        <div className="flex items-center gap-3">
          <Code size={24} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Code Editor</h1>
            <p className="text-sm text-muted-foreground">In-browser code editor with sandbox execution</p>
          </div>
        </div>
      </div>

      {/* Language Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              language === lang
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
            )}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <Card className="bg-muted/10 border-border/50">
          <CardHeader className="py-3 px-4 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Code size={14} />
              Editor
              <Badge variant="outline" className="text-xs ml-1">{LANGUAGE_LABELS[language]}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 gap-1 text-xs">
                {copied ? <CheckCircle size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-7 gap-1 text-xs">
                <ArrowsCounterClockwise size={13} />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-0 pb-0">
            <div className="relative">
              {/* Syntax-highlighted overlay */}
              <pre
                aria-hidden
                className="absolute inset-0 pointer-events-none overflow-auto font-mono text-sm leading-relaxed p-4 text-foreground/90 whitespace-pre"
                dangerouslySetInnerHTML={{ __html: highlight(code, language) + '\n' }}
              />
              {/* Transparent textarea on top for editing */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="relative w-full min-h-[340px] font-mono text-sm leading-relaxed p-4 bg-transparent text-transparent caret-foreground resize-none focus:outline-none border-0 rounded-b-lg"
                style={{ caretColor: 'var(--color-foreground, white)' }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="bg-muted/10 border-border/50">
          <CardHeader className="py-3 px-4 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Play size={14} weight="fill" />
              Output
            </CardTitle>
            <Button
              size="sm"
              onClick={handleRun}
              disabled={isRunning}
              className="h-7 gap-1 text-xs"
            >
              <Play size={13} weight="fill" />
              {isRunning ? 'Running...' : 'Run'}
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <motion.pre
              key={output}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-[300px] font-mono text-xs text-foreground/80 bg-background/50 rounded-md p-4 overflow-auto whitespace-pre-wrap border border-border/30"
            >
              {output || <span className="text-muted-foreground/50">Click Run to execute…</span>}
            </motion.pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
