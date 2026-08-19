/**
 * Host half of dock-git: the /wb-git JSON API (git history data plus a safe
 * set of branch/tag/config/remote/push operations for the current workspace,
 * and multi-repo discovery via /wb-git/repos), browser-trust fenced like the
 * /wb-files gateway. All data endpoints accept an optional `repoRoot` payload
 * field to target an explicit repository root instead of the session cwd.
 * Wire envelope + trust-fence + session-cwd helpers are stripped from the
 * dock-files pattern (dock-files/src/index.ts) and copied here because the
 * plugin must not depend on another plugin's internals.
 *
 * All operations are conversation-scoped: requests carry a sessionId and the
 * session's authoritative cwd comes from the session store (falling back to
 * the process cwd while a session is hydrating).
 */
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { realpath, stat } from 'node:fs/promises'
import {
  buildBranchArgs,
  buildCheckoutArgs,
  buildCommitArgs,
  buildConfigGetArgs,
  buildConfigSetArgs,
  buildCreateBranchArgs,
  buildCreateTagArgs,
  buildDeleteBranchArgs,
  buildDeleteTagArgs,
  buildDetailArgs,
  buildFetchArgs,
  buildFetchIntoArgs,
  buildLogArgs,
  buildPullArgs,
  buildPushBranchArgs,
  buildPushTagArgs,
  buildRemoteAddArgs,
  buildRemoteListArgs,
  buildRemoteRemoveArgs,
  buildRemoteSetUrlArgs,
  buildRenameBranchArgs,
  buildShowFileArgs,
  buildShowRefArgs,
  buildStageAddArgs,
  buildStageResetArgs,
  buildStatusFilesArgs,
  parseBranches,
  parseCommitDetail,
  parseGitLog,
  parseNameStatus,
  parseNumStat,
  parseRemotes,
  parseShowRef,
  parseStatusFiles,
  runGit,
} from './git-ops.ts'
import type { CommitDetailMeta, FileChange, GitLogCommit, StatusFile } from './types.ts'
import { scanRepos } from './repos.ts'

export const name = 'dock-git'

/** Services required before mounting. */
export const inject = ['webServer', 'sessions', 'webRuntime']

// Re-exported for the host smoke script (scripts/smoke-host.mjs), which drives
// the data layer straight from lib/index.js after `pnpm run build`.
export {
  SEP,
  runGit,
  buildLogArgs,
  buildPushBranchArgs,
  buildPushTagArgs,
  buildDetailArgs,
  buildShowFileArgs,
  buildShowRefArgs,
  buildBranchArgs,
  buildConfigGetArgs,
  buildConfigSetArgs,
  buildRemoteListArgs,
  buildRemoteAddArgs,
  buildRemoteRemoveArgs,
  buildRemoteSetUrlArgs,
  buildCreateBranchArgs,
  buildRenameBranchArgs,
  buildDeleteBranchArgs,
  buildCreateTagArgs,
  buildDeleteTagArgs,
  buildCheckoutArgs,
  buildFetchArgs,
  buildPullArgs,
  buildFetchIntoArgs,
  buildStatusFilesArgs,
  buildStageAddArgs,
  buildStageResetArgs,
  buildCommitArgs,
  parseGitLog,
  parseShowRef,
  parseCommitDetail,
  parseNameStatus,
  parseNumStat,
  parseBranches,
  parseRemotes,
  parseStatusFiles,
} from './git-ops.ts'
export type { CommitDetailMeta, FileChange, GitLogCommit, StatusFile } from './types.ts'
// Multi-repo discovery (re-exported for the host smoke script).
export { MAX_SCAN_DIRS, isRepoRoot, scanRepos } from './repos.ts'
export type { RepoEntry } from './repos.ts'

// ── Wire helpers (stripped from dock-files pattern) ────────────────────────

/** Machine-readable error codes of the /wb-git API. */
type WbErrorCode = 'bad-request' | 'forbidden' | 'fs-error' | 'not-found' | 'internal'

