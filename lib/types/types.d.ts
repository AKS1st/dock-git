/**
 * Shared data types for dock-git — the single home for every record type
 * consumed by more than one module (the git command layer, the host API and
 * the client view all agree on these shapes). Type-only file: it contains no
 * runtime code, so both the host build and the pure client modules can import
 * from it freely (the imports are erased).
 */
/** One parsed `git log` record (the graph rows the host sends to the view). */
export interface GitLogCommit {
    /** Full 40-hex commit hash. */
    hash: string;
    /** Full parent hashes, first parent first; empty for a root commit. */
    parents: string[];
    /** Author name. */
    author: string;
    /** Author email. */
    email: string;
    /** Author timestamp, unix seconds. */
    date: number;
    /** Commit subject (first line), non-empty. */
    message: string;
}
/** Full metadata of one commit (`/wb-git/detail` meta). */
export interface CommitDetailMeta {
    /** Full commit hash. */
    hash: string;
    /** Full parent hashes, first parent first; empty for a root commit. */
    parents: string[];
    /** Author name. */
    author: string;
    /** Author email. */
    authorEmail: string;
    /** Author timestamp, unix seconds. */
    authorDate: number;
    /** Committer name. */
    committer: string;
    /** Committer email. */
    committerEmail: string;
    /** Committer timestamp, unix seconds. */
    committerDate: number;
    /** The full commit message, subject line first, with no trailing newline. */
    body: string;
}
/** One changed path of a commit (name-status + numstat joined by the host). */
export interface FileChange {
    /** The (new) path, never empty. */
    path: string;
    /** Previous path; present for renames/copies. */
    oldPath?: string;
    /** One of A (added), M (modified), D (deleted), R (renamed), C (copied), U (unmerged). */
    status: string;
    /** Inserted line count; null for binary rows. */
    additions: number | null;
    /** Deleted line count; null for binary rows. */
    deletions: number | null;
}
/** One working-tree change (`/wb-git/status-files`). */
export interface StatusFile {
    /** The path, never empty. */
    path: string;
    /** One of A, M, D, R, C, U. */
    status: string;
    /** True when the change is in the index. */
    staged: boolean;
    /** Previous path; present for renames/copies. */
    oldPath?: string;
}
/** The parsed `git show-ref -d --head` result. */
export interface ShowRefResult {
    /** The hash HEAD points to, or null when there is no HEAD. */
    head: string | null;
    /** Local branches; name without the refs/heads/ prefix. */
    heads: {
        hash: string;
        name: string;
    }[];
    /** Tags; the peeled entry of an annotated tag carries the commit hash and annotated: true. */
    tags: {
        hash: string;
        name: string;
        annotated: boolean;
    }[];
    /** Remote-tracking refs; name without the refs/remotes/ prefix (e.g. origin/main). */
    remotes: {
        hash: string;
        name: string;
    }[];
}
/** One parsed `git branch --no-color[ --remotes]` row. */
export interface BranchRow {
    /** Local branches: plain name (e.g. main); remote-tracking: name with the remotes/ prefix kept. */
    name: string;
    /** True only for the checked-out branch. */
    current: boolean;
    /** The remote name for remote-tracking branches (e.g. origin); null for local branches. */
    remote: string | null;
}
/** One parsed `git remote -v` row (the fetch URL wins when fetch/push differ). */
export interface RemoteRow {
    /** Remote name. */
    name: string;
    /** The remote's fetch URL, non-empty. */
    url: string;
}
/** One row of NUL-delimited `git diff --name-status -z` output. */
export interface NameStatusRow {
    /** The (new) path, never empty. */
    path: string;
    /** One of A, M, D, R, C, U. */
    status: string;
    /** Previous path; present for R/C rows. */
    oldPath?: string;
}
/** One row of NUL-delimited `git diff --numstat -z` output. */
export interface NumStatRow {
    /** The path (for renames: the new path), never empty. */
    path: string;
    /** Inserted line count; null for binary rows (git reports a dash). */
    additions: number | null;
    /** Deleted line count; null for binary rows. */
    deletions: number | null;
}
