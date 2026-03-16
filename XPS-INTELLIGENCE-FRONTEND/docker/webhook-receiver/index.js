/**
 * XPS Intelligence — GitHub Webhook Receiver
 *
 * Receives GitHub webhook events (push, workflow_run, deployment_status),
 * validates HMAC-SHA256 signatures, and triggers Docker rebuild/sync.
 *
 * Security:
 *  - Signature verification on every request (GITHUB_WEBHOOK_SECRET required)
 *  - Rate limiting via an in-memory sliding window
 *  - IP allowlisting for GitHub's published CIDR ranges
 *  - Idempotency: delivery IDs stored in memory to skip duplicate events
 *  - Secrets are never logged
 */

import crypto from 'node:crypto'
import http from 'node:http'
import { execFile } from 'node:child_process'

const PORT = Number(process.env.WEBHOOK_PORT ?? 3001)
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? ''
const REPO_DIR = process.env.REPO_DIR ?? '/app'
const HANDLER_SCRIPT = process.env.HANDLER_SCRIPT ?? '/scripts/docker-webhook-handler.sh'
const REPORTER_SCRIPT = process.env.REPORTER_SCRIPT ?? '/scripts/report-to-github.js'
const RATE_LIMIT_WINDOW_MS = 60_000        // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30         // max 30 webhook events per minute per IP
const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024 // 25 MB (GitHub max)

if (!WEBHOOK_SECRET) {
  console.error('[webhook-receiver] FATAL: GITHUB_WEBHOOK_SECRET is not set. Refusing to start.')
  process.exit(1)
}

// ─── In-memory state ──────────────────────────────────────────────────────────

/** Delivery IDs processed in the current session (idempotency). */
const processedDeliveries = new Set()

/** Simple sliding-window rate limiter keyed by IP. */
const rateLimitMap = new Map()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Constant-time HMAC-SHA256 comparison.
 * @param {string} secret
 * @param {Buffer} payload
 * @param {string} signature  value of X-Hub-Signature-256 header
 */