/** One API failure with its wire code and HTTP status. */
export class WbError extends Error {
  constructor(
    readonly code: WbErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const MAX_BODY_BYTES = 1 << 20

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new WbError('bad-request', 'request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new WbError('bad-request', 'request body is not valid JSON')
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function writeOk(res: ServerResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof WbError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  writeJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

function stringOrUndefined(payload: unknown, key: string): string | undefined {
  const value = (payload as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// ── Trust fence (stripped from dock-files pattern) ─────────────────────────

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/** DNS-rebinding / cross-site defense (not authentication). */
function isTrustedRequest(request: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

// ── Plugin body ────────────────────────────────────────────────────────────

interface WbContext {
  webServer: {
    register(options: {
      kind: 'prefix'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }): () => void
  }
  sessions: {
    get(sessionId: string): { header: { cwd?: string } } | undefined
  }
  webRuntime: {
    trustedHosts: readonly string[]
  }
  effect(fn: () => void | (() => void), label?: string): void
}

/** Resolve a session's authoritative working directory. */
function sessionCwdOf(ctx: WbContext, sessionId: string | undefined): string {
  if (sessionId !== undefined) {
    const cwd = ctx.sessions.get(sessionId)?.header.cwd
    if (cwd !== undefined && cwd !== '') return cwd
  }
  return process.cwd()
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Run a git sub-command, converting any failure into a wire fs-error. */
async function withGitError<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw new WbError('fs-error', `${label} failed: ${messageOf(error)}`)
  }
}

// ── repoRoot (explicit repository root) ────────────────────────────────────

/**
 * Parse and validate the optional `repoRoot` payload field. When provided it
 * must be a non-empty absolute path (`/`-prefixed or a Windows drive letter)
 * to an existing directory, otherwise 400 bad-request. Returns the canonical
 * (symlink-resolved) path, or undefined when absent (endpoints then fall back
 * to the session cwd). repoRoot is the repository root itself — git runs
 * there directly, no upward lookup. A repoRoot that is not a repository is
 * handled per endpoint: /config rejects it up front with fs-error (work-tree
 * guard), /log reports isRepo:false, and the remaining endpoints surface the
 * failing git command as an fs-error.
 */
async function repoRootOf(payload: unknown): Promise<string | undefined> {
  const raw = stringOrUndefined(payload, 'repoRoot')
  if (raw === undefined) return undefined
  if (!raw.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(raw)) {
    throw new WbError('bad-request', 'repoRoot must be an absolute path')
  }
  try {
    const info = await stat(raw)
    if (!info.isDirectory()) {
      throw new WbError('bad-request', `repoRoot is not a directory: "${raw}"`)
    }
    // Canonical spelling so root fields always match the real on-disk path
    // (git reports realpaths too, e.g. through symlinked session dirs).
    return await realpath(raw)
  } catch (error) {
    if (error instanceof WbError) throw error
    throw new WbError('bad-request', `repoRoot directory not found: "${raw}"`)
  }
}

// ── Endpoints ──────────────────────────────────────────────────────────────

/** Graph row sent to the browser: GitLogCommit + merged refs. */
interface GraphCommit extends GitLogCommit {
  heads: string[]
  tags: { name: string; annotated: boolean }[]
  remotes: { name: string; remote: string | null }[]
}

/** Dedupe tags by name, preferring the annotated (^{}) entry. */
function dedupeTags(tags: { name: string; annotated: boolean }[]): { name: string; annotated: boolean }[] {
  const byName = new Map<string, { name: string; annotated: boolean }>()
  for (const tag of tags) {
    const existing = byName.get(tag.name)
    if (existing === undefined || (tag.annotated && !existing.annotated)) byName.set(tag.name, tag)
  }
  return [...byName.values()]
}

async function endpointStatus(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const repoRoot = await repoRootOf(payload)
  const cwd = repoRoot ?? sessionCwdOf(ctx, sessionId)
  let isRepo = false
  try {
    isRepo = (await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])).includes('true')
  } catch {
    isRepo = false
  }
  let root: string | null = null
  let branch: string | null = null
  if (isRepo) {
    if (repoRoot !== undefined) {
      // repoRoot is the repository root itself (validated above).
      root = repoRoot
    } else {
      try {
        root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).trim()
      } catch {
        root = null
      }
    }
    if (root !== null) {
      try {
        branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
      } catch {
        branch = null
      }
    }
  }
  return { cwd, isRepo, root, branch }
}

/** POST /wb-git/repos { sessionId }
 *  → { cwd, repos: RepoEntry[] } (cwd + two levels of subdirectories scanned). */
async function endpointRepos(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const cwd = sessionCwdOf(ctx, sessionId)
  const repos = await scanRepos(cwd, runGit)
  return { cwd, repos }
}

const DEFAULT_MAX_COMMITS = 200
const MAX_COMMITS_LIMIT = 1000
const MAX_LOG_BRANCHES = 50
/** Branch names allowed as a /log filter (read-only selector). A leading '-'
 *  is rejected because git would parse it as an option (e.g. `--all`). */
const BRANCH_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-/]+$/
/** Branch filters must not smuggle git range/reflog syntax (`main..side`). */
const BRANCH_FILTER_REJECT = /\.\.|@{/

async function endpointLog(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const rawMax = raw?.['maxCommits']
  const maxCommits = typeof rawMax === 'number' && Number.isFinite(rawMax)
    ? Math.min(MAX_COMMITS_LIMIT, Math.max(1, Math.floor(rawMax)))
    : DEFAULT_MAX_COMMITS

  // Branch filter: undefined/null/empty array → all-refs view (existing
  // buildLogArgs); non-empty → the named refs only (single-branch view).
  const rawBranches = raw?.['branches']
  let branches: string[] | undefined
  if (Array.isArray(rawBranches)) {
    if (rawBranches.length > MAX_LOG_BRANCHES) {
      throw new WbError('bad-request', `too many branch filters (max ${MAX_LOG_BRANCHES})`)
    }
    for (const entry of rawBranches) {
      if (typeof entry !== 'string' || !BRANCH_NAME_PATTERN.test(entry) || BRANCH_FILTER_REJECT.test(entry)) {
        throw new WbError('bad-request', `invalid branch name "${String(entry)}"`)
      }
    }
    if (rawBranches.length > 0) branches = rawBranches as string[]
  } else if (rawBranches !== undefined && rawBranches !== null) {
    throw new WbError('bad-request', 'branches must be an array of branch names')
  }
  // showRemote: false drops --remotes from the all-refs view.
  const showRemote = raw?.['showRemote'] !== false

  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  let root: string
  if (repoRoot !== undefined) {
    // repoRoot is the repository root: run git there directly (no upward lookup).
    root = repoRoot
  } else {
    try {
      root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).trim()
    } catch {
      return { isRepo: false, root: null, branch: null, commits: [], more: false, head: null }
    }
  }
  let branch: string | null = null
  try {
    branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  } catch {
    branch = null
  }

  // Empty repo (unborn HEAD): git log exits 128 / show-ref exits 1. Probe
  // first so an empty repo is a normal 200 result instead of a 500. When
  // `--verify HEAD` fails, tell an unborn HEAD (empty repo) apart from a path
  // that is not a work tree at all (reachable only via an explicit repoRoot
  // that is not a repository) — the latter reports isRepo:false instead of
  // masquerading as an empty repo.
  try {
    await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
  } catch {
    let inside = false
    try {
      inside = (await runGit(root, ['rev-parse', '--is-inside-work-tree'])).includes('true')
    } catch {
      inside = false
    }
    if (!inside) {
      return { isRepo: false, root: null, branch: null, commits: [], more: false, head: null }
    }
    return { isRepo: true, root, branch, commits: [], more: false, head: null }
  }

  // N+1 probe: one extra row tells the client whether more commits exist.
  const parsed = parseGitLog(await withGitError('log', () => runGit(root, buildLogArgs(maxCommits + 1, { branches, showRemote }))))
  let more = false
  if (parsed.length > maxCommits) {
    more = true
    parsed.pop()
  }

  const refs = parseShowRef(await withGitError('show-ref', () => runGit(root, buildShowRefArgs())))
  const remoteNames = [...new Set(refs.remotes.map((r) => r.name.split('/')[0]))]
  const commits: GraphCommit[] = parsed.map((commit) => ({
    ...commit,
    heads: refs.heads.filter((h) => h.hash === commit.hash).map((h) => h.name),
    tags: dedupeTags(refs.tags.filter((t) => t.hash === commit.hash).map((t) => ({ name: t.name, annotated: t.annotated }))),
    remotes: refs.remotes.filter((r) => r.hash === commit.hash).map((r) => ({
      name: r.name,
      remote: remoteNames.find((n) => r.name.startsWith(`${n}/`)) ?? null,
    })),
  }))

  const head = refs.head
  if (head !== null && commits.some((c) => c.hash === head)) {
    let uncommitted = 0
    try {
      const statusOut = await runGit(root, ['status', '--porcelain', '--untracked-files=all'])
      uncommitted = statusOut.trim() === '' ? 0 : statusOut.split(/\r\n|\r|\n/g).filter((line) => line !== '').length
    } catch {
      uncommitted = 0
    }
    if (uncommitted > 0) {
      commits.unshift({
        hash: '*',
        parents: [head],
        author: '*',
        email: '',
        date: Math.round(Date.now() / 1000),
        message: `Uncommitted Changes (${uncommitted})`,
        heads: [],
        tags: [],
        remotes: [],
      })
    }
  }

  return { isRepo: true, root, branch, commits, more, head }
}

const MAX_DIFF_CHARS = 512 * 1024
const HASH_PATTERN = /^[0-9a-f]{4,40}$/

async function endpointDetail(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const hash = stringOrUndefined(payload, 'hash')
  if (hash === undefined || !HASH_PATTERN.test(hash)) {
    throw new WbError('bad-request', `invalid commit hash "${hash ?? ''}"`)
  }

  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  let root: string
  if (repoRoot !== undefined) {
    root = repoRoot
  } else {
    try {
      root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).trim()
    } catch (error) {
      throw new WbError('fs-error', `not a git work tree at "${cwd}": ${messageOf(error)}`)
    }
  }

  const meta: CommitDetailMeta = await withGitError('show', async () =>
    parseCommitDetail(await runGit(root, buildDetailArgs(hash))),
  )

  // Root commit (no parents) → diff-tree --root; otherwise diff first-parent..
  const from = meta.parents.length > 0 ? `${hash}^` : hash
  const isRoot = from === hash
  const nameStatusArgs = diffArgs('--name-status', from, hash, isRoot)
  const numStatArgs = diffArgs('--numstat', from, hash, isRoot)
  const [nameStatusOut, numStatOut] = await Promise.all([
    withGitError('diff --name-status', () => runGit(root, nameStatusArgs)),
    withGitError('diff --numstat', () => runGit(root, numStatArgs)),
  ])
  const numStat = new Map(parseNumStat(numStatOut).map((row) => [row.path, row]))
  const files: FileChange[] = parseNameStatus(nameStatusOut).map((change) => {
    const stat = numStat.get(change.path)
    return {
      path: change.path,
      ...(change.oldPath !== undefined ? { oldPath: change.oldPath } : {}),
      status: change.status,
      additions: stat?.additions ?? null,
      deletions: stat?.deletions ?? null,
    }
  })

  const diffOut = await withGitError('show (diff)', () =>
    runGit(root, ['-c', 'log.showSignature=false', 'show', '--format=', '--no-ext-diff', hash]),
  )
  const truncated = diffOut.length > MAX_DIFF_CHARS
  let diff = diffOut
  if (truncated) {
    const cut = diffOut.slice(0, MAX_DIFF_CHARS)
    // Do not split a UTF-16 surrogate pair at the boundary: a trailing HIGH
    // surrogate (0xD800-0xDBFF) means the low half was cut off.
    const last = cut.charCodeAt(cut.length - 1)
    const end = last >= 0xd800 && last <= 0xdbff ? cut.length - 1 : cut.length
    diff = cut.slice(0, end)
  }

  return { meta, files, diff, truncated }
}

/** name-status / numstat args, root-commit variant from the analysis §2.8. */
function diffArgs(arg: string, from: string, to: string, isRoot: boolean): string[] {
  if (isRoot) {
    // --no-commit-id: without it diff-tree emits the commit hash as the
    // first NUL record and the parsers misread it (root-commit detail empty).
    return ['diff-tree', '--no-commit-id', arg, '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', from]
  }
  return ['diff', arg, '--find-renames', '--diff-filter=AMDR', '-z', from, to]
}

// ── Branch / config / remote / ref endpoints ───────────────────────────────

/** Config keys: at least one `section.name` pair (user.name, core.quotepath …). */
const CONFIG_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9.-]*(\.[a-zA-Z][a-zA-Z0-9.-]*)+$/
/** Remote names (git allows [A-Za-z0-9._-]; no '/'). A leading '-' is
 *  rejected because git would parse it as an option. */
