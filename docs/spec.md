# dock-git — Functional Specification for Four Missing Modules

## 1. Purpose and scope

dock-git is a plugin for the DSH dock that visualises the git history of the
current workspace. The host half owns the git interaction: it runs git
commands in the repository and exposes the results as a JSON API under
`/wb-git`. The browser client half renders that data as an interactive commit
graph inside a dock editor view.

Most of the plugin is already written and is being kept as-is. Four modules
are missing and must be implemented from this specification:

| # | File | Role |
|---|------|------|
| 1 | `src/git-ops.ts` | Pure git command layer (host) |
| 2 | `src/client/swimlane.ts` | Pure swimlane graph-layout engine |
| 3 | `src/client/CommitView.tsx` | Main browser commit-list view |
| 4 | `src/types.ts` | Shared type definitions |

The implementer is expected to work from this document **plus the existing
files listed in section 1.1**. The existing files define the integration
surface; this document defines the behaviour of the new modules. Anything not
specified here is an implementation choice; where a choice is left open, this
document says so explicitly.

### 1.1 Reading list (all under the plugin root; nothing else)

- `src/index.ts` — the host entry. It imports the git command layer from
  `./git-data.ts` (see section 8 for the required wiring change) and shows
  every call site, validation rule and response shape the new layer must
  serve. It also re-exports a fixed set of symbols for the host smoke script.
- `src/repos.ts` — multi-repository discovery. Unchanged by this work; it
  receives `runGit` as an injected parameter.
- `src/client/` — the client shell: `index.ts` (registers the view),
  `constants.ts`, `hooks.ts`, `wb.ts` (wire helpers), `i18n.ts` (zh/en
  dictionary), `diff.ts` (side-by-side diff), `context-menu.tsx`,
  `dialog.tsx`, `GitLauncher.tsx`, `SettingsView.tsx`, `styles.ts`
  (the CSS the new view consumes). These define the feature surface the new
  view must integrate with.
- `scripts/` — `smoke-host.mjs` (drives the built host entry), `smoke-layout.mjs`
  and `render-preview.mjs` (drive the layout module), `smoke-diff.mjs` and
  `smoke-i18n.mjs` (use unchanged modules).

### 1.2 Conventions

- Source imports inside the plugin use the `.ts` extension on relative
  imports (existing code does this; the build configuration rewrites them).
- The layout module and the diff/i18n modules are pure: they must keep
  running directly under the same `node --experimental-strip-types` command
  the smoke scripts use, so they must not import anything that requires
  bundling, and must not touch the DOM or any process/global state.
- All user-visible copy must come from the existing locale dictionary via the
  translation function bound by the client hooks (`t`); the dictionary
  already contains every key the new view needs. The view must not invent new
  keys.
- The plugin builds with the existing scripts (`tsc` followed by the bundler
  step) and must remain free of type errors; section 8 gives the exact
  commands.

---

## 2. Module 1 — `src/git-ops.ts` (git command layer)

### 2.1 Role

A pure command layer that knows how to invoke the git executable and how to
turn its stdout into the typed records the host entry and the host smoke
script consume. It must:

- import no code from the plugin's other modules, no workbench/base code,
  and no client-side code (node built-ins are allowed, e.g. the
  child-process and buffer modules);
- import the data types it returns from `src/types.ts` (module 4);
- expose exactly the exports listed in section 2.2;
- perform no side effects other than running git.

Every function here is synchronous in shape and async in execution: the
argument builders return plain argument vectors, the parsers are pure
string → data functions, and `runGit` is the only function that executes
anything.

### 2.2 Required exports

The following exports are required. The first table is the complete list of
names the host entry imports today; the host entry must be able to import the
same names from this module after the wiring change of section 8. The second
table lists the auxiliary exports the host smoke script asserts directly.

**Values imported by `src/index.ts`:**

| Export | Kind |
|--------|------|
| `SEP` | constant |
| `runGit` | function |
| `buildLogArgs`, `buildDetailArgs`, `buildShowRefArgs`, `buildShowFileArgs`, `buildBranchArgs`, `buildConfigGetArgs`, `buildConfigSetArgs`, `buildRemoteListArgs`, `buildRemoteAddArgs`, `buildRemoteRemoveArgs`, `buildRemoteSetUrlArgs`, `buildCreateBranchArgs`, `buildRenameBranchArgs`, `buildDeleteBranchArgs`, `buildCreateTagArgs`, `buildDeleteTagArgs`, `buildCheckoutArgs`, `buildFetchArgs`, `buildPullArgs`, `buildFetchIntoArgs`, `buildPushBranchArgs`, `buildPushTagArgs`, `buildStatusFilesArgs`, `buildStageAddArgs`, `buildStageResetArgs`, `buildCommitArgs` | argument builders |
| `parseGitLog`, `parseShowRef`, `parseCommitDetail`, `parseNameStatus`, `parseNumStat`, `parseBranches`, `parseRemotes`, `parseStatusFiles` | parsers |

**Types imported by `src/index.ts` (defined in module 4):**
`CommitDetailMeta`, `FileChange`, `GitLogCommit`, `StatusFile`.

**Re-exported for the host smoke script (same names, unchanged semantics):**
`SEP`, `runGit`, every argument builder above, every parser above, and the
four types. The host entry currently re-exports exactly this set; it must
continue to do so after the wiring change.

### 2.3 `SEP` — record separator

A string constant used to separate the fields of one record inside the
machine-readable output of the log and detail commands. Requirements:

- it is a single string of length strictly greater than 10 (the host smoke
  script asserts this);
- it must be chosen so that it cannot occur inside ordinary git output
  (a long, randomly-looking token satisfies this);
- the log/detail argument builders and their matching parsers must agree on
  the exact same constant;
- the parsers must split records on it exactly, and must not emit empty or
  partial records when the output ends with the separator or a newline.

The exact value and the full record layout are the implementer's choice.

### 2.4 `runGit(cwd, args)` → `Promise<string>`

Executes the git executable with `args` in the working directory `cwd` and
resolves with the full stdout as a UTF-8 string. Requirements:

- the executable must be spawned directly with the argument vector — the
  command line must never be composed or interpreted as a single shell
  string;
- the environment passed to the child must be sanitised: any ambient
  `GIT_DIR` and `GIT_WORK_TREE` values must be removed so outer settings
  cannot redirect the repository the command operates on, and a fixed C
  locale must be forced (e.g. via the locale environment variables) so
  stdout and stderr text is deterministic regardless of the host locale.
  All other environment entries pass through unchanged;