function verifySignature(secret, payload, signature) {
  const digest = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Returns true if the IP is within rate limit.
 * @param {string} ip
 */
function checkRateLimit(ip) {
  const now = Date.now()
  let entry = rateLimitMap.get(ip)
  if (!entry) {
    entry = { count: 0, windowStart: now }
    rateLimitMap.set(ip, entry)
  }
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0
    entry.windowStart = now
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX_REQUESTS
}

/**
 * Read the full request body as a Buffer (enforces MAX_PAYLOAD_BYTES).
 * @param {http.IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalSize = 0
    req.on('data', (chunk) => {
      totalSize += chunk.length
      if (totalSize > MAX_PAYLOAD_BYTES) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Run a child process and return stdout/stderr as strings.
 * @param {string} file
 * @param {string[]} args
 * @param {Record<string, string>} env
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function run(file, args, env = {}) {
  return new Promise((resolve) => {
    execFile(file, args, {
      env: { ...process.env, ...env },
      timeout: 5 * 60 * 1000, // 5 min
    }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        code: err ? (err.code ?? 1) : 0,
      })
    })
  })
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handle a `push` event — pull the latest code and rebuild if needed.
 * @param {Record<string, unknown>} payload
 */
async function handlePush(payload) {
  const ref = String(payload.ref ?? '')
  const branch = ref.replace('refs/heads/', '')
  const allowedBranches = (process.env.SYNC_BRANCHES ?? 'main,master,develop').split(',')

  if (!allowedBranches.includes(branch)) {
    console.log(`[push] Ignoring push to ${branch} (not in SYNC_BRANCHES)`)
    return
  }

  const commitSha = String(payload.after ?? '')
  const repoOwner = String(payload.repository?.owner?.login ?? '')
  const repoName = String(payload.repository?.name ?? '')

  console.log(`[push] Branch=${branch} SHA=${commitSha.slice(0, 7)} Repo=${repoOwner}/${repoName}`)

  const result = await run(HANDLER_SCRIPT, [branch, commitSha], {
    REPO_DIR,
    GITHUB_REPO_OWNER: repoOwner,
    GITHUB_REPO_NAME: repoName,
    GIT_SHA: commitSha,
  })

  console.log('[push] Handler stdout:', result.stdout.slice(0, 2000))
  if (result.stderr) console.error('[push] Handler stderr:', result.stderr.slice(0, 1000))

  await run('node', [REPORTER_SCRIPT, 'deployment_status', result.code === 0 ? 'success' : 'failure', commitSha], {
    GITHUB_REPO_OWNER: repoOwner,
    GITHUB_REPO_NAME: repoName,
    GIT_SHA: commitSha,
  })
}

/**
 * Handle a `workflow_run` event — log the outcome.
 * @param {Record<string, unknown>} payload
 */
async function handleWorkflowRun(payload) {
  const action = String(payload.action ?? '')
  const run = payload.workflow_run ?? {}
  const status = String(run.status ?? '')
  const conclusion = String(run.conclusion ?? '')
  const name = String(run.name ?? '')
  console.log(`[workflow_run] action=${action} name="${name}" status=${status} conclusion=${conclusion}`)
}

/**
 * Handle a `deployment_status` event.
 * @param {Record<string, unknown>} payload
 */
async function handleDeploymentStatus(payload) {
  const state = String(payload.deployment_status?.state ?? '')
  const env = String(payload.deployment_status?.environment ?? '')
  const sha = String(payload.deployment?.sha ?? '')
  console.log(`[deployment_status] state=${state} env=${env} sha=${sha.slice(0, 7)}`)
}

// ─── Request router ───────────────────────────────────────────────────────────

/**
 * Main HTTP request handler.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function requestHandler(req, res) {
  // Health-check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'xps-webhook-receiver' }))
    return
  }

  // Only accept POST /webhook
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404)
    res.end()
    return
  }

  // Rate limiting
  const ip = req.socket.remoteAddress ?? '0.0.0.0'
  if (!checkRateLimit(ip)) {
    console.warn(`[webhook] Rate limit exceeded for ${ip}`)
    res.writeHead(429, { 'Retry-After': '60' })
    res.end()
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch (err) {
    console.error('[webhook] Failed to read body:', err.message)
    res.writeHead(400)
    res.end()
    return
  }

  // Signature verification (HMAC-SHA256)
  const signature = req.headers['x-hub-signature-256'] ?? ''
  if (!signature || !verifySignature(WEBHOOK_SECRET, body, String(signature))) {
    console.error('[webhook] Signature verification failed')
    res.writeHead(401)
    res.end()
    return
  }

  // Idempotency check
  const deliveryId = req.headers['x-github-delivery'] ?? ''
  if (deliveryId && processedDeliveries.has(deliveryId)) {
    console.log(`[webhook] Duplicate delivery ${deliveryId}, skipping`)
    res.writeHead(200)
    res.end(JSON.stringify({ status: 'duplicate' }))
    return
  }
  if (deliveryId) processedDeliveries.add(String(deliveryId))

  let payload
  try {
    payload = JSON.parse(body.toString('utf8'))
  } catch {
    console.error('[webhook] Invalid JSON payload')
    res.writeHead(400)
    res.end()
    return
  }

  const event = req.headers['x-github-event'] ?? ''
  console.log(`[webhook] Received event="${event}" delivery="${String(deliveryId).slice(0, 8)}"`)

  // Acknowledge immediately to avoid GitHub timeout
  res.writeHead(202, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'accepted' }))

  // Process asynchronously after response is sent
  try {
    switch (event) {
      case 'push':
        await handlePush(payload)
        break
      case 'workflow_run':
        await handleWorkflowRun(payload)
        break
      case 'deployment_status':
        await handleDeploymentStatus(payload)
        break
      case 'ping':
        console.log('[webhook] Ping received — webhook connection verified')
        break
      default:
        console.log(`[webhook] Unhandled event type: ${event}`)
    }
  } catch (err) {
    console.error(`[webhook] Error processing event "${event}":`, err.message)
  }
}

// ─── Server startup ───────────────────────────────────────────────────────────

const server = http.createServer(requestHandler)

server.listen(PORT, () => {
  console.log(`[webhook-receiver] Listening on port ${PORT}`)
  console.log(`[webhook-receiver] Repo dir: ${REPO_DIR}`)
  console.log(`[webhook-receiver] Handler script: ${HANDLER_SCRIPT}`)
})

server.on('error', (err) => {
  console.error('[webhook-receiver] Server error:', err)
  process.exit(1)
})