const REMOTE_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-]+$/
/** Ref names (branch/tag): safe ASCII subset, no whitespace. A leading '-'
 *  is rejected because git would parse it as an option (e.g. `git branch
 *  --force <name>` / `git checkout --force`). */
const REF_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-/]+$/
/** Git ref-name guard on top of the pattern (spec): no leading/trailing '/',
 *  no '..', no '@{', no whitespace (pattern already excludes whitespace). */
function isValidRefName(name: string): boolean {
  if (!REF_NAME_PATTERN.test(name)) return false
  if (name.startsWith('/') || name.endsWith('/')) return false
  if (name.includes('..') || name.includes('@{')) return false
  return true
}

/** Resolve the work-tree root or throw the detail-style fs-error. */
async function workTreeRootOf(ctx: WbContext, cwd: string): Promise<string> {
  try {
    return (await runGit(cwd, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    throw new WbError('fs-error', `not a git work tree at "${cwd}": ${messageOf(error)}`)
  }
}

/** POST /wb-git/branches { sessionId, showRemote? }
 *  → { branches: {name,current,remote}[], head: string|null } */
async function endpointBranches(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const showRemote = (payload as Record<string, unknown> | null)?.['showRemote'] === true
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  const out = await withGitError('branch', () => runGit(root, buildBranchArgs(showRemote)))
  let head: string | null = null
  try {
    const resolved = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    // Detached HEAD resolves to the literal "HEAD" — there is no branch.
    if (resolved !== 'HEAD') head = resolved
  } catch {
    head = null
  }
  return { branches: parseBranches(out), head }
}

/** POST /wb-git/config { sessionId, key, value? }
 *  read  → { key, value: string|null } (unset key → null)
 *  write → { key, value } */
async function endpointConfig(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const key = raw?.['key']
  if (typeof key !== 'string' || !CONFIG_KEY_PATTERN.test(key)) {
    throw new WbError('bad-request', `invalid config key "${String(key)}"`)
  }
  const rawValue = raw?.['value']
  const hasValue = typeof rawValue === 'string'
  if (hasValue && (rawValue.includes('\n') || rawValue.includes('"') || rawValue.includes("'"))) {
    throw new WbError('bad-request', 'config value must not contain newlines or quotes')
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  // Require a work tree so config always targets the repo-local config:
  // outside a repo `git config` would fall back to the user-global config
  // (a read leak and, on old git, a global write). The session-cwd path gets
  // this from workTreeRootOf below; an explicit repoRoot must pass the same
  // work-tree check here before any git config runs.
  if (repoRoot !== undefined) {
    let inside = false
    try {
      inside = (await runGit(repoRoot, ['rev-parse', '--is-inside-work-tree'])).includes('true')
    } catch {
      inside = false
    }
    if (!inside) {
      throw new WbError('fs-error', `not a git work tree at "${repoRoot}"`)
    }
  }
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  if (hasValue) {
    await withGitError('config (set)', () => runGit(root, buildConfigSetArgs(key, rawValue)))
    return { key, value: rawValue }
  }
  let value: string | null = null
  try {
    const out = (await runGit(root, buildConfigGetArgs(key))).trim()
    if (out !== '') value = out
  } catch {
    // `git config --get` exits 1 with empty output for an unset key; the key
    // pattern and the work-tree check already passed, so treat it as null.
    value = null
  }
  return { key, value }
}

/** POST /wb-git/remote { sessionId, action, name?, url? }
 *  list → { remotes: {name,url}[] }; add/remove/set-url → { action, name } */
async function endpointRemote(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const action = raw?.['action']
  if (typeof action !== 'string' || !['list', 'add', 'remove', 'set-url'].includes(action)) {
    throw new WbError('bad-request', `invalid remote action "${String(action)}"`)
  }
  const name = raw?.['name']
  if (name !== undefined && (typeof name !== 'string' || !REMOTE_NAME_PATTERN.test(name))) {
    throw new WbError('bad-request', `invalid remote name "${String(name)}"`)
  }
  const url = raw?.['url']
  if (url !== undefined && (typeof url !== 'string' || url === '' || url.startsWith('-') || /\s/.test(url))) {
    throw new WbError('bad-request', 'invalid remote url (must not contain whitespace or start with "-")')
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  if (action === 'list') {
    const out = await withGitError('remote', () => runGit(root, buildRemoteListArgs()))
    return { remotes: parseRemotes(out) }
  }
  if (action === 'add') {
    if (name === undefined || url === undefined) {
      throw new WbError('bad-request', 'remote add requires name and url')
    }
    await withGitError('remote add', () => runGit(root, buildRemoteAddArgs(name, url)))
    return { action, name }
  }
  if (action === 'remove') {
    if (name === undefined) throw new WbError('bad-request', 'remote remove requires name')
    await withGitError('remote remove', () => runGit(root, buildRemoteRemoveArgs(name)))
    return { action, name }
  }
  if (name === undefined || url === undefined) {
    throw new WbError('bad-request', 'remote set-url requires name and url')
  }
  await withGitError('remote set-url', () => runGit(root, buildRemoteSetUrlArgs(name, url)))
  return { action, name }
}

/** POST /wb-git/ref { sessionId, action, name?, newName?, hash?, remote? }
 *  Safe branch/tag writes, checkout, and push (push-branch sets the upstream
 *  with -u; push-tag pushes a tag). Every failure → fs-error (stderr in the
 *  message, e.g. a dirty-worktree checkout or an unpushable ref). */
async function endpointRef(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const action = raw?.['action']
  if (typeof action !== 'string' || !['create-branch', 'rename-branch', 'delete-branch', 'create-tag', 'delete-tag', 'checkout', 'push-branch', 'push-tag'].includes(action)) {
    throw new WbError('bad-request', `invalid ref action "${String(action)}"`)
  }
  const name = raw?.['name']
  if (name !== undefined && (typeof name !== 'string' || !isValidRefName(name))) {
    throw new WbError('bad-request', `invalid ref name "${String(name)}"`)
  }
  const newName = raw?.['newName']
  if (newName !== undefined && (typeof newName !== 'string' || !isValidRefName(newName))) {
    throw new WbError('bad-request', `invalid ref name "${String(newName)}"`)
  }
  const hash = raw?.['hash']
  if (hash !== undefined && (typeof hash !== 'string' || !HASH_PATTERN.test(hash))) {
    throw new WbError('bad-request', `invalid commit hash "${String(hash)}"`)
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  if (action === 'create-branch') {
    if (name === undefined || hash === undefined) throw new WbError('bad-request', 'create-branch requires name and hash')
    await withGitError('branch', () => runGit(root, buildCreateBranchArgs(name, hash)))
    return { action, name }
  }
  if (action === 'rename-branch') {
    if (name === undefined || newName === undefined) throw new WbError('bad-request', 'rename-branch requires name and newName')
    await withGitError('branch -m', () => runGit(root, buildRenameBranchArgs(name, newName)))
    return { action, name, newName }
  }
  if (action === 'delete-branch') {
    if (name === undefined) throw new WbError('bad-request', 'delete-branch requires name')
    await withGitError('branch -D', () => runGit(root, buildDeleteBranchArgs(name)))
    return { action, name }
  }
  if (action === 'create-tag') {
    if (name === undefined || hash === undefined) throw new WbError('bad-request', 'create-tag requires name and hash')
    await withGitError('tag', () => runGit(root, buildCreateTagArgs(name, hash)))
    return { action, name }
  }
  if (action === 'delete-tag') {
    if (name === undefined) throw new WbError('bad-request', 'delete-tag requires name')
    await withGitError('tag -d', () => runGit(root, buildDeleteTagArgs(name)))
    return { action, name }
  }
  if (action === 'push-branch') {
    if (name === undefined) throw new WbError('bad-request', 'push-branch requires name')
    const remote = pushRemoteOf(raw)
    // setUpstream defaults to true (the historical -u behavior); only an
    // explicit false skips --set-upstream.
    const setUpstream = raw?.['setUpstream'] !== false
    const mode = pushModeOf(raw)
    await withGitError('push', () => runGit(root, buildPushBranchArgs(remote, name, { setUpstream, mode })))
    return { action, name, remote, setUpstream, mode }
  }
  if (action === 'push-tag') {
    if (name === undefined) throw new WbError('bad-request', 'push-tag requires name')
    const remote = pushRemoteOf(raw)
    await withGitError('push', () => runGit(root, buildPushTagArgs(remote, name)))
    return { action, name, remote }
  }
  // checkout: { hash } → detached, { name } → branch/tag switch.
  const ref = typeof hash === 'string' ? hash : typeof name === 'string' ? name : undefined
  if (ref === undefined) throw new WbError('bad-request', 'checkout requires a hash or a branch name')
  await withGitError('checkout', () => runGit(root, buildCheckoutArgs(ref)))
  return { action, ref }
}

/** Push remote from a payload: defaults to 'origin'; an explicit value must
 *  pass REMOTE_NAME_PATTERN (a leading '-' would be parsed by git as an
 *  option, e.g. `git push --force`). */
function pushRemoteOf(raw: Record<string, unknown> | null): string {
  const remote = raw?.['remote']
  if (remote === undefined) return 'origin'
  if (typeof remote !== 'string' || !REMOTE_NAME_PATTERN.test(remote)) {
    throw new WbError('bad-request', `invalid remote name "${String(remote)}"`)
  }
  return remote
}

/** Push mode from a payload: '' / 'normal' / 'force-with-lease' (anything
 *  else → 400 bad-request). 'normal'/'' omit the force flag; only
 *  'force-with-lease' appends --force-with-lease. */
function pushModeOf(raw: Record<string, unknown> | null): 'normal' | 'force-with-lease' {
  const mode = raw?.['mode']
  if (mode === undefined || mode === '' || mode === 'normal') return 'normal'
  if (mode === 'force-with-lease') return 'force-with-lease'
  throw new WbError('bad-request', `invalid push mode "${String(mode)}"`)
}

// ── Commit working-tree endpoints (VS Code style status/stage/commit) ─────

/** POST /wb-git/status-files { sessionId, repoRoot? }
 *  → { files: StatusFile[] } (working-tree changes; clean worktree → []).
 *  Not a repository → fs-error (workTreeRootOf / the failing git status). */
async function endpointStatusFiles(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  const out = await withGitError('status', () => runGit(root, buildStatusFilesArgs()))
  return { files: parseStatusFiles(out) }
}

/** Relative paths for git add/reset: no leading '-' (git option), no
 *  absolute path, no '..' escape, no control characters/NUL. Spaces and
 *  non-ASCII (e.g. Chinese filenames) are allowed — status-files returns
 *  such paths, so stage must accept them (git add handles them as argv). */
function isValidStagePath(path: string): boolean {
  if (path === '' || path.startsWith('-')) return false
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return false
  if (path.includes('..')) return false
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(path)
}

/** POST /wb-git/stage { sessionId, repoRoot?, action: add|unstage, path?, all? }
 *  add → `git add <path>` (or the whole tree when all / no path);
 *  unstage → `git reset HEAD <path>` (or the whole index when all / no path).
 *  → { action, path: string|null, all: boolean }.
 *  Unstage on an unborn HEAD (empty repo) is a no-op for `git reset HEAD --`
 *  and succeeds; with a path it fails and surfaces as fs-error. */
async function endpointStage(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const action = raw?.['action']
  if (action !== 'add' && action !== 'unstage') {
    throw new WbError('bad-request', `invalid stage action "${String(action)}"`)
  }
  const all = raw?.['all'] === true
  let path: string | undefined
  if (!all) {
    const rawPath = raw?.['path']
    if (typeof rawPath !== 'string' || !isValidStagePath(rawPath)) {
      throw new WbError('bad-request', `invalid stage path "${String(rawPath)}"`)
    }
    path = rawPath
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  if (action === 'add') {
    await withGitError('add', () => runGit(root, buildStageAddArgs(path)))
  } else {
    await withGitError('reset', () => runGit(root, buildStageResetArgs(path)))
  }
  return { action, path: path ?? null, all: all ?? false }
}

const MAX_COMMIT_MESSAGE_LENGTH = 2000

/** POST /wb-git/commit { sessionId, repoRoot?, message }
 *  `git commit -m <message>` (one argv element, no shell: newlines and any
 *  characters are safe; message must be a non-empty string ≤2000 chars).
 *  → { action: 'commit', hash: string|null } (hash read back after commit,
 *  tolerated as null). Nothing staged → git commit fails → fs-error. */
async function endpointCommit(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const message = raw?.['message']
  if (typeof message !== 'string' || message === '' || message.length > MAX_COMMIT_MESSAGE_LENGTH) {
    throw new WbError('bad-request', 'commit message must be a non-empty string (max 2000 chars)')
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  await withGitError('commit', () => runGit(root, buildCommitArgs(message)))
  let hash: string | null = null
  try {
    hash = (await runGit(root, ['rev-parse', 'HEAD'])).trim()
  } catch {
    hash = null
  }
  return { action: 'commit', hash }
}

// ── File-content endpoint (commit detail three-column view) ──────────────────

const MAX_FILE_CONTENT_CHARS = 256 * 1024

/** POST /wb-git/file-content { sessionId, repoRoot?, hash, path, side: 'old'|'new' }
 *  Read a single file's content at a given commit (new side) or its parent
 *  (old side). For the three-column commit detail view (file tree | old | new).
 *  → { content: string, exists: boolean, truncated: boolean, binary: boolean }
 *  - Binary files (containing NUL byte) → content:'', binary:true
 *  - Files > 256KB → truncated, sliced to 256KB (surrogate-safe)
 *  - File/rev not found → exists:false
 *  - Other git errors → fs-error */
async function endpointFileContent(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const hash = stringOrUndefined(raw, 'hash')
  if (hash === undefined || !HASH_PATTERN.test(hash)) {
    throw new WbError('bad-request', `invalid commit hash "${hash ?? ''}"`)
  }
  const filePath = raw?.['path']
  if (typeof filePath !== 'string' || !isValidStagePath(filePath)) {
    throw new WbError('bad-request', `invalid file path "${String(filePath ?? '')}"`)
  }
  const side = raw?.['side']
  if (side !== 'old' && side !== 'new') {
    throw new WbError('bad-request', `invalid side "${String(side ?? '')}", must be 'old' or 'new'`)
  }

  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)

  let rev: string
  if (side === 'old') {
    rev = `${hash}^`
    // Probe parent existence first: root commits have no parent
    try {
      await runGit(root, ['rev-parse', '--verify', `${hash}^`])
    } catch {
      return { content: '', exists: false, truncated: false, binary: false }
    }
  } else {
    rev = hash
  }

  // Run git show <rev>:<path>
  let stdout: string
  try {
    stdout = await runGit(root, buildShowFileArgs(rev, filePath))
  } catch (error) {
    const msg = messageOf(error)
    // File not found or rev not found → exists:false (not fs-error)
    if (
      /does not exist/i.test(msg)
      || /exists on disk, but not in/i.test(msg)
      || /bad revision/i.test(msg)
      || /unknown revision/i.test(msg)
      || /ambiguous argument/i.test(msg)
    ) {
      return { content: '', exists: false, truncated: false, binary: false }
    }
    // Other git errors → fs-error
    throw new WbError('fs-error', `show ${rev}:${filePath} failed: ${msg}`)
  }

  // Binary detection (NUL byte in output)
  if (stdout.includes('\0')) {
    return { content: '', exists: true, truncated: false, binary: true }
  }

  // Truncation at 256KB
  const truncated = stdout.length > MAX_FILE_CONTENT_CHARS
  let content = stdout
  if (truncated) {
    const cut = stdout.slice(0, MAX_FILE_CONTENT_CHARS)
    // Avoid splitting a UTF-16 surrogate pair at the boundary
    const last = cut.charCodeAt(cut.length - 1)
    const end = last >= 0xd800 && last <= 0xdbff ? cut.length - 1 : cut.length
    content = cut.slice(0, end)
  }

  return { content, exists: true, truncated, binary: false }
}

// ── Fetch / pull / fetch-into endpoints ──────────────────────────────────────

/** POST /wb-git/fetch { sessionId, repoRoot?, remote? }
 *  remote null/undefined → `git fetch --all --prune`; otherwise the named
 *  remote (validated via REMOTE_NAME_PATTERN).
 *  → { action:'fetch', remote: string|null } */
async function endpointFetch(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const rawRemote = raw?.['remote']
  let remote: string | null = null
  if (rawRemote !== undefined && rawRemote !== null) {
    if (typeof rawRemote !== 'string' || !REMOTE_NAME_PATTERN.test(rawRemote)) {
      throw new WbError('bad-request', `invalid remote name "${String(rawRemote)}"`)
    }
    remote = rawRemote
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  await withGitError('fetch', () => runGit(root, buildFetchArgs(remote)))
  return { action: 'fetch', remote }
}

/** POST /wb-git/pull { sessionId, repoRoot?, remote, branch }
 *  `git pull <remote> <branch>` (validated remote + branch).
 *  Dirty worktree / merge conflict → fs-error (stderr passed through).
 *  → { action:'pull', remote, branch } */
async function endpointPull(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const remote = raw?.['remote']
  if (typeof remote !== 'string' || !REMOTE_NAME_PATTERN.test(remote)) {
    throw new WbError('bad-request', `invalid remote name "${String(remote)}"`)
  }
  const branch = raw?.['branch']
  if (typeof branch !== 'string' || !isValidRefName(branch)) {
    throw new WbError('bad-request', `invalid branch name "${String(branch)}"`)
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  await withGitError('pull', () => runGit(root, buildPullArgs(remote, branch)))
  return { action: 'pull', remote, branch }
}

/** POST /wb-git/fetch-into { sessionId, repoRoot?, remote, remoteBranch, localBranch }
 *  `git fetch <remote> <remoteBranch>:<localBranch>` (all validated).
 *  → { action:'fetch-into', remote, remoteBranch, localBranch } */
async function endpointFetchInto(ctx: WbContext, payload: unknown): Promise<unknown> {
  const sessionId = stringOrUndefined(payload, 'sessionId')
  const raw = payload as Record<string, unknown> | null
  const remote = raw?.['remote']
  if (typeof remote !== 'string' || !REMOTE_NAME_PATTERN.test(remote)) {
    throw new WbError('bad-request', `invalid remote name "${String(remote)}"`)
  }
  const remoteBranch = raw?.['remoteBranch']
  if (typeof remoteBranch !== 'string' || !isValidRefName(remoteBranch)) {
    throw new WbError('bad-request', `invalid remote branch name "${String(remoteBranch)}"`)
  }
  const localBranch = raw?.['localBranch']
  if (typeof localBranch !== 'string' || !isValidRefName(localBranch)) {
    throw new WbError('bad-request', `invalid local branch name "${String(localBranch)}"`)
  }
  const cwd = sessionCwdOf(ctx, sessionId)
  const repoRoot = await repoRootOf(payload)
  const root = repoRoot ?? await workTreeRootOf(ctx, cwd)
  await withGitError('fetch', () => runGit(root, buildFetchIntoArgs(remote, remoteBranch, localBranch)))
  return { action: 'fetch-into', remote, remoteBranch, localBranch }
}

export function apply(ctx: WbContext): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/wb-git',
    handler: async (req, res) => {
      if (!isTrustedRequest(req, ctx.webRuntime.trustedHosts)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'bad-request', message: 'method not allowed' } })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/wb-git/') ? pathname.slice('/wb-git/'.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, new WbError('not-found', `unknown /wb-git method "${method}"`, 404))
        return
      }
      try {
        const payload = await readJsonBody(req)
        let value: unknown
        if (method === 'status') {
          value = await endpointStatus(ctx, payload)
        } else if (method === 'repos') {
          value = await endpointRepos(ctx, payload)
        } else if (method === 'log') {
          value = await endpointLog(ctx, payload)
        } else if (method === 'detail') {
          value = await endpointDetail(ctx, payload)
        } else if (method === 'branches') {
          value = await endpointBranches(ctx, payload)
        } else if (method === 'config') {
          value = await endpointConfig(ctx, payload)
        } else if (method === 'remote') {
          value = await endpointRemote(ctx, payload)
        } else if (method === 'ref') {
          value = await endpointRef(ctx, payload)
        } else if (method === 'status-files') {
          value = await endpointStatusFiles(ctx, payload)
        } else if (method === 'stage') {
          value = await endpointStage(ctx, payload)
        } else if (method === 'commit') {
          value = await endpointCommit(ctx, payload)
        } else if (method === 'fetch') {
          value = await endpointFetch(ctx, payload)
        } else if (method === 'pull') {
          value = await endpointPull(ctx, payload)
        } else if (method === 'fetch-into') {
          value = await endpointFetchInto(ctx, payload)
        } else if (method === 'file-content') {
          value = await endpointFileContent(ctx, payload)
        } else {
          writeError(res, new WbError('not-found', `unknown /wb-git method "${method}"`, 404))
          return
        }
        writeOk(res, value)
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dock-git: /wb-git routes')
}
