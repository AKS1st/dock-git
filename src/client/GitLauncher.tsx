/**
 * Git History launcher (dock side-bar pane 'git'): clicking the dock 'git'
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
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ViewProps, WorkbenchContext, WorkbenchService } from './contract.ts'
import { GRAPH_VIEW_ID } from './constants'
import { useLocale, type T } from './hooks'
import { translate } from './i18n'
import { messageOf, postWb } from './wb'

/** One /wb-git/repos entry (host src/repos.ts RepoEntry). */
interface RepoEntry {
  root: string
  name: string
  depth: number
}

/** /wb-git/repos result. */
interface ReposValue {
  cwd: string
  repos: RepoEntry[]
}

/** Depth badge label: 工作区 / 子目录 / 孙目录 (unknown depths fall back to d<N>). */
function depthLabel(depth: number, t: T): string {
  if (depth === 0) return t('depthWorkspace')
  if (depth === 1) return t('depthSub')
  if (depth === 2) return t('depthNested')
  return `d${depth}`
}

export function GitLauncher(props: ViewProps): ReactNode {
  const { ctx, sessionId, active } = props
  const workbench = ctx.get<WorkbenchService>('workbench')
  const locale = useLocale(ctx)
  const t: T = useCallback((key: string, params?: Record<string, string | number>): string =>
    translate(locale, key, params), [locale])

  const [repos, setRepos] = useState<RepoEntry[] | null>(null)
  const [cwd, setCwd] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  /** Monotonic scan sequence: a rapid re-activation/retry cannot let a stale
   *  /wb-git/repos response overwrite a newer one. */
  const scanSeq = useRef(0)

  // Session switch: drop the previous workspace's list so the loading state
  // shows until the new scan lands (no stale-repo flash).
  useEffect(() => {
    setRepos(null)
    setCwd(null)
  }, [sessionId])

  // On becoming active (dock 'git' activity click): scan the workspace. A
  // workspace that is itself the only repository opens the graph window
  // directly (existing behavior, no repoRoot); anything else leaves the
  // picker visible. Re-runs when the session, locale or retry counter change.
  useEffect(() => {
    if (!active || sessionId === undefined || workbench === undefined) return
    const seq = ++scanSeq.current
    let cancelled = false
    setLoading(true)
    setError(null)
    void postWb<ReposValue>('/wb-git/repos', { sessionId })
      .then((value) => {
        if (cancelled || seq !== scanSeq.current) return
        setCwd(value.cwd)
        setRepos(value.repos)
        setLoading(false)
        if (value.repos.length === 1 && value.repos[0].depth === 0) {
          // Single repo at the workspace itself → open the graph window and
          // collapse the dock (only the floating window remains). Always
          // openView: replacing the seed drops a stale meta.repoRoot from a
          // previously picked sub-repo, so the window shows the workspace
          // repo again instead of the old one.
          workbench.openView(GRAPH_VIEW_ID, { title: t('graphTitle') }, { floating: true })
          workbench.updateLayout({ activity: null, sideBarOpen: false })
        }
        // Otherwise the repo picker stays in the side bar (dock not collapsed).
      })
      .catch((cause) => {
        if (cancelled || seq !== scanSeq.current) return
        setError(messageOf(cause))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [active, sessionId, workbench, t, reloadTick])

  /** Pick one repository → open its history in the floating window, collapse. */
  const openRepo = (repo: RepoEntry): void => {
    if (workbench === undefined) return
    workbench.openView(GRAPH_VIEW_ID, { title: repo.name, meta: { repoRoot: repo.root } }, { floating: true })
    workbench.updateLayout({ activity: null, sideBarOpen: false })
  }

  if (sessionId === undefined) {
    return createElement('div', { className: 'dsh-wb-view dg-repo-list' },
      createElement('div', { className: 'dg-repo-empty' }, t('noSession')))
  }
  if (error !== null) {
    return createElement('div', { className: 'dsh-wb-view dg-repo-list' },
      createElement('div', { className: 'dg-err' }, `${t('error')}: ${error}`),
      createElement('button', {
        className: 'dg-btn',
        style: { margin: '4px 2px' },
        onClick: () => setReloadTick((n) => n + 1),
      }, t('retry')),
    )
  }
  if (repos === null) {
    return createElement('div', { className: 'dsh-wb-view dg-repo-list' },
      createElement('div', { className: 'dg-loading' }, loading ? t('loading') : '…'),
    )
  }

  const rows: ReactNode[] = repos.map((repo) =>
    createElement('div', {
      key: repo.root,
      className: 'dg-repo-item',
      title: repo.root,
      onClick: () => openRepo(repo),
    },
      createElement('div', { className: 'dg-repo-item-top' },
        createElement('span', { className: 'dg-repo-name' }, repo.name),
        createElement('span', {
          className: `dg-repo-depth dg-repo-depth-${Math.min(repo.depth, 2)}`,
          title: t('openRepo'),
        }, depthLabel(repo.depth, t)),
      ),
      createElement('div', { className: 'dg-repo-path', title: repo.root }, repo.root),
    ))

  return createElement('div', { className: 'dsh-wb-view dg-repo-list' },
    repos.length > 0 ? createElement('div', { className: 'dg-repo-list-hint' }, t('repoListHint')) : null,
    repos.length === 0
      ? createElement('div', { className: 'dg-repo-empty' },
        createElement('div', null, t('noReposFound')),
        cwd !== null
          ? createElement('div', { className: 'dg-muted', style: { marginTop: 4, fontSize: 12 } }, cwd)
          : null,
      )
      : rows,
  )
}