- on success it resolves with the complete stdout (no trimming);
- on any non-zero exit it rejects with an `Error` whose message contains the
  git stderr text. The host layer surfaces `error.message` to the browser and
  matches substrings of it (e.g. "does not exist", "bad revision",
  "ambiguous argument") to decide failure kinds, so the message content must
  come from git's own stderr. The error should also carry the stderr text and
  the exit code as properties so callers can tell failure kinds apart;
- it must not swallow partial stdout on failure;
- it must not do anything with the output beyond returning the string — all
  interpretation happens in the parsers.

### 2.5 Argument builders

An argument builder takes the described parameters and returns the argument
vector (an array of strings) for one git sub-command, so that `runGit(root,
args)` produces output the matching parser consumes, or performs the
described mutation. Parameter values are already validated by the host entry
before the builder is called; the builders can trust them. For most builders
the exact flags are the implementer's choice, with the constraint that the
builder and its parser are exact inverses of each other. For a subset, the
host smoke script asserts the exact argument vector; those are pinned below
and must be reproduced verbatim.

#### Log

`buildLogArgs(maxCount, options?)` → argument vector for the log command
whose stdout `parseGitLog` can consume.

- `maxCount`: positive integer — at most this many commit records may appear
  in the output. The caller passes `maxCount + 1` when it wants a probe row
  and truncates itself, so the builder must honour the count exactly.
- `options` (optional):
  - `branches?: string[]` — when present and non-empty, the output must
    contain only commits reachable from the named refs (single-branch view);
    when absent or empty, the output must cover all refs (all-refs view).
  - `showRemote?: boolean` — when `false`, remote-tracking refs are excluded
    from the all-refs view; when `true` or absent they are included.
- Per commit record the output must carry, in order: the full commit hash,
  all parent hashes (space-separated, first parent first, empty for a root
  commit), the author name, the author email, the author timestamp (unix
  seconds), and the commit subject. The exact command line and record format
  are the implementer's choice.

#### Show-ref

`buildShowRefArgs()` → argument vector for the ref-listing command whose
stdout `parseShowRef` can consume. It must include the peeled entries of
annotated tags and the `HEAD` pseudo-ref, because the parser and its consumer
need both. The exact flags are the implementer's choice.

#### Detail

`buildDetailArgs(hash)` → argument vector for a single-commit metadata
command whose stdout `parseCommitDetail` can consume. It must work for merge
commits (multiple parents), root commits (no parents) and ordinary commits.

#### File content

`buildShowFileArgs(rev, path)` → must return exactly
`['show', `${rev}:${path}`]` (pinned by the host smoke script).

#### Branches

`buildBranchArgs(showRemote)` → argument vector for the branch-listing
command whose stdout `parseBranches` can consume. `showRemote` controls
whether remote-tracking branches appear in the output.

#### Config

- `buildConfigGetArgs(key)` → argument vector reading one configuration key.
  When the key is unset, the command must exit non-zero with empty stdout
  (the caller treats that as "no value").
- `buildConfigSetArgs(key, value)` → argument vector writing one
  configuration key to the repository-local configuration.

#### Remotes

- `buildRemoteListArgs()` → argument vector listing every remote together
  with its URL, so that `parseRemotes` can produce one `{name, url}` row per
  remote.
- `buildRemoteAddArgs(name, url)` → argument vector adding a remote.
- `buildRemoteRemoveArgs(name)` → argument vector removing a remote.
- `buildRemoteSetUrlArgs(name, url)` → argument vector changing a remote's
  URL.

#### Ref writes (branch / tag / checkout)

- `buildCreateBranchArgs(name, hash)` → argument vector creating a branch
  named `name` at commit `hash`.
- `buildRenameBranchArgs(name, newName)` → argument vector renaming branch
  `name` to `newName`.
- `buildDeleteBranchArgs(name)` → argument vector deleting branch `name`;
  the host entry documents this operation as a force delete, and the smoke
  setup deletes non-merged branches through it.
- `buildCreateTagArgs(name, hash)` → argument vector creating a plain (non
  annotated) tag named `name` at commit `hash`.
- `buildDeleteTagArgs(name)` → argument vector deleting tag `name`.
- `buildCheckoutArgs(ref)` → argument vector switching to `ref`, where `ref`
  is either a commit hash (detached checkout) or a branch/tag name. The
  caller decides which kind it is before calling.

#### Fetch / pull / fetch-into

The exact argument vectors below are pinned by the host smoke script and must
be reproduced verbatim.

- `buildFetchArgs(remote: string | null)`:
  - `null` → exactly `['fetch', '--all', '--prune']`;
  - a named remote `r` → exactly `['fetch', r, '--prune']`.
- `buildPullArgs(remote, branch)` → exactly `['pull', remote, branch]`.
- `buildFetchIntoArgs(remote, remoteBranch, localBranch)` → exactly
  `['fetch', remote, `${remoteBranch}:${localBranch}`]`.

#### Push

The exact argument vectors below are pinned by the host smoke script and must
be reproduced verbatim.

- `buildPushBranchArgs(remote, name, options?)` with
  `options?: { setUpstream?: boolean; mode?: 'normal' | 'force-with-lease' }`:
  - base vector is `['push', remote, name]`;
  - `--set-upstream` is appended when `setUpstream` is not `false`
    (defaults to true);
  - `--force-with-lease` is appended when `mode === 'force-with-lease'`
    (defaults to `'normal'`, which appends nothing);
  - the upstream flag precedes the force flag when both are present.

  Pinned examples: `buildPushBranchArgs('origin2', 'main')` →
  `['push', 'origin2', 'main', '--set-upstream']`;
  `buildPushBranchArgs('origin2', 'main', { setUpstream: false })` →
  `['push', 'origin2', 'main']`;
  `buildPushBranchArgs('origin2', 'main', { setUpstream: false, mode:
  'force-with-lease' })` →
  `['push', 'origin2', 'main', '--force-with-lease']`;
  `buildPushBranchArgs('origin2', 'main', { mode: 'force-with-lease' })` →
  `['push', 'origin2', 'main', '--set-upstream', '--force-with-lease']`.
- `buildPushTagArgs(remote, name)` → exactly `['push', remote, name]`.

#### Status / stage / commit

The exact argument vectors below are pinned by the host smoke script and must
be reproduced verbatim.

