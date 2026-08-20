/** One discovered repository root. */
export interface RepoEntry {
    /** Absolute repository root (toplevel of the work tree). */
    root: string;
    /** Directory name of the root (basename). */
    name: string;
    /** 0 = cwd itself, 1 = direct child of cwd, 2 = grandchild. */
    depth: number;
}
/** Directory-enumeration cap per scan layer (perf bound on one click). */
export declare const MAX_SCAN_DIRS = 200;
/** True when dir is itself a git repository root (toplevel === dir). */
export declare function isRepoRoot(dir: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<boolean>;
/** Scan cwd and two levels of subdirectories for repository roots. */
export declare function scanRepos(cwd: string, runGit: (cwd: string, args: string[]) => Promise<string>): Promise<RepoEntry[]>;
