/**
 * CommitView — the main commit-list view of dock-git: the editor view the
 * client entry registers under the 'git-history' id, hosted in an independent
 * floating window that the launcher opens. It renders the repository's commit
 * history as a swimlane graph (src/client/swimlane.ts) with an interactive
 * row list, inline commit metadata, a bottom-docked three-column detail panel,
 * a working-tree change panel, context menus, dialogs and a settings panel.
 *
 * Conventions follow the other client view modules (GitLauncher /
 * SettingsView): element creation via React.createElement, the `useLocale`
 * hook + bound `t` for every visible string (the dictionary already contains
 * every key used here), and the /wb-git wire helpers from wb.ts with the
 * repoRoot read from the open seed (`seed.meta.repoRoot`).
 */
import { type ReactNode } from 'react';
import type { ViewProps } from './contract.ts';
export declare function CommitView(props: ViewProps): ReactNode;
