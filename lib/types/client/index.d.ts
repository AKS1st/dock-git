/**
 * Client half of dock-git: registers the 'git' activity-bar item, the
 * side-bar launcher pane and the 'git-history' editor view (the full history
 * graph, hosted in an independent floating window — the dock side bar is too
 * narrow for the graph). Clicking the 'git' activity item reveals the
 * launcher, which auto-opens the floating window.
 *
 * Registration and optional-peer-guard patterns follow dock-files.
 */
import type { WorkbenchContext } from './contract.ts';
/** Requires the workbench base to be mounted. */
export declare const inject: string[];
export declare function apply(ctx: WorkbenchContext): void;