- `buildStatusFilesArgs()` → exactly
  `['status', '--porcelain', '-z', '--untracked-files=all']`.
- `buildStageAddArgs(path?)`:
  - with a path → exactly `['add', path]`;
  - without → exactly `['add', '-A']`.
- `buildStageResetArgs(path?)`:
  - with a path → exactly `['reset', 'HEAD', path]`;
  - without → exactly `['reset', 'HEAD', '--']`.
- `buildCommitArgs(message)` → exactly `['commit', '-m', message]` — the
  message is one argument vector element, so any characters (newlines
  included) stay safe.

### 2.6 Parsers

All parsers are pure functions from the stdout string produced by the
matching builder to typed records. They must tolerate trailing separators and
newlines, must produce no empty or "ghost" records, and must be robust to
paths containing spaces and non-ASCII characters (the corresponding git
output modes are NUL-delimited for this reason).

#### `parseGitLog(stdout)` → `GitLogCommit[]`

One record per commit, in output order (top row first). Fields:

| Field | Type | Meaning |
|-------|------|---------|
| `hash` | string | Full 40-hex commit hash |
| `parents` | string[] | Full parent hashes, first parent first; empty for a root commit |
| `author` | string | Author name |
| `email` | string | Author email |
| `date` | number | Author timestamp, unix seconds |
| `message` | string | Commit subject (first line), non-empty |

#### `parseShowRef(stdout)` → show-ref result

| Field | Type | Meaning |
|-------|------|---------|
| `head` | string \| null | The hash `HEAD` points to, or `null` when there is no `HEAD` |
| `heads` | `{ hash: string; name: string }[]` | Local branches; `name` without the `refs/heads/` prefix |
| `tags` | `{ hash: string; name: string; annotated: boolean }[]` | Tags; for an annotated tag the peeled entry must appear as an entry with the same name, the commit hash, and `annotated: true` (the consumer dedupes by name, preferring the annotated entry) |
| `remotes` | `{ hash: string; name: string }[]` | Remote-tracking refs; `name` without the `refs/remotes/` prefix (e.g. `origin/main`; the consumer derives the remote name from the first path segment) |

All hashes are full 40-hex strings.

#### `parseCommitDetail(stdout)` → `CommitDetailMeta`

| Field | Type | Meaning |
|-------|------|---------|
| `hash` | string | Full commit hash |
| `parents` | string[] | Full parent hashes, first parent first; empty for a root commit |
| `author` | string | Author name |
| `authorEmail` | string | Author email |
| `authorDate` | number | Author timestamp, unix seconds |
| `committer` | string | Committer name |
| `committerEmail` | string | Committer email |
| `committerDate` | number | Committer timestamp, unix seconds |
| `body` | string | The full commit message, subject line first, with no trailing newline |

#### `parseNameStatus(stdout)` → file-change rows

Input is NUL-delimited name-status output. One row per changed path:

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | The (new) path, never empty |
| `status` | string | One of `A` (added), `M` (modified), `D` (deleted), `R` (renamed), `C` (copied), `U` (unmerged) |
| `oldPath` | string (optional) | Present for `R`/`C` rows: the previous path |

#### `parseNumStat(stdout)` → numeric-stat rows

Input is NUL-delimited numstat output. One row per changed path:

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | The path, never empty |
| `additions` | number \| null | Inserted line count; `null` for binary rows (where git reports a dash) |
| `deletions` | number \| null | Deleted line count; `null` for binary rows |

The host entry joins name-status and numstat rows by path, so the parsers
must agree on path spelling exactly.

#### `parseBranches(stdout)` → branch rows

| Field | Type | Meaning |
|-------|------|---------|
| `name` | string | Local branches: plain name (e.g. `main`); remote-tracking branches: name with the `remotes/` prefix kept (e.g. `remotes/origin/main`) |
| `current` | boolean | `true` only for the checked-out branch |
| `remote` | string \| null | The remote name for remote-tracking branches (e.g. `origin`); `null` for local branches |

The `remotes/origin/HEAD` pointer must be excluded from the output. Rows keep
the order git reports (the consumer displays them in that order).

#### `parseRemotes(stdout)` → remote rows

| Field | Type | Meaning |
|-------|------|---------|
| `name` | string | Remote name |
| `url` | string | The remote's fetch URL, non-empty |

Exactly one row per remote: when the listing shows more than one line per
remote (fetch and push), they must collapse into one row (the fetch URL
wins).

#### `parseStatusFiles(stdout)` → `StatusFile[]`

Input is the output of `buildStatusFilesArgs` (porcelain, NUL-delimited,
untracked included). One row per working-tree change; a clean worktree yields
an empty array.

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | The path, never empty |
| `status` | string | One of `A`, `M`, `D`, `R`, `C`, `U` |
| `staged` | boolean | `true` when the change is in the index, `false` otherwise |
| `oldPath` | string (optional) | Present for renames/copies: the previous path |

Required mappings (the host smoke script asserts these): a staged
modification → `M`/`staged: true`; an unstaged modification → `M`/`staged:
false`; a staged addition → `A`/`staged: true`; an untracked file → `U`/
`staged: false`; a deleted file → `D` with the staged flag matching whether
the deletion is staged; a rename → `R` with `path` being the new name and
`staged` matching the index state. The exact porcelain-code mapping for
unusual states (e.g. unmerged entries) is the implementer's choice, as long
as the status value stays within the set above.

---

## 3. Module 2 — `src/client/swimlane.ts` (swimlane layout engine)

### 3.1 Role

A pure layout engine that turns an ordered list of commits (with their parent
links) into a swimlane graph model: for every commit a row position (lane
column), a colour, and flags; a set of branch-line segments connecting the
dots; and the graph dimensions. The view and the preview/smoke scripts both
consume this model. The module must:

- be pure: no runtime imports, no DOM access, no process/global access, and
  no UI-framework dependency — type-only imports are allowed (they are
  erased) so the module keeps running directly under the same
  `node --experimental-strip-types` command the smoke scripts use;
- be deterministic: identical input must always produce identical output;
- expose the four exports named in section 3.3 under those exact names, so
  the preview/smoke scripts only need their import path updated (section 8).

### 3.2 Input

`layoutGraph(commits, headHash?, options?)` where:

- `commits` — an array of commit records `{ hash: string, parents: string[]
  }` in display order: index 0 is the top (newest) row. The array may contain
  the uncommitted pseudo-row as its first element: a record whose hash is the
  literal marker `*` and whose single parent is the current head hash. It may
  also be empty (empty repository). Records are never duplicated.
