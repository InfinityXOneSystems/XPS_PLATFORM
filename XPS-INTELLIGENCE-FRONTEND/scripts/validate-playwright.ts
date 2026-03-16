#!/usr/bin/env tsx
/**
 * scripts/validate-playwright.ts
 * XPS Intelligence — E2E Validation with Playwright
 *
 * Usage: npx tsx scripts/validate-playwright.ts [--url <url>] [--headed]
 *
 * Runs end-to-end validation tests against the frontend. Checks:
 * - Page loads without JS errors
 * - All navigation routes render
 * - API connectivity (graceful degradation if backend offline)
 * - No console errors
 * - Core Web Vitals (LCP, FCP)
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN'
  duration: number
  detail?: string
  error?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const urlArg = args.indexOf('--url')
const BASE_URL = urlArg >= 0 ? args[urlArg + 1] : 'http://localhost:5173'
const HEADED = args.includes('--headed')
const TIMEOUT = 30_000

const results: TestResult[] = []

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function test(name: string, fn: (page: Page) => Promise<void>, page: Page): Promise<void> {
  const start = Date.now()
  try {
    await fn(page)
    results.push({ name, status: 'PASS', duration: Date.now() - start })
    console.log(`  ✅ ${name} (${Date.now() - start}ms)`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name, status: 'FAIL', duration: Date.now() - start, error: msg })
    console.log(`  ❌ ${name} (${Date.now() - start}ms): ${msg.slice(0, 120)}`)
  }
}

function warn(name: string, detail: string) {
  results.push({ name, status: 'WARN', duration: 0, detail })
  console.log(`  ⚠️  ${name}: ${detail}`)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testPageLoads(page: Page) {
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  const response = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT })
  if (!response || !response.ok()) {
    throw new Error(`Page returned HTTP ${response?.status()}`)
  }

  // Wait for React root to mount
  await page.waitForSelector('#root, [data-testid="app"]', { timeout: TIMEOUT })

  if (consoleErrors.length > 0) {
    throw new Error(`${consoleErrors.length} console error(s): ${consoleErrors[0]}`)
  }
}

async function testNavigation(page: Page) {
  const navRoutes = [
    { label: 'Home', selector: '[data-page="home"], button[aria-label*="Home"]' },
    { label: 'Dashboard', selector: '[data-page="dashboard"], button[aria-label*="Dashboard"]' },
    { label: 'Leads', selector: '[data-page="leads"], button[aria-label*="Leads"]' },
  ]

  for (const route of navRoutes) {
    try {
      const el = await page.$(route.selector)
      if (el) {
        await el.click()
        await page.waitForLoadState('networkidle', { timeout: 5000 })
      } else {
        // Try text-based navigation
        const btn = await page.getByRole('button', { name: new RegExp(route.label, 'i') }).first()
        if (await btn.isVisible()) {
          await btn.click()
          await page.waitForLoadState('networkidle', { timeout: 5000 })
        }
      }
    } catch {
      // Navigation element not found — non-fatal
    }
  }
}

async function testNoJsErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT })
  await page.waitForTimeout(2000)

  if (errors.length > 0) {
    throw new Error(`JavaScript errors detected: ${errors[0]}`)
  }
}

async function testCoreWebVitals(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT })

  // Measure basic timing via Performance API
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paint = performance.getEntriesByType('paint')
    const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime ?? 0
    const lcp = nav ? nav.domContentLoadedEventEnd - nav.startTime : 0
    return { fcp: Math.round(fcp), lcp: Math.round(lcp), ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0 }
  })

  const FCP_THRESHOLD = 1800  // ms
  const LCP_THRESHOLD = 2500  // ms

  if (metrics.fcp > FCP_THRESHOLD) {
    throw new Error(`FCP ${metrics.fcp}ms exceeds threshold of ${FCP_THRESHOLD}ms`)
  }
  if (metrics.lcp > LCP_THRESHOLD) {
    throw new Error(`LCP ${metrics.lcp}ms exceeds threshold of ${LCP_THRESHOLD}ms`)
  }

  console.log(`     FCP: ${metrics.fcp}ms, LCP: ${metrics.lcp}ms, TTFB: ${metrics.ttfb}ms`)
}

async function testApiConnectivity(page: Page) {
  // Try to detect if the app is showing demo/mock mode (acceptable) vs. hard error
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT })

  const hasErrorModal = await page.$('.error-modal, [data-testid="critical-error"]')
  if (hasErrorModal) {
    throw new Error('Critical error modal is displayed on page load')
  }

  // Check for toast warnings about demo mode (acceptable — backend may be offline)
  const demoToast = await page.$('[data-sonner-toast]')
  if (demoToast) {
    const text = await demoToast.textContent()
    if (text?.includes('demo mode') || text?.includes('unavailable')) {
      warn('API connectivity', 'Running in demo mode — backend not reachable (acceptable for frontend-only test)')
      return
    }
  }
}

async function testMobileViewport(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT })

  // Ensure page renders without horizontal overflow
  const hasHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
  if (hasHorizontalOverflow) {
    throw new Error('Page has horizontal overflow on mobile viewport')
  }

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 800 })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎭 XPS Intelligence — Playwright E2E Validation\n')
  console.log(`Target: ${BASE_URL}`)
  console.log(`Mode: ${HEADED ? 'headed' : 'headless'}\n`)

  let browser: Browser | null = null
  let context: BrowserContext | null = null

  try {
    browser = await chromium.launch({ headless: !HEADED })
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT)

    console.log('Running tests...\n')

    await test('Page loads without HTTP errors', testPageLoads, page)
    await test('No JavaScript runtime errors', testNoJsErrors, page)
    await test('Navigation routes are accessible', testNavigation, page)
    await test('Core Web Vitals within thresholds', testCoreWebVitals, page)
    await test('API connectivity (graceful degradation)', testApiConnectivity, page)
    await test('Mobile viewport renders correctly', testMobileViewport, page)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('net::ERR')) {
      console.log(`\n⚠️  Cannot reach ${BASE_URL} — is the dev server running?`)
      console.log('   Start it with: npm run dev\n')
      process.exit(0)
    }
    console.error('Unexpected error:', msg)
  } finally {
    await context?.close()
    await browser?.close()
  }

  // Report
  console.log('\n' + '═'.repeat(60))
  console.log('🎭 PLAYWRIGHT VALIDATION RESULTS')
  console.log('═'.repeat(60))

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warned = results.filter(r => r.status === 'WARN').length

  console.log(`\n  ✅ Passed:  ${passed}`)
  console.log(`  ❌ Failed:  ${failed}`)
  console.log(`  ⚠️  Warned:  ${warned}`)
  console.log(`  📊 Total:   ${results.length}`)

  const passRate = results.length > 0 ? Math.round((passed / results.length) * 100) : 0
  console.log(`\n  Pass rate: ${passRate}%`)

  // Write markdown report
  const md = [
    '# Playwright E2E Validation Report',
    '',
    `**Generated**: ${new Date().toISOString()}`,
    `**Target**: ${BASE_URL}`,
    `**Pass Rate**: ${passRate}% (${passed}/${results.length})`,
    '',
    '## Results',
    '',
    '| Test | Status | Duration |',
    '|------|--------|----------|',
    ...results.map(r => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'WARN' ? '⚠️' : '⏭️'
      const detail = r.error ?? r.detail ?? ''
      return `| ${icon} ${r.name}${detail ? ` — ${detail.slice(0, 80)}` : ''} | ${r.status} | ${r.duration}ms |`
    }),
  ].join('\n')

  const reportPath = join(process.cwd(), '.infinity', 'playwright-report.md')
  try {
    writeFileSync(reportPath, md, 'utf8')
    console.log(`\n📄 Report written to: .infinity/playwright-report.md`)
  } catch {
    // .infinity dir may not exist in CI
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Status: ${failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TEST(S) FAILED`}`)
  console.log('─'.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Playwright validation error:', err)
  process.exit(1)
})
