#!/usr/bin/env tsx
/**
 * scripts/recursive-fix.ts
 * XPS Intelligence — Recursive Healing Loop
 *
 * Usage: npx tsx scripts/recursive-fix.ts [--max-iterations <n>] [--dry-run]
 *
 * Runs diagnose → heal → validate in a loop until the repository is
 * fully operational or the maximum number of iterations is reached.
 *
 * Exit codes:
 *   0 — Repository is operational
 *   1 — Max iterations reached without achieving operational status
 *   2 — Unrecoverable error
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const maxIterArg = args.indexOf('--max-iterations')
const MAX_ITERATIONS = maxIterArg >= 0 ? parseInt(args[maxIterArg + 1], 10) : 5
const DRY_RUN = args.includes('--dry-run')
const ROOT = process.cwd()

// ─── Types ────────────────────────────────────────────────────────────────────

interface IterationResult {
  iteration: number
  timestamp: string
  diagnosticExitCode: number
  healExitCode: number
  buildExitCode: number
  operational: boolean
  findings: number
  fixed: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { stdout, stderr: '', code: 0 }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      code: err.status ?? 1,
    }
  }
}

function isOperational(): boolean {
  console.log('  Checking operational status...')

  // Must pass: typecheck
  const { code: tsCode } = run('npx tsc --noEmit 2>&1')
  if (tsCode !== 0) {
    console.log('    ❌ TypeScript errors present')
    return false
  }

  // Must pass: lint
  const { code: lintCode } = run('npm run lint 2>&1')
  if (lintCode !== 0) {
    console.log('    ❌ ESLint errors present')
    return false
  }

  // Must pass: build
  const { code: buildCode } = run('npm run build 2>&1')
  if (buildCode !== 0) {
    console.log('    ❌ Build failed')
    return false
  }

  // Must pass: security audit
  const { code: auditCode } = run('npm audit --audit-level=high 2>&1')
  if (auditCode !== 0) {
    console.log('    ❌ Security vulnerabilities found')
    return false
  }

  console.log('    ✅ All checks pass — system is operational')
  return true
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 XPS Intelligence — Recursive Healing Loop\n')
  console.log(`Max iterations: ${MAX_ITERATIONS}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`Root: ${ROOT}\n`)

  const history: IterationResult[] = []
  let operational = false

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`ITERATION ${i}/${MAX_ITERATIONS}`)
    console.log('═'.repeat(60))

    const iterResult: IterationResult = {
      iteration: i,
      timestamp: new Date().toISOString(),
      diagnosticExitCode: 0,
      healExitCode: 0,
      buildExitCode: 0,
      operational: false,
      findings: 0,
      fixed: 0,
    }

    // Step 1: Diagnose
    console.log('\n📊 Step 1: Running diagnostic scan...')
    const diagArgs = DRY_RUN ? '' : ''
    const diagResult = run(`npx tsx scripts/diagnose.ts ${diagArgs} 2>&1`)
    iterResult.diagnosticExitCode = diagResult.code

    // Parse finding count from output
    const findingsMatch = diagResult.stdout.match(/(\d+) total/)
    iterResult.findings = findingsMatch ? parseInt(findingsMatch[1], 10) : 0

    if (iterResult.findings === 0 && diagResult.code === 0) {
      console.log('  ✅ No issues found by diagnostic scan')
    } else {
      console.log(`  Found ${iterResult.findings} issue(s)`)
    }

    // Step 2: Heal
    console.log('\n🔧 Step 2: Running heal engine...')
    const healArgs = DRY_RUN ? '--dry-run' : ''
    const healResult = run(`npx tsx scripts/heal.ts ${healArgs} 2>&1`)
    iterResult.healExitCode = healResult.code

    // Parse fixed count
    const fixedMatch = healResult.stdout.match(/(\d+) fix\(es\) applied/)
    iterResult.fixed = fixedMatch ? parseInt(fixedMatch[1], 10) : 0
    console.log(`  Applied ${iterResult.fixed} fix(es)`)

    // Step 3: Validate build
    console.log('\n🏗️  Step 3: Validating build...')
    const buildResult = run('npm run build 2>&1')
    iterResult.buildExitCode = buildResult.code

    if (buildResult.code === 0) {
      console.log('  ✅ Build passed')
    } else {
      console.log('  ❌ Build failed')
    }

    // Step 4: Check operational status
    console.log('\n🔍 Step 4: Checking operational status...')
    iterResult.operational = isOperational()
    history.push(iterResult)

    if (iterResult.operational) {
      operational = true
      console.log(`\n✅ SYSTEM OPERATIONAL after ${i} iteration(s)`)
      break
    }

    // If no fixes were applied and still not operational, stop early
    if (iterResult.fixed === 0 && i > 1) {
      console.log(`\n⚠️  No fixes applied in iteration ${i} — stopping (no further progress possible automatically)`)
      break
    }

    console.log(`\n⟳ Issues remain. Starting iteration ${i + 1}...`)
  }

  // Final Report
  console.log('\n' + '═'.repeat(60))
  console.log('📋 RECURSIVE HEALING SUMMARY')
  console.log('═'.repeat(60))

  console.log(`\nIterations run: ${history.length}`)
  console.log(`Final status: ${operational ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`)

  console.log('\nIteration history:')
  history.forEach(r => {
    const icon = r.operational ? '✅' : '❌'
    console.log(`  ${icon} Iter ${r.iteration}: ${r.findings} findings, ${r.fixed} fixed, build=${r.buildExitCode === 0 ? 'PASS' : 'FAIL'}`)
  })

  // Write status file
  const statusContent = `# OVERSEER STATUS

**Generated**: ${new Date().toISOString()}
**Status**: ${operational ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}
**Iterations**: ${history.length}/${MAX_ITERATIONS}

## Iteration History

| Iter | Findings | Fixed | Build | Operational |
|------|----------|-------|-------|-------------|
${history.map(r => `| ${r.iteration} | ${r.findings} | ${r.fixed} | ${r.buildExitCode === 0 ? 'PASS' : 'FAIL'} | ${r.operational ? '✅ Yes' : '❌ No'} |`).join('\n')}

## System Checks

Run \`npx tsx scripts/diagnose.ts\` for detailed findings.
Run \`npx tsx scripts/heal.ts\` to apply automated fixes.
Run \`npx tsx scripts/validate-playwright.ts\` for E2E tests.

## Remaining Manual Steps

${operational ? '✅ No manual steps required. System is fully operational.' : `
1. Review \`.infinity/DIAGNOSTIC_REPORT.md\` for remaining issues
2. Set environment variables in Railway (DATABASE_URL, JWT_SECRET, AI_GROQ_API_KEY)
3. Set environment variables in Vercel (VITE_API_URL, AI_GROQ_API_KEY)
4. Verify Railway backend is deployed and healthy
5. Merge this PR to trigger automatic Vercel deployment
`}
`

  const statusPath = join(ROOT, 'OVERSEER_STATUS.md')
  if (!DRY_RUN) {
    writeFileSync(statusPath, statusContent, 'utf8')
    console.log('\n📄 Status written to: OVERSEER_STATUS.md')
  }

  console.log('\n' + '─'.repeat(60))
  if (operational) {
    console.log('🚀 FRONTEND IS OPERATIONAL — Ready for deployment')
  } else {
    console.log('⚠️  Manual intervention required for remaining issues')
    console.log('   See OVERSEER_STATUS.md for next steps')
  }
  console.log('─'.repeat(60) + '\n')

  process.exit(operational ? 0 : 1)
}

main().catch(err => {
  console.error('Recursive fix error:', err)
  process.exit(2)
})