- `headHash` — the hash of the current head commit, or `null`/absent when
  there is no head. Only a record whose hash equals `headHash` is flagged as
  current; if no record matches, no row is flagged.
- `options` — an optional expansion descriptor; see section 3.6.

### 3.3 Required exports

- `layoutGraph(commits, headHash?, options?)` → layout result (3.4).
- `applyExpandToLines(lines, { index, height })` → transformed line array
  (3.6).
- `GRID` — an object with the geometry constants `x` (horizontal spacing
  between adjacent lane columns, in px), `y` (vertical spacing between
  adjacent rows, in px), `offsetX` (left/right padding so the outermost dots
  are not clipped), `offsetY` (top/bottom padding). The view uses these
  constants to convert grid coordinates to pixel coordinates (3.5), and the
  preview/smoke scripts assert the dimension relationships against them. The
  numeric values are the implementer's choice, with two constraints: `y` must
  equal the CSS row height used by the view's commit rows (section 6.3), and
  the dimension relationships of section 3.4 must hold.
- `COLOURS` — the lane palette: an array of colour strings indexed by
  `colourIndex`. It must contain at least as many entries as the largest
  `colourIndex` the engine ever assigns. The palette values (and whether the
  palette needs dark-theme variants) are the implementer's choice.

### 3.4 Output

The layout result is an object with:

| Field | Type | Meaning |
|-------|------|---------|
| `rows` | array | One entry per input commit, in input order |
| `lines` | array | Branch-line segments between rows |
| `width` | number | Graph width in px |
| `height` | number | Graph height in px |

A row entry has:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | number | The index of the commit in the input array (0 = top row); the view looks the commit up with it |
| `x` | number | Lane column index (0-based, non-negative) |
| `colourIndex` | number | Index into `COLOURS` for this lane |
| `isCurrent` | boolean | `true` only for the row whose hash equals `headHash` |
| `isCommitted` | boolean | `false` for the uncommitted pseudo-row, `true` for every real commit |

A line entry has:

| Field | Type | Meaning |
|-------|------|---------|
| `p1` | `{ x, y }` | Start point, in grid units: `y` is the row index of the commit the line leaves |
| `p2` | `{ x, y }` | End point, in grid units: `y` is the row index the line arrives at |
| `colourIndex` | number | Index into `COLOURS`; equals the colour of the lane the line belongs to |
| `isCommitted` | boolean | `false` for lines that involve the uncommitted pseudo-row, `true` otherwise |

Coordinates are grid units (column/row indices), not pixels; the view and the
preview convert them with `GRID` (3.5). `y` grows downwards (row 0 at the
top). Every segment must start at the dot position of one row and end at the
dot position of another row — a segment always connects a row to the next
row that participates in that lane, with no intermediate rows skipped within
a single segment (the view draws curves between segment endpoints; see 3.5).

Dimensions must satisfy these relationships (the smoke script asserts them):

- `width === 2 * GRID.offsetX + (maxColumn) * GRID.x`, where `maxColumn` is
  the largest column index used anywhere in the output (rows and lines), or
  `0` when the graph is empty;
- `height` is derived from the row count and `GRID.y` (plus the top/bottom
  padding) such that every row's dot and every line endpoint falls inside the
  reported height; when an expansion is applied, `height` must exceed the
  unexpanded height by exactly the requested extra height (3.6);
- an empty commit list yields an empty model with zero rows and zero lines
  and non-negative dimensions.

### 3.5 Visual requirements

The following behaviours are requirements on the model. Everything about how
they are achieved internally (lane bookkeeping, colour assignment, curve
geometry) is the implementer's choice.

