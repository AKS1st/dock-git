# Session-Aware Git Repository Binding

## Goal
Prevent dock-git from displaying or operating on the Harness repository when switching workspaces, while preserving single-repository fast-open and multi-repository selection.

## Architecture
Host session cwd resolution is the safety owner. dock-git Client owns repository binding and re-resolution. The generic dock Workbench remains session-agnostic.

## Tech Stack
TypeScript, Cordis host/client plugin, Node smoke scripts, pnpm.

## Baseline/Authority Refs
- `src/index.ts`: `/wb-git` route and session cwd resolution.
- `src/client/CommitView.tsx`: Git view state and request target.
- `src/client/GitLauncher.tsx`: repository scan and opening behavior.
- `src/client/wb.ts`: request body construction.
- `scripts/smoke-host.mjs`: Host route regression coverage.

## Compatibility Boundary
Keep all existing `/wb-git` endpoint names and normal success payloads. Keep explicit `repoRoot` confinement. Do not change generic Workbench persistence or session propagation. When cwd is unavailable, return a clear non-success error rather than executing Git in `process.cwd()`.

## TDD Route
- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Test posture: focused post-change regression
- Reason: user approved implementation but did not request strict TDD.
- Verification: smoke-host plus package build/type checks.

## Change Necessity
The fallback conflates unknown workspace with the Harness checkout and allows browser-trusted Git routes to return unrelated repository data. No config or documentation change can prevent this. Minimum boundary: `src/index.ts`, `src/client/CommitView.tsx`, `src/client/GitLauncher.tsx`, and focused smoke coverage.

## Tasks
1. Make Host cwd resolution fail closed with a dedicated workspace-not-ready error and regression cases for missing/empty cwd.
2. Scope Client Git repository state to the current session, re-resolve after switching, and handle workspace-not-ready distinctly.
3. Make the launcher auto-open any single discovered repository, pass explicit root for subdirectory repositories, and add empty-state retry.
4. Run focused tests/build and inspect the final diff.

## Repair Track
Canonical owner: `sessionCwdOf` for unsafe fallback; Client seed/session boundary for stale repository binding. Repair removes the fallback and invalidates stale bindings.

## Retirement Track
The old `process.cwd()` fallback is retired. No compatibility path is retained. Explicit `repoRoot` validation remains and is verified.

## Risks and Verification
Risk: a transient session hydration window may show a retryable workspace-not-ready message. Verify no endpoint runs Git without an authoritative cwd, no stale repo root is sent after session switch, and single/multi/no-repo flows remain correct.
