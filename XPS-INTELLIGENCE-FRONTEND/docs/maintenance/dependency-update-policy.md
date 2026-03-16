# Dependency Update Policy

> **XPS Intelligence Frontend** — Maintained by InfinityXOneSystems

## Overview

This document describes how dependency updates are handled in this repository, how open Dependabot PRs should be processed, and how the PR queue is kept empty through automated governance.

---

## Automated Governance (via `dependabot-auto-merge.yml`)

The workflow at `.github/workflows/dependabot-auto-merge.yml` automatically governs all Dependabot PRs:

| Update type | Automation behavior |
|-------------|---------------------|
| **Patch** (e.g. `1.2.3 → 1.2.4`) | Auto-approved + auto-merged after CI passes |
| **Minor** (e.g. `1.2.x → 1.3.0`) | Auto-approved + auto-merged after CI passes |
| **Major** (e.g. `1.x → 2.0.0`) | Labeled `major-bump`, comment added, **manual review required** |

> **Prerequisite:** Repository _must_ have **Allow auto-merge** enabled in  
> **Settings → General → Pull Requests → Allow auto-merge**.

---

## CI Requirements Before Any Merge

All PRs must pass the following checks (defined in `.github/workflows/ci.yml`):

1. ✅ `.infinity/ACTIVE_MEMORY.md` present
2. ✅ `npm ci` (clean install, no lockfile drift)
3. ✅ `npm run lint` (ESLint, no errors)
4. ✅ `npm audit --audit-level=high` (no high/critical vulnerabilities)
5. ✅ `npx tsc --noEmit` (TypeScript strict type-check)
6. ✅ `npm run build` (Vite production build)

---

## Strategic PR Queue Reduction — Current Open PRs

The following Dependabot PRs are open as of the time this document was created.  
Process them in the order shown to minimise conflict risk.

### Phase 1 — Auto-mergeable (patch / minor)

These are safe to merge immediately after CI passes:

| PR | Package | Change | Action |
|----|---------|--------|--------|
| #48 | `framer-motion` | `12.35.1 → 12.35.2` | ✅ Auto-merge |
| #51 | `lucide-react` | `0.484.0 → 0.577.0` | ✅ Auto-merge (minor) |
| #44 | `typescript` | `5.7.3 → 5.9.3` | ✅ Auto-merge (minor) |

### Phase 2 — Major bumps (require manual verification)

Process **one at a time**. Verify CI after each merge before proceeding.

| PR | Package | Change | Risk notes |
|----|---------|--------|------------|
| #46 | `marked` | `15.0.12 → 17.0.4` | Check renderer API changes |
| #49 | `date-fns` | `3.6.0 → 4.1.0` | Timezone/locale API changes; review `format()` calls |
| #47 | `recharts` | `2.15.4 → 3.8.0` | **High risk** — `src/components/ui/chart.tsx` uses v3-only types; verify `DefaultTooltipContentProps` / `DefaultLegendContentProps` |
| #50 | `octokit` | `4.1.4 → 5.0.5` | Review `@octokit/core` usage in API modules |
| #45 | `@eslint/js` | `9.39.4 → 10.0.1` | `eslint-plugin-react-hooks@7.x` only supports eslint ≤9. **Do NOT merge** until `eslint-plugin-react-hooks` releases v8+ with eslint v10 peer support, or `npm ci` will break. |

> ⚠️ **Special case — `@eslint/js` (#45):** The `eslint-plugin-react-hooks@7.x` package declares a peer dependency of `eslint@^3–^9`. Upgrading `@eslint/js` to v10 _without_ a compatible version of `eslint-plugin-react-hooks` will cause `npm ci` to fail with an `ERESOLVE` error. **Hold this PR until react-hooks plugin is updated.**

---

## How to Manually Merge a Major Bump

```bash
# 1. Checkout the Dependabot branch
git fetch origin
git checkout <dependabot-branch>

# 2. Install with the new version
npm ci

# 3. Run all quality checks
npm run lint
npx tsc --noEmit
npm run build

# 4. Fix any breakages, commit, push

# 5. Approve and merge via GitHub UI
```

---

## Keeping the PR Queue Empty

1. **Dependabot is configured** (see `.github/dependabot.yml` or repo settings) to open PRs for npm dependencies.
2. **Patch / minor PRs auto-merge** within minutes of CI passing — no human action needed.
3. **Major PRs** are labeled and require a single human approval. Process them as part of a regular maintenance window (recommended: weekly).
4. If a major bump causes CI failures, either:
   - Fix the code for compatibility and push to the Dependabot branch, **or**
   - Close the PR and pin the package at the current version until the ecosystem catches up.

---

## ESLint Version Pin (important)

`eslint` is intentionally pinned to `^9.39.4` in `package.json`. This is **not** an accident.

- `eslint-plugin-react-hooks@7.x` declares `peerDependencies: { eslint: "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9" }`
- ESLint v10 breaks this constraint and causes `npm ci` to fail with `ERESOLVE`
- Do **not** allow automated tools to upgrade `eslint` past v9 until `eslint-plugin-react-hooks` ships a v10-compatible release

---

## Memory System Note

After any significant dependency change, update `.infinity/ACTIVE_MEMORY.md` to reflect the new dependency versions and any architectural changes introduced.

If `.infinity/ACTIVE_MEMORY.md` is missing or empty, the CI pipeline will block all merges. Run `Run_Memory_Script.ps1` (Windows) or restore the file from the last known-good commit to unblock CI.
