/**
 * Git launcher (dock side-bar pane 'git'): clicking the dock 'git'
 * activity item scans the workspace for git repositories (host
 * /wb-git/repos, cwd + two levels) and either
 *   - opens the full history graph in an independent floating window and
 *     collapses the dock when the workspace itself is the only repository
 *     (repos.length === 1 && depth === 0 — the original single-repo flow,
 *     request carries no repoRoot), or
 *   - shows a repository picker in the side bar (like the dock-files tree
 *     panel) for multi-repo workspaces: repo name + path + depth badge;
 *     clicking one opens the graph window seeded with that repo's root
 *     (meta.repoRoot) and collapses the dock.
 * Empty scans ("no git repositories") and failed scans keep the pane visible
 * with a hint / error + retry.
 */
import { type ReactNode } from 'react';
import type { ViewProps } from './contract.ts';
export declare function GitLauncher(props: ViewProps): ReactNode;
