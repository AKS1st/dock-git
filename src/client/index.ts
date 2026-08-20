/**
 * Client half of dock-git: registers the 'git' activity-bar item, the
 * side-bar launcher pane and the 'git-history' editor view (the full history
 * graph, hosted in an independent floating window — the dock side bar is too
 * narrow for the graph). Clicking the 'git' activity item reveals the
 * launcher, which auto-opens the floating window.
 *
 * Registration and optional-peer-guard patterns follow dock-files.
 */
import type { IconSpec, WorkbenchContext, WorkbenchService } from './contract.ts'
import { GRAPH_VIEW_ID } from './constants'
import { CommitView } from './CommitView'
import { GitLauncher } from './GitLauncher'
import { detectLocale, translate } from './i18n'
import { mountStyles } from './styles'

/** Requires the workbench base to be mounted. */
export const inject = ['workbench']

/** Git branch icon (lucide git-branch, stroke style, currentColor). */
const GIT_ICON: IconSpec = {
  path: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  stroke: true,
}

export function apply(ctx: WorkbenchContext): void {
  const workbench = ctx.get<WorkbenchService>('workbench')
  // Optional-peer guard: skip silently when the base is absent.
  if (workbench === undefined) return

  // Panel styles (SVG overlay, ref chips, rows, detail panel).
  ctx.effect(() => mountStyles(), 'dock-git: styles')

  // Activity item: the left strip entry that reveals the git launcher pane
  // (which in turn opens the floating graph window).
  ctx.effect(() => workbench.registerActivityBarItem({
    id: 'git',
    title: translate(detectLocale(ctx), 'graphTitle'),
    icon: GIT_ICON,
    order: 20,
    paneId: 'git',
  }), 'dock-git: activity item')

  // The side-bar pane — a slim launcher (the graph itself lives in the
  // floating 'git-history' window: the side bar is too narrow for the graph).
  // The panel title is the repo list's own name, shown once by the dock's
  // sidebar header (the launcher renders no duplicate title).
  ctx.effect(() => workbench.registerPanel({
    id: 'git',
    region: 'sideBar',
    title: () => translate(detectLocale(ctx), 'repoSelectorTitle'),
    icon: GIT_ICON,
    order: 20,
    component: GitLauncher,
  }), 'dock-git: git launcher panel')

  // The full graph view, hosted in an independent floating window (default
  // 520×360, user-resizable, geometry remembered per view id).
  ctx.effect(() => workbench.registerEditorView({
    id: GRAPH_VIEW_ID,
    title: () => translate(detectLocale(ctx), 'graphTitle'),
    icon: GIT_ICON,
    order: 20,
    component: CommitView,
  }), 'dock-git: git history view')
}