1. **One dot per lane.** Each commit sits on exactly one lane column, and
   consecutive commits of one branch chain (each commit's first-parent chain)
   stay on the same column whenever possible — a linear history occupies a
   single column.
2. **Merges.** On a merge commit (more than one parent), the first parent
   keeps the commit's column and each additional parent is placed on a new
   column of its own; the new column is then carried down by that parent's
   own chain.
3. **Visually continuous lines.** Branch lines run from the current row's
   column to the target row's column. When the two columns differ, the line
   still spans exactly from the start dot to the end dot; the view renders
   the horizontal transition inside the row band with a smooth curve (the
   curve style is the view's choice, see 6.3), so the model only needs the
   straight segment endpoints. Lines must not cross dots of other rows
   without arriving at their own endpoint row.
4. **Colour reuse.** Colours are recycled: after a lane ends (its last
   commit has no further loaded commit below it), a later lane may reuse the
   same `colourIndex`. The engine must not need more colours than the palette
   provides.
5. **Open lines at the bottom.** When a commit's parent is not among the
   loaded commits, its line must extend to the bottom edge of the graph
   (from that commit's dot to the graph's bottom boundary), so the graph
   reads as continuing below the loaded window.
6. **Uncommitted pseudo-row.** The pseudo-row (hash `*`) renders as an
   uncommitted row: `isCommitted: false`, and the segment from it down to its
   parent is also flagged `isCommitted: false`. The view draws uncommitted
   elements in grey.
7. **Head marker.** Exactly one row carries `isCurrent: true` when `headHash`
   matches a loaded commit; the view draws a distinct marker on it.
8. **Constant spacing.** Vertical dot spacing is constant (`GRID.y`) and
   horizontal column spacing is constant (`GRID.x`), so every pixel
   coordinate is linearly derivable from row/column indices:
   `px = x * GRID.x + GRID.offsetX`, `py = y * GRID.y + GRID.offsetY`.

### 3.6 Inline expansion support

The view can expand a row inline (a compact detail strip inserted under the
row, see 6.4); the graph must stay aligned with the rows, so the model must
support inserting extra vertical space at one row and re-splitting the lines
that cross it. Two cooperating exports provide this:

- `layoutGraph(commits, headHash, { index, height })` — the `options` object
  carries `index` (the row index the expansion is attached to) and `height`
  (the extra vertical space, in px). The result must have the same rows as
  the unexpanded layout, and a `height` exactly `height` px larger than the
  unexpanded height. The line set must be split so that any line passing
  through the added band is represented by two segments: one ending at the
  upper boundary of the band, one resuming at the lower boundary, preserving
  colour and committed flag, so the drawn line stays visually continuous
  across the gap.
- `applyExpandToLines(lines, { index, height })` — applies the same
  split transformation to a line array produced without expansion, returning
  a new array (the input is not mutated). When no line crosses the band, the
  output equals the input. All resulting segment coordinates must be valid
  (non-negative row/column indices).

Whether the two functions share an internal helper is the implementer's
choice; both must agree on the geometry of the band.

---

## 4. Module 3 — `src/client/CommitView.tsx` (main browser view)

### 4.1 Role

The main commit-list view: the editor view the client entry registers (under
the id from `constants.ts`), rendered in an independent floating window that
the launcher opens. It renders the repository's commit history as a swimlane
graph with an interactive row list, commit details, a working-tree change
panel, context menus, dialogs and a settings panel. It is the single consumer
of the layout module and the primary consumer of the wire API.

The module must be authored with the same element-creation and hook
conventions as the existing client view modules (see the view modules in
`src/client/`). It must provide the view component that the client entry's
existing import expects (the entry currently imports a component named
`CommitView` from a module path that does not exist yet; the new module
must satisfy that import — either by exporting that component under the same
name, or by updating the entry's import to this module and its export name.
Either way the registered view must mount, and the deliverable must build).

### 4.2 Component contract

The view component receives the standard view props from the workbench
(see the existing launcher for how the workbench hands props to a view):

- `ctx` — the workbench context (used for the locale hook and the locale
  event);
- `sessionId` — the active DSH conversation id, possibly absent (the view
  must show the "no session" state then);
- `active` — whether the view is on screen (see 4.10);
- `seed` — the open seed; the launcher opens this view with
  `meta: { repoRoot }` on the seed, so the view must read the repository
  root from `seed.meta.repoRoot` (a string) and use it as the `repoRoot`
  for every wire request (via the existing `wbBody` helper, which omits it
  when absent — an absent `repoRoot` means the host runs git at the session
  working directory).

The view owns the settings state: it must render the existing `SettingsView`
component (section 4.12) with the props that component declares, passing the
locale, the translation function, the current date format and a back
callback; the date format is persisted under the storage key the settings
component already uses (`dock-git:date-format`, default `relative`) and must
be read at mount.

### 4.3 Consumed existing modules

The view must integrate with the following existing client modules (their
exact exports are defined in the files themselves):

- `wb.ts` — `postWb`, `wbBody`, `messageOf` for every wire call;
- `hooks.ts` — `useLocale` and the `T` translation-function type;
- `i18n.ts` — `translate` for the locale binding (via the hook);
- `diff.ts` — `diffText` (and its row/cell types) for the side-by-side
  content view;
- `context-menu.tsx` — `ContextMenu` and `MenuItem` for right-click menus;
- `dialog.tsx` — `Dialog`, `PromptDialog`, `DialogInput`, `DialogSelect`,
  `DialogCheck` for all prompts/confirms;
- `SettingsView.tsx` — `SettingsView` and its props;
- `constants.ts` — the view id;
- `styles.ts` — the mounted stylesheet; the view must render with the class
  names the stylesheet defines (section 6 lists the relevant classes);
- `swimlane.ts` — the layout module (section 3).

### 4.4 Wire data model

The view consumes these `/wb-git` endpoints (all through `postWb` +
`wbBody(sessionId, repoRoot, extra)`):

| Endpoint | Payload | Result the view uses |
|----------|---------|----------------------|
| `/wb-git/log` | `{ maxCommits, branches?, showRemote? }` | `{ isRepo, root, branch, commits, more, head }` |
| `/wb-git/detail` | `{ hash }` | `{ meta, files, diff, truncated }` |
| `/wb-git/file-content` | `{ hash, path, side }` (`side: 'old' \| 'new'`) | `{ content, exists, truncated, binary }` |
| `/wb-git/branches` | `{ showRemote? }` | `{ branches, head }` |
| `/wb-git/status-files` | — | `{ files }` |
| `/wb-git/stage` | `{ action: 'add' \| 'unstage', path?, all? }` | `{ action, path, all }` |
| `/wb-git/commit` | `{ message }` | `{ action, hash }` |
| `/wb-git/ref` | `{ action, name?, newName?, hash?, remote?, setUpstream?, mode? }` | action result |
| `/wb-git/fetch` | `{ remote? }` | `{ action, remote }` |
| `/wb-git/pull` | `{ remote, branch }` | `{ action, remote, branch }` |
| `/wb-git/fetch-into` | `{ remote, remoteBranch, localBranch }` | `{ action, remote, remoteBranch, localBranch }` |

A log commit record has the fields of the shared log type plus the ref
decorations: `heads` (local branch names), `tags` (`{ name, annotated }`),
`remotes` (`{ name, remote }`), with `remote` naming the remote a
remote-tracking ref belongs to (or null). The log result may contain the
uncommitted pseudo-row as its first commit: hash `*`, parents `[head]`,
message starting "Uncommitted Changes", no refs. The view must recognise it
by its hash and render it as the grey, non-expandable uncommitted row
(section 6.5). A `head` value is the hash of the current head commit (or
null).

### 4.5 Header bar

A header (the `dg-header` classes) with, from left to right:

- the repository name (the seed title or the repository root's name —
  implementer's choice) and the current branch name;
- the commit count via the dictionary key `commitsCount` (`{n}`);
- a branch-filter dropdown (`dg-header-select`): an "all branches" entry plus
  one entry per branch from `/wb-git/branches` (remote-tracking entries only
  when the remote toggle is on); the current branch is visually marked.
  Selecting an entry reloads the log with `branches: [name]` (no filter for
  "all");
- a "show remote branches" toggle (`dg-toggle` with a checkbox) controlling
  `showRemote` on the log and branches requests;
- buttons (`dg-btn`): settings, refresh, load more (only when the log result
  reports `more: true`), and fetch.

Behaviour:

- **Refresh** refetches the log, the branch list and the working-tree file
  list, preserving the current branch filter, remote toggle and (where
  possible) the selected/expanded commit.
- **Load more** increases the requested commit count and appends the new
  commits to the list, preserving the current filter and scroll position.
- **Fetch** runs `/wb-git/fetch` with no remote (all remotes) and reports the
  outcome on the result strip (4.13), then refreshes the log.
- The header must not overflow its window: the stylesheet allows wrapping.

### 4.6 Rows area and graph overlay

The main area (`.dg-rows`, scrollable) contains:

- **The row list.** One `dg-row` per commit, in order. Each row is laid out
  with left padding equal to the graph width (from the layout result) so the
  text starts after the lane area, and contains: the ref chips (4.7), the
  message (`dg-msg`), the date (`dg-date`, formatted per 4.9), the author
  (`dg-author`) and a short hash prefix (`dg-hash`). Rows are exactly
  `GRID.y` px tall so the SVG dots align with them.
- **The SVG overlay.** A single absolutely-positioned `<svg>` (`.dg-graph`)
  covering the rows area, sized `layout.width` × `layout.height`. It draws:
  - branch lines in two passes per segment group: a shadow pass (`.shadow`)
    then the coloured line (`.line`) stroked with
    `COLOURS[colourIndex]` (grey when the segment is uncommitted);
  - a dot at every row position
    `(row.x * GRID.x + GRID.offsetX, row.id * GRID.y + GRID.offsetY)` —
    filled with the lane colour (grey for the uncommitted row), and with the
    `.current` marker class on the head row;
  - lane changes are drawn as smooth curves inside the row band between the
    segment endpoints; the curve geometry is the implementer's choice but
    must be the same style the preview script uses (section 8 keeps the
    preview in sync with the view).
  - The overlay itself must not intercept pointer events except the dots,
    which must be clickable (the stylesheet provides this split).
- **Row interaction.** Clicking a row selects it (`dg-row-selected`) and
  toggles its inline expansion (4.8). Clicking a dot is equivalent to
  clicking its row. Right-clicking a row opens the commit context menu
  (4.11); right-clicking a ref chip opens the menu for that ref kind.

When a row is expanded, the graph must be re-laid-out with the expansion
(3.6) so dots and lines stay aligned with the taller rows area, and the SVG
height must grow by the strip height.

### 4.7 Ref chips

The refs of a commit render as chips (`.dg-ref`):

- local branch names — `.dg-ref-head` (the stylesheet colours them green);
  the current branch additionally gets `.dg-ref-active` and its text colour
  set to the row's lane colour (the stylesheet derives the emphasis ring from
  it);
- remote-tracking refs — `.dg-ref-remote` (purple);
- tags — `.dg-ref-tag` (gold), with annotated tags optionally distinguished
  (implementer's choice).

Chips are non-interactive for selection but carry their context menu
(4.11). The uncommitted row renders no chips.

### 4.8 Inline expansion and commit metadata

Clicking a row toggles a compact inline strip (`.dg-inline-meta`) directly
under the row:

- while the detail is loading it shows a loading row (`.dg-inline-meta-loading`);
- loaded, it shows the commit metadata from `/wb-git/detail` (`meta`):
  hash, parents (as clickable links that select and expand the parent
  commit; a root commit shows the root marker), author, author date,
  committer, committer date, and the full message body;
- it offers a "view details" affordance that opens the bottom detail panel
  (4.9) for the commit;
- a load failure shows an inline error with a retry affordance.

Only one row is expanded at a time; expanding another row collapses the
previous one. The uncommitted pseudo-row cannot be expanded.

### 4.9 Bottom detail panel (three columns)

A bottom-docked panel (`.dg-detail-panel-bottom`) showing the selected
commit's file changes side by side with the old and new content:

- **Resize handle** (`.dg-detail-resize`): dragging it adjusts the panel
  height (bounded by the stylesheet's constraints); the handle shows the
  drag hint as its tooltip.
- **Head** (`.dg-detail-panel-head`): the commit subject
  (`.dg-detail-panel-title`) and a close control.
- **Body** (`.dg-detail-panel-body`) with three columns (`.dg-detail-cols`):
  1. **File tree** (`.dg-file-tree`): the commit's file list (from
     `/wb-git/detail` `files`) grouped by directory. Directories are
     collapsible (`.dg-tree-dir` with a `.dg-tree-arrow`); files are
     selectable rows (`.dg-tree-item`, `.dg-tree-active` when selected) and
     show the status letter styled by status (`.dg-file-A/M/D/R/C/U`) and
     the add/del counts (`.dg-file-stats`, `.dg-file-add`/`.dg-file-del`).
  2. **Old content** (`.dg-content-title` = "before" label) and
     3. **new content** ("after" label): a side-by-side view
     (`.dg-diff-container`, `.dg-diff-header` with two titles, `.dg-diff-body`
     with two independently horizontally scrolling panes `.dg-diff-pane`)
     built from `/wb-git/file-content` for `side: 'old'` and `'new'`,
     aligned through the diff module into rows styled
     `.dg-diff-add`/`.dg-diff-del`/`.dg-diff-same`/`.dg-diff-empty`.
- **Per-file states:** no file selected → the "select a file" hint; a file
  that does not exist on the old side (added) → the "missing (added)" hint;
  a file that does not exist on the new side (deleted) → the "missing
  (deleted)" hint; a binary file → the binary hint; content truncated by the
  host or capped by the view → the "too long" hints with the shown line
  count. Content for both sides is fetched on selection; a stale selection
  must not overwrite a newer one (4.13).
- The panel also offers the raw commit diff (from `/wb-git/detail` `diff`)
  — the implementer decides where it surfaces (e.g. a mode toggle on the
  head), as long as the three-column view remains the primary view.

### 4.10 Working-tree change panel

A panel (`.dg-commit-panel`) with:

- the working-tree file list from `/wb-git/status-files`, one row per file
  (`.dg-commit-row`): status letter, path, and a per-file action button
  (`.dg-commit-row-btn`): stage for unstaged/untracked files, unstage for
  staged files;
- a "stage all" control that stages everything (and unstages when nothing is
  staged — implementer's choice of single control vs. both directions);
- a commit-message textarea (`.dg-commit-msg`) and a commit button
  (`.dg-commit-btn`) that submits `/wb-git/commit`; the button is disabled
  while the message is empty (with the "enter a message" hint) and while any
  operation is busy (4.13);
- a "no changes" empty state (`.dg-commit-empty`) and a dedicated error area
  (`.dg-commit-error`) for stage/commit failures;
- after a successful commit the view reports the result on the strip
  ("Committed {hash}") and refreshes the graph and the file list.

The panel's visibility is controlled from the header (e.g. a "changes"
button); the implementer decides the exact affordance.

### 4.11 Context menus and dialogs

Right-click behaviour (via the existing `ContextMenu` component; all labels
from the dictionary):

- **Commit row menu:** view details; copy commit hash; copy commit subject;
  copy commit body; create branch…; add tag…; checkout…; and, when the
  commit carries a local branch, the branch actions below.
- **Local branch chip menu:** checkout branch; push branch…; rename…;
  delete… (with a confirmation dialog); copy branch name.
- **Remote chip menu:** copy remote branch name; pull into current branch
  (with a confirmation dialog); fetch into local branch… (prompt for the
  local branch name).
- **Tag chip menu:** push tag…; delete tag… (confirmation); copy tag name.

Dialogs (from `dialog.tsx`):

- prompts for branch/tag names (create branch, add tag, rename branch,
  delete confirmations, checkout confirmation);
- a push dialog for branches and tags with: the branch/tag name, a remote
  dropdown, a "set upstream" checkbox, and a mode dropdown (normal /
  force-with-lease).

All write actions route through the wire endpoints of 4.4
(`/wb-git/ref` actions `create-branch`, `rename-branch`, `delete-branch`,
`create-tag`, `delete-tag`, `checkout`, `push-branch`, `push-tag`; plus
`/wb-git/pull` and `/wb-git/fetch-into`). Copy actions use the browser
clipboard. After every successful write the view reports the localized
success summary on the result strip and refreshes the log (and, for
checkout, the branch header and file list).

### 4.12 Settings panel

The header's settings button swaps the view body for the existing
`SettingsView` (passing the props it declares); the back callback returns to
the graph. Opening settings must not lose the loaded log data — returning
must restore the graph without a refetch unless the data is stale (the
implementer decides the staleness rule).

### 4.13 State management

The view must satisfy the following state requirements:

- **Sequence guards against races.** Every request stream that can be
  superseded (log, detail, file content, branch list, working-tree list)
  carries a monotonic sequence number; a response whose sequence is stale is
  discarded. This protects against: a refresh racing an earlier load, a
  branch-filter change racing an earlier load, a repository switch racing an
  earlier load, and a file selection racing an earlier content fetch.
- **Session and repository switches.** When `sessionId` changes, or the seed
  `repoRoot` changes, the view resets its data and reloads; a previous
  repository's data must never flash in the new one's place.
- **Mutually exclusive write operations.** At most one mutating operation
  (stage, commit, branch/tag/ref writes, checkout, push, pull, fetch-into,
  fetch) runs at a time. While one is in flight, other write triggers are
  disabled and the busy message ("an operation is already in progress") is
  shown; after completion or failure the strip shows the localized success or
  failure summary (failure messages truncated via `messageOf`).
- **Result strip.** A dedicated strip (`.dg-op-msg` / `.dg-op-error`)
  reports the last operation outcome (success summary, failure message, or
  busy notice).
- **View lifecycle.** While `active` is false the view must not start new
  background requests; when it becomes active again it must re-sync (reload
  missing data, and refresh stale data — the implementer decides the exact
  staleness rule).
- **Locale.** The view re-renders on locale changes (via the locale hook);
  every visible string comes from the dictionary.
- **States.** Distinct, localized states for: no session; workspace not a
  repository (with hint and retry); empty repository (born without commits);
  no commits; loading; load failure (with retry); and "load more" when the
  log reports more rows.

---

## 5. Module 4 — `src/types.ts` (shared types)

### 5.1 Role

The single home for the data types shared by more than one module. It must
define, at minimum, the four host data types and the auxiliary parser result
types below. Any type imported by more than one module must live here and be
imported by those modules; a module may keep purely private types local to
itself. The file must contain no runtime code.

### 5.2 Required types

**`GitLogCommit`** — one log record:

| Field | Type |
|-------|------|
| `hash` | string |
| `parents` | string[] |
| `author` | string |
| `email` | string |
| `date` | number |
| `message` | string |

**`CommitDetailMeta`** — one commit's full metadata:

| Field | Type |
|-------|------|
| `hash` | string |
| `parents` | string[] |
| `author` | string |
| `authorEmail` | string |
| `authorDate` | number |
| `committer` | string |
| `committerEmail` | string |
| `committerDate` | number |
| `body` | string |

**`FileChange`** — one changed path of a commit:

| Field | Type |
|-------|------|
| `path` | string |
| `oldPath` | string (optional) |
| `status` | string |
| `additions` | number \| null |
| `deletions` | number \| null |

**`StatusFile`** — one working-tree change:

| Field | Type |
|-------|------|
| `path` | string |
| `status` | string |
| `staged` | boolean |
| `oldPath` | string (optional) |

**Auxiliary parser result types** (the implementer names them): the
show-ref result (`head`, `heads`, `tags`, `remotes` per 2.6), the branch row
(`name`, `current`, `remote` per 2.6), and the remote row (`name`, `url` per
2.6). The implementer may add further shared types (e.g. the layout input/
output types of section 3) if two or more modules need them; the layout
module's own record types may equally stay private to it — the implementer
decides, as long as nothing is duplicated across modules.

### 5.3 Wiring

`src/git-ops.ts` must import the four host data types from this module and
return them from its parsers. The host entry imports the same four types;
after the wiring change (section 8) it must keep re-exporting them exactly as
it does today (the re-export may come from this module directly or through
the git layer — the implementer decides, provided the public export surface
of the host entry is unchanged).

---

## 6. Styling contract for the new view

The stylesheet in `src/client/styles.ts` is already mounted by the client
entry and defines every class the view needs. The view must render with
those class names (they encode the visual language: theme variables, light
and dark variants, colours). The classes the view is expected to use are
grouped below; the view may use inline styles only where the stylesheet
explicitly expects them (e.g. the active chip's lane colour).

- View shell: `.dg-view`, `.dg-err`, `.dg-loading`, `.dg-not-repo`,
  `.dg-empty`, `.dg-btn`, `.dg-btn-danger`, `.dg-muted`, `.dg-saved`.
- Header: `.dg-header`, `.dg-repo`, `.dg-header-spacer`, `.dg-header-select`,
  `.dg-toggle`.
- Rows + graph: `.dg-rows`, `.dg-graph` (with `.shadow`, `.line`,
  `circle.current`), `.dg-row`, `.dg-row-selected`, `.dg-uncommitted`.
- Ref chips: `.dg-ref`, `.dg-ref-head`, `.dg-ref-remote`, `.dg-ref-tag`,
  `.dg-ref-active`.
- Row text: `.dg-msg`, `.dg-date`, `.dg-author`, `.dg-hash`.
- Inline expansion: `.dg-inline-meta`, `.dg-inline-meta-loading`,
  `.dg-inline-meta-body`, `.dg-inline-body`.
- Detail panel: `.dg-detail-panel-bottom`, `.dg-detail-resize`,
  `.dg-detail-panel-head`, `.dg-detail-panel-title`, `.dg-detail-panel-body`,
  `.dg-detail-cols`, `.dg-file-tree`, `.dg-file-tree-title`, `.dg-tree-item`,
  `.dg-tree-active`, `.dg-tree-dir`, `.dg-tree-arrow`, `.dg-tree-name`,
  `.dg-content-title`, `.dg-content-empty`, `.dg-detail-head`,
  `.dg-detail-title`, `.dg-detail-body`, `.dg-meta-row`, `.dg-meta-label`,
  `.dg-parent-link`, `.dg-body`, `.dg-file`, `.dg-file-status`,
  `.dg-file-A/M/D/R/C/U`, `.dg-file-add`, `.dg-file-del`, `.dg-file-stats`.
- Diff: `.dg-diff-container`, `.dg-diff`, `.dg-diff-header`, `.dg-diff-body`,
  `.dg-diff-pane`, `.dg-diff-line`, `.dg-diff-add`, `.dg-diff-del`,
  `.dg-diff-empty`, `.dg-diff-same`.
- Commit panel: `.dg-commit-panel`, `.dg-commit-body`, `.dg-commit-row`,
  `.dg-commit-row-btn`, `.dg-commit-actions`, `.dg-commit-hint`,
  `.dg-commit-msg`, `.dg-commit-btn`, `.dg-commit-empty`, `.dg-commit-error`.
- Result strip: `.dg-op-msg`, `.dg-op-error`.
- Context menu and dialogs come with the existing components.

Two alignment rules are hard requirements: the commit row height must equal
`GRID.y` (the SVG dots are positioned with `GRID.y`), and the graph overlay
must be sized exactly from the layout result's `width`/`height` with the
conversions of section 3.5.

---

## 7. Behavioural notes shared by the modules

- **Determinism:** all pure modules must produce identical output for
  identical input, so the smoke scripts can assert exact relationships.
- **Never trust formatted text:** parsers must rely on the machine-readable
  output modes their builders request (NUL-delimited where paths are
  involved), never on human-readable columns.
- **No global state:** the pure modules must not read or write module-level
  mutable state across calls (the layout engine in particular must be
  stateless between invocations).
- **Locale independence:** the git layer forces a fixed C locale (2.4); the
  layout and view must not depend on the host/browser locale except for the
  deliberately localized UI strings.

---

## 8. Integration, build and verification

### 8.1 Wiring changes

1. **`src/index.ts`** — the two import blocks that currently import from
   `./git-data.ts` (the value block and the type block) must switch to the
   new modules: the git command layer now lives in `./git-ops.ts` and the
   four data types in `./types.ts`. The host entry's **public export surface
   must remain symbol-identical** to today: `SEP`, `runGit`, every argument
   builder, every parser, the four type re-exports, and the multi-repo
   exports from `repos.ts` — because the host smoke script drives
   `../lib/index.js` after the build and asserts those symbols and their
   behaviour.
2. **`src/repos.ts`** — unchanged (it already receives `runGit` as a
   parameter).
3. **`src/client/index.ts`** — its import of the view component (currently
   `./CommitView`) must resolve to the new `./CommitView` module (either
   the new module exports the component under the name the entry imports, or
   the entry's import is updated to the new module and its export name). The
   registered editor view must mount under the existing view id and receive
   the seed `meta.repoRoot` the launcher passes.
4. **`scripts/smoke-layout.mjs`** and **`scripts/render-preview.mjs`** —
   their imports of the layout module currently point at
   `../src/client/graph.ts`; they must point at the new
   `../src/client/swimlane.ts` and its export names (`GRID`, `COLOURS`,
   `layoutGraph`, `applyExpandToLines`). Numeric expectations in those
   scripts that were derived from the previous geometry must be recomputed
   against the new geometry so they assert the same *relationships* (the
   width formula of 3.4, the exact-height expansion delta, the row/column
   facts of 3.5) with the new constants. The scripts must keep running via
   the commands in their own headers.
5. **`scripts/smoke-host.mjs`**, **`scripts/smoke-diff.mjs`**,
   **`scripts/smoke-i18n.mjs`** — no changes required beyond relocating the
   host smoke script's scratch repository directory to a neutral local path
   (see §8.3); the host script drives the built host entry whose exports are
   preserved, and the other two use unchanged modules.

### 8.2 Build

The deliverable must build cleanly:

```
pnpm run build
```

which runs the type-check (`tsc -p tsconfig.json`) followed by the bundling
step (`tsdown -c tsdown.config.mjs`), and also `pnpm run check` (type-check
only) must pass. The type-check emits on error, so any type error fails the
build. The four new files must be part of the build inputs (they are under
`src/`).

### 8.3 Smoke tests

After a successful build, all smoke scripts must exit 0:

- `node --experimental-strip-types scripts/smoke-i18n.mjs`
- `node --experimental-strip-types scripts/smoke-diff.mjs`
- `node --experimental-strip-types scripts/smoke-layout.mjs`
- `node scripts/smoke-host.mjs` (after the build; it creates its scratch
  repositories under a local scratch directory whose location is the
  implementer's choice — e.g., a gitignored directory inside the plugin or a
  path under the system temp directory — and must pass every check, including
  the pinned argument vectors of section 2 and the `SEP` length check)
- `node scripts/render-preview.mjs` (visual aid; it lays out a real
  repository history with the layout module and writes a standalone HTML +
  screenshot. It reads the smoke repository from the same local scratch
  location chosen for the host smoke script — the host smoke script creates
  that repository — and requires a browser for the screenshot step; the
  layout and HTML-generation portion must work from the new module).

### 8.4 Acceptance checklist

- `src/git-ops.ts` exists with all exports of section 2.2, the `SEP` length
  and `runGit` semantics of 2.3–2.4, and the pinned argument vectors of 2.5;
- `src/client/swimlane.ts` exists as a pure module exporting `GRID`,
  `COLOURS`, `layoutGraph`, `applyExpandToLines`, satisfying sections 3.3–3.6;
- `src/client/CommitView.tsx` exists, satisfies the view contract of
  sections 4.2–4.13 and the styling contract of section 6, and the client
  entry's import resolves;
- `src/types.ts` exists with the types of section 5;
- the host entry imports from the new modules and re-exports the unchanged
  symbol set;
- the layout/preview scripts point at the new module and their numeric
  expectations match the new geometry;
- `pnpm run check` and `pnpm run build` pass;
- all smoke scripts exit 0.

---

*End of specification.*
