/** One discovered repository root. */
export interface RepoEntry {
    /** Absolute repository root (toplevel of the work tree). */
    root: string;
    /** Directory name of the root (basename). */
    name: string;
    /** 0 = cwd itself, 1 = direct child of cwd, 2 = grandchild. */
    depth: number;
    /** Current branch name (rev-parse --abbrev-ref HEAD), or null when there is
     *  none to show: detached HEAD, unborn HEAD (empty repo), or a repo that
     *  cannot be resolved. */
    branch: string | null;
}
/** Directory-enumeration cap per scan layer (perf bound on one click). */
export declare const MAX_SCAN_DIRS = 200;
/** True when dir is itself a git repository root (toplevel === dir). */
export declare function isRepoRoot(dir: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<boolean>;
/**
 * Current branch name of a repository root, or null when there is none worth
 * showing. `rev-parse --abbrev-ref HEAD` reports the literal "HEAD" both for a
 * detached HEAD and for an unborn branch (empty repo), so both collapse to
 * null; any failure (not a work tree) is also null.
 */
export declare function currentBranchOf(root: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<string | null>;
/** Scan cwd and two levels of subdirectories for repository roots. */
export declare function scanRepos(cwd: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<RepoEntry[]>;
