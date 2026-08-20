/**
 * Shared client constants for dock-git. Kept in their own module (instead of
 * exporting from client/index.ts) so GitLauncher and CommitView can
 * import them without a circular dependency through the entry module.
 */
/** The editor-view id hosting the git history (opened in a floating window). */
export declare const GRAPH_VIEW_ID = "git-history";
