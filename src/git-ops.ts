/**
 * Pure git command layer for dock-git (host half): knows how to invoke the
 * git executable and how to turn its stdout into the typed records the host
 * API (`src/index.ts`) and the host smoke script consume.
 *
 * The module is split into three kinds of functions, all synchronous in shape
 * and async in execution:
 *   - `runGit(cwd, args)` — the single executor: spawns `git` directly with
 *     the argument vector (never a shell string), sanitised environment, and
 *     rejects with git's own stderr text on failure;
 *   - the `build*Args` argument builders — return the argument vector for one
 *     git sub-command so that its stdout is exactly what the matching parser
 *     consumes (builder and parser are inverses);
 *   - the `parse*` parsers — pure string → data functions that rely on the
 *     machine-readable output modes the builders request (NUL-delimited
 *     wherever paths are involved), never on human-readable columns.
 *
 * No side effects other than running git; no imports from the plugin's other
 * modules besides the shared data types (`src/types.ts`).
 */
import { spawn } from 'node:child_process'
import type {
  BranchRow,
  CommitDetailMeta,
  GitLogCommit,
  NameStatusRow,
  NumStatRow,
  RemoteRow,
  ShowRefResult,
  StatusFile,
} from './types.ts'

/**
 * Field separator for the machine-readable log/detail records. A single long,
 * randomly-looking token: it cannot occur inside ordinary git output, and the
 * smoke script asserts it is longer than 10 characters. The log/detail
 * builders and their matching parsers must agree on this exact constant.
 */
export const SEP = 'dock-git-7f3c9a2e-4b81-4d6e-9a51-2c8f0d7b3e6a'

/** `git log` record layout: hash, parents, author, email, date, subject. */
const LOG_FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%s'].join(SEP)

/** `git show --no-patch` record layout: hash, parents, author, committer, body. */
const DETAIL_FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%cn', '%ce', '%ct', '%B'].join(SEP)

/**
 * Execute `git` with `args` in `cwd` and resolve with the complete stdout as
 * a UTF-8 string (no trimming).
 *
 * - the executable is spawned directly with the argument vector — the command
 *   line is never composed or interpreted as a shell string;
 * - the child environment is sanitised: ambient GIT_DIR / GIT_WORK_TREE are
 *   removed (outer settings cannot redirect the repository) and a fixed C
 *   locale is forced so stdout/stderr text is deterministic; all other
 *   environment entries pass through;
 * - on any non-zero exit the promise rejects with an `Error` whose message is
 *   git's own output text (stderr, falling back to stdout when stderr is
 *   empty — the host matches substrings of it, e.g. "nothing to commit",
 *   "does not exist", "bad revision", "ambiguous argument"); the error also
 *   carries the stderr text, the exit code and the full stdout as properties,
 *   and the partial stdout is never swallowed.
 * - `maxBytes` (optional) is a streaming output cap: once accumulated stdout
 *   exceeds it the child is killed and the promise rejects with a dedicated
 *   "output exceeds N bytes" error, so a pathological command (a commit that
 *   adds a multi-GB file, a giant status listing) can never OOM the host
 *   process. Post-hoc truncation in callers still applies within the cap.
 */
export function runGit(cwd: string, args: string[], maxBytes?: number): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  env.LC_ALL = 'C'
  env.LC_MESSAGES = 'C'
  env.LANG = 'C'

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let overflow = false
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      if (maxBytes !== undefined && stdout.length + chunk.length > maxBytes) {
        overflow = true
        child.kill('SIGKILL')
        return
      }
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code: number | null) => {
      if (overflow) {
        reject(new Error(`git output exceeds ${maxBytes} bytes`))
        return
      }
      if (code === 0) {
        resolve(stdout)
        return
      }
      // The message carries git's own output so the host can match substrings
      // of it ("nothing to commit", "does not exist", "bad revision" …).
      // Most failures write to stderr; a few (e.g. `git commit` with nothing
      // staged) exit non-zero with the message on stdout instead, so fall back
      // to stdout when stderr is empty. Both are also attached as properties.
      const text = stderr !== '' ? stderr : stdout
      const error = new Error(text !== '' ? text : `git exited with code ${code}`) as Error & {
        stderr: string
        exitCode: number | null
        stdout: string
      }
      error.stderr = stderr
      error.exitCode = code
      error.stdout = stdout
      reject(error)
    })
  })
}

