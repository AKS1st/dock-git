/**
 * Multi-repo discovery for dock-git: scans a workspace directory (cwd itself
 * plus two levels of subdirectories) and lists every independent git
 * repository root. Pure logic on top of the injected runGit — no node:http,
 * no Cordis, no ctx — so the host route layer (index.ts) and the host smoke
 * script share it.
 *
 * Rules (spec: docs/aegis/plans/2026-08-19-dock-git.md §多仓库支持):
 *  - depth 0: cwd itself when inside a work tree (toplevel may be an ancestor).
 *  - depth 1/2: a subdirectory is listed only when it is its OWN repository
 *    root (rev-parse --show-toplevel === the directory itself).
 *  - hidden dirs (. prefix) and node_modules are skipped at every level.
 *  - each scan layer enumerates at most MAX_SCAN_DIRS candidate directories
 *    (truncation is silent).
 *  - results are deduped by root (first occurrence wins).
 *  - unreadable directories and failed rev-parse calls are skipped silently.
 */
import { opendir, realpath } from 'node:fs/promises'
import type { Dir } from 'node:fs'
import { basename, resolve } from 'node:path'

/** One discovered repository root. */
export interface RepoEntry {
  /** Absolute repository root (toplevel of the work tree). */
  root: string
  /** Directory name of the root (basename). */
  name: string
  /** 0 = cwd itself, 1 = direct child of cwd, 2 = grandchild. */
  depth: number
}

/** Directory-enumeration cap per scan layer (perf bound on one click). */
export const MAX_SCAN_DIRS = 200

/** True when dir is itself a git repository root (toplevel === dir). */
export async function isRepoRoot(dir: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<boolean> {
  try {
    // resolve() only normalizes '..' and concatenation — it does NOT resolve
    // symlinks, while git reports the canonical path (getcwd resolves links).
    // Callers must pass symlink-free paths; scanRepos realpaths its base
    // before descending.
    return (await runGit(dir, ['rev-parse', '--show-toplevel'])).trim() === resolve(dir)
  } catch {
    return false
  }
}

/**
 * Run fn over items with at most limit in flight, merging results in input
 * order (stable output order regardless of completion timing).
 */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next
      next += 1
      if (i >= items.length) return
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Enumerate the candidate subdirectories of dir: non-hidden, non-node_modules
 * directories, capped at limit. Files, hidden dirs and missing/unreadable
 * dirs are skipped silently. Returns absolute paths in enumeration order.
 */
async function candidateDirs(dir: string, limit: number): Promise<string[]> {
  const out: string[] = []
  let handle: Dir | undefined
  try {
    handle = await opendir(dir)
    for await (const entry of handle) {
      if (out.length >= limit) break
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (name.startsWith('.') || name === 'node_modules') continue
      out.push(resolve(dir, name))
    }
  } catch {
    // Missing/unreadable directory: nothing to scan, skip silently.
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close()
      } catch {
        // Already closed (for-await exhausted or broken out of).
      }
    }
  }
  return out
}

/** Scan cwd and two levels of subdirectories for repository roots. */
export async function scanRepos(cwd: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<RepoEntry[]> {
  // Scan from the canonical path: git resolves symlinks (getcwd), so a
  // symlinked base would make every isRepoRoot comparison fail. Falling back
  // to the raw path keeps a missing/unreadable cwd a silent empty result.
  const base = await realpath(cwd).catch(() => cwd)
  const entries: RepoEntry[] = []
  const seen = new Set<string>()

  // Depth 0: cwd itself when inside a work tree (toplevel may be an ancestor).
  try {
    const top = (await runGit(base, ['rev-parse', '--show-toplevel'])).trim()
    if (top !== '') {
      const root = resolve(top)
      if (!seen.has(root)) {
        seen.add(root)
        entries.push({ root, name: basename(root), depth: 0 })
      }
    }
  } catch {
    // Not inside a repository.
  }

  const level1 = await candidateDirs(base, MAX_SCAN_DIRS)
  const level1Repo = await mapLimit(level1, 8, async (dir) => ((await isRepoRoot(dir, runGit)) ? dir : null))
  for (const dir of level1Repo) {
    if (dir !== null) {
      const root = resolve(dir)
      if (!seen.has(root)) {
        seen.add(root)
        entries.push({ root, name: basename(root), depth: 1 })
      }
    }
  }

  // Depth 2: children of each first-level dir (cwd/sub/subdir), globally
  // capped at MAX_SCAN_DIRS candidates so one click cannot fan out unboundedly.
  const level2: string[] = []
  let scanned = 0
  for (const dir of level1) {
    if (scanned >= MAX_SCAN_DIRS) break
    const sub = await candidateDirs(dir, MAX_SCAN_DIRS - scanned)
    level2.push(...sub)
    scanned += sub.length
  }
  const level2Repo = await mapLimit(level2, 8, async (child) => ((await isRepoRoot(child, runGit)) ? child : null))
  for (const child of level2Repo) {
    if (child !== null) {
      const root = resolve(child)
      if (!seen.has(root)) {
        seen.add(root)
        entries.push({ root, name: basename(root), depth: 2 })
      }
    }
  }

  return entries
}
