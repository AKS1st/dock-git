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
import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const name = "dock-git";
/**
 * Services required before mounting.
 *
 * The declared-authority list these routes fence with used to be injected here
 * as `webRuntime`. DSH renamed that service to `webStartup` in 0.2.1, so the
 * list is resolved lazily through `declaredTrustedHosts` instead: a renamed
 * service can no longer park this plugin, and older hosts still mount.
 */
export declare const inject: string[];
export { SEP, runGit, buildLogArgs, buildPushBranchArgs, buildPushTagArgs, buildDetailArgs, buildShowFileArgs, buildShowRefArgs, buildBranchArgs, buildConfigGetArgs, buildConfigSetArgs, buildRemoteListArgs, buildRemoteAddArgs, buildRemoteRemoveArgs, buildRemoteSetUrlArgs, buildCreateBranchArgs, buildRenameBranchArgs, buildDeleteBranchArgs, buildCreateTagArgs, buildDeleteTagArgs, buildCheckoutArgs, buildSwitchArgs, buildSwitchDetachArgs, buildFetchArgs, buildPullArgs, buildFetchIntoArgs, buildStatusFilesArgs, buildStageAddArgs, buildStageResetArgs, buildCommitArgs, buildResetArgs, buildRevertArgs, buildMergeArgs, parseGitLog, parseShowRef, parseCommitDetail, parseNameStatus, parseNumStat, parseBranches, parseRemotes, parseStatusFiles, } from './git-ops.ts';
export type { CommitDetailMeta, FileChange, GitLogCommit, StatusFile } from './types.ts';
export { MAX_SCAN_DIRS, currentBranchOf, isRepoRoot, scanRepos } from './repos.ts';
export type { RepoEntry } from './repos.ts';
/** Machine-readable error codes of the /wb-git API. */
type WbErrorCode = 'bad-request' | 'forbidden' | 'fs-error' | 'not-found' | 'workspace-not-ready' | 'internal';
/** One API failure with its wire code and HTTP status. */
export declare class WbError extends Error {
    readonly code: WbErrorCode;
    readonly status: number;
    constructor(code: WbErrorCode, message: string, status?: number);
}
interface WbContext {
    webServer: {
        register(options: {
            kind: 'prefix';
            path: string;
            handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
        }): () => void;
    };
    sessions: {
        get(sessionId: string): {
            header: {
                cwd?: string;
            };
        } | undefined;
    };
    /**
     * Read a service without declaring a hard dependency on it.
     *
     * Used for the optional `webStartup` / `webRuntime` / `connection` services:
     * a host that provides none of them keeps the loopback-only fence instead of
     * failing to mount.
     */
    get?(name: string): unknown;
    effect(fn: () => void | (() => void), label?: string): void;
}
export declare function apply(ctx: WbContext): void;