// ── Log / refs / detail ─────────────────────────────────────────────────────

/** Options of `buildLogArgs` controlling which refs the log covers. */
export interface LogOptions {
  /** Non-empty: only commits reachable from these refs (single-branch view). */
  branches?: string[]
  /** False: exclude remote-tracking refs from the all-refs view. */
  showRemote?: boolean
}

/**
 * Argument vector for the log command. At most `maxCount` commit records may
 * appear in the output (the caller passes maxCount + 1 for a probe row and
 * truncates itself). Without a branch filter the output covers all refs
 * (`--all`), or all refs except remote-tracking ones when `showRemote` is
 * false; with a filter it covers only the named refs.
 */
export function buildLogArgs(maxCount: number, options?: LogOptions): string[] {
  const args = ['log', `--max-count=${maxCount}`, `--format=${LOG_FORMAT}`, '--date-order']
  const branches = options?.branches
  if (branches !== undefined && branches.length > 0) {
    args.push(...branches)
  } else if (options?.showRemote === false) {
    args.push('--branches', '--tags', 'HEAD')
  } else {
    args.push('--all')
  }
  return args
}

/** Argument vector for `git show-ref -d --head` (peeled tags + HEAD included). */
export function buildShowRefArgs(): string[] {
  return ['show-ref', '-d', '--head']
}

/**
 * Argument vector for the single-commit metadata command. Works for merge
 * commits (multiple parents), root commits (no parents) and ordinary commits;
 * `--no-patch` suppresses the diff so the record is exactly the format line.
 */
export function buildDetailArgs(hash: string): string[] {
  return ['show', '--no-patch', `--format=${DETAIL_FORMAT}`, hash]
}

/** Pinned by the smoke script: `git show <rev>:<path>`. */
export function buildShowFileArgs(rev: string, path: string): string[] {
  return ['show', `${rev}:${path}`]
}

// ── Branches / config / remotes ─────────────────────────────────────────────

/**
 * Argument vector for the branch-listing command. `showRemote` controls
 * whether remote-tracking branches appear: `--all` lists local branches plus
 * remote-tracking refs (prefixed `remotes/<remote>/<branch>`), while the plain
 * listing shows local branches only.
 */
export function buildBranchArgs(showRemote: boolean): string[] {
  return showRemote ? ['branch', '--no-color', '--all'] : ['branch', '--no-color']
}

/** Read one configuration key; an unset key exits non-zero with empty stdout. */
export function buildConfigGetArgs(key: string): string[] {
  return ['config', '--get', key]
}

/** Write one configuration key to the repository-local configuration. */
export function buildConfigSetArgs(key: string, value: string): string[] {
  return ['config', key, value]
}

/** List every remote together with its URL (`git remote -v`). */
export function buildRemoteListArgs(): string[] {
  return ['remote', '-v']
}

/** Add a remote. */
export function buildRemoteAddArgs(name: string, url: string): string[] {
  return ['remote', 'add', name, url]
}

/** Remove a remote. */
export function buildRemoteRemoveArgs(name: string): string[] {
  return ['remote', 'remove', name]
}

/** Change a remote's URL. */
export function buildRemoteSetUrlArgs(name: string, url: string): string[] {
  return ['remote', 'set-url', name, url]
}

// ── Ref writes (branch / tag / checkout) ────────────────────────────────────

/** Create a branch named `name` at commit `hash`. */
export function buildCreateBranchArgs(name: string, hash: string): string[] {
  return ['branch', name, hash]
}

/** Rename branch `name` to `newName`. */
export function buildRenameBranchArgs(name: string, newName: string): string[] {
  return ['branch', '-m', name, newName]
}

/** Force-delete branch `name`. */
export function buildDeleteBranchArgs(name: string): string[] {
  return ['branch', '-D', name]
}

/** Create a plain (non-annotated) tag named `name` at commit `hash`. */
export function buildCreateTagArgs(name: string, hash: string): string[] {
  return ['tag', name, hash]
}

