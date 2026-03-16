#!/usr/bin/env tsx
/**
 * scripts/diagnose.ts
 * XPS Intelligence — Full Codebase Diagnostic Engine
 *
 * Usage: npx tsx scripts/diagnose.ts [--json] [--output <path>]
 *
 * Scans the repository for configuration issues, missing files, broken imports,
 * security risks, and deployment blockers. Outputs a structured report.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative } from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface Finding {
  id: string
  severity: Severity
  category: string
  file?: string
  line?: number
  title: string
  description: string
  fix: string
}

interface DiagnosticReport {
  timestamp: string
  repoRoot: string
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    operational: boolean
  }
  findings: Finding[]
  checks: Record<string, 'PASS' | 'FAIL' | 'WARN' | 'SKIP'>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const findings: Finding[] = []
const checks: Record<string, 'PASS' | 'FAIL' | 'WARN' | 'SKIP'> = {}
let nextId = 1

function find(severity: Severity, category: string, title: string, description: string, fix: string, file?: string, line?: number) {
  findings.push({ id: `DX-${String(nextId++).padStart(3, '0')}`, severity, category, title, description, fix, file, line })
}

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel))
}

function readJson(rel: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(join(ROOT, rel), 'utf8')
    // Strip UTF-8 BOM if present
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    return JSON.parse(text)
  } catch {
    return null
  }
}

function readText(rel: string): string | null {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    return null
  }
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

// ─── Check: Required Files ────────────────────────────────────────────────────

function checkRequiredFiles() {
  const required = [
    { path: 'package.json', name: 'package.json' },
    { path: 'tsconfig.json', name: 'TypeScript config' },
    { path: 'vite.config.ts', name: 'Vite config' },
    { path: 'index.html', name: 'HTML entry point' },
    { path: 'src/App.tsx', name: 'React root' },
    { path: 'src/main.tsx', name: 'Vite entry' },
    { path: 'src/lib/config.ts', name: 'API config (single source of truth)' },
    { path: 'src/lib/api.ts', name: 'API client' },
    { path: 'vercel.json', name: 'Vercel deployment config' },
    { path: '.infinity/ACTIVE_MEMORY.md', name: 'System memory file' },
    { path: 'Dockerfile', name: 'Docker container definition' },
  ]

  let allPresent = true
  for (const { path, name } of required) {
    if (!fileExists(path)) {
      allPresent = false
      find('CRITICAL', 'Files', `Missing required file: ${name}`, `${path} is required for the build to succeed.`, `Create ${path} with appropriate content.`, path)
    }
  }
  checks['required-files'] = allPresent ? 'PASS' : 'FAIL'
}

// ─── Check: Environment Configuration ────────────────────────────────────────

function checkEnvConfig() {
  const vercelJson = readJson('vercel.json')
  let vercelOk = true

  if (!vercelJson) {
    find('CRITICAL', 'Config', 'vercel.json missing or invalid JSON', 'Cannot parse vercel.json — Vercel deployment will fail.', 'Recreate vercel.json with valid JSON.', 'vercel.json')
    vercelOk = false
  } else {
    const env = vercelJson.env as Record<string, string> | undefined
    if (!env?.VITE_API_URL) {
      find('HIGH', 'Config', 'vercel.json missing VITE_API_URL', 'VITE_API_URL is not set in vercel.json env block. All API calls will fail in production.', 'Add VITE_API_URL to vercel.json env with the full Railway backend URL including /api.', 'vercel.json')
      vercelOk = false
    } else if (!env.VITE_API_URL.endsWith('/api')) {
      find('HIGH', 'Config', 'vercel.json VITE_API_URL missing /api suffix', `Current value: "${env.VITE_API_URL}" — all API calls will hit the wrong endpoint.`, 'Append /api to VITE_API_URL in vercel.json.', 'vercel.json')
      vercelOk = false
    }
    if (!env?.VITE_WS_URL) {
      find('MEDIUM', 'Config', 'vercel.json missing VITE_WS_URL', 'VITE_WS_URL is not set in vercel.json. WebSocket connections will fall back to localhost.', 'Add VITE_WS_URL to vercel.json env with the Railway WebSocket URL.', 'vercel.json')
    }
  }
  checks['vercel-config'] = vercelOk ? 'PASS' : 'FAIL'

  // Check config.ts
  const configTs = readText('src/lib/config.ts')
  let configOk = true
  if (!configTs) {
    find('CRITICAL', 'Config', 'src/lib/config.ts missing', 'Single source of truth for API URLs is missing. Api.ts will not have a valid base URL.', 'Create src/lib/config.ts exporting API_BASE and WS_BASE from VITE_* env vars.')
    configOk = false
  } else {
    if (!configTs.includes('localhost:3000')) {
      find('HIGH', 'Config', 'config.ts not using port 3000 as fallback', 'The API base URL fallback should point to localhost:3000 (where the backend runs), not any other port.', 'Update config.ts default to http://localhost:3000/api.', 'src/lib/config.ts')
      configOk = false
    }
  }
  checks['env-config'] = configOk ? 'PASS' : 'WARN'
}

// ─── Check: GitHub Actions Workflows ─────────────────────────────────────────

function checkWorkflows() {
  const workflowDir = '.github/workflows'
  if (!fileExists(workflowDir)) {
    find('HIGH', 'CI/CD', 'No GitHub Actions workflows found', '.github/workflows directory is missing — CI/CD will not run.', 'Create .github/workflows/ci.yml with lint, typecheck, and build steps.')
    checks['workflows'] = 'FAIL'
    return
  }

  const files = readdirSync(join(ROOT, workflowDir))
  let hasIssues = false

  const invalidVersionPatterns = [
    { pattern: /actions\/checkout@v[5-9]/, fix: 'Use actions/checkout@v4' },
    { pattern: /actions\/setup-node@v[5-9]/, fix: 'Use actions/setup-node@v4' },
    { pattern: /actions\/setup-python@v[6-9]/, fix: 'Use actions/setup-python@v5' },
    { pattern: /actions\/upload-artifact@v[5-9]/, fix: 'Use actions/upload-artifact@v4' },
    { pattern: /actions\/download-artifact@v[5-9]/, fix: 'Use actions/download-artifact@v4' },
  ]

  for (const file of files) {
    const content = readText(`${workflowDir}/${file}`)
    if (!content) continue
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      for (const { pattern, fix } of invalidVersionPatterns) {
        if (pattern.test(line)) {
          hasIssues = true
          const matched = line.match(/actions\/[^@]+@v\d+/)?.[0] ?? line.trim()
          find('HIGH', 'CI/CD', `Invalid action version: ${matched}`, `${workflowDir}/${file}:${idx + 1} uses a non-existent action version. CI will fail.`, fix, `${workflowDir}/${file}`, idx + 1)
        }
      }
    })
  }
  checks['workflows'] = hasIssues ? 'FAIL' : 'PASS'
}

// ─── Check: TypeScript ────────────────────────────────────────────────────────

function checkTypeScript() {
  const { code, stdout } = run('npx tsc --noEmit 2>&1')
  if (code !== 0) {
    const errors = stdout.split('\n').filter(l => l.includes('error TS'))
    errors.slice(0, 10).forEach(err => {
      const match = err.match(/^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/)
      if (match) {
        const [, file, line, code2, msg] = match
        find('CRITICAL', 'TypeScript', `TypeScript error ${code2}: ${msg.slice(0, 80)}`, err.trim(), 'Fix the TypeScript type error.', relative(ROOT, file), parseInt(line))
      }
    })
    if (errors.length > 10) {
      find('CRITICAL', 'TypeScript', `${errors.length - 10} more TypeScript errors`, 'Run npx tsc --noEmit for full list.', 'Fix all TypeScript errors before deploying.')
    }
    checks['typescript'] = 'FAIL'
  } else {
    checks['typescript'] = 'PASS'
  }
}

// ─── Check: ESLint ────────────────────────────────────────────────────────────

function checkLint() {
  const { code } = run('npm run lint 2>&1')
  if (code !== 0) {
    find('MEDIUM', 'Code Quality', 'ESLint found errors', 'Run npm run lint for details.', 'Fix all ESLint errors.')
    checks['lint'] = 'FAIL'
  } else {
    checks['lint'] = 'PASS'
  }
}

// ─── Check: Build ─────────────────────────────────────────────────────────────

function checkBuild() {
  const { code } = run('npm run build 2>&1')
  if (code !== 0) {
    find('CRITICAL', 'Build', 'Production build failed', 'npm run build failed. The frontend cannot be deployed.', 'Fix all build errors reported above.')
    checks['build'] = 'FAIL'
  } else {
    checks['build'] = 'PASS'
  }
}

// ─── Check: Security Audit ────────────────────────────────────────────────────

function checkSecurity() {
  const { code, stdout } = run('npm audit --audit-level=high --json 2>/dev/null')
  try {
    const report = JSON.parse(stdout)
    const vulns = report.metadata?.vulnerabilities ?? {}
    const critical = (vulns.critical ?? 0) + (vulns.high ?? 0)
    if (critical > 0) {
      find('HIGH', 'Security', `${critical} high/critical npm vulnerabilities`, 'npm audit found high or critical severity vulnerabilities in dependencies.', 'Run npm audit fix or manually update the affected packages.')
      checks['security'] = 'FAIL'
    } else {
      checks['security'] = 'PASS'
    }
  } catch {
    checks['security'] = code === 0 ? 'PASS' : 'WARN'
  }
}

// ─── Check: Serverless API Functions ─────────────────────────────────────────

function checkServerlessFunctions() {
  const apiDir = 'pages/api'
  if (!fileExists(apiDir)) {
    checks['serverless-functions'] = 'SKIP'
    return
  }

  const files = readdirSync(join(ROOT, apiDir))
  let hasIssues = false

  for (const file of files) {
    const content = readText(`${apiDir}/${file}`)
    if (!content) continue

    if (!content.includes('try') || !content.includes('catch')) {
      hasIssues = true
      find('HIGH', 'Serverless', `${apiDir}/${file} missing try/catch error handling`, 'Uncaught exceptions in Vercel serverless functions crash the function and return a 500 with no useful error.', 'Wrap the handler body in try/catch and return structured JSON error responses.', `${apiDir}/${file}`)
    }

    if (content.includes('req.method') === false) {
      hasIssues = true
      find('MEDIUM', 'Serverless', `${apiDir}/${file} missing HTTP method check`, 'The function accepts all HTTP methods. Only intended methods should be allowed.', 'Add if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" }).', `${apiDir}/${file}`)
    }
  }
  checks['serverless-functions'] = hasIssues ? 'FAIL' : 'PASS'
}

// ─── Check: Broken Symlinks ───────────────────────────────────────────────────

function checkSymlinks() {
  let hasIssues = false

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isSymbolicLink()) {
          try {
            statSync(full) // throws if target doesn't exist
          } catch {
            hasIssues = true
            find('HIGH', 'Files', `Broken symlink: ${relative(ROOT, full)}`, 'This symlink points to a non-existent target. It will cause build/CI failures on Linux.', `Run: git rm ${relative(ROOT, full)}`, relative(ROOT, full))
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDir(full)
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  scanDir(ROOT)
  checks['symlinks'] = hasIssues ? 'FAIL' : 'PASS'
}

// ─── Check: WebSocket Wiring ──────────────────────────────────────────────────

function checkWebSocket() {
  const appContent = readText('src/App.tsx')
  const wsContent = readText('src/lib/websocket.ts')
  let ok = true

  if (!wsContent) {
    find('HIGH', 'WebSocket', 'src/lib/websocket.ts missing', 'WebSocket client module is missing. Real-time scraper updates will not work.', 'Create src/lib/websocket.ts with a WebSocket client class.')
    ok = false
  }
  if (!appContent?.includes('wsClient')) {
    find('MEDIUM', 'WebSocket', 'WebSocket client not imported in App.tsx', 'wsClient is not used in App.tsx. WebSocket will never connect.', 'Import wsClient and call wsClient.connect() in a useEffect in App.tsx.', 'src/App.tsx')
    ok = false
  }
  checks['websocket'] = ok ? 'PASS' : 'WARN'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍 XPS Intelligence — Diagnostic Engine\n')
  console.log('Scanning repository...\n')

  checkRequiredFiles()
  checkEnvConfig()
  checkWorkflows()
  checkSymlinks()
  checkWebSocket()
  checkServerlessFunctions()

  console.log('Running TypeScript type check...')
  checkTypeScript()

  console.log('Running ESLint...')
  checkLint()

  console.log('Running production build...')
  checkBuild()

  console.log('Running security audit...')
  checkSecurity()

  // Build report
  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
    medium: findings.filter(f => f.severity === 'MEDIUM').length,
    low: findings.filter(f => f.severity === 'LOW').length,
    operational: findings.filter(f => f.severity === 'CRITICAL').length === 0 && checks['build'] === 'PASS',
  }

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    repoRoot: ROOT,
    summary,
    findings,
    checks,
  }

  // Print results
  console.log('\n' + '═'.repeat(60))
  console.log('📊 DIAGNOSTIC RESULTS')
  console.log('═'.repeat(60))
  console.log(`\nChecks:`)
  for (const [name, status] of Object.entries(checks)) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️'
    console.log(`  ${icon} ${name}: ${status}`)
  }

  console.log(`\nFindings: ${summary.total} total`)
  console.log(`  🔴 CRITICAL: ${summary.critical}`)
  console.log(`  🟠 HIGH:     ${summary.high}`)
  console.log(`  🟡 MEDIUM:   ${summary.medium}`)
  console.log(`  🟢 LOW:      ${summary.low}`)

  if (findings.length > 0) {
    console.log('\nTop Findings:')
    findings
      .sort((a, b) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.severity) - ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.severity))
      .slice(0, 15)
      .forEach(f => {
        const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : f.severity === 'MEDIUM' ? '🟡' : '🟢'
        console.log(`\n  ${icon} [${f.id}] ${f.title}`)
        if (f.file) console.log(`     📁 ${f.file}${f.line ? `:${f.line}` : ''}`)
        console.log(`     🔧 ${f.fix}`)
      })
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Status: ${summary.operational ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`)
  console.log('─'.repeat(60) + '\n')

  // Write report files
  const args = process.argv.slice(2)
  const outputArg = args.indexOf('--output')
  const outputPath = outputArg >= 0 ? args[outputArg + 1] : '.infinity/DIAGNOSTIC_REPORT.md'
  const jsonMode = args.includes('--json')

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2))
  }

  // Write Markdown report
  const md = [
    '# XPS Intelligence — Diagnostic Report',
    '',
    `**Generated**: ${report.timestamp}`,
    `**Status**: ${summary.operational ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`,
    '',
    '## Summary',
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| 🔴 CRITICAL | ${summary.critical} |`,
    `| 🟠 HIGH | ${summary.high} |`,
    `| 🟡 MEDIUM | ${summary.medium} |`,
    `| 🟢 LOW | ${summary.low} |`,
    `| **Total** | **${summary.total}** |`,
    '',
    '## Check Results',
    '',
    ...Object.entries(checks).map(([name, status]) => {
      const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️'
      return `- ${icon} **${name}**: ${status}`
    }),
    '',
    '## Findings',
    '',
    ...(findings.length === 0
      ? ['No issues found. Repository is fully operational. 🎉']
      : findings
          .sort((a, b) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.severity) - ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.severity))
          .flatMap(f => {
            const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : f.severity === 'MEDIUM' ? '🟡' : '🟢'
            return [
              `### ${icon} [${f.id}] ${f.title}`,
              '',
              `**Severity**: ${f.severity}  `,
              `**Category**: ${f.category}  `,
              ...(f.file ? [`**File**: \`${f.file}\`${f.line ? `:${f.line}` : ''}  `] : []),
              '',
              f.description,
              '',
              `**Fix**: ${f.fix}`,
              '',
            ]
          })),
  ].join('\n')

  writeFileSync(join(ROOT, outputPath), md, 'utf8')
  console.log(`📄 Diagnostic report written to: ${outputPath}`)

  process.exit(summary.critical > 0 || checks['build'] === 'FAIL' ? 1 : 0)
}

main()
