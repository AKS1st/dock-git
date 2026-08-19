#!/usr/bin/env node
/**
 * Host-half smoke test for dock-git: drives the data layer (git-data.ts,
 * re-exported from lib/index.js) AND the /wb-git route layer (apply from
 * lib/index.js with a stubbed ctx) against scratch repos.
 *
 * History under test (deterministic dates so ordering is stable):
 *   c1 (main)          add a.txt            'c1: add a.txt'
 *   c2 (feature, c1)   git mv a.txt b.txt   'c2: rename a.txt to b.txt'   (rename, 0/0)
 *   c3 (feature, c2)   modify b.txt, +extra 'c3: modify b.txt, add extra.txt'
 *   c4 (main, c1)      add c.txt            'c4: add c.txt'
 *   M  (merge feature into main)            'Merge feature branch'         (2 parents)
 *   tag -a v1.0 on M
 *
 * Write-side tests (branches/config/remote/ref + log filters) run on a clone
 * of the smoke repo (smoke-write-repo) so smoke-repo stays pristine:
 *   c5 (feature)       add feat-only.txt    'c5: feature-only commit'   (reachable only from feature)
 *   c6 (ghost, pushed) add ghost.txt        'c6: remote-only commit'    (reachable only from refs/remotes/origin/ghost)
 *
 * Push tests (step 15) run on the same clone against a local bare remote
 * (bare-remote.git, added as remote origin2; origin gets repointed at it to
 * pin the default-remote path without any network).
 *
 * Run after building:
 *   cd /home/zero/AgentX/plugins/dock-git && pnpm run build && node scripts/smoke-host.mjs
 *
 * The scratch repos are intentionally left in place for the coordinator.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Deterministic git error text for stderr-content assertions.
process.env.LC_ALL = 'C'
process.env.LANG = 'C'

import {
  SEP,
  apply,
  runGit,
  parseGitLog,
  parseShowRef,
  parseCommitDetail,
  parseNameStatus,
  parseNumStat,
  buildLogArgs,
  buildPushBranchArgs,
  buildPushTagArgs,
  buildShowRefArgs,
  buildDetailArgs,
  buildBranchArgs,
  buildFetchArgs,
  buildPullArgs,
  buildFetchIntoArgs,
  parseBranches,
  buildStatusFilesArgs,
  parseStatusFiles,
  buildStageAddArgs,
  buildStageResetArgs,
  buildCommitArgs,
  buildShowFileArgs,
  isRepoRoot,
  scanRepos,
  MAX_SCAN_DIRS,
} from '../lib/index.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve('/tmp', 'dock-git-smoke', 'smoke-repo')
const EMPTY_REPO = join(dirname(REPO), 'smoke-empty-repo')
const WRITE_REPO = join(dirname(REPO), 'smoke-write-repo')
const BARE_REMOTE = join(dirname(REPO), 'bare-remote.git')
const NOT_REPO = join(dirname(REPO), 'smoke-not-repo')
const STAGE_REPO = join(dirname(REPO), 'smoke-stage-repo')
const REPOS_ROOT = join(dirname(REPO), 'repos-scan-root')
const REPOS_CAP_ROOT = join(dirname(REPO), 'repos-cap-root')
const FETCH_REPO = join(dirname(REPO), 'smoke-fetch-repo')
const FILE_CONTENT_REPO = join(dirname(REPO), 'smoke-file-content-repo')

let failures = 0
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}${detail !== undefined ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/** Run a git command in a repo (deterministic dates, no shell). Fatal on failure. */
function setupIn(cwd, args, { authorDate, committerDate } = {}) {
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    ...(authorDate ? { GIT_AUTHOR_DATE: authorDate } : {}),
    ...(committerDate ? { GIT_COMMITTER_DATE: committerDate } : {}),
  }
  try {
    execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const stderr = error?.stderr?.toString().trim() || error?.message || String(error)
    console.error(`[FATAL] setup failed: git ${args.join(' ')}\n${stderr}`)
    process.exit(1)
  }
}

/** Setup helper for the base smoke repo. */
function setup(args, options) {
  setupIn(REPO, args, options)
}

/** Setup helper for the write clone (smoke-write-repo). */
function setupW(args, options) {
  setupIn(WRITE_REPO, args, options)
}

/** Init a scratch repo (deterministic identity, optional one commit). */
function initScratchRepo(dir, { message } = {}) {
  mkdirSync(dir, { recursive: true })
  setupIn(dir, ['init', '-b', 'main'])
  setupIn(dir, ['config', 'user.name', 'Smoke Tester'])
  setupIn(dir, ['config', 'user.email', 'smoke@example.com'])
  if (message !== undefined) {
    writeFileSync(join(dir, 'file.txt'), `${message}\n`)
    setupIn(dir, ['add', 'file.txt'])
    setupIn(dir, ['commit', '-m', message], { authorDate: dateAt(30), committerDate: dateAt(30) })
  }
}

/** Deterministic ISO date for one commit minute (0..59). */
function dateAt(minute) {
  return new Date(Date.UTC(2024, 0, 1, 0, minute, 0)).toISOString()
}

// ── Stubs for the route-layer tests ────────────────────────────────────────

function stubRes() {
  const captured = { status: 0, headers: {}, body: '' }
  return {
    captured,
    writeHead(status, headers) {
      captured.status = status
      captured.headers = headers
      return this
    },
    end(body) {
      captured.body = body
    },
  }
}

function stubReq(method, url, body, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]
  let i = 0
  return {
    method,
    url,
    headers: { host: '127.0.0.1', ...headers },
    [Symbol.asyncIterator]() {
      return {
        next: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true }),
      }
    },
  }
}

function stubCtx(cwd) {
  const captured = { handler: null }
  return {
    captured,
    webServer: {
      register(options) {
        captured.handler = options.handler
        return () => {}
      },
    },
    sessions: {
      get() {
        return { header: { cwd } }
      },
    },
    webRuntime: { trustedHosts: [] },
    effect(fn) {
      fn()
    },
  }
}

/** POST one /wb-git method through the real route handler with stubbed ctx. */
async function postWbGit(cwd, url, body) {
  const ctx = stubCtx(cwd)
  apply(ctx)
  const res = stubRes()
  await ctx.captured.handler(stubReq('POST', url, body), res)
  return { status: res.captured.status, json: JSON.parse(res.captured.body) }
}

console.log('== step 1: build scratch repo ==')
rmSync(REPO, { recursive: true, force: true })
mkdirSync(REPO, { recursive: true })
setup(['init', '-b', 'main'])
setup(['config', 'user.name', 'Smoke Tester'])
setup(['config', 'user.email', 'smoke@example.com'])
// c1 (minute 0)
writeFileSync(join(REPO, 'a.txt'), 'one\n')
setup(['add', 'a.txt'])
setup(['commit', '-m', 'c1: add a.txt'], { authorDate: dateAt(0), committerDate: dateAt(0) })
// feature branch, rename commit c2 (minute 1)
setup(['checkout', '-b', 'feature'])
setup(['mv', 'a.txt', 'b.txt'])
setup(['commit', '-m', 'c2: rename a.txt to b.txt'], { authorDate: dateAt(1), committerDate: dateAt(1) })
// feature c3 (minute 2)
writeFileSync(join(REPO, 'b.txt'), 'two\n')
writeFileSync(join(REPO, 'extra.txt'), 'ex\n')
setup(['add', 'b.txt', 'extra.txt'])
setup(['commit', '-m', 'c3: modify b.txt, add extra.txt'], { authorDate: dateAt(2), committerDate: dateAt(2) })
// back to main, c4 (minute 3)
setup(['checkout', 'main'])
writeFileSync(join(REPO, 'c.txt'), 'see\n')
setup(['add', 'c.txt'])
setup(['commit', '-m', 'c4: add c.txt'], { authorDate: dateAt(3), committerDate: dateAt(3) })
// merge feature (minute 4)
setup(['merge', '--no-ff', 'feature', '-m', 'Merge feature branch'], { authorDate: dateAt(4), committerDate: dateAt(4) })
// annotated tag on the merge commit
setup(['tag', '-a', 'v1.0', '-m', 'v1.0 release'])

