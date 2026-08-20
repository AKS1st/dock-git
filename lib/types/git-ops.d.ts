import type { BranchRow, CommitDetailMeta, GitLogCommit, NameStatusRow, NumStatRow, RemoteRow, ShowRefResult, StatusFile } from './types.ts';
/**
 * Field separator for the machine-readable log/detail records. A single long,
 * randomly-looking token: it cannot occur inside ordinary git output, and the
 * smoke script asserts it is longer than 10 characters. The log/detail
 * builders and their matching parsers must agree on this exact constant.
 */
export declare const SEP = "dock-git-7f3c9a2e-4b81-4d6e-9a51-2c8f0d7b3e6a";
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
export declare function runGit(cwd: string, args: string[], maxBytes?: number): Promise<string>;
/** Options of `buildLogArgs` controlling which refs the log covers. */
export interface LogOptions {
    /** Non-empty: only commits reachable from these refs (single-branch view). */
    branches?: string[];
    /** False: exclude remote-tracking refs from the all-refs view. */
    showRemote?: boolean;
}
/**
 * Argument vector for the log command. At most `maxCount` commit records may
 * appear in the output (the caller passes maxCount + 1 for a probe row and
 * truncates itself). Without a branch filter the output covers all refs
 * (`--all`), or all refs except remote-tracking ones when `showRemote` is
 * false; with a filter it covers only the named refs.
 */
export declare function buildLogArgs(maxCount: number, options?: LogOptions): string[];
/** Argument vector for `git show-ref -d --head` (peeled tags + HEAD included). */
export declare function buildShowRefArgs(): string[];
/**
 * Argument vector for the single-commit metadata command. Works for merge
 * commits (multiple parents), root commits (no parents) and ordinary commits;
 * `--no-patch` suppresses the diff so the record is exactly the format line.
 */
export declare function buildDetailArgs(hash: string): string[];
/** Pinned by the smoke script: `git show <rev>:<path>`. */
export declare function buildShowFileArgs(rev: string, path: string): string[];
/**
 * Argument vector for the branch-listing command. `showRemote` controls
 * whether remote-tracking branches appear: `--all` lists local branches plus
 * remote-tracking refs (prefixed `remotes/<remote>/<branch>`), while the plain
 * listing shows local branches only.
 */
export declare function buildBranchArgs(showRemote: boolean): string[];
/** Read one configuration key; an unset key exits non-zero with empty stdout. */
export declare function buildConfigGetArgs(key: string): string[];
/** Write one configuration key to the repository-local configuration. */
export declare function buildConfigSetArgs(key: string, value: string): string[];
/** List every remote together with its URL (`git remote -v`). */
export declare function buildRemoteListArgs(): string[];
/** Add a remote. */
export declare function buildRemoteAddArgs(name: string, url: string): string[];
/** Remove a remote. */
export declare function buildRemoteRemoveArgs(name: string): string[];
/** Change a remote's URL. */
export declare function buildRemoteSetUrlArgs(name: string, url: string): string[];
/** Create a branch named `name` at commit `hash`. */
export declare function buildCreateBranchArgs(name: string, hash: string): string[];
/** Rename branch `name` to `newName`. */
export declare function buildRenameBranchArgs(name: string, newName: string): string[];
/** Force-delete branch `name`. */
export declare function buildDeleteBranchArgs(name: string): string[];
/** Create a plain (non-annotated) tag named `name` at commit `hash`. */
export declare function buildCreateTagArgs(name: string, hash: string): string[];
/** Delete tag `name`. */
export declare function buildDeleteTagArgs(name: string): string[];
/** Switch to `ref` (a commit hash for a detached checkout, or a branch/tag name). */
export declare function buildCheckoutArgs(ref: string): string[];
/**
 * Switch to a branch or tag by name with `git switch`. Unlike `checkout`,
 * `switch` never falls back to path semantics: a name that matches a tracked
 * file (e.g. `src/index.ts`) cannot silently restore that file from the
 * index and destroy working-tree changes. Callers must pass only refs that
 * have been validated (REF_NAME_PATTERN) and, for safety, resolve to an
 * existing branch/tag before calling.
 */
