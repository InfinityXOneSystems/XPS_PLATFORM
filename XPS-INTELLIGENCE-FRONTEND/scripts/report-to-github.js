#!/usr/bin/env node
/**
 * report-to-github.js
 *
 * Reports Docker container state, build outcomes, and deployment status back
 * to GitHub using the Deployments, Commit Statuses, and Issues APIs.
 *
 * Usage:
 *   node report-to-github.js <action> [status] [sha]
 *
 *   Actions:
 *     deployment_status   — Update a GitHub deployment (success|failure|error)
 *     commit_status       — Post a commit check status (success|failure|error|pending)
 *     open_issue          — Open a GitHub issue (e.g. container crash report)
 *
 * Required environment variables:
 *   GITHUB_TOKEN          — PAT or GitHub App installation token (write:deployments scope)
 *   GITHUB_REPO_OWNER     — Repository owner
 *   GITHUB_REPO_NAME      — Repository name
 *   GIT_SHA               — Full commit SHA (optional, falls back to HEAD)
 */

import { execSync } from 'node:child_process'
import https from 'node:https'

// ─── Config ───────────────────────────────────────────────────────────────────

const TOKEN = process.env.GITHUB_TOKEN ?? ''
const OWNER = process.env.GITHUB_REPO_OWNER ?? ''
const REPO = process.env.GITHUB_REPO_NAME ?? ''
const SHA = process.env.GIT_SHA || (() => {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { return '' }
})()

const [, , ACTION = '', STATUS = 'success', COMMIT_SHA = SHA] = process.argv

// ─── GitHub API helper ────────────────────────────────────────────────────────

/**
 * Make a GitHub API request.
 * @param {string} method
 * @param {string} endpoint
 * @param {unknown} [body]
 * @returns {Promise<unknown>}
 */
function githubRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    if (!TOKEN) {
      reject(new Error('GITHUB_TOKEN is not set'))
      return
    }
    const payload = body ? JSON.stringify(body) : undefined
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'xps-intelligence-sync/1.0',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        const data = (() => { try { return JSON.parse(text) } catch { return text } })()
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}: ${JSON.stringify(data)}`))
        } else {
          resolve(data)
        }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function createDeployment(sha) {
  return githubRequest('POST', `/repos/${OWNER}/${REPO}/deployments`, {
    ref: sha,
    environment: 'docker',
    description: 'XPS Intelligence Docker sync deployment',
    auto_merge: false,
    required_contexts: [],
  })
}

async function updateDeploymentStatus(deploymentId, state) {
  const validStates = ['error', 'failure', 'inactive', 'in_progress', 'queued', 'pending', 'success']
  const safeState = validStates.includes(state) ? state : 'error'
  return githubRequest('POST', `/repos/${OWNER}/${REPO}/deployments/${deploymentId}/statuses`, {
    state: safeState,
    description: `Docker deployment ${safeState}`,
    environment: 'docker',
    environment_url: process.env.DEPLOYMENT_URL ?? '',
  })
}

async function setCommitStatus(sha, state, description) {
  const validStates = ['error', 'failure', 'pending', 'success']
  const safeState = validStates.includes(state) ? state : 'error'
  return githubRequest('POST', `/repos/${OWNER}/${REPO}/statuses/${sha}`, {
    state: safeState,
    description: description ?? `XPS Docker build ${safeState}`,
    context: 'xps/docker-sync',
    target_url: process.env.DEPLOYMENT_URL ?? '',
  })
}

async function openCrashIssue(sha) {
  const title = `🐳 Container crash detected at ${new Date().toISOString()}`
  const body = [
    '## XPS Intelligence — Container Crash Report',
    '',
    `**Commit:** \`${sha.slice(0, 7)}\``,
    `**Time:** ${new Date().toUTCString()}`,
    `**Environment:** Docker`,
    '',
    'The XPS Intelligence container crashed. Automatic rollback has been attempted.',
    '',
    '### Next Steps',
    '1. Review the deployment logs in the Actions tab',
    '2. Check the container health status',
    '3. Verify the webhook receiver is operational',
  ].join('\n')

  return githubRequest('POST', `/repos/${OWNER}/${REPO}/issues`, {
    title,
    body,
    labels: ['bug', 'deployment', 'auto-generated'],
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!OWNER || !REPO) {
    console.error('[report-to-github] GITHUB_REPO_OWNER and GITHUB_REPO_NAME must be set')
    process.exit(1)
  }

  if (!COMMIT_SHA) {
    console.error('[report-to-github] Could not determine commit SHA')
    process.exit(1)
  }

  console.log(`[report-to-github] action=${ACTION} status=${STATUS} sha=${COMMIT_SHA.slice(0, 7)}`)

  switch (ACTION) {
    case 'deployment_status': {
      const deployment = await createDeployment(COMMIT_SHA)
      await updateDeploymentStatus(deployment.id, STATUS)
      console.log(`[report-to-github] Deployment ${deployment.id} → ${STATUS}`)
      break
    }
    case 'commit_status': {
      await setCommitStatus(COMMIT_SHA, STATUS)
      console.log(`[report-to-github] Commit status set to ${STATUS} for ${COMMIT_SHA.slice(0, 7)}`)
      break
    }
    case 'open_issue': {
      const issue = await openCrashIssue(COMMIT_SHA)
      console.log(`[report-to-github] Opened issue #${issue.number}`)
      break
    }
    default:
      console.error(`[report-to-github] Unknown action: "${ACTION}"`)
      console.error('Valid actions: deployment_status, commit_status, open_issue')
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('[report-to-github] Fatal error:', err.message)
  process.exit(1)
})