/** Delete tag `name`. */
export function buildDeleteTagArgs(name: string): string[] {
  return ['tag', '-d', name]
}

/** Switch to `ref` (a commit hash for a detached checkout, or a branch/tag name). */
export function buildCheckoutArgs(ref: string): string[] {
  return ['checkout', ref]
}

/**
 * Switch to a branch or tag by name with `git switch`. Unlike `checkout`,
 * `switch` never falls back to path semantics: a name that matches a tracked
 * file (e.g. `src/index.ts`) cannot silently restore that file from the
 * index and destroy working-tree changes. Callers must pass only refs that
 * have been validated (REF_NAME_PATTERN) and, for safety, resolve to an
 * existing branch/tag before calling.
 */
export function buildSwitchArgs(ref: string): string[] {
  return ['switch', ref]
}

/** Detached switch to a commit hash (never path semantics). */
export function buildSwitchDetachArgs(hash: string): string[] {
  return ['switch', '--detach', hash]
}

// ── Fetch / pull / fetch-into (pinned by the smoke script) ─────────────────

/** Fetch all remotes (`--all --prune`) or one named remote (`--prune`). */
export function buildFetchArgs(remote: string | null): string[] {
  return remote === null ? ['fetch', '--all', '--prune'] : ['fetch', remote, '--prune']
}

/** Pull `remote`/`branch` into the current branch. */
export function buildPullArgs(remote: string, branch: string): string[] {
  return ['pull', remote, branch]
}

/** Fetch one remote branch into a local branch (`remoteBranch:localBranch`). */
export function buildFetchIntoArgs(remote: string, remoteBranch: string, localBranch: string): string[] {
  return ['fetch', remote, `${remoteBranch}:${localBranch}`]
}

// ── Push (pinned by the smoke script) ───────────────────────────────────────

/** Options of `buildPushBranchArgs` controlling upstream tracking and force. */
export interface PushBranchOptions {
  /** Append `--set-upstream`; defaults to true, false omits it. */
  setUpstream?: boolean
  /** `'force-with-lease'` appends `--force-with-lease`; `'normal'` appends nothing. */
  mode?: 'normal' | 'force-with-lease'
}

/** Push one branch; the upstream flag precedes the force flag when both are present. */
export function buildPushBranchArgs(remote: string, name: string, options?: PushBranchOptions): string[] {
  const args = ['push', remote, name]
  if (options?.setUpstream !== false) args.push('--set-upstream')
  if (options?.mode === 'force-with-lease') args.push('--force-with-lease')
  return args
}

/** Push one tag. */
export function buildPushTagArgs(remote: string, name: string): string[] {
  return ['push', remote, name]
}

// ── Status / stage / commit (pinned by the smoke script) ───────────────────

/** Working-tree status, porcelain v1, NUL-delimited, untracked files included. */
export function buildStatusFilesArgs(): string[] {
  return ['status', '--porcelain', '-z', '--untracked-files=all']
}

/** Stage one path, or the whole tree (`-A`) when no path is given. */
export function buildStageAddArgs(path?: string): string[] {
  return path === undefined ? ['add', '-A'] : ['add', path]
}

/** Unstage one path, or the whole index (`--`) when no path is given. */
export function buildStageResetArgs(path?: string): string[] {
  return path === undefined ? ['reset', 'HEAD', '--'] : ['reset', 'HEAD', path]
}

/**
 * Commit with `message` as one argument vector element (newlines stay safe).
 * `--no-verify` skips pre-commit/commit-msg hooks: the /wb-git API is
 * browser-trust fenced, so hooks are not run on its behalf (a malicious
 * config value or a repo with hostile hooks must not execute on commit).
 */
export function buildCommitArgs(message: string): string[] {
  return ['commit', '--no-verify', '-m', message]
}

// ── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse `git log` output (one record per line, fields joined by SEP). Trailing
 * newlines and separators are tolerated; no empty or partial records are
 * emitted. A subject is the last field, so a separator appearing inside it
 * (astronomically unlikely by construction) is re-joined rather than dropped.
 */