export declare function buildSwitchArgs(ref: string): string[];
/** Detached switch to a commit hash (never path semantics). */
export declare function buildSwitchDetachArgs(hash: string): string[];
/** Fetch all remotes (`--all --prune`) or one named remote (`--prune`). */
export declare function buildFetchArgs(remote: string | null): string[];
/** Pull `remote`/`branch` into the current branch. */
export declare function buildPullArgs(remote: string, branch: string): string[];
/** Fetch one remote branch into a local branch (`remoteBranch:localBranch`). */
export declare function buildFetchIntoArgs(remote: string, remoteBranch: string, localBranch: string): string[];
/** Options of `buildPushBranchArgs` controlling upstream tracking and force. */
export interface PushBranchOptions {
    /** Append `--set-upstream`; defaults to true, false omits it. */
    setUpstream?: boolean;
    /** `'force-with-lease'` appends `--force-with-lease`; `'normal'` appends nothing. */
    mode?: 'normal' | 'force-with-lease';
}
/** Push one branch; the upstream flag precedes the force flag when both are present. */
export declare function buildPushBranchArgs(remote: string, name: string, options?: PushBranchOptions): string[];
/** Push one tag. */
export declare function buildPushTagArgs(remote: string, name: string): string[];
/** Working-tree status, porcelain v1, NUL-delimited, untracked files included. */
export declare function buildStatusFilesArgs(): string[];
/** Stage one path, or the whole tree (`-A`) when no path is given. */
export declare function buildStageAddArgs(path?: string): string[];
/** Unstage one path, or the whole index (`--`) when no path is given. */
export declare function buildStageResetArgs(path?: string): string[];
/**
 * Commit with `message` as one argument vector element (newlines stay safe).
 * `--no-verify` skips pre-commit/commit-msg hooks: the /wb-git API is
 * browser-trust fenced, so hooks are not run on its behalf (a malicious
 * config value or a repo with hostile hooks must not execute on commit).
 */
export declare function buildCommitArgs(message: string): string[];
/**
 * Parse `git log` output (one record per line, fields joined by SEP). Trailing
 * newlines and separators are tolerated; no empty or partial records are
 * emitted. A subject is the last field, so a separator appearing inside it
 * (astronomically unlikely by construction) is re-joined rather than dropped.
 */
export declare function parseGitLog(stdout: string): GitLogCommit[];
/**
 * Parse `git show-ref -d --head` output. For an annotated tag the peeled
 * entry (`refs/tags/<name>^{}`) appears as an entry with the same name, the
 * commit hash and `annotated: true`; the consumer dedupes by name preferring
 * the annotated entry.
 */
export declare function parseShowRef(stdout: string): ShowRefResult;
/**
 * Parse `git show --no-patch` output (one record, fields joined by SEP, the
 * body last). The body may contain newlines, so the record is split on SEP
 * only (never on newlines); exactly one trailing newline is trimmed.
 */
export declare function parseCommitDetail(stdout: string): CommitDetailMeta;
/**
 * Parse NUL-delimited `git diff --name-status -z` output. Rename/copy rows
 * carry a similarity-suffixed status code (e.g. R100) followed by the old
 * path and the new path; the status letter is the first character.
 */
export declare function parseNameStatus(stdout: string): NameStatusRow[];
/**
 * Parse NUL-delimited `git diff --numstat -z` output. Binary rows report a
 * dash instead of the counts (parsed as null). A rename/copy row has an empty
 * path field followed by two NUL-terminated paths (old, new); the row's path
 * is the new path, so the host can join name-status and numstat by path.
 */
export declare function parseNumStat(stdout: string): NumStatRow[];
/**
 * Parse `git branch --no-color[ --all]` output. The checked-out branch
 * carries a leading `*`; remote-tracking entries keep the `remotes/` prefix
 * and expose the remote name (the first path segment). Non-branch lines are
 * skipped: the detached-HEAD pseudo-entry (`(HEAD detached at …)`), the
 * synthetic `remotes/<remote>/HEAD` pointer (plain or `-> origin/main`
 * symbolic form), and anything with a `->` arrow.
 */
export declare function parseBranches(stdout: string): BranchRow[];
/**
 * Parse `git remote -v` output. `git remote -v` prints one fetch line and one
 * push line per remote; they collapse into one row and the fetch URL wins.
 */
export declare function parseRemotes(stdout: string): RemoteRow[];
/**
 * Parse `git status --porcelain -z` output: one record per working-tree
 * change, `<XY><space><path>` NUL-terminated (renames: `<XY><space><new>` NUL
 * `<old>` NUL). The index letter (X) decides the staged flag; the status
 * letter is the index side for staged changes and the worktree side
 * otherwise; `??` (untracked) maps to status `U`/staged false.
 */
export declare function parseStatusFiles(stdout: string): StatusFile[];
