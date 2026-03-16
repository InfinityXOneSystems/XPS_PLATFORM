#!/usr/bin/env tsx
/**
 * scripts/heal.ts
 * XPS Intelligence — Automated Fix Application Engine
 *
 * Usage: npx tsx scripts/heal.ts [--dry-run] [--category <category>]
 *
 * Reads a diagnostic report (or runs diagnose.ts inline) and applies
 * all known automated fixes. Each fix is idempotent — safe to run repeatedly.
 */

import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealResult {
  id: string
  title: string
  status: 'APPLIED' | 'ALREADY_FIXED' | 'SKIPPED' | 'FAILED'
  detail?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const DRY_RUN = process.argv.includes('--dry-run')
const results: HealResult[] = []

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel))
}

function readText(rel: string): string | null {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    return null
  }
}

function writeText(rel: string, content: string): void {
  if (DRY_RUN) {
    console.log(`  [dry-run] Would write: ${rel}`)
    return
  }
  writeFileSync(join(ROOT, rel), content, 'utf8')
}

function run(cmd: string): { stdout: string; code: number } {
  try {
    const stdout = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    return { stdout, code: 0 }
  } catch (e: unknown) {
    const err = e as { stdout?: string; status?: number }
    return { stdout: err.stdout ?? '', code: err.status ?? 1 }
  }
}

function record(id: string, title: string, status: HealResult['status'], detail?: string) {
  results.push({ id, title, status, detail })
  const icon = status === 'APPLIED' ? '✅' : status === 'FAILED' ? '❌' : '⏭️'
  console.log(`  ${icon} [${id}] ${title}${detail ? ` — ${detail}` : ''}`)
}

// ─── Fixes ────────────────────────────────────────────────────────────────────

/**
 * FIX-001: Standardize GitHub Actions action versions
 * Changes v6/v7/v8 references to correct stable versions.
 */
function fixActionVersions() {
  const workflowDir = '.github/workflows'
  if (!fileExists(workflowDir)) {
    record('FIX-001', 'Fix GitHub Actions versions', 'SKIPPED', 'No workflows directory')
    return
  }

  const files = readdirSync(join(ROOT, workflowDir))

  const replacements: Array<[RegExp, string]> = [
    [/actions\/checkout@v[5-9]\d*/g, 'actions/checkout@v4'],
    [/actions\/setup-node@v[5-9]\d*/g, 'actions/setup-node@v4'],
    [/actions\/setup-python@v[6-9]\d*/g, 'actions/setup-python@v5'],
    [/actions\/upload-artifact@v[5-9]\d*/g, 'actions/upload-artifact@v4'],
    [/actions\/download-artifact@v[5-9]\d*/g, 'actions/download-artifact@v4'],
  ]

  let changed = 0
  for (const file of files) {
    const path = `${workflowDir}/${file}`
    const original = readText(path)
    if (!original) continue
    let updated = original
    for (const [pattern, replacement] of replacements) {
      updated = updated.replace(pattern, replacement)
    }
    if (updated !== original) {
      writeText(path, updated)
      changed++
    }
  }

  record('FIX-001', 'Fix GitHub Actions versions', changed > 0 ? 'APPLIED' : 'ALREADY_FIXED', `${changed} workflow(s) updated`)
}

/**
 * FIX-002: Fix vercel.json API URL
 * Ensures VITE_API_URL ends with /api
 */
function fixVercelJson() {
  const path = 'vercel.json'
  const content = readText(path)
  if (!content) {
    record('FIX-002', 'Fix vercel.json API URL', 'SKIPPED', 'vercel.json not found')
    return
  }

  try {
    // Strip UTF-8 BOM if present
    const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
    const config = JSON.parse(text) as Record<string, unknown>
    const env = config.env as Record<string, string> | undefined
    if (!env?.VITE_API_URL) {
      record('FIX-002', 'Fix vercel.json API URL', 'SKIPPED', 'VITE_API_URL not in vercel.json — set it manually')
      return
    }
    if (!env.VITE_API_URL.endsWith('/api')) {
      ;(config.env as Record<string, string>).VITE_API_URL = env.VITE_API_URL.replace(/\/?$/, '/api')
      writeText(path, JSON.stringify(config, null, 2) + '\n')
      record('FIX-002', 'Fix vercel.json API URL', 'APPLIED', 'Appended /api to VITE_API_URL')
    } else {
      record('FIX-002', 'Fix vercel.json API URL', 'ALREADY_FIXED')
    }
  } catch {
    record('FIX-002', 'Fix vercel.json API URL', 'FAILED', 'Cannot parse vercel.json')
  }
}

/**
 * FIX-003: Ensure src/lib/config.ts exists with correct defaults
 */
function fixConfigTs() {
  const path = 'src/lib/config.ts'
  const content = readText(path)

  if (content && content.includes('localhost:3000')) {
    record('FIX-003', 'Ensure src/lib/config.ts defaults', 'ALREADY_FIXED')
    return
  }

  const template = `/**
 * config.ts — Single source of truth for runtime configuration.
 *
 * All environment-specific values are read here; the rest of the app
 * imports from this module instead of accessing import.meta.env directly.
 */

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const WS_BASE =
  import.meta.env.VITE_WS_URL || 'ws://localhost:3000'

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[XPS] VITE_API_URL is not set — using http://localhost:3000/api. ' +
      'Ensure the backend is running on port 3000.'
  )
}
`
  writeText(path, template)
  record('FIX-003', 'Ensure src/lib/config.ts defaults', 'APPLIED', content ? 'Updated defaults' : 'Created file')
}