export function parseGitLog(stdout: string): GitLogCommit[] {
  const commits: GitLogCommit[] = []
  for (const line of stdout.split(/\r\n|\r|\n/g)) {
    if (line === '') continue
    const parts = line.split(SEP)
    if (parts.length < 6) continue
    commits.push({
      hash: parts[0],
      parents: parts[1] === '' ? [] : parts[1].split(' '),
      author: parts[2],
      email: parts[3],
      date: Number(parts[4]),
      message: parts.slice(5).join(SEP),
    })
  }
  return commits
}

/**
 * Parse `git show-ref -d --head` output. For an annotated tag the peeled
 * entry (`refs/tags/<name>^{}`) appears as an entry with the same name, the
 * commit hash and `annotated: true`; the consumer dedupes by name preferring
 * the annotated entry.
 */
export function parseShowRef(stdout: string): ShowRefResult {
  const result: ShowRefResult = { head: null, heads: [], tags: [], remotes: [] }
  for (const line of stdout.split(/\r\n|\r|\n/g)) {
    if (line === '') continue
    const space = line.indexOf(' ')
    if (space <= 0) continue
    const hash = line.slice(0, space)
    const ref = line.slice(space + 1).trim()
    if (ref === 'HEAD') {
      result.head = hash
    } else if (ref.startsWith('refs/heads/')) {
      result.heads.push({ hash, name: ref.slice('refs/heads/'.length) })
    } else if (ref.startsWith('refs/tags/')) {
      const name = ref.slice('refs/tags/'.length)
      if (name.endsWith('^{}')) {
        result.tags.push({ hash, name: name.slice(0, -3), annotated: true })
      } else {
        result.tags.push({ hash, name, annotated: false })
      }
    } else if (ref.startsWith('refs/remotes/')) {
      result.remotes.push({ hash, name: ref.slice('refs/remotes/'.length) })
    }
  }
  return result
}

/**
 * Parse `git show --no-patch` output (one record, fields joined by SEP, the
 * body last). The body may contain newlines, so the record is split on SEP
 * only (never on newlines); exactly one trailing newline is trimmed.
 */
export function parseCommitDetail(stdout: string): CommitDetailMeta {
  const parts = stdout.split(SEP)
  if (parts.length < 9) {
    throw new Error('unexpected git show output: expected 9 fields')
  }
  return {
    hash: parts[0],
    parents: parts[1] === '' ? [] : parts[1].split(' '),
    author: parts[2],
    authorEmail: parts[3],
    authorDate: Number(parts[4]),
    committer: parts[5],
    committerEmail: parts[6],
    committerDate: Number(parts[7]),
    // `%B` ends with the message's own newline and `--format` appends one
    // more; the spec demands no trailing newline, so strip them all.
    body: parts.slice(8).join(SEP).replace(/\r?\n+$/, ''),
  }
}

/**
 * Parse NUL-delimited `git diff --name-status -z` output. Rename/copy rows
 * carry a similarity-suffixed status code (e.g. R100) followed by the old
 * path and the new path; the status letter is the first character.
 */
export function parseNameStatus(stdout: string): NameStatusRow[] {
  const rows: NameStatusRow[] = []
  const tokens = stdout.split('\0')
  let i = 0
  while (i < tokens.length) {
    const code = tokens[i]
    i += 1
    if (code === '') continue
    const status = code[0]
    if (status === 'R' || status === 'C') {
      const oldPath = tokens[i]
      i += 1
      const path = tokens[i]
      i += 1
      if (path === undefined || path === '') continue
      rows.push({ path, status, oldPath })
    } else {
      const path = tokens[i]
      i += 1
      if (path === undefined || path === '') continue
      rows.push({ path, status })
    }
  }
  return rows
}

/**
 * Parse NUL-delimited `git diff --numstat -z` output. Binary rows report a
 * dash instead of the counts (parsed as null). A rename/copy row has an empty
 * path field followed by two NUL-terminated paths (old, new); the row's path
 * is the new path, so the host can join name-status and numstat by path.
 */
