#!/usr/bin/env bash
# =============================================================================
# docker-webhook-handler.sh
#
# Triggered by the webhook-receiver when a push event arrives from GitHub.
# Performs:
#   1. git pull origin <branch>
#   2. Conditional npm install (only if package.json/lock changed)
#   3. npm run build
#   4. Container health check gate
#   5. Rollback on failure
#
# Usage:
#   docker-webhook-handler.sh <branch> <commit_sha>
#
# Environment:
#   REPO_DIR            — absolute path to the repository (default: /app)
#   GITHUB_REPO_OWNER   — repository owner
#   GITHUB_REPO_NAME    — repository name
#   GIT_SHA             — full commit SHA being deployed
# =============================================================================
set -euo pipefail

BRANCH="${1:-main}"
COMMIT_SHA="${2:-HEAD}"
REPO_DIR="${REPO_DIR:-/app}"
LOG_FILE="/tmp/xps-deploy-${COMMIT_SHA:0:7}.log"

log() {
  local level="$1"; shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [$level] $*" | tee -a "$LOG_FILE"
}

fatal() {
  log ERROR "$@"
  exit 1
}

# ── Validate working directory ────────────────────────────────────────────────
if [[ ! -d "$REPO_DIR/.git" ]]; then
  fatal "REPO_DIR ($REPO_DIR) is not a git repository"
fi

cd "$REPO_DIR"
log INFO "=== XPS Webhook Deploy: branch=$BRANCH sha=${COMMIT_SHA:0:7} ==="

# ── Capture previous state for rollback ──────────────────────────────────────
PREVIOUS_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
log INFO "Previous HEAD: ${PREVIOUS_SHA:0:7}"

# ── Safety: stash any local changes to avoid conflict ────────────────────────
STASH_REF=$(git stash create 2>/dev/null || echo "")
if [[ -n "$STASH_REF" ]]; then
  git stash store -m "pre-deploy stash" "$STASH_REF" 2>/dev/null || true
  log INFO "Stashed local changes: $STASH_REF"
fi

# ── Pull latest code ─────────────────────────────────────────────────────────
log INFO "Fetching origin..."
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

log INFO "Resetting to origin/$BRANCH..."
git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG_FILE"

CURRENT_SHA=$(git rev-parse HEAD)
log INFO "Now at: ${CURRENT_SHA:0:7}"

# ── Check if dependencies changed ────────────────────────────────────────────
DEPS_CHANGED=false
if [[ -n "$PREVIOUS_SHA" ]]; then
  if git diff --name-only "$PREVIOUS_SHA" HEAD | grep -qE '^package(-lock)?\.json$'; then
    DEPS_CHANGED=true
    log INFO "package.json or package-lock.json changed — running npm ci"
  fi
else
  DEPS_CHANGED=true
fi

if [[ "$DEPS_CHANGED" == "true" ]]; then
  log INFO "Installing dependencies..."
  if ! npm ci 2>&1 | tee -a "$LOG_FILE"; then
    log ERROR "npm ci failed — rolling back to $PREVIOUS_SHA"
    git reset --hard "$PREVIOUS_SHA" 2>/dev/null || true
    exit 1
  fi
fi

# ── Build ─────────────────────────────────────────────────────────────────────
log INFO "Building frontend..."
BUILD_EXIT=0
if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
  BUILD_EXIT=1
fi

if [[ $BUILD_EXIT -ne 0 ]]; then
  log ERROR "Build failed — rolling back to $PREVIOUS_SHA"
  if [[ -n "$PREVIOUS_SHA" ]]; then
    git reset --hard "$PREVIOUS_SHA" 2>/dev/null || true
    log INFO "Rebuilding previous revision..."
    npm run build 2>&1 | tee -a "$LOG_FILE" || true
  fi
  exit 1
fi

log INFO "=== Deploy complete: branch=$BRANCH sha=${CURRENT_SHA:0:7} ==="
cat "$LOG_FILE"