/**
 * FIX-004: Add error handling to Vercel serverless functions
 */
function fixServerlessFunctions() {
  const chatPath = 'pages/api/chat.js'
  const agentPath = 'pages/api/agent.ts'

  // Check chat.js
  const chatContent = readText(chatPath)
  if (chatContent && (!chatContent.includes('try') || !chatContent.includes('catch'))) {
    const fixed = `import { Groq } from 'groq-sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' })
  }

  if (!process.env.AI_GROQ_API_KEY) {
    return res.status(503).json({ error: 'LLM not configured — AI_GROQ_API_KEY is missing' })
  }

  try {
    const groq = new Groq({ apiKey: process.env.AI_GROQ_API_KEY })
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: message.trim() }],
      max_tokens: 512,
    })

    return res.status(200).json({
      reply: response.choices[0]?.message?.content || 'Empty response from LLM',
    })
  } catch (err) {
    console.error('Groq chat error:', err)
    return res.status(500).json({ error: 'LLM request failed', details: err.message })
  }
}
`
    writeText(chatPath, fixed)
    record('FIX-004a', 'Add error handling to pages/api/chat.js', 'APPLIED')
  } else {
    record('FIX-004a', 'Add error handling to pages/api/chat.js', chatContent ? 'ALREADY_FIXED' : 'SKIPPED', chatContent ? undefined : 'File not found')
  }

  // Check agent.ts
  const agentContent = readText(agentPath)
  if (agentContent && (!agentContent.includes('try') || !agentContent.includes('catch'))) {
    const fixed = `export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' })
  }

  const backendUrl =
    process.env.BACKEND_URL || 'https://xpsintelligencesystem-production.up.railway.app'

  try {
    const result = await fetch(\`\${backendUrl}/api/agent\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() }),
    })

    if (!result.ok) {
      const text = await result.text()
      console.error('Backend agent error:', result.status, text)
      return res.status(result.status).json({
        error: \`Backend agent request failed with status \${result.status}\`,
        details: text,
      })
    }

    const data = await result.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error('Agent proxy error:', err)
    return res.status(500).json({ error: 'Failed to reach backend agent', details: err.message })
  }
}
`
    writeText(agentPath, fixed)
    record('FIX-004b', 'Add error handling to pages/api/agent.ts', 'APPLIED')
  } else {
    record('FIX-004b', 'Add error handling to pages/api/agent.ts', agentContent ? 'ALREADY_FIXED' : 'SKIPPED', agentContent ? undefined : 'File not found')
  }
}

/**
 * FIX-005: Remove broken symlinks
 */
function fixBrokenSymlinks() {
  let removed = 0

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isSymbolicLink()) {
          try {
            statSync(full)
          } catch {
            // Broken symlink — remove it
            if (!DRY_RUN) {
              run(`git rm -f "${full}"`)
            }
            removed++
            console.log(`  🗑️  Removed broken symlink: ${full}`)
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDir(full)
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  scanDir(ROOT)
  record('FIX-005', 'Remove broken symlinks', removed > 0 ? 'APPLIED' : 'ALREADY_FIXED', `${removed} symlink(s) removed`)
}

/**
 * FIX-006: Run npm audit fix for high/critical vulnerabilities
 */
function fixSecurityVulns() {
  const { code, stdout } = run('npm audit --json 2>/dev/null')
  try {
    const report = JSON.parse(stdout) as { metadata?: { vulnerabilities?: Record<string, number> } }
    const vulns = report.metadata?.vulnerabilities ?? {}
    const count = (vulns.critical ?? 0) + (vulns.high ?? 0)
    if (count > 0) {
      if (!DRY_RUN) {
        run('npm audit fix --audit-level=high')
      }
      record('FIX-006', 'Fix npm security vulnerabilities', 'APPLIED', `Ran npm audit fix for ${count} high/critical vulns`)
    } else {
      record('FIX-006', 'Fix npm security vulnerabilities', 'ALREADY_FIXED', 'No high/critical vulnerabilities')
    }
  } catch {
    record('FIX-006', 'Fix npm security vulnerabilities', code === 0 ? 'ALREADY_FIXED' : 'SKIPPED', 'Could not parse audit output')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`🔧 XPS Intelligence — Heal Engine${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
  console.log('Applying automated fixes...\n')

  fixActionVersions()
  fixVercelJson()
  fixConfigTs()
  fixServerlessFunctions()
  fixBrokenSymlinks()
  fixSecurityVulns()

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('🔧 HEAL RESULTS')
  console.log('═'.repeat(60))

  const applied = results.filter(r => r.status === 'APPLIED').length
  const failed = results.filter(r => r.status === 'FAILED').length
  const alreadyFixed = results.filter(r => r.status === 'ALREADY_FIXED').length
  const skipped = results.filter(r => r.status === 'SKIPPED').length

  console.log(`\n  ✅ Applied:       ${applied}`)
  console.log(`  ⏭️  Already fixed: ${alreadyFixed}`)
  console.log(`  ⏭️  Skipped:       ${skipped}`)
  console.log(`  ❌ Failed:        ${failed}`)

  if (failed > 0) {
    console.log('\nFailed fixes:')
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`  ❌ [${r.id}] ${r.title}: ${r.detail}`)
    })
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Heal complete. ${applied} fix(es) applied.`)
  if (DRY_RUN) console.log('(DRY RUN — no files were modified)')
  console.log('─'.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

main()