export function parseNumStat(stdout: string): NumStatRow[] {
  const rows: NumStatRow[] = []
  const tokens = stdout.split('\0')
  let i = 0
  while (i < tokens.length) {
    const record = tokens[i]
    i += 1
    if (record === '') continue
    const tab1 = record.indexOf('\t')
    if (tab1 < 0) continue
    const tab2 = record.indexOf('\t', tab1 + 1)
    if (tab2 < 0) continue
    const additions = record.slice(0, tab1)
    const deletions = record.slice(tab1 + 1, tab2)
    let path = record.slice(tab2 + 1)
    if (path === '') {
      // Rename/copy: empty path field, then old path, then new path.
      const oldPath = tokens[i]
      i += 1
      const newPath = tokens[i]
      i += 1
      if (newPath === undefined) continue
      path = newPath
      if (path === '') continue
    }
    if (path === '') continue
    rows.push({
      path,
      additions: additions === '-' ? null : Number(additions),
      deletions: deletions === '-' ? null : Number(deletions),
    })
  }
  return rows
}

/**
 * Parse `git branch --no-color[ --all]` output. The checked-out branch
 * carries a leading `*`; remote-tracking entries keep the `remotes/` prefix
 * and expose the remote name (the first path segment). Non-branch lines are
 * skipped: the detached-HEAD pseudo-entry (`(HEAD detached at …)`), the
 * synthetic `remotes/<remote>/HEAD` pointer (plain or `-> origin/main`
 * symbolic form), and anything with a `->` arrow.
 */
export function parseBranches(stdout: string): BranchRow[] {
  const rows: BranchRow[] = []
  for (const line of stdout.split(/\r\n|\r|\n/g)) {
    if (line === '') continue
    const trimmed = line.replace(/^\s+/, '')
    const current = trimmed.startsWith('*')
    const name = (current ? trimmed.slice(1) : trimmed).trim()
    if (name === '') continue
    if (name.startsWith('(') || name.startsWith('（')) continue
    if (name.includes('->')) continue
    if (name.startsWith('remotes/') && name.endsWith('/HEAD')) continue
    const remote = name.startsWith('remotes/') ? name.slice('remotes/'.length).split('/')[0] : null
    rows.push({ name, current, remote })
  }
  return rows
}

/**
 * Parse `git remote -v` output. `git remote -v` prints one fetch line and one
 * push line per remote; they collapse into one row and the fetch URL wins.
 */
export function parseRemotes(stdout: string): RemoteRow[] {
  const byName = new Map<string, string>()
  for (const line of stdout.split(/\r\n|\r|\n/g)) {
    if (line === '') continue
    const tab = line.indexOf('\t')
    if (tab <= 0) continue
    const name = line.slice(0, tab)
    const rest = line.slice(tab + 1)
    if (rest.endsWith(' (fetch)')) {
      byName.set(name, rest.slice(0, -' (fetch)'.length))
    } else if (rest.endsWith(' (push)')) {
      if (!byName.has(name)) byName.set(name, rest.slice(0, -' (push)'.length))
    }
  }
  return [...byName].map(([name, url]) => ({ name, url }))
}

/**
 * Parse `git status --porcelain -z` output: one record per working-tree
 * change, `<XY><space><path>` NUL-terminated (renames: `<XY><space><new>` NUL
 * `<old>` NUL). The index letter (X) decides the staged flag; the status
 * letter is the index side for staged changes and the worktree side
 * otherwise; `??` (untracked) maps to status `U`/staged false.
 */
export function parseStatusFiles(stdout: string): StatusFile[] {
  const files: StatusFile[] = []
  const tokens = stdout.split('\0')
  let i = 0
  while (i < tokens.length) {
    const record = tokens[i]
    i += 1
    if (record === '') continue
    const x = record[0]
    const y = record[1]
    const path = record.slice(3)
    if (path === '') continue
    if (x === '?' && y === '?') {
      files.push({ path, status: 'U', staged: false })
      continue
    }
    let oldPath: string | undefined
    if (x === 'R' || x === 'C') {
      const old = tokens[i]
      i += 1
      if (old !== undefined) oldPath = old
    }
    const staged = x !== ' '
    const status = staged ? x : y
    const file: StatusFile = { path, status, staged }
    if (oldPath !== undefined) file.oldPath = oldPath
    files.push(file)
  }
  return files
}
