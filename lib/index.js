import { opendir, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
//#region src/git-ops.ts
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
/**
* Field separator for the machine-readable log/detail records. A single long,
* randomly-looking token: it cannot occur inside ordinary git output, and the
* smoke script asserts it is longer than 10 characters. The log/detail
* builders and their matching parsers must agree on this exact constant.
*/
const SEP = "dock-git-7f3c9a2e-4b81-4d6e-9a51-2c8f0d7b3e6a";
/** `git log` record layout: hash, parents, author, email, date, subject. */
const LOG_FORMAT = [
	"%H",
	"%P",
	"%an",
	"%ae",
	"%at",
	"%s"
].join(SEP);
/** `git show --no-patch` record layout: hash, parents, author, committer, body. */
const DETAIL_FORMAT = [
	"%H",
	"%P",
	"%an",
	"%ae",
	"%at",
	"%cn",
	"%ce",
	"%ct",
	"%B"
].join(SEP);
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
function runGit(cwd, args, maxBytes) {
	const env = { ...process.env };
	delete env.GIT_DIR;
	delete env.GIT_WORK_TREE;
	env.LC_ALL = "C";
	env.LC_MESSAGES = "C";
	env.LANG = "C";
	return new Promise((resolve, reject) => {
		const child = spawn("git", args, {
			cwd,
			env,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let stdout = "";
		let stderr = "";
		let overflow = false;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			if (maxBytes !== void 0 && stdout.length + chunk.length > maxBytes) {
				overflow = true;
				child.kill("SIGKILL");
				return;
			}
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (overflow) {
				reject(/* @__PURE__ */ new Error(`git output exceeds ${maxBytes} bytes`));
				return;
			}
			if (code === 0) {
				resolve(stdout);
				return;
			}
			const text = stderr !== "" ? stderr : stdout;
			const error = new Error(text !== "" ? text : `git exited with code ${code}`);
			error.stderr = stderr;
			error.exitCode = code;
			error.stdout = stdout;
			reject(error);
		});
	});
}
/**
* Argument vector for the log command. At most `maxCount` commit records may
* appear in the output (the caller passes maxCount + 1 for a probe row and
* truncates itself). Without a branch filter the output covers all refs
* (`--all`), or all refs except remote-tracking ones when `showRemote` is
* false; with a filter it covers only the named refs.
*/
function buildLogArgs(maxCount, options) {
	const args = [
		"log",
		`--max-count=${maxCount}`,
		`--format=${LOG_FORMAT}`,
		"--date-order"
	];
	const branches = options?.branches;
	if (branches !== void 0 && branches.length > 0) args.push(...branches);
	else if (options?.showRemote === false) args.push("--branches", "--tags", "HEAD");
	else args.push("--all");
	return args;
}
/** Argument vector for `git show-ref -d --head` (peeled tags + HEAD included). */
function buildShowRefArgs() {
	return [
		"show-ref",
		"-d",
		"--head"
	];
}
/**
* Argument vector for the single-commit metadata command. Works for merge
* commits (multiple parents), root commits (no parents) and ordinary commits;
* `--no-patch` suppresses the diff so the record is exactly the format line.
*/
function buildDetailArgs(hash) {
	return [
		"show",
		"--no-patch",
		`--format=${DETAIL_FORMAT}`,
		hash
	];
}
/** Pinned by the smoke script: `git show <rev>:<path>`. */
function buildShowFileArgs(rev, path) {
	return ["show", `${rev}:${path}`];
}
/**
* Argument vector for the branch-listing command. `showRemote` controls
* whether remote-tracking branches appear: `--all` lists local branches plus
* remote-tracking refs (prefixed `remotes/<remote>/<branch>`), while the plain
* listing shows local branches only.
*/
function buildBranchArgs(showRemote) {
	return showRemote ? [
		"branch",
		"--no-color",
		"--all"
	] : ["branch", "--no-color"];
}
/** Read one configuration key; an unset key exits non-zero with empty stdout. */
function buildConfigGetArgs(key) {
	return [
		"config",
		"--get",
		key
	];
}
/** Write one configuration key to the repository-local configuration. */
function buildConfigSetArgs(key, value) {
	return [
		"config",
		key,
		value
	];
}
/** List every remote together with its URL (`git remote -v`). */
function buildRemoteListArgs() {
	return ["remote", "-v"];
}
/** Add a remote. */
function buildRemoteAddArgs(name, url) {
	return [
		"remote",
		"add",
		name,
		url
	];
}
/** Remove a remote. */
function buildRemoteRemoveArgs(name) {
	return [
		"remote",
		"remove",
		name
	];
}
/** Change a remote's URL. */
function buildRemoteSetUrlArgs(name, url) {
	return [
		"remote",
		"set-url",
		name,
		url
	];
}
/** Create a branch named `name` at commit `hash`. */
function buildCreateBranchArgs(name, hash) {
	return [
		"branch",
		name,
		hash
	];
}
/** Rename branch `name` to `newName`. */
function buildRenameBranchArgs(name, newName) {
	return [
		"branch",
		"-m",
		name,
		newName
	];
}
/** Force-delete branch `name`. */
function buildDeleteBranchArgs(name) {
	return [
		"branch",
		"-D",
		name
	];
}
/** Create a plain (non-annotated) tag named `name` at commit `hash`. */
function buildCreateTagArgs(name, hash) {
	return [
		"tag",
		name,
		hash
	];
}
/** Delete tag `name`. */
function buildDeleteTagArgs(name) {
	return [
		"tag",
		"-d",
		name
	];
}
/** Switch to `ref` (a commit hash for a detached checkout, or a branch/tag name). */
function buildCheckoutArgs(ref) {
	return ["checkout", ref];
}
/**
* Switch to a branch or tag by name with `git switch`. Unlike `checkout`,
* `switch` never falls back to path semantics: a name that matches a tracked
* file (e.g. `src/index.ts`) cannot silently restore that file from the
* index and destroy working-tree changes. Callers must pass only refs that
* have been validated (REF_NAME_PATTERN) and, for safety, resolve to an
* existing branch/tag before calling.
*/
function buildSwitchArgs(ref) {
	return ["switch", ref];
}
/** Detached switch to a commit hash (never path semantics). */
function buildSwitchDetachArgs(hash) {
	return [
		"switch",
		"--detach",
		hash
	];
}
/** Fetch all remotes (`--all --prune`) or one named remote (`--prune`). */
function buildFetchArgs(remote) {
	return remote === null ? [
		"fetch",
		"--all",
		"--prune"
	] : [
		"fetch",
		remote,
		"--prune"
	];
}
/** Pull `remote`/`branch` into the current branch. */
function buildPullArgs(remote, branch) {
	return [
		"pull",
		remote,
		branch
	];
}
/** Fetch one remote branch into a local branch (`remoteBranch:localBranch`). */
function buildFetchIntoArgs(remote, remoteBranch, localBranch) {
	return [
		"fetch",
		remote,
		`${remoteBranch}:${localBranch}`
	];
}
/** Push one branch; the upstream flag precedes the force flag when both are present. */
function buildPushBranchArgs(remote, name, options) {
	const args = [
		"push",
		remote,
		name
	];
	if (options?.setUpstream !== false) args.push("--set-upstream");
	if (options?.mode === "force-with-lease") args.push("--force-with-lease");
	return args;
}
/** Push one tag. */
function buildPushTagArgs(remote, name) {
	return [
		"push",
		remote,
		name
	];
}
/** Working-tree status, porcelain v1, NUL-delimited, untracked files included. */
function buildStatusFilesArgs() {
	return [
		"status",
		"--porcelain",
		"-z",
		"--untracked-files=all"
	];
}
/** Stage one path, or the whole tree (`-A`) when no path is given. */
function buildStageAddArgs(path) {
	return path === void 0 ? ["add", "-A"] : ["add", path];
}
/** Unstage one path, or the whole index (`--`) when no path is given. */
function buildStageResetArgs(path) {
	return path === void 0 ? [
		"reset",
		"HEAD",
		"--"
	] : [
		"reset",
		"HEAD",
		path
	];
}
/**
* Commit with `message` as one argument vector element (newlines stay safe).
* `--no-verify` skips pre-commit/commit-msg hooks: the /wb-git API is
* browser-trust fenced, so hooks are not run on its behalf (a malicious
* config value or a repo with hostile hooks must not execute on commit).
*/
function buildCommitArgs(message) {
	return [
		"commit",
		"--no-verify",
		"-m",
		message
	];
}
/**
* Parse `git log` output (one record per line, fields joined by SEP). Trailing
* newlines and separators are tolerated; no empty or partial records are
* emitted. A subject is the last field, so a separator appearing inside it
* (astronomically unlikely by construction) is re-joined rather than dropped.
*/
function parseGitLog(stdout) {
	const commits = [];
	for (const line of stdout.split(/\r\n|\r|\n/g)) {
		if (line === "") continue;
		const parts = line.split(SEP);
		if (parts.length < 6) continue;
		commits.push({
			hash: parts[0],
			parents: parts[1] === "" ? [] : parts[1].split(" "),
			author: parts[2],
			email: parts[3],
			date: Number(parts[4]),
			message: parts.slice(5).join(SEP)
		});
	}
	return commits;
}
/**
* Parse `git show-ref -d --head` output. For an annotated tag the peeled
* entry (`refs/tags/<name>^{}`) appears as an entry with the same name, the
* commit hash and `annotated: true`; the consumer dedupes by name preferring
* the annotated entry.
*/
function parseShowRef(stdout) {
	const result = {
		head: null,
		heads: [],
		tags: [],
		remotes: []
	};
	for (const line of stdout.split(/\r\n|\r|\n/g)) {
		if (line === "") continue;
		const space = line.indexOf(" ");
		if (space <= 0) continue;
		const hash = line.slice(0, space);
		const ref = line.slice(space + 1).trim();
		if (ref === "HEAD") result.head = hash;
		else if (ref.startsWith("refs/heads/")) result.heads.push({
			hash,
			name: ref.slice(11)
		});
		else if (ref.startsWith("refs/tags/")) {
			const name = ref.slice(10);
			if (name.endsWith("^{}")) result.tags.push({
				hash,
				name: name.slice(0, -3),
				annotated: true
			});
			else result.tags.push({
				hash,
				name,
				annotated: false
			});
		} else if (ref.startsWith("refs/remotes/")) result.remotes.push({
			hash,
			name: ref.slice(13)
		});
	}
	return result;
}
/**
* Parse `git show --no-patch` output (one record, fields joined by SEP, the
* body last). The body may contain newlines, so the record is split on SEP
* only (never on newlines); exactly one trailing newline is trimmed.
*/
function parseCommitDetail(stdout) {
	const parts = stdout.split(SEP);
	if (parts.length < 9) throw new Error("unexpected git show output: expected 9 fields");
	return {
		hash: parts[0],
		parents: parts[1] === "" ? [] : parts[1].split(" "),
		author: parts[2],
		authorEmail: parts[3],
		authorDate: Number(parts[4]),
		committer: parts[5],
		committerEmail: parts[6],
		committerDate: Number(parts[7]),
		body: parts.slice(8).join(SEP).replace(/\r?\n+$/, "")
	};
}
/**
* Parse NUL-delimited `git diff --name-status -z` output. Rename/copy rows
* carry a similarity-suffixed status code (e.g. R100) followed by the old
* path and the new path; the status letter is the first character.
*/
function parseNameStatus(stdout) {
	const rows = [];
	const tokens = stdout.split("\0");
	let i = 0;
	while (i < tokens.length) {
		const code = tokens[i];
		i += 1;
		if (code === "") continue;
		const status = code[0];
		if (status === "R" || status === "C") {
			const oldPath = tokens[i];
			i += 1;
			const path = tokens[i];
			i += 1;
			if (path === void 0 || path === "") continue;
			rows.push({
				path,
				status,
				oldPath
			});
		} else {
			const path = tokens[i];
			i += 1;
			if (path === void 0 || path === "") continue;
			rows.push({
				path,
				status
			});
		}
	}
	return rows;
}
/**
* Parse NUL-delimited `git diff --numstat -z` output. Binary rows report a
* dash instead of the counts (parsed as null). A rename/copy row has an empty
* path field followed by two NUL-terminated paths (old, new); the row's path
* is the new path, so the host can join name-status and numstat by path.
*/
function parseNumStat(stdout) {
	const rows = [];
	const tokens = stdout.split("\0");
	let i = 0;
	while (i < tokens.length) {
		const record = tokens[i];
		i += 1;
		if (record === "") continue;
		const tab1 = record.indexOf("	");
		if (tab1 < 0) continue;
		const tab2 = record.indexOf("	", tab1 + 1);
		if (tab2 < 0) continue;
		const additions = record.slice(0, tab1);
		const deletions = record.slice(tab1 + 1, tab2);
		let path = record.slice(tab2 + 1);
		if (path === "") {
			tokens[i];
			i += 1;
			const newPath = tokens[i];
			i += 1;
			if (newPath === void 0) continue;
			path = newPath;
			if (path === "") continue;
		}
		if (path === "") continue;
		rows.push({
			path,
			additions: additions === "-" ? null : Number(additions),
			deletions: deletions === "-" ? null : Number(deletions)
		});
	}
	return rows;
}
/**
* Parse `git branch --no-color[ --all]` output. The checked-out branch
* carries a leading `*`; remote-tracking entries keep the `remotes/` prefix
* and expose the remote name (the first path segment). Non-branch lines are
* skipped: the detached-HEAD pseudo-entry (`(HEAD detached at …)`), the
* synthetic `remotes/<remote>/HEAD` pointer (plain or `-> origin/main`
* symbolic form), and anything with a `->` arrow.
*/
function parseBranches(stdout) {
	const rows = [];
	for (const line of stdout.split(/\r\n|\r|\n/g)) {
		if (line === "") continue;
		const trimmed = line.replace(/^\s+/, "");
		const current = trimmed.startsWith("*");
		const name = (current ? trimmed.slice(1) : trimmed).trim();
		if (name === "") continue;
		if (name.startsWith("(") || name.startsWith("（")) continue;
		if (name.includes("->")) continue;
		if (name.startsWith("remotes/") && name.endsWith("/HEAD")) continue;
		const remote = name.startsWith("remotes/") ? name.slice(8).split("/")[0] : null;
		rows.push({
			name,
			current,
			remote
		});
	}
	return rows;
}
/**
* Parse `git remote -v` output. `git remote -v` prints one fetch line and one
* push line per remote; they collapse into one row and the fetch URL wins.
*/
function parseRemotes(stdout) {
	const byName = /* @__PURE__ */ new Map();
	for (const line of stdout.split(/\r\n|\r|\n/g)) {
		if (line === "") continue;
		const tab = line.indexOf("	");
		if (tab <= 0) continue;
		const name = line.slice(0, tab);
		const rest = line.slice(tab + 1);
		if (rest.endsWith(" (fetch)")) byName.set(name, rest.slice(0, -8));
		else if (rest.endsWith(" (push)")) {
			if (!byName.has(name)) byName.set(name, rest.slice(0, -7));
		}
	}
	return [...byName].map(([name, url]) => ({
		name,
		url
	}));
}
/**
* Parse `git status --porcelain -z` output: one record per working-tree
* change, `<XY><space><path>` NUL-terminated (renames: `<XY><space><new>` NUL
* `<old>` NUL). The index letter (X) decides the staged flag; the status
* letter is the index side for staged changes and the worktree side
* otherwise; `??` (untracked) maps to status `U`/staged false.
*/
function parseStatusFiles(stdout) {
	const files = [];
	const tokens = stdout.split("\0");
	let i = 0;
	while (i < tokens.length) {
		const record = tokens[i];
		i += 1;
		if (record === "") continue;
		const x = record[0];
		const y = record[1];
		const path = record.slice(3);
		if (path === "") continue;
		if (x === "?" && y === "?") {
			files.push({
				path,
				status: "U",
				staged: false
			});
			continue;
		}
		let oldPath;
		if (x === "R" || x === "C") {
			const old = tokens[i];
			i += 1;
			if (old !== void 0) oldPath = old;
		}
		const staged = x !== " ";
		const file = {
			path,
			status: staged ? x : y,
			staged
		};
		if (oldPath !== void 0) file.oldPath = oldPath;
		files.push(file);
	}
	return files;
}
//#endregion
//#region src/repos.ts
/**
* Multi-repo discovery for dock-git: scans a workspace directory (cwd itself
* plus two levels of subdirectories) and lists every independent git
* repository root. Pure logic on top of the injected runGit — no node:http,
* no Cordis, no ctx — so the host route layer (index.ts) and the host smoke
* script share it.
*
* Rules (multi-repo support):
*  - depth 0: cwd itself when inside a work tree (toplevel may be an ancestor).
*  - depth 1/2: a subdirectory is listed only when it is its OWN repository
*    root (rev-parse --show-toplevel === the directory itself).
*  - hidden dirs (. prefix) and node_modules are skipped at every level.
*  - each scan layer enumerates at most MAX_SCAN_DIRS candidate directories
*    (truncation is silent).
*  - results are deduped by root (first occurrence wins).
*  - unreadable directories and failed rev-parse calls are skipped silently.
*/
/** Directory-enumeration cap per scan layer (perf bound on one click). */
const MAX_SCAN_DIRS = 200;
/** True when dir is itself a git repository root (toplevel === dir). */
async function isRepoRoot(dir, runGit) {
	try {
		return (await runGit(dir, ["rev-parse", "--show-toplevel"])).trim() === resolve(dir);
	} catch {
		return false;
	}
}
/**
* Run fn over items with at most limit in flight, merging results in input
* order (stable output order regardless of completion timing).
*/
async function mapLimit(items, limit, fn) {
	const results = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		for (;;) {
			const i = next;
			next += 1;
			if (i >= items.length) return;
			results[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return results;
}
/**
* Enumerate the candidate subdirectories of dir: non-hidden, non-node_modules
* directories, capped at limit. Files, hidden dirs and missing/unreadable
* dirs are skipped silently. Returns absolute paths in enumeration order.
*/
async function candidateDirs(dir, limit) {
	const out = [];
	let handle;
	try {
		handle = await opendir(dir);
		for await (const entry of handle) {
			if (out.length >= limit) break;
			if (!entry.isDirectory()) continue;
			const name = entry.name;
			if (name.startsWith(".") || name === "node_modules") continue;
			out.push(resolve(dir, name));
		}
	} catch {} finally {
		if (handle !== void 0) try {
			await handle.close();
		} catch {}
	}
	return out;
}
/** Scan cwd and two levels of subdirectories for repository roots. */
async function scanRepos(cwd, runGit) {
	const base = await realpath(cwd).catch(() => cwd);
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	try {
		const top = (await runGit(base, ["rev-parse", "--show-toplevel"])).trim();
		if (top !== "") {
			const root = resolve(top);
			if (!seen.has(root)) {
				seen.add(root);
				entries.push({
					root,
					name: basename(root),
					depth: 0
				});
			}
		}
	} catch {}
	const level1 = await candidateDirs(base, 200);
	const level1Repo = await mapLimit(level1, 8, async (dir) => await isRepoRoot(dir, runGit) ? dir : null);
	for (const dir of level1Repo) if (dir !== null) {
		const root = resolve(dir);
		if (!seen.has(root)) {
			seen.add(root);
			entries.push({
				root,
				name: basename(root),
				depth: 1
			});
		}
	}
	const level2 = [];
	let scanned = 0;
	for (const dir of level1) {
		if (scanned >= 200) break;
		const sub = await candidateDirs(dir, 200 - scanned);
		level2.push(...sub);
		scanned += sub.length;
	}
	const level2Repo = await mapLimit(level2, 8, async (child) => await isRepoRoot(child, runGit) ? child : null);
	for (const child of level2Repo) if (child !== null) {
		const root = resolve(child);
		if (!seen.has(root)) {
			seen.add(root);
			entries.push({
				root,
				name: basename(root),
				depth: 2
			});
		}
	}
	return entries;
}
//#endregion
//#region src/index.ts
const name = "dock-git";
/** Services required before mounting. */
const inject = [
	"webServer",
	"sessions",
	"webRuntime"
];
/** One API failure with its wire code and HTTP status. */
var WbError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
	}
};
const MAX_BODY_BYTES = 1 << 20;
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.from(chunk);
		total += buffer.length;
		if (total > MAX_BODY_BYTES) throw new WbError("bad-request", "request body too large");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text.trim() === "") return {};
	if (text.includes("\0")) throw new WbError("bad-request", "request body must not contain NUL bytes");
	try {
		return JSON.parse(text);
	} catch {
		throw new WbError("bad-request", "request body is not valid JSON");
	}
}
function writeJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
function writeOk(res, value) {
	writeJson(res, 200, {
		ok: true,
		value
	});
}
function writeError(res, error) {
	if (error instanceof WbError) {
		writeJson(res, error.status, {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	writeJson(res, 500, {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error)
		}
	});
}
function stringOrUndefined(payload, key) {
	const value = payload?.[key];
	return typeof value === "string" && value !== "" ? value : void 0;
}
function header(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/** DNS-rebinding / cross-site defense (not authentication). */
function isTrustedRequest(request, trustedHosts) {
	const host = header(request.headers, "host");
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
	const origin = header(request.headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** Resolve a session's authoritative working directory. */
function sessionCwdOf(ctx, sessionId) {
	if (sessionId !== void 0) {
		const cwd = ctx.sessions.get(sessionId)?.header.cwd;
		if (cwd !== void 0 && cwd !== "") return cwd;
	}
	return process.cwd();
}
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Run a git sub-command, converting any failure into a wire fs-error. */
async function withGitError(label, fn) {
	try {
		return await fn();
	} catch (error) {
		throw new WbError("fs-error", `${label} failed: ${messageOf(error)}`);
	}
}
/**
* Parse and validate the optional `repoRoot` payload field. When provided it
* must be a non-empty absolute path (`/`-prefix or a Windows drive letter)
* to an existing directory, otherwise 400 bad-request. It must also lie
* inside the session workspace (the canonical session cwd or a descendant),
* otherwise 403 forbidden — a browser-trusted request must not run git in
* arbitrary repositories outside the conversation's workspace. Returns the
* canonical (symlink-resolved) path, or undefined when absent (endpoints
* then fall back to the session cwd). repoRoot is the repository root
* itself — git runs there directly, no upward lookup. A repoRoot that is
* not a repository is handled per endpoint: /config rejects it up front
* with fs-error (work-tree guard), /log reports isRepo:false, and the
* remaining endpoints surface the failing git command as an fs-error.
*/
async function repoRootOf(payload, ctx, sessionId) {
	const raw = stringOrUndefined(payload, "repoRoot");
	if (raw === void 0) return void 0;
	if (!raw.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(raw)) throw new WbError("bad-request", "repoRoot must be an absolute path");
	let info;
	try {
		info = await stat(raw);
	} catch {
		throw new WbError("bad-request", `repoRoot directory not found: "${raw}"`);
	}
	if (!info.isDirectory()) throw new WbError("bad-request", `repoRoot is not a directory: "${raw}"`);
	const root = await realpath(raw);
	const cwd = sessionCwdOf(ctx, sessionId);
	const workspace = await realpath(cwd).catch(() => resolve(cwd));
	const rel = relative(workspace, root);
	if (rel === "" || rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) return root;
	throw new WbError("forbidden", `repoRoot is outside the session workspace: "${raw}"`, 403);
}
/** Dedupe tags by name, preferring the annotated (^{}) entry. */
function dedupeTags(tags) {
	const byName = /* @__PURE__ */ new Map();
	for (const tag of tags) {
		const existing = byName.get(tag.name);
		if (existing === void 0 || tag.annotated && !existing.annotated) byName.set(tag.name, tag);
	}
	return [...byName.values()];
}
async function endpointStatus(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const repoRoot = await repoRootOf(payload, ctx, sessionId);
	const cwd = repoRoot ?? sessionCwdOf(ctx, sessionId);
	let isRepo = false;
	try {
		isRepo = (await runGit(cwd, ["rev-parse", "--is-inside-work-tree"])).includes("true");
	} catch {
		isRepo = false;
	}
	let root = null;
	let branch = null;
	if (isRepo) {
		if (repoRoot !== void 0) root = repoRoot;
		else try {
			root = (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
		} catch {
			root = null;
		}
		if (root !== null) try {
			branch = (await runGit(root, [
				"rev-parse",
				"--abbrev-ref",
				"HEAD"
			])).trim();
		} catch {
			branch = null;
		}
	}
	return {
		cwd,
		isRepo,
		root,
		branch
	};
}
/** POST /wb-git/repos { sessionId }
*  → { cwd, repos: RepoEntry[] } (cwd + two levels of subdirectories scanned). */
async function endpointRepos(ctx, payload) {
	const cwd = sessionCwdOf(ctx, stringOrUndefined(payload, "sessionId"));
	return {
		cwd,
		repos: await scanRepos(cwd, runGit)
	};
}
const DEFAULT_MAX_COMMITS = 200;
const MAX_COMMITS_LIMIT = 1e3;
const MAX_LOG_BRANCHES = 50;
/** Branch names allowed as a /log filter (read-only selector). A leading '-'
*  is rejected because git would parse it as an option (e.g. `--all`). */
const BRANCH_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-/]+$/;
/** Branch filters must not smuggle git range/reflog syntax (`main..side`). */
const BRANCH_FILTER_REJECT = /\.\.|@{/;
async function endpointLog(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const rawMax = raw?.["maxCommits"];
	const maxCommits = typeof rawMax === "number" && Number.isFinite(rawMax) ? Math.min(MAX_COMMITS_LIMIT, Math.max(1, Math.floor(rawMax))) : DEFAULT_MAX_COMMITS;
	const rawBranches = raw?.["branches"];
	let branches;
	if (Array.isArray(rawBranches)) {
		if (rawBranches.length > MAX_LOG_BRANCHES) throw new WbError("bad-request", `too many branch filters (max ${MAX_LOG_BRANCHES})`);
		for (const entry of rawBranches) if (typeof entry !== "string" || !BRANCH_NAME_PATTERN.test(entry) || BRANCH_FILTER_REJECT.test(entry)) throw new WbError("bad-request", `invalid branch name "${String(entry)}"`);
		if (rawBranches.length > 0) branches = rawBranches;
	} else if (rawBranches !== void 0 && rawBranches !== null) throw new WbError("bad-request", "branches must be an array of branch names");
	const showRemote = raw?.["showRemote"] !== false;
	const cwd = sessionCwdOf(ctx, sessionId);
	const repoRoot = await repoRootOf(payload, ctx, sessionId);
	let root;
	if (repoRoot !== void 0) root = repoRoot;
	else try {
		root = (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
	} catch {
		return {
			isRepo: false,
			root: null,
			branch: null,
			commits: [],
			more: false,
			head: null
		};
	}
	let branch = null;
	try {
		branch = (await runGit(root, [
			"rev-parse",
			"--abbrev-ref",
			"HEAD"
		])).trim();
	} catch {
		branch = null;
	}
	try {
		await runGit(root, [
			"rev-parse",
			"--verify",
			"--quiet",
			"HEAD"
		]);
	} catch {
		let inside = false;
		try {
			inside = (await runGit(root, ["rev-parse", "--is-inside-work-tree"])).includes("true");
		} catch {
			inside = false;
		}
		if (!inside) return {
			isRepo: false,
			root: null,
			branch: null,
			commits: [],
			more: false,
			head: null
		};
		return {
			isRepo: true,
			root,
			branch,
			commits: [],
			more: false,
			head: null
		};
	}
	const parsed = parseGitLog(await withGitError("log", () => runGit(root, buildLogArgs(maxCommits + 1, {
		branches,
		showRemote
	}), 8388608)));
	let more = false;
	if (parsed.length > maxCommits) {
		more = true;
		parsed.pop();
	}
	const refs = parseShowRef(await withGitError("show-ref", () => runGit(root, buildShowRefArgs())));
	const remoteNames = [...new Set(refs.remotes.map((r) => r.name.split("/")[0]))];
	const commits = parsed.map((commit) => ({
		...commit,
		heads: refs.heads.filter((h) => h.hash === commit.hash).map((h) => h.name),
		tags: dedupeTags(refs.tags.filter((t) => t.hash === commit.hash).map((t) => ({
			name: t.name,
			annotated: t.annotated
		}))),
		remotes: refs.remotes.filter((r) => r.hash === commit.hash).map((r) => ({
			name: r.name,
			remote: remoteNames.find((n) => r.name.startsWith(`${n}/`)) ?? null
		}))
	}));
	const head = refs.head;
	if (head !== null && commits.some((c) => c.hash === head)) {
		let uncommitted = 0;
		try {
			const statusOut = await runGit(root, [
				"status",
				"--porcelain",
				"--untracked-files=all"
			], 8388608);
			uncommitted = statusOut.trim() === "" ? 0 : statusOut.split(/\r\n|\r|\n/g).filter((line) => line !== "").length;
		} catch {
			uncommitted = 0;
		}
		if (uncommitted > 0) commits.unshift({
			hash: "*",
			parents: [head],
			author: "*",
			email: "",
			date: Math.round(Date.now() / 1e3),
			message: `Uncommitted Changes (${uncommitted})`,
			heads: [],
			tags: [],
			remotes: []
		});
	}
	return {
		isRepo: true,
		root,
		branch,
		commits,
		more,
		head
	};
}
const MAX_DIFF_CHARS = 524288;
const HASH_PATTERN = /^[0-9a-f]{4,40}$/;
async function endpointDetail(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const hash = stringOrUndefined(payload, "hash");
	if (hash === void 0 || !HASH_PATTERN.test(hash)) throw new WbError("bad-request", `invalid commit hash "${hash ?? ""}"`);
	const cwd = sessionCwdOf(ctx, sessionId);
	const repoRoot = await repoRootOf(payload, ctx, sessionId);
	let root;
	if (repoRoot !== void 0) root = repoRoot;
	else try {
		root = (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
	} catch (error) {
		throw new WbError("fs-error", `not a git work tree at "${cwd}": ${messageOf(error)}`);
	}
	const meta = await withGitError("show", async () => parseCommitDetail(await runGit(root, buildDetailArgs(hash))));
	const from = meta.parents.length > 0 ? `${hash}^` : hash;
	const isRoot = from === hash;
	const nameStatusArgs = diffArgs("--name-status", from, hash, isRoot);
	const numStatArgs = diffArgs("--numstat", from, hash, isRoot);
	const [nameStatusOut, numStatOut] = await Promise.all([withGitError("diff --name-status", () => runGit(root, nameStatusArgs)), withGitError("diff --numstat", () => runGit(root, numStatArgs))]);
	const numStat = new Map(parseNumStat(numStatOut).map((row) => [row.path, row]));
	const files = parseNameStatus(nameStatusOut).map((change) => {
		const stat = numStat.get(change.path);
		return {
			path: change.path,
			...change.oldPath !== void 0 ? { oldPath: change.oldPath } : {},
			status: change.status,
			additions: stat?.additions ?? null,
			deletions: stat?.deletions ?? null
		};
	});
	const diffOut = await withGitError("show (diff)", () => runGit(root, [
		"-c",
		"log.showSignature=false",
		"show",
		"--format=",
		"--no-ext-diff",
		hash
	], 8388608));
	const truncated = diffOut.length > MAX_DIFF_CHARS;
	let diff = diffOut;
	if (truncated) {
		const cut = diffOut.slice(0, MAX_DIFF_CHARS);
		const last = cut.charCodeAt(cut.length - 1);
		const end = last >= 55296 && last <= 56319 ? cut.length - 1 : cut.length;
		diff = cut.slice(0, end);
	}
	return {
		meta,
		files,
		diff,
		truncated
	};
}
/** name-status / numstat args, root-commit variant (diff-tree --root). */
function diffArgs(arg, from, to, isRoot) {
	if (isRoot) return [
		"diff-tree",
		"--no-commit-id",
		arg,
		"-r",
		"--root",
		"--find-renames",
		"--diff-filter=AMDR",
		"-z",
		from
	];
	return [
		"diff",
		arg,
		"--find-renames",
		"--diff-filter=AMDR",
		"-z",
		from,
		to
	];
}
/** Config keys: at least one `section.name` pair (user.name, core.quotepath …). */
const CONFIG_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9.-]*(\.[a-zA-Z][a-zA-Z0-9.-]*)+$/;
/** Remote names (git allows [A-Za-z0-9._-]; no '/'). A leading '-' is
*  rejected because git would parse it as an option. */
const REMOTE_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-]+$/;
/** Ref names (branch/tag): safe ASCII subset, no whitespace. A leading '-'
*  is rejected because git would parse it as an option (e.g. `git branch
*  --force <name>` / `git checkout --force`). */
const REF_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-/]+$/;
/** Git ref-name guard on top of the pattern (spec): no leading/trailing '/',
*  no '..', no '@{', no whitespace (pattern already excludes whitespace). */
function isValidRefName(name) {
	if (!REF_NAME_PATTERN.test(name)) return false;
	if (name.startsWith("/") || name.endsWith("/")) return false;
	if (name.includes("..") || name.includes("@{")) return false;
	return true;
}
/** Resolve the work-tree root or throw the detail-style fs-error. */
async function workTreeRootOf(ctx, cwd) {
	try {
		return (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
	} catch (error) {
		throw new WbError("fs-error", `not a git work tree at "${cwd}": ${messageOf(error)}`);
	}
}
/** POST /wb-git/branches { sessionId, showRemote? }
*  → { branches: {name,current,remote}[], head: string|null } */
async function endpointBranches(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const showRemote = payload?.["showRemote"] === true;
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	const out = await withGitError("branch", () => runGit(root, buildBranchArgs(showRemote)));
	let head = null;
	try {
		const resolved = (await runGit(root, [
			"rev-parse",
			"--abbrev-ref",
			"HEAD"
		])).trim();
		if (resolved !== "HEAD") head = resolved;
	} catch {
		head = null;
	}
	return {
		branches: parseBranches(out),
		head
	};
}
/** POST /wb-git/config { sessionId, key, value? }
*  read  → { key, value: string|null } (unset key → null)
*  write → { key, value }
*
* Writes are restricted to a key allowlist (`user.name` / `user.email` —
* the identity the settings UI manages). Other keys are read-only: keys
* like `core.hooksPath`, `core.sshCommand`, `alias.*` and
* `remote.<n>.uploadpack` change what later git commands execute, and a
* browser-trust-fenced endpoint must not let a page arm git to run
* arbitrary code on the next commit/push. */
async function endpointConfig(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const key = raw?.["key"];
	if (typeof key !== "string" || !CONFIG_KEY_PATTERN.test(key)) throw new WbError("bad-request", `invalid config key "${String(key)}"`);
	const rawValue = raw?.["value"];
	const hasValue = typeof rawValue === "string";
	if (hasValue) {
		if (key !== "user.name" && key !== "user.email") throw new WbError("forbidden", `config write to "${key}" is not allowed`, 403);
		if (rawValue.includes("\n") || rawValue.includes("\"") || rawValue.includes("'")) throw new WbError("bad-request", "config value must not contain newlines or quotes");
	}
	const cwd = sessionCwdOf(ctx, sessionId);
	const repoRoot = await repoRootOf(payload, ctx, sessionId);
	if (repoRoot !== void 0) {
		let inside = false;
		try {
			inside = (await runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"])).includes("true");
		} catch {
			inside = false;
		}
		if (!inside) throw new WbError("fs-error", `not a git work tree at "${repoRoot}"`);
	}
	const root = repoRoot ?? await workTreeRootOf(ctx, cwd);
	if (hasValue) {
		await withGitError("config (set)", () => runGit(root, buildConfigSetArgs(key, rawValue)));
		return {
			key,
			value: rawValue
		};
	}
	let value = null;
	try {
		const out = (await runGit(root, buildConfigGetArgs(key))).trim();
		if (out !== "") value = out;
	} catch {
		value = null;
	}
	return {
		key,
		value
	};
}
/** POST /wb-git/remote { sessionId, action, name?, url? }
*  list → { remotes: {name,url}[] }; add/remove/set-url → { action, name } */
async function endpointRemote(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const action = raw?.["action"];
	if (typeof action !== "string" || ![
		"list",
		"add",
		"remove",
		"set-url"
	].includes(action)) throw new WbError("bad-request", `invalid remote action "${String(action)}"`);
	const name = raw?.["name"];
	if (name !== void 0 && (typeof name !== "string" || !REMOTE_NAME_PATTERN.test(name))) throw new WbError("bad-request", `invalid remote name "${String(name)}"`);
	const url = raw?.["url"];
	if (url !== void 0 && (typeof url !== "string" || url === "" || url.startsWith("-") || /\s/.test(url))) throw new WbError("bad-request", "invalid remote url (must not contain whitespace or start with \"-\")");
	if (url !== void 0 && typeof url === "string" && url.includes("::")) throw new WbError("bad-request", "remote url must not use a remote-helper scheme");
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	if (action === "list") return { remotes: parseRemotes(await withGitError("remote", () => runGit(root, buildRemoteListArgs()))) };
	if (action === "add") {
		if (name === void 0 || url === void 0) throw new WbError("bad-request", "remote add requires name and url");
		await withGitError("remote add", () => runGit(root, buildRemoteAddArgs(name, url)));
		return {
			action,
			name
		};
	}
	if (action === "remove") {
		if (name === void 0) throw new WbError("bad-request", "remote remove requires name");
		await withGitError("remote remove", () => runGit(root, buildRemoteRemoveArgs(name)));
		return {
			action,
			name
		};
	}
	if (name === void 0 || url === void 0) throw new WbError("bad-request", "remote set-url requires name and url");
	await withGitError("remote set-url", () => runGit(root, buildRemoteSetUrlArgs(name, url)));
	return {
		action,
		name
	};
}
/** POST /wb-git/ref { sessionId, action, name?, newName?, hash?, remote? }
*  Safe branch/tag writes, checkout, and push (push-branch sets the upstream
*  with -u; push-tag pushes a tag). Every failure → fs-error (stderr in the
*  message, e.g. a dirty-worktree checkout or an unpushable ref). */
async function endpointRef(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const action = raw?.["action"];
	if (typeof action !== "string" || ![
		"create-branch",
		"rename-branch",
		"delete-branch",
		"create-tag",
		"delete-tag",
		"checkout",
		"push-branch",
		"push-tag"
	].includes(action)) throw new WbError("bad-request", `invalid ref action "${String(action)}"`);
	const name = raw?.["name"];
	if (name !== void 0 && (typeof name !== "string" || !isValidRefName(name))) throw new WbError("bad-request", `invalid ref name "${String(name)}"`);
	const newName = raw?.["newName"];
	if (newName !== void 0 && (typeof newName !== "string" || !isValidRefName(newName))) throw new WbError("bad-request", `invalid ref name "${String(newName)}"`);
	const hash = raw?.["hash"];
	if (hash !== void 0 && (typeof hash !== "string" || !HASH_PATTERN.test(hash))) throw new WbError("bad-request", `invalid commit hash "${String(hash)}"`);
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	if (action === "create-branch") {
		if (name === void 0 || hash === void 0) throw new WbError("bad-request", "create-branch requires name and hash");
		await withGitError("branch", () => runGit(root, buildCreateBranchArgs(name, hash)));
		return {
			action,
			name
		};
	}
	if (action === "rename-branch") {
		if (name === void 0 || newName === void 0) throw new WbError("bad-request", "rename-branch requires name and newName");
		await withGitError("branch -m", () => runGit(root, buildRenameBranchArgs(name, newName)));
		return {
			action,
			name,
			newName
		};
	}
	if (action === "delete-branch") {
		if (name === void 0) throw new WbError("bad-request", "delete-branch requires name");
		await withGitError("branch -D", () => runGit(root, buildDeleteBranchArgs(name)));
		return {
			action,
			name
		};
	}
	if (action === "create-tag") {
		if (name === void 0 || hash === void 0) throw new WbError("bad-request", "create-tag requires name and hash");
		await withGitError("tag", () => runGit(root, buildCreateTagArgs(name, hash)));
		return {
			action,
			name
		};
	}
	if (action === "delete-tag") {
		if (name === void 0) throw new WbError("bad-request", "delete-tag requires name");
		await withGitError("tag -d", () => runGit(root, buildDeleteTagArgs(name)));
		return {
			action,
			name
		};
	}
	if (action === "push-branch") {
		if (name === void 0) throw new WbError("bad-request", "push-branch requires name");
		const remote = pushRemoteOf(raw);
		const setUpstream = raw?.["setUpstream"] !== false;
		const mode = pushModeOf(raw);
		await withGitError("push", () => runGit(root, buildPushBranchArgs(remote, name, {
			setUpstream,
			mode
		})));
		return {
			action,
			name,
			remote,
			setUpstream,
			mode
		};
	}
	if (action === "push-tag") {
		if (name === void 0) throw new WbError("bad-request", "push-tag requires name");
		const remote = pushRemoteOf(raw);
		await withGitError("push", () => runGit(root, buildPushTagArgs(remote, name)));
		return {
			action,
			name,
			remote
		};
	}
	const ref = typeof hash === "string" ? hash : typeof name === "string" ? name : void 0;
	if (ref === void 0) throw new WbError("bad-request", "checkout requires a hash or a branch name");
	if (typeof hash === "string") await withGitError("switch --detach", () => runGit(root, buildSwitchDetachArgs(hash)));
	else {
		let kind;
		try {
			await runGit(root, [
				"rev-parse",
				"--verify",
				`refs/heads/${name}`
			]);
			kind = "branch";
		} catch {
			try {
				await runGit(root, [
					"rev-parse",
					"--verify",
					`refs/tags/${name}`
				]);
				kind = "tag";
			} catch {
				throw new WbError("bad-request", `unknown branch or tag "${String(name)}"`);
			}
		}
		if (kind === "branch") await withGitError("switch", () => runGit(root, buildSwitchArgs(name)));
		else await withGitError("switch --detach", () => runGit(root, buildSwitchDetachArgs(name)));
	}
	return {
		action,
		ref
	};
}
/** Push remote from a payload: defaults to 'origin'; an explicit value must
*  pass REMOTE_NAME_PATTERN (a leading '-' would be parsed by git as an
*  option, e.g. `git push --force`). */
function pushRemoteOf(raw) {
	const remote = raw?.["remote"];
	if (remote === void 0) return "origin";
	if (typeof remote !== "string" || !REMOTE_NAME_PATTERN.test(remote)) throw new WbError("bad-request", `invalid remote name "${String(remote)}"`);
	return remote;
}
/** Push mode from a payload: '' / 'normal' / 'force-with-lease' (anything
*  else → 400 bad-request). 'normal'/'' omit the force flag; only
*  'force-with-lease' appends --force-with-lease. */
function pushModeOf(raw) {
	const mode = raw?.["mode"];
	if (mode === void 0 || mode === "" || mode === "normal") return "normal";
	if (mode === "force-with-lease") return "force-with-lease";
	throw new WbError("bad-request", `invalid push mode "${String(mode)}"`);
}
/** POST /wb-git/status-files { sessionId, repoRoot? }
*  → { files: StatusFile[] } (working-tree changes; clean worktree → []).
*  Not a repository → fs-error (workTreeRootOf / the failing git status). */
async function endpointStatusFiles(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	return { files: parseStatusFiles(await withGitError("status", () => runGit(root, buildStatusFilesArgs(), 8388608))) };
}
/**
* Relative paths for git add/reset: no leading '-' (git option), no leading
* ':' (pathspec magic — `:(...)` selects an unintended set), no absolute
* path, no '..' escape, no control characters/NUL. Spaces and non-ASCII
* (e.g. Chinese filenames) are allowed — status-files returns such paths,
* so stage must accept them (git add handles them as argv).
*/
function isValidStagePath(path) {
	if (path === "" || path.startsWith("-") || path.startsWith(":")) return false;
	if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) return false;
	if (path.includes("..")) return false;
	return !/[\u0000-\u001f\u007f]/.test(path);
}
/** POST /wb-git/stage { sessionId, repoRoot?, action: add|unstage, path?, all? }
*  add → `git add <path>` (or the whole tree when all / no path);
*  unstage → `git reset HEAD <path>` (or the whole index when all / no path).
*  → { action, path: string|null, all: boolean }.
*  Unstage on an unborn HEAD (empty repo) is a no-op for `git reset HEAD --`
*  and succeeds; with a path it fails and surfaces as fs-error. */
async function endpointStage(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const action = raw?.["action"];
	if (action !== "add" && action !== "unstage") throw new WbError("bad-request", `invalid stage action "${String(action)}"`);
	const all = raw?.["all"] === true;
	let path;
	if (!all) {
		const rawPath = raw?.["path"];
		if (typeof rawPath !== "string" || !isValidStagePath(rawPath)) throw new WbError("bad-request", `invalid stage path "${String(rawPath)}"`);
		path = rawPath;
	}
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	if (action === "add") await withGitError("add", () => runGit(root, buildStageAddArgs(path)));
	else await withGitError("reset", () => runGit(root, buildStageResetArgs(path)));
	return {
		action,
		path: path ?? null,
		all: all ?? false
	};
}
const MAX_COMMIT_MESSAGE_LENGTH = 2e3;
/** POST /wb-git/commit { sessionId, repoRoot?, message }
*  `git commit -m <message>` (one argv element, no shell: newlines and any
*  characters are safe; message must be a non-empty string ≤2000 chars).
*  → { action: 'commit', hash: string|null } (hash read back after commit,
*  tolerated as null). Nothing staged → git commit fails → fs-error. */
async function endpointCommit(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const message = payload?.["message"];
	if (typeof message !== "string" || message === "" || message.length > MAX_COMMIT_MESSAGE_LENGTH) throw new WbError("bad-request", "commit message must be a non-empty string (max 2000 chars)");
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	await withGitError("commit", () => runGit(root, buildCommitArgs(message)));
	let hash = null;
	try {
		hash = (await runGit(root, ["rev-parse", "HEAD"])).trim();
	} catch {
		hash = null;
	}
	return {
		action: "commit",
		hash
	};
}
const MAX_FILE_CONTENT_CHARS = 262144;
/** POST /wb-git/file-content { sessionId, repoRoot?, hash, path, side: 'old'|'new' }
*  Read a single file's content at a given commit (new side) or its parent
*  (old side). For the three-column commit detail view (file tree | old | new).
*  → { content: string, exists: boolean, truncated: boolean, binary: boolean }
*  - Binary files (containing NUL byte) → content:'', binary:true
*  - Files > 256KB → truncated, sliced to 256KB (surrogate-safe)
*  - File/rev not found → exists:false
*  - Other git errors → fs-error */
async function endpointFileContent(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const hash = stringOrUndefined(raw, "hash");
	if (hash === void 0 || !HASH_PATTERN.test(hash)) throw new WbError("bad-request", `invalid commit hash "${hash ?? ""}"`);
	const filePath = raw?.["path"];
	if (typeof filePath !== "string" || !isValidStagePath(filePath)) throw new WbError("bad-request", `invalid file path "${String(filePath ?? "")}"`);
	const side = raw?.["side"];
	if (side !== "old" && side !== "new") throw new WbError("bad-request", `invalid side "${String(side ?? "")}", must be 'old' or 'new'`);
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	let rev;
	if (side === "old") {
		rev = `${hash}^`;
		try {
			await runGit(root, [
				"rev-parse",
				"--verify",
				`${hash}^`
			]);
		} catch {
			return {
				content: "",
				exists: false,
				truncated: false,
				binary: false
			};
		}
	} else rev = hash;
	let stdout;
	try {
		stdout = await runGit(root, buildShowFileArgs(rev, filePath), 4194304);
	} catch (error) {
		const msg = messageOf(error);
		if (/does not exist/i.test(msg) || /exists on disk, but not in/i.test(msg) || /bad revision/i.test(msg) || /unknown revision/i.test(msg) || /ambiguous argument/i.test(msg)) return {
			content: "",
			exists: false,
			truncated: false,
			binary: false
		};
		throw new WbError("fs-error", `show ${rev}:${filePath} failed: ${msg}`);
	}
	if (stdout.includes("\0")) return {
		content: "",
		exists: true,
		truncated: false,
		binary: true
	};
	const truncated = stdout.length > MAX_FILE_CONTENT_CHARS;
	let content = stdout;
	if (truncated) {
		const cut = stdout.slice(0, MAX_FILE_CONTENT_CHARS);
		const last = cut.charCodeAt(cut.length - 1);
		const end = last >= 55296 && last <= 56319 ? cut.length - 1 : cut.length;
		content = cut.slice(0, end);
	}
	return {
		content,
		exists: true,
		truncated,
		binary: false
	};
}
/** POST /wb-git/fetch { sessionId, repoRoot?, remote? }
*  remote null/undefined → `git fetch --all --prune`; otherwise the named
*  remote (validated via REMOTE_NAME_PATTERN).
*  → { action:'fetch', remote: string|null } */
async function endpointFetch(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const rawRemote = payload?.["remote"];
	let remote = null;
	if (rawRemote !== void 0 && rawRemote !== null) {
		if (typeof rawRemote !== "string" || !REMOTE_NAME_PATTERN.test(rawRemote)) throw new WbError("bad-request", `invalid remote name "${String(rawRemote)}"`);
		remote = rawRemote;
	}
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	await withGitError("fetch", () => runGit(root, buildFetchArgs(remote)));
	return {
		action: "fetch",
		remote
	};
}
/** POST /wb-git/pull { sessionId, repoRoot?, remote, branch }
*  `git pull <remote> <branch>` (validated remote + branch).
*  Dirty worktree / merge conflict → fs-error (stderr passed through).
*  → { action:'pull', remote, branch } */
async function endpointPull(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const remote = raw?.["remote"];
	if (typeof remote !== "string" || !REMOTE_NAME_PATTERN.test(remote)) throw new WbError("bad-request", `invalid remote name "${String(remote)}"`);
	const branch = raw?.["branch"];
	if (typeof branch !== "string" || !isValidRefName(branch)) throw new WbError("bad-request", `invalid branch name "${String(branch)}"`);
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	await withGitError("pull", () => runGit(root, buildPullArgs(remote, branch)));
	return {
		action: "pull",
		remote,
		branch
	};
}
/** POST /wb-git/fetch-into { sessionId, repoRoot?, remote, remoteBranch, localBranch }
*  `git fetch <remote> <remoteBranch>:<localBranch>` (all validated).
*  → { action:'fetch-into', remote, remoteBranch, localBranch } */
async function endpointFetchInto(ctx, payload) {
	const sessionId = stringOrUndefined(payload, "sessionId");
	const raw = payload;
	const remote = raw?.["remote"];
	if (typeof remote !== "string" || !REMOTE_NAME_PATTERN.test(remote)) throw new WbError("bad-request", `invalid remote name "${String(remote)}"`);
	const remoteBranch = raw?.["remoteBranch"];
	if (typeof remoteBranch !== "string" || !isValidRefName(remoteBranch)) throw new WbError("bad-request", `invalid remote branch name "${String(remoteBranch)}"`);
	const localBranch = raw?.["localBranch"];
	if (typeof localBranch !== "string" || !isValidRefName(localBranch)) throw new WbError("bad-request", `invalid local branch name "${String(localBranch)}"`);
	const cwd = sessionCwdOf(ctx, sessionId);
	const root = await repoRootOf(payload, ctx, sessionId) ?? await workTreeRootOf(ctx, cwd);
	await withGitError("fetch", () => runGit(root, buildFetchIntoArgs(remote, remoteBranch, localBranch)));
	return {
		action: "fetch-into",
		remote,
		remoteBranch,
		localBranch
	};
}
function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/wb-git",
		handler: async (req, res) => {
			if (!isTrustedRequest(req, ctx.webRuntime.trustedHosts)) {
				writeJson(res, 403, {
					ok: false,
					error: {
						code: "forbidden",
						message: "forbidden"
					}
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: {
						code: "bad-request",
						message: "method not allowed"
					}
				});
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const method = pathname.startsWith("/wb-git/") ? pathname.slice(8) : void 0;
			if (method === void 0 || method.includes("/")) {
				writeError(res, new WbError("not-found", `unknown /wb-git method "${method}"`, 404));
				return;
			}
			try {
				const payload = await readJsonBody(req);
				let value;
				if (method === "status") value = await endpointStatus(ctx, payload);
				else if (method === "repos") value = await endpointRepos(ctx, payload);
				else if (method === "log") value = await endpointLog(ctx, payload);
				else if (method === "detail") value = await endpointDetail(ctx, payload);
				else if (method === "branches") value = await endpointBranches(ctx, payload);
				else if (method === "config") value = await endpointConfig(ctx, payload);
				else if (method === "remote") value = await endpointRemote(ctx, payload);
				else if (method === "ref") value = await endpointRef(ctx, payload);
				else if (method === "status-files") value = await endpointStatusFiles(ctx, payload);
				else if (method === "stage") value = await endpointStage(ctx, payload);
				else if (method === "commit") value = await endpointCommit(ctx, payload);
				else if (method === "fetch") value = await endpointFetch(ctx, payload);
				else if (method === "pull") value = await endpointPull(ctx, payload);
				else if (method === "fetch-into") value = await endpointFetchInto(ctx, payload);
				else if (method === "file-content") value = await endpointFileContent(ctx, payload);
				else {
					writeError(res, new WbError("not-found", `unknown /wb-git method "${method}"`, 404));
					return;
				}
				writeOk(res, value);
			} catch (error) {
				writeError(res, error);
			}
		}
	}), "dock-git: /wb-git routes");
}
//#endregion
export { MAX_SCAN_DIRS, SEP, WbError, apply, buildBranchArgs, buildCheckoutArgs, buildCommitArgs, buildConfigGetArgs, buildConfigSetArgs, buildCreateBranchArgs, buildCreateTagArgs, buildDeleteBranchArgs, buildDeleteTagArgs, buildDetailArgs, buildFetchArgs, buildFetchIntoArgs, buildLogArgs, buildPullArgs, buildPushBranchArgs, buildPushTagArgs, buildRemoteAddArgs, buildRemoteListArgs, buildRemoteRemoveArgs, buildRemoteSetUrlArgs, buildRenameBranchArgs, buildShowFileArgs, buildShowRefArgs, buildStageAddArgs, buildStageResetArgs, buildStatusFilesArgs, buildSwitchArgs, buildSwitchDetachArgs, inject, isRepoRoot, name, parseBranches, parseCommitDetail, parseGitLog, parseNameStatus, parseNumStat, parseRemotes, parseShowRef, parseStatusFiles, runGit, scanRepos };