console.log('== step 2: status layer ==')
try {
  const inside = await runGit(REPO, ['rev-parse', '--is-inside-work-tree'])
  check('status: is-inside-work-tree', inside.includes('true'), inside.trim())
} catch (error) {
  check('status: is-inside-work-tree', false, error.message)
}
try {
  const top = (await runGit(REPO, ['rev-parse', '--show-toplevel'])).trim()
  check('status: show-toplevel', top === REPO, top)
} catch (error) {
  check('status: show-toplevel', false, error.message)
}
try {
  const branch = (await runGit(REPO, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  check('status: abbrev-ref HEAD', branch === 'main', branch)
} catch (error) {
  check('status: abbrev-ref HEAD', false, error.message)
}

console.log('== step 3: log layer ==')
const logOut = await runGit(REPO, buildLogArgs(20))
const commits = parseGitLog(logOut)
check('log: parsed rows', commits.length >= 5, `${commits.length} commits`)
check('log: first commit is the merge (2 parents)', commits.length > 0 && commits[0].parents.length === 2, commits[0]?.parents.join(','))
check('log: first commit subject', commits[0]?.message === 'Merge feature branch', commits[0]?.message ?? 'none')
const subjects = commits.map((c) => c.message)
check(
  'log: c1/c2/c3/c4 present',
  ['c1: add a.txt', 'c2: rename a.txt to b.txt', 'c3: modify b.txt, add extra.txt', 'c4: add c.txt'].every((s) => subjects.includes(s)),
  subjects.join(' | '),
)
check(
  'log: fields complete',
  commits.every((c) => /^[0-9a-f]{40}$/.test(c.hash) && typeof c.author === 'string' && typeof c.email === 'string' && typeof c.date === 'number' && c.message !== ''),
)
const refs = parseShowRef(await runGit(REPO, buildShowRefArgs()))
check('refs: head non-null', refs.head !== null, refs.head ?? 'null')
const headNames = refs.heads.map((h) => h.name)
check('refs: heads contain main & feature', headNames.includes('main') && headNames.includes('feature'), headNames.join(','))
const tagNames = refs.tags.map((t) => t.name)
check('refs: tags contain v1.0', tagNames.includes('v1.0'), tagNames.join(','))
check('refs: v1.0 annotated entry present', refs.tags.some((t) => t.name === 'v1.0' && t.annotated))
check(
  'refs: v1.0 points at merge commit',
  commits[0] !== undefined && refs.tags.some((t) => t.name === 'v1.0' && t.annotated && t.hash === commits[0].hash),
)

console.log('== step 4: detail layer (merge commit) ==')
const mergeHash = commits[0].hash
const meta = parseCommitDetail(await runGit(REPO, buildDetailArgs(mergeHash)))
check('detail: hash matches', meta.hash === mergeHash, `${meta.hash.slice(0, 8)}…`)
check('detail: 2 parents', meta.parents.length === 2, meta.parents.join(','))
check('detail: body first line is subject', meta.body.split('\n')[0] === 'Merge feature branch', meta.body.split('\n')[0])
check(
  'detail: author/committer fields',
  meta.author === 'Smoke Tester' && meta.committer === 'Smoke Tester' && typeof meta.authorDate === 'number' && typeof meta.committerDate === 'number',
  `${meta.author} <${meta.authorEmail}> @${meta.authorDate}`,
)
check('detail: body has no trailing blank line', !meta.body.endsWith('\n'), JSON.stringify(meta.body.slice(-10)))

const from = meta.parents.length > 0 ? `${mergeHash}^` : mergeHash
const mergeNameStatus = parseNameStatus(await runGit(REPO, ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', from, mergeHash]))
check(
  'files: merge name-status has b.txt (A) and extra.txt (A)',
  mergeNameStatus.some((f) => f.path === 'b.txt' && f.status === 'A') && mergeNameStatus.some((f) => f.path === 'extra.txt' && f.status === 'A'),
  mergeNameStatus.map((f) => `${f.status} ${f.path}`).join(', ') || '(empty)',
)
check('files: merge name-status has no ghost rows', mergeNameStatus.every((f) => f.path !== '' && /^[AMDR]$/.test(f.status)))
const mergeNumStat = parseNumStat(await runGit(REPO, ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', from, mergeHash]))
const mergeBStat = mergeNumStat.find((n) => n.path === 'b.txt')
check(
  'files: merge numstat b.txt added 1/0',
  mergeBStat !== undefined && mergeBStat.additions === 1 && mergeBStat.deletions === 0,
  mergeBStat ? `${mergeBStat.additions}/${mergeBStat.deletions}` : 'missing',
)
check('files: merge numstat has no ghost rows', mergeNumStat.every((n) => n.path !== ''))

console.log('== step 5: detail layer (rename commit) ==')
const renameCommit = commits.find((c) => c.message === 'c2: rename a.txt to b.txt')
check('detail: rename commit found in log', renameCommit !== undefined, renameCommit?.hash.slice(0, 8) ?? 'none')
const renameHash = renameCommit.hash
const renameMeta = parseCommitDetail(await runGit(REPO, buildDetailArgs(renameHash)))
check('detail: rename commit has 1 parent', renameMeta.parents.length === 1, renameMeta.parents.join(','))
const renameFrom = `${renameHash}^`
const renameNameStatus = parseNameStatus(await runGit(REPO, ['diff', '--name-status', '--find-renames', '-z', renameFrom, renameHash]))
const renameRow = renameNameStatus.find((f) => f.path === 'b.txt')
check(
  'files: rename name-status is R b.txt (oldPath a.txt)',
  renameRow !== undefined && renameRow.oldPath === 'a.txt' && renameRow.status === 'R',
  renameNameStatus.map((f) => `${f.status} ${f.oldPath ?? ''}->${f.path}`).join(', ') || '(empty)',
)
check('files: rename name-status has exactly one row, no ghosts', renameNameStatus.length === 1 && renameNameStatus[0].path === 'b.txt' && renameNameStatus[0].oldPath === 'a.txt')
const renameNumStat = parseNumStat(await runGit(REPO, ['diff', '--numstat', '--find-renames', '-z', renameFrom, renameHash]))
const renameNumRow = renameNumStat.find((n) => n.path === 'b.txt')
check(
  'files: rename numstat is b.txt 0/0',
  renameNumRow !== undefined && renameNumRow.additions === 0 && renameNumRow.deletions === 0,
  renameNumStat.map((n) => `${n.path}:${n.additions}/${n.deletions}`).join(', ') || '(empty)',
)
check('files: rename numstat has no ghost rows', renameNumStat.every((n) => n.path !== ''))

console.log('== step 6: route layer ==')
// empty repo /log must be a clean 200, not a 500
rmSync(EMPTY_REPO, { recursive: true, force: true })
mkdirSync(EMPTY_REPO, { recursive: true })
for (const args of [['init', '-b', 'main'], ['config', 'user.name', 'Smoke Tester'], ['config', 'user.email', 'smoke@example.com']]) {
  try {
    execFileSync('git', args, { cwd: EMPTY_REPO, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    console.error(`[FATAL] empty-repo setup failed: git ${args.join(' ')}\n${error?.stderr?.toString().trim() || error?.message}`)
    process.exit(1)
  }
}
{
  const { status, json } = await postWbGit(EMPTY_REPO, '/wb-git/log', { sessionId: 's1' })
  const v = json?.value
  check('route: empty repo /log is 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check(
    'route: empty repo /log shape',
    v !== undefined && v.isRepo === true && Array.isArray(v.commits) && v.commits.length === 0 && v.more === false && v.head === null,
    JSON.stringify(v),
  )
}
{
  const { status, json } = await postWbGit(REPO, '/wb-git/detail', { sessionId: 's1', hash: renameHash })
  const files = json?.value?.files
  check('route: rename /detail is 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check(
    'route: rename /detail files contain R b.txt (a.txt) 0/0',
    Array.isArray(files) && files.some((f) => f.path === 'b.txt' && f.oldPath === 'a.txt' && f.status === 'R' && f.additions === 0 && f.deletions === 0),
    JSON.stringify(files),
  )
  check(
    'route: rename /detail has no ghost rows',
    Array.isArray(files) && files.every((f) => f.path !== '' && f.oldPath !== '' && /^[AMDR]$/.test(f.status)),
    JSON.stringify(files),
  )
}
{
  const { status, json } = await postWbGit(REPO, '/wb-git/detail', { sessionId: 's1', hash: 'zzz' })
  check('route: invalid hash is 400 bad-request', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', `status=${status}`)
}

console.log('== step 7: misc ==')
check('SEP exported and non-trivial', typeof SEP === 'string' && SEP.length > 10, `${SEP.slice(0, 8)}…`)

console.log('== step 8: write-repo setup (clone + feature-only / remote-only commits) ==')
rmSync(WRITE_REPO, { recursive: true, force: true })
setupIn(dirname(WRITE_REPO), ['clone', REPO, WRITE_REPO])
setupW(['config', 'user.name', 'Smoke Tester'])
setupW(['config', 'user.email', 'smoke@example.com'])
// c5 on feature (not merged into main): genuinely feature-only
setupW(['checkout', 'feature'])
writeFileSync(join(WRITE_REPO, 'feat-only.txt'), 'feat\n')
setupW(['add', 'feat-only.txt'])
setupW(['commit', '-m', 'c5: feature-only commit'], { authorDate: dateAt(5), committerDate: dateAt(5) })
// c6 on a local branch "ghost" that is then deleted: only refs/remotes/origin/ghost
// points at it, so it is reachable solely via --remotes
setupW(['checkout', '-b', 'ghost'])
writeFileSync(join(WRITE_REPO, 'ghost.txt'), 'ghost\n')
setupW(['add', 'ghost.txt'])
setupW(['commit', '-m', 'c6: remote-only commit'], { authorDate: dateAt(6), committerDate: dateAt(6) })
const c6hash = (await runGit(WRITE_REPO, ['rev-parse', 'HEAD'])).trim()
setupW(['update-ref', 'refs/remotes/origin/ghost', c6hash])
setupW(['checkout', 'main'])
setupW(['branch', '-D', 'ghost'])
// non-repo dir for fs-error route tests
rmSync(NOT_REPO, { recursive: true, force: true })
mkdirSync(NOT_REPO, { recursive: true })
writeFileSync(join(NOT_REPO, 'file.txt'), 'x\n')

console.log('== step 9: branches layer ==')
{
  const branchOut = await runGit(WRITE_REPO, buildBranchArgs(true))
  const parsed = parseBranches(branchOut)
  check(
    'branch: parseBranches main current + feature plain',
    parsed.some((b) => b.name === 'main' && b.current) && parsed.some((b) => b.name === 'feature' && !b.current && !b.remote),
    parsed.map((b) => `${b.current ? '*' : ' '}${b.name}`).join(','),
  )
  check(
    'branch: parseBranches showRemote has remotes/origin/main',
    parsed.some((b) => b.name === 'remotes/origin/main' && b.remote && !b.current),
    parsed.map((b) => `${b.current ? '*' : ' '}${b.name}`).join(','),
  )
  check(
    'branch: parseBranches filters origin/HEAD pointer',
    !parsed.some((b) => b.name === 'remotes/origin/HEAD'),
    parsed.map((b) => `${b.current ? '*' : ' '}${b.name}`).join(','),
  )
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/branches', { sessionId: 's1' })
  const v = json?.value
  check('route: branches default 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check(
    'route: branches contain main & feature',
    Array.isArray(v?.branches) && v.branches.some((b) => b.name === 'main') && v.branches.some((b) => b.name === 'feature'),
    JSON.stringify(v?.branches),
  )
  check('route: branches main is current', Array.isArray(v?.branches) && v.branches.find((b) => b.name === 'main')?.current === true, JSON.stringify(v?.branches))
  check('route: branches default has no remote entries', Array.isArray(v?.branches) && !v.branches.some((b) => b.remote), JSON.stringify(v?.branches))
  check('route: branches head is main', v?.head === 'main', JSON.stringify(v?.head))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/branches', { sessionId: 's1', showRemote: true })
  const v = json?.value
  check(
    'route: branches showRemote includes remotes items',
    Array.isArray(v?.branches) && v.branches.some((b) => b.remote && b.name.startsWith('remotes/')),
    JSON.stringify(v?.branches),
  )
  check('route: branches showRemote filters */HEAD', Array.isArray(v?.branches) && !v.branches.some((b) => b.name.endsWith('/HEAD')), JSON.stringify(v?.branches))
}
{
  const { status, json } = await postWbGit(NOT_REPO, '/wb-git/branches', { sessionId: 's1' })
  check('route: branches non-repo 400 fs-error', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
}

console.log('== step 10: config layer ==')
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'user.name' })
  const v = json?.value
  check('route: config get user.name', status === 200 && json?.ok === true && v?.key === 'user.name' && v?.value === 'Smoke Tester', JSON.stringify(v))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'nonexistent.key' })
  const v = json?.value
  check('route: config unset key → value null', status === 200 && json?.ok === true && v?.key === 'nonexistent.key' && v?.value === null, JSON.stringify(v))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'user.email', value: 'smoke-new@example.com' })
  const v = json?.value
  check('route: config set user.email', status === 200 && json?.ok === true && v?.key === 'user.email' && v?.value === 'smoke-new@example.com', JSON.stringify(v))
  const { status: s2, json: j2 } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'user.email' })
  check('route: config get reflects set value', s2 === 200 && j2?.value?.value === 'smoke-new@example.com', JSON.stringify(j2?.value))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'bad' })
  check('route: config invalid key 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'user.name', value: 'bad\nvalue' })
  check('route: config newline value 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/config', { sessionId: 's1', key: 'user.name', value: 'with "quote"' })
  check('route: config quote value 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(NOT_REPO, '/wb-git/config', { sessionId: 's1', key: 'user.name' })
  check('route: config non-repo 400 fs-error (no global write)', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
}

console.log('== step 11: remote layer ==')
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'list' })
  const remotes = json?.value?.remotes ?? []
  const origin = remotes.find((r) => r.name === 'origin')
  check('route: remote list has origin (deduped)', status === 200 && json?.ok === true && origin !== undefined && origin.url !== '' && remotes.filter((r) => r.name === 'origin').length === 1, JSON.stringify(remotes))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'add', name: 'upstream', url: 'http://example.com/upstream.git' })
  check('route: remote add upstream', status === 200 && json?.ok === true && json?.value?.action === 'add' && json?.value?.name === 'upstream', JSON.stringify(json))
  const { json: j2 } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'list' })
  check('route: remote list includes upstream', (j2?.value?.remotes ?? []).some((r) => r.name === 'upstream' && r.url === 'http://example.com/upstream.git'), JSON.stringify(j2?.value?.remotes))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'set-url', name: 'origin', url: 'http://example.com/changed.git' })
  check('route: remote set-url origin', status === 200 && json?.ok === true && json?.value?.action === 'set-url', JSON.stringify(json))
  const { json: j2 } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'list' })
  const origin = (j2?.value?.remotes ?? []).find((r) => r.name === 'origin')
  check('route: remote origin url changed', origin?.url === 'http://example.com/changed.git', JSON.stringify(origin))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'remove', name: 'upstream' })
  check('route: remote remove upstream', status === 200 && json?.ok === true && json?.value?.action === 'remove', JSON.stringify(json))
  const { json: j2 } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'list' })
  check('route: remote upstream gone', !(j2?.value?.remotes ?? []).some((r) => r.name === 'upstream'), JSON.stringify(j2?.value?.remotes))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'add', name: 'bad name', url: 'http://example.com/x.git' })
  check('route: remote invalid name 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'add', name: 'badurl', url: 'http://exa mple.com/x.git' })
  check('route: remote url with whitespace 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // leading '-' would be parsed by git as an option (e.g. `git remote add -f …`)
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'add', name: '-origin', url: 'http://example.com/x.git' })
  check('route: remote name leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // a url starting with '-' is parsed as an option by `git remote set-url`
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/remote', { sessionId: 's1', action: 'set-url', name: 'origin', url: '--force' })
  check('route: remote url leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}

console.log('== step 12: ref layer ==')
const c1hash = (await runGit(WRITE_REPO, ['rev-list', '--max-parents=0', 'HEAD'])).trim()
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'create-branch', name: 'branch-from-smoke', hash: c1hash })
  check('route: ref create-branch', status === 200 && json?.ok === true && json?.value?.action === 'create-branch' && json?.value?.name === 'branch-from-smoke', JSON.stringify(json))
  const listed = (await runGit(WRITE_REPO, ['branch', '--list', 'branch-from-smoke'])).trim()
  check('git: branch-from-smoke exists', listed.includes('branch-from-smoke'), JSON.stringify(listed))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'rename-branch', name: 'branch-from-smoke', newName: 'branch-renamed' })
  check('route: ref rename-branch', status === 200 && json?.ok === true && json?.value?.action === 'rename-branch' && json?.value?.newName === 'branch-renamed', JSON.stringify(json))
  const oldListed = (await runGit(WRITE_REPO, ['branch', '--list', 'branch-from-smoke'])).trim()
  const newListed = (await runGit(WRITE_REPO, ['branch', '--list', 'branch-renamed'])).trim()
  check('git: rename old gone new exists', oldListed === '' && newListed.includes('branch-renamed'), `old=${JSON.stringify(oldListed)} new=${JSON.stringify(newListed)}`)
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'delete-branch', name: 'branch-renamed' })
  check('route: ref delete-branch', status === 200 && json?.ok === true && json?.value?.action === 'delete-branch', JSON.stringify(json))
  const listed = (await runGit(WRITE_REPO, ['branch', '--list', 'branch-renamed'])).trim()
  check('git: branch-renamed deleted', listed === '', JSON.stringify(listed))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'create-tag', name: 'tag-smoke', hash: c1hash })
  check('route: ref create-tag', status === 200 && json?.ok === true && json?.value?.action === 'create-tag', JSON.stringify(json))
  const listed = (await runGit(WRITE_REPO, ['tag', '--list', 'tag-smoke'])).trim()
  check('git: tag-smoke exists', listed === 'tag-smoke', JSON.stringify(listed))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'delete-tag', name: 'tag-smoke' })
  check('route: ref delete-tag', status === 200 && json?.ok === true && json?.value?.action === 'delete-tag', JSON.stringify(json))
  const listed = (await runGit(WRITE_REPO, ['tag', '--list', 'tag-smoke'])).trim()
  check('git: tag-smoke deleted', listed === '', JSON.stringify(listed))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'checkout', hash: c1hash })
  check('route: ref checkout by hash (detached)', status === 200 && json?.ok === true && json?.value?.ref === c1hash, JSON.stringify(json))
  const head = (await runGit(WRITE_REPO, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  check('git: checkout hash is detached', head === 'HEAD', head)
  const { status: s2, json: j2 } = await postWbGit(WRITE_REPO, '/wb-git/branches', { sessionId: 's1' })
  check('route: branches detached → head null, no current', s2 === 200 && j2?.value?.head === null && !(j2?.value?.branches ?? []).some((b) => b.current), JSON.stringify(j2?.value))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'checkout', name: 'main' })
  check('route: ref checkout by name', status === 200 && json?.ok === true && json?.value?.ref === 'main', JSON.stringify(json))
  const head = (await runGit(WRITE_REPO, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  check('git: checkout main on branch', head === 'main', head)
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'create-branch', name: 'bad..name', hash: c1hash })
  check('route: ref invalid name 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'create-branch', name: 'ok-name', hash: 'zzz' })
  check('route: ref invalid hash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'bogus', name: 'x' })
  check('route: ref invalid action 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // leading '-' would be parsed by git as an option: `git checkout --force`
  // discards uncommitted changes, `git branch --force <hash>` force-creates a
  // branch, `git branch -m side --force` renames the current branch — all 400.
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'checkout', name: '--force' })
  check('route: ref checkout leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'create-branch', name: '--force', hash: c1hash })
  check('route: ref create-branch leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'rename-branch', name: 'branch-from-smoke', newName: '--force' })
  check('route: ref rename newName leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'delete-branch', name: '-side' })
  check('route: ref delete-branch leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'delete-branch', name: 'no-such-branch' })
  check('route: ref delete missing branch fs-error', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'checkout', name: 'main', hash: c1hash })
  check('route: ref checkout name+hash uses hash', status === 200 && json?.ok === true && json?.value?.ref === c1hash, JSON.stringify(json))
  await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'checkout', name: 'main' })
}

console.log('== step 13: log filters ==')
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1', branches: ['main'] })
  const subjects = (json?.value?.commits ?? []).map((c) => c.message)
  check('route: log branches=[main] 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('route: log branches=[main] has main history', subjects.includes('c4: add c.txt') && subjects.includes('c1: add a.txt'), subjects.join(' | '))
  check('route: log branches=[main] excludes c5 (feature-only)', !subjects.includes('c5: feature-only commit'), subjects.join(' | '))
  check('route: log branches=[main] excludes c6 (remote-only)', !subjects.includes('c6: remote-only commit'), subjects.join(' | '))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1' })
  const subjects = (json?.value?.commits ?? []).map((c) => c.message)
  check('route: log default includes c5 and c6', subjects.includes('c5: feature-only commit') && subjects.includes('c6: remote-only commit'), subjects.join(' | '))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1', showRemote: false })
  const subjects = (json?.value?.commits ?? []).map((c) => c.message)
  check('route: log showRemote=false includes c5', subjects.includes('c5: feature-only commit'), subjects.join(' | '))
  check('route: log showRemote=false excludes c6', !subjects.includes('c6: remote-only commit'), subjects.join(' | '))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1', showRemote: true })
  const subjects = (json?.value?.commits ?? []).map((c) => c.message)
  const c6 = (json?.value?.commits ?? []).find((c) => c.message === 'c6: remote-only commit')
  check('route: log showRemote=true includes c6', subjects.includes('c6: remote-only commit'), subjects.join(' | '))
  check(
    'route: log c6 carries origin/ghost remote ref',
    c6 !== undefined && Array.isArray(c6.remotes) && c6.remotes.some((r) => r.name === 'origin/ghost' && r.remote === 'origin'),
    JSON.stringify(c6?.remotes),
  )
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1', branches: ['bad branch'] })
  check('route: log invalid branch filter 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // leading '-' would be parsed by git as an option (`git log --all`), so it
  // must be rejected as a filter value
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1', branches: ['--all'] })
  check('route: log branch filter leading dash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/log', { sessionId: 's1', branches: 'main' })
  check('route: log branches non-array 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}

console.log('== step 14: dirty-worktree checkout ==')
{
  writeFileSync(join(WRITE_REPO, 'c.txt'), 'dirty\n')
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'checkout', name: 'feature' })
  check(
    'route: ref checkout dirty worktree fs-error (stderr passed through)',
    status === 400 && json?.ok === false && json?.error?.code === 'fs-error' && /local changes|overwritten/i.test(json?.error?.message ?? ''),
    JSON.stringify(json?.error),
  )
  setupW(['checkout', '--', 'c.txt'])
}

console.log('== step 15: push layer (local bare remote) ==')
// Fresh bare remote in the scratch area (deterministic; same setupIn helper).
rmSync(BARE_REMOTE, { recursive: true, force: true })
setupIn(dirname(REPO), ['init', '--bare', BARE_REMOTE])
// origin2 points at the bare remote. origin still carries the bogus
// http://example.com/changed.git URL from the remote-layer test above.
setupW(['remote', 'add', 'origin2', BARE_REMOTE])
{
  // pure-layer args (verifies the new exports are wired through lib/index.js)
  check(
    'push: buildPushBranchArgs default (setUpstream)',
    JSON.stringify(buildPushBranchArgs('origin2', 'main')) === JSON.stringify(['push', 'origin2', 'main', '--set-upstream']),
    JSON.stringify(buildPushBranchArgs('origin2', 'main')),
  )
  check(
    'push: buildPushBranchArgs setUpstream=false',
    JSON.stringify(buildPushBranchArgs('origin2', 'main', { setUpstream: false })) === JSON.stringify(['push', 'origin2', 'main']),
    JSON.stringify(buildPushBranchArgs('origin2', 'main', { setUpstream: false })),
  )
  check(
    'push: buildPushBranchArgs force-with-lease',
    JSON.stringify(buildPushBranchArgs('origin2', 'main', { setUpstream: false, mode: 'force-with-lease' })) === JSON.stringify(['push', 'origin2', 'main', '--force-with-lease']),
    JSON.stringify(buildPushBranchArgs('origin2', 'main', { setUpstream: false, mode: 'force-with-lease' })),
  )
  check(
    'push: buildPushBranchArgs setUpstream + force-with-lease',
    JSON.stringify(buildPushBranchArgs('origin2', 'main', { mode: 'force-with-lease' })) === JSON.stringify(['push', 'origin2', 'main', '--set-upstream', '--force-with-lease']),
    JSON.stringify(buildPushBranchArgs('origin2', 'main', { mode: 'force-with-lease' })),
  )
  check(
    'push: buildPushTagArgs',
    JSON.stringify(buildPushTagArgs('origin2', 'v1.0')) === JSON.stringify(['push', 'origin2', 'v1.0']),
    JSON.stringify(buildPushTagArgs('origin2', 'v1.0')),
  )
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'main', remote: 'origin2' })
  check(
    'route: ref push-branch main → origin2',
    status === 200 && json?.ok === true && json?.value?.action === 'push-branch' && json?.value?.name === 'main' && json?.value?.remote === 'origin2',
    JSON.stringify(json),
  )
  const bareBranches = (await runGit(BARE_REMOTE, ['branch'])).trim()
  check('git: bare-remote has main branch', bareBranches.includes('main'), JSON.stringify(bareBranches))
  const upstream = (await runGit(WRITE_REPO, ['rev-parse', '--abbrev-ref', 'main@{upstream}'])).trim()
  check('git: main upstream is origin2/main', upstream === 'origin2/main', JSON.stringify(upstream))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-tag', name: 'v1.0', remote: 'origin2' })
  check(
    'route: ref push-tag v1.0 → origin2',
    status === 200 && json?.ok === true && json?.value?.action === 'push-tag' && json?.value?.name === 'v1.0' && json?.value?.remote === 'origin2',
    JSON.stringify(json),
  )
  const bareTags = (await runGit(BARE_REMOTE, ['tag'])).trim()
  check('git: bare-remote has v1.0 tag', bareTags.includes('v1.0'), JSON.stringify(bareTags))
}
{
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'nonexistent-branch', remote: 'origin2' })
  check('route: ref push-branch missing ref fs-error', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
}
{
  // leading '-' would be parsed by git as an option: `git push -bad` → 400 at
  // ref-name validation (before any git call)
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-tag', name: '-bad', remote: 'origin2' })
  check('route: ref push-tag invalid tag name 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // leading '-' would be parsed by git as an option: `git push -x` → 400 at
  // remote-name validation
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'main', remote: '-x' })
  check('route: ref push-branch invalid remote 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // remote omitted → defaults to 'origin'. Pin it without network: repoint
  // origin (bogus URL from the remote-layer test) at the local bare remote,
  // then push with no remote field.
  setupW(['remote', 'set-url', 'origin', BARE_REMOTE])
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'main' })
  check(
    'route: ref push-branch default remote origin',
    status === 200 && json?.ok === true && json?.value?.action === 'push-branch' && json?.value?.remote === 'origin',
    JSON.stringify(json),
  )
  const upstream = (await runGit(WRITE_REPO, ['rev-parse', '--abbrev-ref', 'main@{upstream}'])).trim()
  check('git: main upstream now origin/main', upstream === 'origin/main', JSON.stringify(upstream))
}
{
  // setUpstream:false + mode:'force-with-lease': a brand-new local branch
  // (no upstream) is pushed without --set-upstream; --force-with-lease is a
  // no-op for a new remote ref.
  setupW(['branch', 'fresh', 'main'])
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'fresh', remote: 'origin2', setUpstream: false, mode: 'force-with-lease' })
  check(
    'route: ref push-branch setUpstream=false + force-with-lease',
    status === 200 && json?.ok === true && json?.value?.action === 'push-branch' && json?.value?.name === 'fresh' && json?.value?.remote === 'origin2' && json?.value?.setUpstream === false && json?.value?.mode === 'force-with-lease',
    JSON.stringify(json),
  )
  const bareBranches = (await runGit(BARE_REMOTE, ['branch'])).trim()
  check('git: bare-remote has fresh branch', bareBranches.includes('fresh'), JSON.stringify(bareBranches))
  let noUpstream = false
  try {
    await runGit(WRITE_REPO, ['rev-parse', '--abbrev-ref', 'fresh@{upstream}'])
  } catch {
    noUpstream = true
  }
  check('git: fresh has no upstream (setUpstream=false)', noUpstream, 'expected @{upstream} to fail')
}
{
  // feature already tracks origin/feature (clone DWIM); pushing it to origin2
  // with setUpstream:false must NOT move the upstream to origin2/feature.
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'feature', remote: 'origin2', setUpstream: false, mode: 'force-with-lease' })
  check(
    'route: ref push-branch feature setUpstream=false (upstream kept)',
    status === 200 && json?.ok === true && json?.value?.setUpstream === false,
    JSON.stringify(json),
  )
  const upstream = (await runGit(WRITE_REPO, ['rev-parse', '--abbrev-ref', 'feature@{upstream}'])).trim()
  check('git: feature upstream unchanged (still origin/feature)', upstream === 'origin/feature', JSON.stringify(upstream))
}
{
  // mode:'normal' + setUpstream:false on main (already on origin2): no-op push.
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'main', remote: 'origin2', setUpstream: false, mode: 'normal' })
  check(
    'route: ref push-branch mode=normal setUpstream=false',
    status === 200 && json?.ok === true && json?.value?.setUpstream === false && json?.value?.mode === 'normal',
    JSON.stringify(json),
  )
}
{
  // no opts → defaults setUpstream=true, mode='normal' echoed back
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'main', remote: 'origin2' })
  check(
    'route: ref push-branch defaults setUpstream=true mode=normal',
    status === 200 && json?.ok === true && json?.value?.setUpstream === true && json?.value?.mode === 'normal',
    JSON.stringify(json),
  )
}
{
  // mode:'bad' is rejected before any git call → 400 bad-request
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/ref', { sessionId: 's1', action: 'push-branch', name: 'main', remote: 'origin2', mode: 'bad' })
  check('route: ref push-branch invalid mode 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}

console.log('== step 16: status-files layer (write-repo) ==')
{
  // clean worktree → []
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const v = json?.value
  check('route: status-files clean worktree → 200 []', status === 200 && json?.ok === true && Array.isArray(v?.files) && v.files.length === 0, JSON.stringify(v))
}
{
  // unstaged modification →  M c.txt
  writeFileSync(join(WRITE_REPO, 'c.txt'), 'status-test\n')
  let files = parseStatusFiles(await runGit(WRITE_REPO, buildStatusFilesArgs()))
  check('status-files: unstaged M parsed', files.some((f) => f.path === 'c.txt' && f.status === 'M' && f.staged === false), JSON.stringify(files))
  const { json } = await postWbGit(WRITE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const routeFiles = json?.value?.files ?? []
  check('route: status-files unstaged M', routeFiles.some((f) => f.path === 'c.txt' && f.status === 'M' && f.staged === false), JSON.stringify(routeFiles))
}
{
  // git add → staged M
  setupW(['add', 'c.txt'])
  const files = parseStatusFiles(await runGit(WRITE_REPO, buildStatusFilesArgs()))
  check('status-files: staged M parsed', files.some((f) => f.path === 'c.txt' && f.status === 'M' && f.staged === true), JSON.stringify(files))
}
{
  // new untracked file → U (?? → U, not staged)
  writeFileSync(join(WRITE_REPO, 'untracked.txt'), 'new\n')
  const files = parseStatusFiles(await runGit(WRITE_REPO, buildStatusFilesArgs()))
  check('status-files: untracked U parsed', files.some((f) => f.path === 'untracked.txt' && f.status === 'U' && f.staged === false), JSON.stringify(files))
}
{
  // deleted file → D (unstaged)
  rmSync(join(WRITE_REPO, 'extra.txt'))
  const files = parseStatusFiles(await runGit(WRITE_REPO, buildStatusFilesArgs()))
  check('status-files: deleted D parsed', files.some((f) => f.path === 'extra.txt' && f.status === 'D' && f.staged === false), JSON.stringify(files))
}
{
  // git mv → rename R, path is the NEW name
  setupW(['mv', 'b.txt', 'renamed.txt'])
  const files = parseStatusFiles(await runGit(WRITE_REPO, buildStatusFilesArgs()))
  check('status-files: rename R parsed (new path)', files.some((f) => f.path === 'renamed.txt' && f.status === 'R' && f.staged === true), JSON.stringify(files))
}
{
  // route layer sees all five constructions; pure parse matches the route
  const { status, json } = await postWbGit(WRITE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = json?.value?.files ?? []
  check(
    'route: status-files all changes',
    status === 200 && json?.ok === true
      && files.some((f) => f.path === 'c.txt' && f.status === 'M' && f.staged === true)
      && files.some((f) => f.path === 'untracked.txt' && f.status === 'U' && f.staged === false)
      && files.some((f) => f.path === 'extra.txt' && f.status === 'D' && f.staged === false)
      && files.some((f) => f.path === 'renamed.txt' && f.status === 'R' && f.staged === true),
    JSON.stringify(files),
  )
  const pure = parseStatusFiles(await runGit(WRITE_REPO, buildStatusFilesArgs()))
  check('route: status-files matches pure parseStatusFiles', JSON.stringify(pure) === JSON.stringify(files), `${pure.length} files`)
}
{
  // empty repo (unborn HEAD, no files) → []
  const { status, json } = await postWbGit(EMPTY_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const v = json?.value
  check('route: status-files empty repo → []', status === 200 && json?.ok === true && Array.isArray(v?.files) && v.files.length === 0, JSON.stringify(v))
}
{
  // non-repo → fs-error
  const { status, json } = await postWbGit(NOT_REPO, '/wb-git/status-files', { sessionId: 's1' })
  check('route: status-files non-repo 400 fs-error', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
}

console.log('== step 17: stage layer (fresh clone) ==')
rmSync(STAGE_REPO, { recursive: true, force: true })
setupIn(dirname(REPO), ['clone', REPO, STAGE_REPO])
setupIn(STAGE_REPO, ['config', 'user.name', 'Smoke Tester'])
setupIn(STAGE_REPO, ['config', 'user.email', 'smoke@example.com'])
writeFileSync(join(STAGE_REPO, 'one.txt'), '1\n')
writeFileSync(join(STAGE_REPO, 'two.txt'), '2\n')
{
  check('stage: buildStatusFilesArgs', JSON.stringify(buildStatusFilesArgs()) === JSON.stringify(['status', '--porcelain', '-z', '--untracked-files=all']), JSON.stringify(buildStatusFilesArgs()))
  check('stage: buildStageAddArgs path', JSON.stringify(buildStageAddArgs('one.txt')) === JSON.stringify(['add', 'one.txt']), JSON.stringify(buildStageAddArgs('one.txt')))
  check('stage: buildStageAddArgs all (-A)', JSON.stringify(buildStageAddArgs()) === JSON.stringify(['add', '-A']), JSON.stringify(buildStageAddArgs()))
  check('stage: buildStageResetArgs path', JSON.stringify(buildStageResetArgs('one.txt')) === JSON.stringify(['reset', 'HEAD', 'one.txt']), JSON.stringify(buildStageResetArgs('one.txt')))
  check('stage: buildStageResetArgs all (--)', JSON.stringify(buildStageResetArgs()) === JSON.stringify(['reset', 'HEAD', '--']), JSON.stringify(buildStageResetArgs()))
  check('stage: buildCommitArgs', JSON.stringify(buildCommitArgs('hi')) === JSON.stringify(['commit', '-m', 'hi']), JSON.stringify(buildCommitArgs('hi')))
}
{
  // add a single file
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', path: 'one.txt' })
  check('route: stage add single file', status === 200 && json?.ok === true && json?.value?.action === 'add' && json?.value?.path === 'one.txt' && json?.value?.all === false, JSON.stringify(json))
  const { json: j2 } = await postWbGit(STAGE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = j2?.value?.files ?? []
  check(
    'route: stage one.txt staged, two.txt not',
    files.some((f) => f.path === 'one.txt' && f.status === 'A' && f.staged === true) && !files.some((f) => f.path === 'two.txt' && f.staged === true),
    JSON.stringify(files),
  )
}
{
  // unstage the single file
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'unstage', path: 'one.txt' })
  check('route: stage unstage single file', status === 200 && json?.ok === true && json?.value?.action === 'unstage' && json?.value?.path === 'one.txt', JSON.stringify(json))
  const { json: j2 } = await postWbGit(STAGE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = j2?.value?.files ?? []
  check('route: stage one.txt unstaged (U)', files.some((f) => f.path === 'one.txt' && f.status === 'U' && f.staged === false), JSON.stringify(files))
}
{
  // add all → both staged
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', all: true })
  check('route: stage add all', status === 200 && json?.ok === true && json?.value?.all === true && json?.value?.path === null, JSON.stringify(json))
  const { json: j2 } = await postWbGit(STAGE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = j2?.value?.files ?? []
  check('route: stage all → both staged', files.filter((f) => f.path === 'one.txt' || f.path === 'two.txt').every((f) => f.staged === true), JSON.stringify(files))
}
{
  // unstage all → none staged
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'unstage', all: true })
  check('route: stage unstage all', status === 200 && json?.ok === true && json?.value?.all === true && json?.value?.path === null, JSON.stringify(json))
  const { json: j2 } = await postWbGit(STAGE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = j2?.value?.files ?? []
  check('route: stage unstage all → none staged', files.filter((f) => f.path === 'one.txt' || f.path === 'two.txt').every((f) => f.staged === false), JSON.stringify(files))
}
{
  // path negative cases → 400 bad-request (option/absolute/'..' escape only;
  // spaces and non-ASCII are VALID paths, tested separately below)
  const badPaths = [
    ['parent-dotdot', '..'],
    ['embedded-dotdot', 'a/../b'],
    ['leading-dash', '-x'],
    ['absolute', '/abs/path'],
  ]
  for (const [label, path] of badPaths) {
    const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', path })
    check(`route: stage invalid path (${label}) 400`, status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
  }
}
{
  // spaces / non-ASCII paths are valid stage inputs (git argv handles them);
  // a nonexistent file with a space fails as fs-error, not bad-request
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', path: 'bad path' })
  check('route: stage space path nonexistent → fs-error (not 400)', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
  writeFileSync(join(STAGE_REPO, 'my file.txt'), 'spaced\n')
  const addRes = await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', path: 'my file.txt' })
  check('route: stage space path exists → 200', addRes.status === 200 && addRes.json?.ok === true, JSON.stringify(addRes.json))
  const after = await postWbGit(STAGE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = after.json?.value?.files ?? []
  check('route: staged space file shows staged', files.some((f) => f.path === 'my file.txt' && f.staged === true), JSON.stringify(files))
  // cleanup so later steps start clean
  await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'unstage', all: true })
}
{
  // unstage on an unborn HEAD (empty repo): `git reset HEAD --` is a no-op
  const { status, json } = await postWbGit(EMPTY_REPO, '/wb-git/stage', { sessionId: 's1', action: 'unstage', all: true })
  check('route: stage unstage on unborn HEAD → 200 no-op', status === 200 && json?.ok === true && json?.value?.all === true, JSON.stringify(json))
}

console.log('== step 18: commit layer ==')
{
  // stage everything, then commit
  await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', all: true })
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/commit', { sessionId: 's1', message: 'test commit' })
  const v = json?.value
  check('route: commit → 200 with 40-hex hash', status === 200 && json?.ok === true && v?.action === 'commit' && typeof v?.hash === 'string' && /^[0-9a-f]{40}$/.test(v.hash), JSON.stringify(v))
  const subject = (await runGit(STAGE_REPO, ['log', '-1', '--format=%s'])).trim()
  check('git: HEAD subject is "test commit"', subject === 'test commit', JSON.stringify(subject))
  const { json: j2 } = await postWbGit(STAGE_REPO, '/wb-git/status-files', { sessionId: 's1' })
  const files = j2?.value?.files ?? []
  check('route: status-files clean after commit', Array.isArray(files) && files.length === 0, JSON.stringify(files))
}
{
  // message validation → 400 bad-request
  const empty = await postWbGit(STAGE_REPO, '/wb-git/commit', { sessionId: 's1', message: '' })
  check('route: commit empty message 400', empty.status === 400 && empty.json?.ok === false && empty.json?.error?.code === 'bad-request', JSON.stringify(empty.json))
  const nonString = await postWbGit(STAGE_REPO, '/wb-git/commit', { sessionId: 's1', message: 123 })
  check('route: commit non-string message 400', nonString.status === 400 && nonString.json?.ok === false && nonString.json?.error?.code === 'bad-request', JSON.stringify(nonString.json))
  const overlong = await postWbGit(STAGE_REPO, '/wb-git/commit', { sessionId: 's1', message: 'x'.repeat(2001) })
  check('route: commit overlong message 400', overlong.status === 400 && overlong.json?.ok === false && overlong.json?.error?.code === 'bad-request', JSON.stringify(overlong.json))
}
{
  // nothing staged → git commit fails → fs-error (stderr passthrough)
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/commit', { sessionId: 's1', message: 'nothing staged' })
  check(
    'route: commit nothing staged fs-error',
    status === 400 && json?.ok === false && json?.error?.code === 'fs-error' && /nothing to commit|无文件要提交/i.test(json?.error?.message ?? ''),
    JSON.stringify(json?.error),
  )
}
{
  // message with newline + Chinese → success, message preserved
  writeFileSync(join(STAGE_REPO, 'cn.txt'), '中\n')
  await postWbGit(STAGE_REPO, '/wb-git/stage', { sessionId: 's1', action: 'add', path: 'cn.txt' })
  const message = '第一行 subject\n第二行 body 中文'
  const { status, json } = await postWbGit(STAGE_REPO, '/wb-git/commit', { sessionId: 's1', message })
  check('route: commit multiline Chinese message', status === 200 && json?.ok === true && typeof json?.value?.hash === 'string' && /^[0-9a-f]{40}$/.test(json?.value?.hash ?? ''), JSON.stringify(json?.value))
  const body = await runGit(STAGE_REPO, ['log', '-1', '--format=%B'])
  check('git: multiline Chinese message preserved', body.includes('第一行 subject') && body.includes('第二行 body 中文') && body.includes('\n'), JSON.stringify(body))
}

console.log('== step 19: repos scan (multi-repo workspace) ==')
rmSync(REPOS_ROOT, { recursive: true, force: true })
const repoA = join(REPOS_ROOT, 'repo-a')
const repoB = join(REPOS_ROOT, 'repo-b')
const repoC = join(REPOS_ROOT, 'sub', 'repo-c')
const nestedParent = join(REPOS_ROOT, 'nested-parent')
const nestedChild = join(nestedParent, 'nested-child')
const hiddenGitrepo = join(REPOS_ROOT, 'hidden', '.gitrepo')
const nmrepo = join(REPOS_ROOT, 'node_modules', 'nmrepo')
const plainDir = join(REPOS_ROOT, 'plain-dir')
initScratchRepo(repoA, { message: 'repo-a: initial commit' })
initScratchRepo(repoB, { message: 'repo-b: initial commit' })
initScratchRepo(repoC, { message: 'repo-c: initial commit' })
initScratchRepo(nestedParent, { message: 'np: initial commit' })
initScratchRepo(nestedChild, { message: 'nc: initial commit' })
initScratchRepo(hiddenGitrepo, { message: 'hidden: initial commit' })
initScratchRepo(nmrepo, { message: 'nm: initial commit' })
mkdirSync(plainDir, { recursive: true })
writeFileSync(join(plainDir, 'file.txt'), 'x\n')
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/repos', { sessionId: 's1' })
  const v = json?.value
  const repos = v?.repos ?? []
  const roots = new Set(repos.map((r) => r.root))
  check('repos: route 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('repos: cwd echoed as scan root', v?.cwd === REPOS_ROOT, JSON.stringify(v?.cwd))
  check('repos: repo-a/repo-b/sub-repo-c found', roots.has(repoA) && roots.has(repoB) && roots.has(repoC), [...roots].join(', '))
  check('repos: nested-parent and nested-child both found', roots.has(nestedParent) && roots.has(nestedChild), [...roots].join(', '))
  check('repos: scan root (non-repo) not listed', !roots.has(REPOS_ROOT), [...roots].join(', '))
  check('repos: hidden .gitrepo skipped', !roots.has(hiddenGitrepo), [...roots].join(', '))
  check('repos: node_modules nmrepo skipped', !roots.has(nmrepo), [...roots].join(', '))
  check('repos: plain-dir not listed', !roots.has(plainDir), [...roots].join(', '))
  check('repos: exactly 5 repos', repos.length === 5, `${repos.length} repos`)
  const depths = repos.map((r) => r.depth)
  const lastD1 = depths.lastIndexOf(1)
  const firstD2 = depths.indexOf(2)
  check('repos: stable depth order (depth 1 before depth 2)', lastD1 !== -1 && (firstD2 === -1 || lastD1 < firstD2), depths.join(','))
  const byRoot = new Map(repos.map((r) => [r.root, r]))
  check(
    'repos: names are basenames',
    byRoot.get(repoA)?.name === 'repo-a' && byRoot.get(repoC)?.name === 'repo-c' && byRoot.get(nestedChild)?.name === 'nested-child',
    JSON.stringify(repos.map((r) => r.name)),
  )
  // pure-layer check: direct scanRepos matches the route result
  const direct = await scanRepos(REPOS_ROOT, runGit)
  check('repos: direct scanRepos matches route', JSON.stringify(direct) === JSON.stringify(repos), `${direct.length} vs ${repos.length}`)
  check('repos: isRepoRoot true for repo-a', await isRepoRoot(repoA, runGit))
  check('repos: isRepoRoot false for plain-dir', !(await isRepoRoot(plainDir, runGit)))
}
{
  // cwd inside a repo → depth 0 root is the toplevel (may be an ancestor)
  const repoADocs = join(repoA, 'docs')
  mkdirSync(repoADocs, { recursive: true })
  const { json } = await postWbGit(repoADocs, '/wb-git/repos', { sessionId: 's1' })
  const repos = json?.value?.repos ?? []
  check(
    'repos: cwd inside repo-a subdir → depth0 root is repo-a',
    repos.length === 1 && repos[0].root === repoA && repos[0].depth === 0 && repos[0].name === 'repo-a',
    JSON.stringify(repos),
  )
}
{
  // cwd = a repo root with no child repos → exactly that repo at depth 0
  const { json } = await postWbGit(repoA, '/wb-git/repos', { sessionId: 's1' })
  const repos = json?.value?.repos ?? []
  check('repos: cwd=repo-a → only repo-a (depth 0)', repos.length === 1 && repos[0].root === repoA && repos[0].depth === 0, JSON.stringify(repos))
}

console.log('== step 20: repos scan layer cap ==')
rmSync(REPOS_CAP_ROOT, { recursive: true, force: true })
initScratchRepo(join(REPOS_CAP_ROOT, 'cap-a'), { message: 'cap-a: initial' })
const capMany = join(REPOS_CAP_ROOT, 'many')
mkdirSync(capMany, { recursive: true })
for (let i = 0; i < MAX_SCAN_DIRS + 1; i++) {
  const dir = join(capMany, `r${String(i).padStart(3, '0')}`)
  mkdirSync(dir, { recursive: true })
  setupIn(dir, ['init', '-b', 'main'])
}
initScratchRepo(join(REPOS_CAP_ROOT, 'cap-z'), { message: 'cap-z: initial' })
{
  const { status, json } = await postWbGit(REPOS_CAP_ROOT, '/wb-git/repos', { sessionId: 's1' })
  const repos = json?.value?.repos ?? []
  const manyRepos = repos.filter((r) => r.root.startsWith(capMany) && r.depth === 2)
  check('repos: layer cap truncates many/* at MAX_SCAN_DIRS', status === 200 && manyRepos.length === MAX_SCAN_DIRS, `${manyRepos.length} of ${MAX_SCAN_DIRS + 1} many/* repos`)
  check(
    'repos: cap keeps depth-1 repos around the capped layer',
    repos.some((r) => r.root === join(REPOS_CAP_ROOT, 'cap-a')) && repos.some((r) => r.root === join(REPOS_CAP_ROOT, 'cap-z')),
    JSON.stringify(repos.map((r) => r.name)),
  )
  check('repos: cap total = 2 depth-1 + MAX_SCAN_DIRS depth-2', repos.length === 2 + MAX_SCAN_DIRS, `${repos.length} repos`)
}

console.log('== step 21: repoRoot parameter ==')
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/log', { sessionId: 's1', repoRoot: repoA })
  const v = json?.value
  const subjects = (v?.commits ?? []).map((c) => c.message)
  check('repoRoot: log repo-a 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('repoRoot: log repo-a root===repoRoot', v?.isRepo === true && v?.root === repoA, JSON.stringify(v?.root))
  check('repoRoot: log repo-a returns repo-a commit only', subjects.includes('repo-a: initial commit') && !subjects.includes('repo-b: initial commit'), subjects.join(' | '))
}
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/log', { sessionId: 's1', repoRoot: repoB })
  const subjects = (json?.value?.commits ?? []).map((c) => c.message)
  check('repoRoot: log repo-b returns repo-b commit only', status === 200 && subjects.includes('repo-b: initial commit') && !subjects.includes('repo-a: initial commit'), subjects.join(' | '))
}
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/status', { sessionId: 's1', repoRoot: repoA })
  const v = json?.value
  check('repoRoot: status repo-a root===repoRoot, cwd===repoRoot', status === 200 && v?.isRepo === true && v?.root === repoA && v?.cwd === repoA, JSON.stringify(v))
  check('repoRoot: status repo-a branch main', v?.branch === 'main', JSON.stringify(v?.branch))
}
{
  // branches skips the workTreeRootOf lookup when repoRoot is provided
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/branches', { sessionId: 's1', repoRoot: repoB })
  const v = json?.value
  check(
    'repoRoot: branches repo-b has current main',
    status === 200 && Array.isArray(v?.branches) && v?.branches.some((b) => b.name === 'main' && b.current) && v?.head === 'main',
    JSON.stringify(v),
  )
}
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/log', { sessionId: 's1', repoRoot: '/nonexistent/repo-root' })
  check('repoRoot: nonexistent path 400 bad-request', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/log', { sessionId: 's1', repoRoot: 'relative/path' })
  check('repoRoot: relative path 400 bad-request', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/log', { sessionId: 's1', repoRoot: join(repoA, 'file.txt') })
  check('repoRoot: file (not a dir) 400 bad-request', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // config must not fall back to the user-global config outside a work tree
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/config', { sessionId: 's1', key: 'user.name', repoRoot: plainDir })
  check('repoRoot: config non-repo dir 400 fs-error (no global fallback)', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json))
}
{
  // log with a non-repo repoRoot reports isRepo:false, not an empty repo
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/log', { sessionId: 's1', repoRoot: plainDir })
  const v = json?.value
  check('repoRoot: log non-repo dir isRepo:false', status === 200 && v?.isRepo === false && v?.root === null && Array.isArray(v?.commits) && v?.commits.length === 0, JSON.stringify(v))
}
{
  // positive config read through repoRoot (work-tree guard passes)
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/config', { sessionId: 's1', key: 'user.name', repoRoot: repoA })
  const v = json?.value
  check('repoRoot: config read repo-a user.name', status === 200 && json?.ok === true && v?.key === 'user.name' && v?.value === 'Smoke Tester', JSON.stringify(v))
}
{
  // status-files honours repoRoot (repo-a is a clean scratch repo → [])
  const { status, json } = await postWbGit(REPOS_ROOT, '/wb-git/status-files', { sessionId: 's1', repoRoot: repoA })
  const v = json?.value
  check('repoRoot: status-files repo-a → []', status === 200 && json?.ok === true && Array.isArray(v?.files) && v.files.length === 0, JSON.stringify(v))
  // commit via repoRoot works too (repo-a already has identity + one commit)
  writeFileSync(join(repoA, 'extra.txt'), 'extra\n')
  await postWbGit(REPOS_ROOT, '/wb-git/stage', { sessionId: 's1', action: 'add', path: 'extra.txt', repoRoot: repoA })
  const commitRes = await postWbGit(REPOS_ROOT, '/wb-git/commit', { sessionId: 's1', message: 'repoRoot commit', repoRoot: repoA })
  check('repoRoot: commit via repoRoot', commitRes.status === 200 && commitRes.json?.ok === true && typeof commitRes.json?.value?.hash === 'string', JSON.stringify(commitRes.json))
}

console.log('== step 22: fetch / pull / fetch-into layer (local bare remote) ==')
// Fresh clone of write-repo for fetch tests (does not pollute the main write-repo).
rmSync(FETCH_REPO, { recursive: true, force: true })
setupIn(dirname(REPO), ['clone', WRITE_REPO, FETCH_REPO])
setupIn(FETCH_REPO, ['config', 'user.name', 'Smoke Tester'])
setupIn(FETCH_REPO, ['config', 'user.email', 'smoke@example.com'])
// Point origin at the bare remote (same as write-repo's origin after step 15).
setupIn(FETCH_REPO, ['remote', 'set-url', 'origin', BARE_REMOTE])
// Add origin2 pointing at the bare remote.
setupIn(FETCH_REPO, ['remote', 'add', 'origin2', BARE_REMOTE])
// Ensure the bare remote has a feature branch pushed (from step 15 write-repo
// pushed main/fresh/feature via origin2, and origin via set-url).
// The bare remote already has: main, feature, fresh branches from step 15.
{
  // Pure-layer build* args
  check(
    'fetch: buildFetchArgs null (--all --prune)',
    JSON.stringify(buildFetchArgs(null)) === JSON.stringify(['fetch', '--all', '--prune']),
    JSON.stringify(buildFetchArgs(null)),
  )
  check(
    'fetch: buildFetchArgs named remote',
    JSON.stringify(buildFetchArgs('origin2')) === JSON.stringify(['fetch', 'origin2', '--prune']),
    JSON.stringify(buildFetchArgs('origin2')),
  )
  check(
    'pull: buildPullArgs',
    JSON.stringify(buildPullArgs('origin2', 'main')) === JSON.stringify(['pull', 'origin2', 'main']),
    JSON.stringify(buildPullArgs('origin2', 'main')),
  )
  check(
    'fetch-into: buildFetchIntoArgs',
    JSON.stringify(buildFetchIntoArgs('origin2', 'main', 'local-branch')) === JSON.stringify(['fetch', 'origin2', 'main:local-branch']),
    JSON.stringify(buildFetchIntoArgs('origin2', 'main', 'local-branch')),
  )
}
{
  // Add a new commit on a new branch in the bare remote directly.
  setupIn(BARE_REMOTE, ['branch', 'fetch-test', 'main'])
  // The bare remote now has a fetch-test branch that FETCH_REPO doesn't know about.
  // fetch { } → --all --prune → should see the new remote-tracking branch.
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch', { sessionId: 's1' })
  check('route: fetch --all --prune 200 ok', status === 200 && json?.ok === true && json?.value?.action === 'fetch' && json?.value?.remote === null, JSON.stringify(json))
  const remoteBranches = (await runGit(FETCH_REPO, ['branch', '-r'])).trim()
  check('git: fetch --all brings in fetch-test remote-tracking branch', remoteBranches.includes('origin2/fetch-test'), JSON.stringify(remoteBranches))
}
{
  // Add another commit on main in the bare remote so FETCH_REPO is behind.
  const bareMainHash = (await runGit(BARE_REMOTE, ['rev-parse', 'main'])).trim()
  // Make a new commit in the bare remote on main via a temp clone.
  const TEMP_CLONE = join(dirname(REPO), 'smoke-fetch-temp')
  rmSync(TEMP_CLONE, { recursive: true, force: true })
  setupIn(dirname(REPO), ['clone', BARE_REMOTE, TEMP_CLONE])
  setupIn(TEMP_CLONE, ['config', 'user.name', 'Smoke Tester'])
  setupIn(TEMP_CLONE, ['config', 'user.email', 'smoke@example.com'])
  // Ensure main is checked out (clone from bare may land on a different branch)
  setupIn(TEMP_CLONE, ['checkout', 'main'])
  writeFileSync(join(TEMP_CLONE, 'fetch-test-file.txt'), 'new content\n')
  setupIn(TEMP_CLONE, ['add', 'fetch-test-file.txt'])
  setupIn(TEMP_CLONE, ['commit', '-m', 'fetch-test: new commit on main'], { authorDate: dateAt(50), committerDate: dateAt(50) })
  setupIn(TEMP_CLONE, ['push', 'origin', 'main'])
  rmSync(TEMP_CLONE, { recursive: true, force: true })

  // fetch { remote: origin2 } → named remote fetch
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch', { sessionId: 's1', remote: 'origin2' })
  check('route: fetch origin2 200 ok', status === 200 && json?.ok === true && json?.value?.action === 'fetch' && json?.value?.remote === 'origin2', JSON.stringify(json))
  // Verify FETCH_REPO now sees the new commit on origin2/main.
  const localMainHash = (await runGit(FETCH_REPO, ['rev-parse', 'main'])).trim()
  const remoteMainHash = (await runGit(FETCH_REPO, ['rev-parse', 'origin2/main'])).trim()
  check('git: fetch origin2 updated remote-tracking branch', remoteMainHash !== bareMainHash, `${bareMainHash.slice(0, 8)} → ${remoteMainHash.slice(0, 8)}`)
  check('git: local main still behind (not fast-forwarded)', localMainHash === bareMainHash, `${localMainHash.slice(0, 8)} vs ${bareMainHash.slice(0, 8)}`)

  // pull { remote: origin2, branch: main } → fast-forward local main
  const { status: pullStatus, json: pullJson } = await postWbGit(FETCH_REPO, '/wb-git/pull', { sessionId: 's1', remote: 'origin2', branch: 'main' })
  check('route: pull origin2 main 200 ok', pullStatus === 200 && pullJson?.ok === true && pullJson?.value?.action === 'pull' && pullJson?.value?.remote === 'origin2' && pullJson?.value?.branch === 'main', JSON.stringify(pullJson))
  const pulledMainHash = (await runGit(FETCH_REPO, ['rev-parse', 'main'])).trim()
  check('git: pull fast-forwarded main to origin2/main', pulledMainHash === remoteMainHash, `${pulledMainHash.slice(0, 8)} vs ${remoteMainHash.slice(0, 8)}`)
}
{
  // pull with invalid branch → 400 bad-request
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/pull', { sessionId: 's1', remote: 'origin2', branch: '-x' })
  check('route: pull invalid branch 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // pull with invalid remote → 400 bad-request
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/pull', { sessionId: 's1', remote: '-x', branch: 'main' })
  check('route: pull invalid remote 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // pull with dirty worktree (conflicting change) → fs-error
  writeFileSync(join(FETCH_REPO, 'fetch-test-file.txt'), 'local dirty change\n')
  // Create another commit in the bare remote that changes the same file
  const TEMP_CLONE2 = join(dirname(REPO), 'smoke-fetch-temp2')
  rmSync(TEMP_CLONE2, { recursive: true, force: true })
  setupIn(dirname(REPO), ['clone', BARE_REMOTE, TEMP_CLONE2])
  setupIn(TEMP_CLONE2, ['config', 'user.name', 'Smoke Tester'])
  setupIn(TEMP_CLONE2, ['config', 'user.email', 'smoke@example.com'])
  setupIn(TEMP_CLONE2, ['checkout', 'main'])
  writeFileSync(join(TEMP_CLONE2, 'fetch-test-file.txt'), 'remote conflicting change\n')
  setupIn(TEMP_CLONE2, ['add', 'fetch-test-file.txt'])
  setupIn(TEMP_CLONE2, ['commit', '-m', 'conflicting remote commit'], { authorDate: dateAt(51), committerDate: dateAt(51) })
  setupIn(TEMP_CLONE2, ['push', 'origin', 'main'])
  rmSync(TEMP_CLONE2, { recursive: true, force: true })
  // Fetch first to update remote-tracking ref
  await postWbGit(FETCH_REPO, '/wb-git/fetch', { sessionId: 's1', remote: 'origin2' })
  // Now pull → conflict/dirty worktree → fs-error
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/pull', { sessionId: 's1', remote: 'origin2', branch: 'main' })
  check('route: pull dirty worktree → fs-error', status === 400 && json?.ok === false && json?.error?.code === 'fs-error', JSON.stringify(json?.error))
  // Reset the dirty change so later tests work cleanly
  setupIn(FETCH_REPO, ['checkout', '--', 'fetch-test-file.txt'])
  // Now pull should succeed (fast-forward)
  const { status: s2, json: j2 } = await postWbGit(FETCH_REPO, '/wb-git/pull', { sessionId: 's1', remote: 'origin2', branch: 'main' })
  check('route: pull after reset succeeds', s2 === 200 && j2?.ok === true, JSON.stringify(j2))
}
{
  // fetch-into { remote: origin2, remoteBranch: main, localBranch: fetchinto-test }
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch-into', { sessionId: 's1', remote: 'origin2', remoteBranch: 'main', localBranch: 'fetchinto-test' })
  check('route: fetch-into 200 ok', status === 200 && json?.ok === true && json?.value?.action === 'fetch-into' && json?.value?.remote === 'origin2' && json?.value?.remoteBranch === 'main' && json?.value?.localBranch === 'fetchinto-test', JSON.stringify(json))
  const branchList = (await runGit(FETCH_REPO, ['branch', '--list', 'fetchinto-test'])).trim()
  check('git: fetchinto-test branch exists', branchList.includes('fetchinto-test'), JSON.stringify(branchList))
  const localHash = (await runGit(FETCH_REPO, ['rev-parse', 'fetchinto-test'])).trim()
  const remoteHash = (await runGit(FETCH_REPO, ['rev-parse', 'origin2/main'])).trim()
  check('git: fetchinto-test points at origin2/main HEAD', localHash === remoteHash, `${localHash.slice(0, 8)} vs ${remoteHash.slice(0, 8)}`)
}
{
  // fetch-into invalid localBranch → 400
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch-into', { sessionId: 's1', remote: 'origin2', remoteBranch: 'main', localBranch: '-bad' })
  check('route: fetch-into invalid localBranch 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // fetch-into invalid remoteBranch → 400
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch-into', { sessionId: 's1', remote: 'origin2', remoteBranch: '-bad', localBranch: 'ok' })
  check('route: fetch-into invalid remoteBranch 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // fetch-into invalid remote → 400
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch-into', { sessionId: 's1', remote: '-x', remoteBranch: 'main', localBranch: 'ok' })
  check('route: fetch-into invalid remote 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // fetch invalid remote → 400
  const { status, json } = await postWbGit(FETCH_REPO, '/wb-git/fetch', { sessionId: 's1', remote: '-x' })
  check('route: fetch invalid remote 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}

console.log('== step 23: file-content endpoint (dedicated repo) ==')
// Set up a small repo with commits that exercise modified/added/deleted/root paths.
rmSync(FILE_CONTENT_REPO, { recursive: true, force: true })
mkdirSync(FILE_CONTENT_REPO, { recursive: true })
setupIn(FILE_CONTENT_REPO, ['init', '-b', 'main'])
setupIn(FILE_CONTENT_REPO, ['config', 'user.name', 'Smoke Tester'])
setupIn(FILE_CONTENT_REPO, ['config', 'user.email', 'smoke@example.com'])
// c0 (root commit): add hello.txt
writeFileSync(join(FILE_CONTENT_REPO, 'hello.txt'), 'hello world\n')
setupIn(FILE_CONTENT_REPO, ['add', 'hello.txt'])
setupIn(FILE_CONTENT_REPO, ['commit', '-m', 'c0: add hello.txt'], { authorDate: dateAt(70), committerDate: dateAt(70) })
const fc0hash = (await runGit(FILE_CONTENT_REPO, ['rev-parse', 'HEAD'])).trim()
// fc1: modify hello.txt, add new.txt
writeFileSync(join(FILE_CONTENT_REPO, 'hello.txt'), 'hello updated\n')
writeFileSync(join(FILE_CONTENT_REPO, 'new.txt'), 'new file\n')
setupIn(FILE_CONTENT_REPO, ['add', 'hello.txt', 'new.txt'])
setupIn(FILE_CONTENT_REPO, ['commit', '-m', 'c1: modify hello.txt, add new.txt'], { authorDate: dateAt(71), committerDate: dateAt(71) })
const fc1hash = (await runGit(FILE_CONTENT_REPO, ['rev-parse', 'HEAD'])).trim()
// fc2: delete hello.txt
rmSync(join(FILE_CONTENT_REPO, 'hello.txt'))
setupIn(FILE_CONTENT_REPO, ['add', 'hello.txt'])
setupIn(FILE_CONTENT_REPO, ['commit', '-m', 'c2: delete hello.txt'], { authorDate: dateAt(72), committerDate: dateAt(72) })
const fc2hash = (await runGit(FILE_CONTENT_REPO, ['rev-parse', 'HEAD'])).trim()
{
  // Pure-layer: buildShowFileArgs
  check(
    'file-content: buildShowFileArgs',
    JSON.stringify(buildShowFileArgs('abc123', 'path/to/file.txt')) === JSON.stringify(['show', 'abc123:path/to/file.txt']),
    JSON.stringify(buildShowFileArgs('abc123', 'path/to/file.txt')),
  )
}
{
  // Modified file: c1 hello.txt — new side has updated content, old side has original
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'hello.txt', side: 'new' })
  const v = json?.value
  check('route: file-content modified new 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('route: file-content modified new content', v?.content === 'hello updated\n' && v?.exists === true && v?.truncated === false && v?.binary === false, JSON.stringify(v))
}
{
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'hello.txt', side: 'old' })
  const v = json?.value
  check('route: file-content modified old 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('route: file-content modified old content', v?.content === 'hello world\n' && v?.exists === true && v?.truncated === false && v?.binary === false, JSON.stringify(v))
}
{
  // Added file: c1 new.txt — new side has content, old side doesn't exist
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'new.txt', side: 'new' })
  const v = json?.value
  check('route: file-content added new 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('route: file-content added new content', v?.content === 'new file\n' && v?.exists === true, JSON.stringify(v))
}
{
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'new.txt', side: 'old' })
  const v = json?.value
  check('route: file-content added old exists:false', status === 200 && json?.ok === true && v?.exists === false && v?.content === '' && v?.truncated === false && v?.binary === false, JSON.stringify(v))
}
{
  // Deleted file: c2 hello.txt — new side doesn't exist, old side has content
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc2hash, path: 'hello.txt', side: 'new' })
  const v = json?.value
  check('route: file-content deleted new exists:false', status === 200 && json?.ok === true && v?.exists === false && v?.content === '' && v?.truncated === false && v?.binary === false, JSON.stringify(v))
}
{
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc2hash, path: 'hello.txt', side: 'old' })
  const v = json?.value
  check('route: file-content deleted old 200 ok', status === 200 && json?.ok === true, `status=${status}`)
  check('route: file-content deleted old content', v?.content === 'hello updated\n' && v?.exists === true && v?.truncated === false && v?.binary === false, JSON.stringify(v))
}
{
  // Root commit (no parent): old side → exists:false
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc0hash, path: 'hello.txt', side: 'new' })
  const v = json?.value
  check('route: file-content root commit new content', v?.content === 'hello world\n' && v?.exists === true && v?.truncated === false && v?.binary === false, JSON.stringify(v))
}
{
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc0hash, path: 'hello.txt', side: 'old' })
  const v = json?.value
  check('route: file-content root commit old exists:false', status === 200 && json?.ok === true && v?.exists === false && v?.content === '' && v?.truncated === false && v?.binary === false, JSON.stringify(v))
  // Root-commit detail must list the added file (regression: diff-tree --root
  // used to emit the commit hash first and the parsers returned []).
  const { json: dRoot } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/detail', { sessionId: 's1', hash: fc0hash })
  const rootFiles = dRoot?.value?.files ?? []
  check('route: detail root commit lists added file (A hello.txt)', Array.isArray(rootFiles) && rootFiles.some((f) => f.path === 'hello.txt' && f.status === 'A'), JSON.stringify(rootFiles))
}
{
  // Negative: invalid hash → 400
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: 'zzz', path: 'hello.txt', side: 'new' })
  check('route: file-content invalid hash 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // Negative: invalid path '..' → 400
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: '..', side: 'new' })
  check('route: file-content invalid path (..) 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // Negative: invalid path '-x' → 400
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: '-x', side: 'new' })
  check('route: file-content invalid path (-x) 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // Negative: absolute path → 400
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: '/abs/path', side: 'new' })
  check('route: file-content invalid path (absolute) 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // Negative: invalid side → 400
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'hello.txt', side: 'other' })
  check('route: file-content invalid side 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // Negative: missing side → 400
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'hello.txt' })
  check('route: file-content missing side 400', status === 400 && json?.ok === false && json?.error?.code === 'bad-request', JSON.stringify(json))
}
{
  // Binary file: commit a file with NUL bytes → binary:true, content:''
  writeFileSync(join(FILE_CONTENT_REPO, 'binary.bin'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0x1a, 0x0a]))
  setupIn(FILE_CONTENT_REPO, ['add', 'binary.bin'])
  setupIn(FILE_CONTENT_REPO, ['commit', '-m', 'c3: add binary file'], { authorDate: dateAt(73), committerDate: dateAt(73) })
  const fc3hash = (await runGit(FILE_CONTENT_REPO, ['rev-parse', 'HEAD'])).trim()
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc3hash, path: 'binary.bin', side: 'new' })
  const v = json?.value
  check('route: file-content binary file', status === 200 && json?.ok === true && v?.exists === true && v?.binary === true && v?.content === '' && v?.truncated === false, JSON.stringify(v))
}
{
  // Large file truncation: commit a file > 256KB
  const bigContent = 'x'.repeat(256 * 1024 + 100)
  writeFileSync(join(FILE_CONTENT_REPO, 'bigfile.txt'), bigContent)
  setupIn(FILE_CONTENT_REPO, ['add', 'bigfile.txt'])
  setupIn(FILE_CONTENT_REPO, ['commit', '-m', 'c4: add big file'], { authorDate: dateAt(74), committerDate: dateAt(74) })
  const fc4hash = (await runGit(FILE_CONTENT_REPO, ['rev-parse', 'HEAD'])).trim()
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc4hash, path: 'bigfile.txt', side: 'new' })
  const v = json?.value
  check('route: file-content large file truncated', status === 200 && json?.ok === true && v?.exists === true && v?.truncated === true && v?.binary === false && typeof v?.content === 'string' && v.content.length <= 256 * 1024, `length=${v?.content?.length} truncated=${v?.truncated}`)
  check('route: file-content large file content is prefix', v?.content === bigContent.slice(0, v.content.length), `content length=${v?.content?.length}`)
}
{
  // Space and non-ASCII (Chinese) path support — same validation as isValidStagePath
  writeFileSync(join(FILE_CONTENT_REPO, '中文 文件.txt'), 'chinese content\n')
  setupIn(FILE_CONTENT_REPO, ['add', '中文 文件.txt'])
  setupIn(FILE_CONTENT_REPO, ['commit', '-m', 'c5: add Chinese filename'], { authorDate: dateAt(75), committerDate: dateAt(75) })
  const fc5hash = (await runGit(FILE_CONTENT_REPO, ['rev-parse', 'HEAD'])).trim()
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc5hash, path: '中文 文件.txt', side: 'new' })
  const v = json?.value
  check('route: file-content Chinese+space path 200 ok', status === 200 && json?.ok === true && v?.content === 'chinese content\n' && v?.exists === true, JSON.stringify(v))
}
{
  // Non-existent file at a valid commit → exists:false
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: fc1hash, path: 'no-such-file.txt', side: 'new' })
  const v = json?.value
  check('route: file-content non-existent file exists:false', status === 200 && json?.ok === true && v?.exists === false && v?.content === '', JSON.stringify(v))
}
{
  // Non-existent commit hash (valid hex format, but doesn't exist) → exists:false (git show fails with bad revision)
  const { status, json } = await postWbGit(FILE_CONTENT_REPO, '/wb-git/file-content', { sessionId: 's1', hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', path: 'hello.txt', side: 'new' })
  const v = json?.value
  check('route: file-content non-existent commit exists:false', status === 200 && json?.ok === true && v?.exists === false, JSON.stringify(v))
}

console.log(`\nscratch repos left at: ${REPO}, ${EMPTY_REPO}, ${WRITE_REPO}, ${BARE_REMOTE}, ${NOT_REPO}, ${STAGE_REPO}, ${REPOS_ROOT} and ${REPOS_CAP_ROOT}`)
if (failures > 0) {
  console.log(`SMOKE FAILED: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('SMOKE PASSED: all checks passed')
