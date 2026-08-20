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
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import type { ViewProps } from 'dock/client/contract'
import { useLocale, type T } from './hooks'
import { translate } from './i18n'
import { diffText } from './diff'
import { ContextMenu, type MenuItem } from './context-menu'
import { Dialog, DialogCheck, DialogInput, DialogSelect, PromptDialog } from './dialog'
import { SettingsView, type DateFormat } from './SettingsView'
import { messageOf, postWb, wbBody } from './wb'
import {
  COLOURS,
  GRID,
  layoutGraph,
  type LayoutLine,
  type LayoutResult,
} from './swimlane'
import type { StatusFile } from '../types'

// ── Wire value shapes (mirror of the /wb-git endpoints, spec §4.4) ─────────

/** One graph row sent by /wb-git/log: log record + merged ref decorations. */
interface GraphCommit {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number
  message: string
  heads: string[]
  tags: { name: string; annotated: boolean }[]
  remotes: { name: string; remote: string | null }[]
}

interface LogValue {
  isRepo: boolean
  root: string | null
  branch: string | null
  commits: GraphCommit[]
  more: boolean
  head: string | null
}

interface BranchRowWire {
  name: string
  current: boolean
  remote: string | null
}

interface BranchesValue {
  branches: BranchRowWire[]
  head: string | null
}

interface StatusFilesValue {
  files: StatusFile[]
}

interface DetailValue {
  meta: {
    hash: string
    parents: string[]
    author: string
    authorEmail: string
    authorDate: number
    committer: string
    committerEmail: string
    committerDate: number
    body: string
  }
  files: Array<{ path: string; oldPath?: string; status: string; additions: number | null; deletions: number | null }>
  diff: string
  truncated: boolean
}

interface FileContentValue {
  content: string
  exists: boolean
  truncated: boolean
  binary: boolean
}

interface RemoteRowWire {
  name: string
  url: string
}

// ── Local constants ─────────────────────────────────────────────────────────

/** Height of the inline expansion strip (px): the graph band inserted under
 *  an expanded row must match the DOM strip exactly, so it is one constant. */
const INLINE_META_HEIGHT = 192
/** Initial commit window; "load more" grows it by this amount. */
const LOAD_MORE_STEP = 200
/** Diff line cap (the diff module's own default; rows beyond it are dropped). */
const MAX_DIFF_LINES = 5000

// ── Small pure helpers ──────────────────────────────────────────────────────

function shortHash(hash: string): string {
  return hash.length > 8 ? hash.slice(0, 8) : hash
}

function absoluteDate(date: number): string {
  const d = new Date(date * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Relative date from the dictionary (justNow / minutesAgo / hoursAgo);
 *  anything older falls back to the locale-neutral absolute date. */
function relativeDate(date: number, now: number, t: T): string {
  const diff = Math.max(0, now - date)
  if (diff < 60) return t('justNow')
  if (diff < 3600) return t('minutesAgo', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('hoursAgo', { n: Math.floor(diff / 3600) })
  return absoluteDate(date)
}

function formatDate(date: number, now: number, format: DateFormat, t: T): string {
  return format === 'absolute' ? absoluteDate(date) : relativeDate(date, now, t)
}

/** Stable colour for a ref (local branch, remote branch or tag) derived from
 *  its name: the same ref always gets the same palette colour (consistent
 *  across commits and sessions), and distinct refs spread across the palette.
 *  The lane colours the graph lines use are separate — the badge colour
 *  identifies the ref itself, not the commit it sits on. */
function refColour(name: string): string {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return COLOURS[(h >>> 0) % COLOURS.length]
}

/** Group the changed files of a commit by directory ('' = repository root). */
function groupFiles(files: DetailValue['files']): { dir: string; files: DetailValue['files'] }[] {
  const byDir = new Map<string, DetailValue['files']>()
  for (const file of files) {
    const idx = file.path.lastIndexOf('/')
    const dir = idx >= 0 ? file.path.slice(0, idx) : ''
    const list = byDir.get(dir)
    if (list === undefined) byDir.set(dir, [file])
    else list.push(file)
  }
  return [...byDir.entries()]
    .sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0] < b[0] ? -1 : 1))
    .map(([dir, list]) => ({ dir, files: list }))
}

/** Classify one raw unified-diff line for colouring. File-header lines are
 *  checked before the generic +/- so `--- a/x` / `+++ b/x` are not mistaken
 *  for additions/deletions. */
function rawDiffLineClass(line: string): string {
  if (line.startsWith('--- ') || line.startsWith('+++ ')) return 'dg-diff-line dg-diff-hdr'
  if (line.startsWith('@@')) return 'dg-diff-line dg-diff-hunk'
  if (line.startsWith('diff --git')
    || line.startsWith('index ')
    || line.startsWith('new file')
    || line.startsWith('deleted file')
    || line.startsWith('Binary files')) return 'dg-diff-line dg-diff-hdr'
  if (line.startsWith('+')) return 'dg-diff-line dg-diff-add'
  if (line.startsWith('-')) return 'dg-diff-line dg-diff-del'
  return 'dg-diff-line dg-diff-same'
}

// ── Dialogs / menus ────────────────────────────────────────────────────────

type DialogState =
  | { kind: 'create-branch'; hash: string }
  | { kind: 'add-tag'; hash: string }
  | { kind: 'checkout'; hash?: string; name?: string }
  | { kind: 'rename-branch'; name: string }
  | { kind: 'delete-branch'; name: string }
  | { kind: 'delete-tag'; name: string }
  | { kind: 'push'; target: 'branch' | 'tag'; name: string }
  | { kind: 'pull'; remote: string; branch: string }
  | { kind: 'fetch-into'; remote: string; branch: string }

/** One open push dialog's form values. */
interface PushForm {
  remote: string
  setUpstream: boolean
  mode: 'normal' | 'force-with-lease'
}

// ── The view ───────────────────────────────────────────────────────────────

export function CommitView(props: ViewProps): ReactNode {
  const { ctx, sessionId, active, seed } = props

  // The launcher opens this view with meta.repoRoot on the seed; absent means
  // the host runs git at the session working directory (wbBody omits it).
  const seedMeta = (seed as { meta?: { repoRoot?: unknown } } | undefined)?.meta
  const repoRoot = typeof seedMeta?.repoRoot === 'string' && seedMeta.repoRoot !== '' ? seedMeta.repoRoot : undefined
  const seedTitle = (seed as { title?: unknown } | undefined)?.title

  const locale = useLocale(ctx)
  const t: T = useCallback((key: string, params?: Record<string, string | number>): string =>
    translate(locale, key, params), [locale])

  const body = useCallback((extra?: Record<string, unknown>): Record<string, unknown> =>
    wbBody(sessionId, repoRoot, extra), [sessionId, repoRoot])

  // ── View mode / date format ──────────────────────────────────────────────
  const [mode, setMode] = useState<'graph' | 'settings'>('graph')
  const [dateFormat, setDateFormat] = useState<DateFormat>(() => {
    try {
      return localStorage.getItem('dock-git:date-format') === 'absolute' ? 'absolute' : 'relative'
    } catch {
      return 'relative'
    }
  })
  const handleDateFormatChange = (format: DateFormat): void => {
    setDateFormat(format)
    try {
      localStorage.setItem('dock-git:date-format', format)
    } catch {
      // Storage unavailable: the setting simply stays in-memory.
    }
  }

  // ── Log data ─────────────────────────────────────────────────────────────
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [root, setRoot] = useState<string | null>(null)
  const [branch, setBranch] = useState<string | null>(null)
  const [commits, setCommits] = useState<GraphCommit[]>([])
  const [more, setMore] = useState(false)
  const [head, setHead] = useState<string | null>(null)
  const [maxCommits, setMaxCommits] = useState(LOAD_MORE_STEP)
  const [branchFilter, setBranchFilter] = useState<string | null>(null)
  const [showRemote, setShowRemote] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [branches, setBranches] = useState<BranchRowWire[]>([])
  const [reloadTick, setReloadTick] = useState(0)

  // ── Selection / expansion / bottom panel ─────────────────────────────────
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<DetailValue | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailRetryTick, setDetailRetryTick] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelHash, setPanelHash] = useState<string | null>(null)
  const [panelDetail, setPanelDetail] = useState<DetailValue | null>(null)
  const [panelMode, setPanelMode] = useState<'files' | 'diff'>('files')
  const [panelHeight, setPanelHeight] = useState(240)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [oldContent, setOldContent] = useState<FileContentValue | null>(null)
  const [newContent, setNewContent] = useState<FileContentValue | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  // ── Working-tree panel ───────────────────────────────────────────────────
  const [commitPanelOpen, setCommitPanelOpen] = useState(false)
  const [statusFiles, setStatusFiles] = useState<StatusFile[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [commitError, setCommitError] = useState<string | null>(null)

  // ── Operation strip / busy guard ─────────────────────────────────────────
  const [opMsg, setOpMsg] = useState<string | null>(null)
  const [opError, setOpError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  // ── Menus / dialogs / remotes (push dialog) ──────────────────────────────
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pushForm, setPushForm] = useState<PushForm>({ remote: 'origin', setUpstream: true, mode: 'normal' })
  const [remotes, setRemotes] = useState<RemoteRowWire[]>([])

  // ── Sequence guards (stale responses are discarded) ──────────────────────
  const logSeq = useRef(0)
  const branchesSeq = useRef(0)
  const statusSeq = useRef(0)
  const detailSeq = useRef(0)
  const contentSeq = useRef(0)

  // Scroll restoration for "load more" (the new, longer list must not jump).
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const restoreScroll = useRef<number | null>(null)

  // Side-by-side diff panes: their horizontal scroll positions stay in sync.
  const oldPaneRef = useRef<HTMLDivElement | null>(null)
  const newPaneRef = useRef<HTMLDivElement | null>(null)

  // ── Data loading ─────────────────────────────────────────────────────────

  /** Reset everything tied to the current repository/session. */
  const resetData = useCallback((): void => {
    setIsRepo(null)
    setRoot(null)
    setBranch(null)
    setCommits([])
    setMore(false)
    setHead(null)
    setLoading(false)
    setLoadError(null)
    setBranches([])
    setSelectedId(null)
    setExpandedId(null)
    setDetail(null)
    setDetailError(null)
    setPanelOpen(false)
    setPanelHash(null)
    setPanelDetail(null)
    setSelectedFile(null)
    setOldContent(null)
    setNewContent(null)
    setStatusFiles([])
    setCommitError(null)
    setOpMsg(null)
    setOpError(null)
  }, [])

  const repoKey = `${sessionId ?? ''}\u0000${repoRoot ?? ''}`

  // Session / repository switch: drop the previous repo's data before the new
  // one loads so it can never flash in place of the new data.
  useEffect(() => {
    resetData()
  }, [repoKey, resetData])

  // Log: reloads when the session/repo, the filter, the toggle, the window or
  // the refresh tick changes — and only while the view is on screen.
  useEffect(() => {
    if (!active || sessionId === undefined) return
    const seq = ++logSeq.current
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    postWb<LogValue>('/wb-git/log', body({
      maxCommits,
      ...(branchFilter !== null ? { branches: [branchFilter] } : {}),
      showRemote,
    }))
      .then((value) => {
        if (cancelled || seq !== logSeq.current) return
        // Re-resolve the expanded row by hash so a refresh (or filter change)
        // keeps the same commit expanded when it is still in the new list.
        const previousHash = expandedId !== null ? commits[expandedId]?.hash : undefined
        setLoading(false)
        setIsRepo(value.isRepo)
        setRoot(value.root)
        setBranch(value.branch)
        setCommits(value.commits)
        setMore(value.more)
        setHead(value.head)
        if (previousHash !== undefined) {
          const idx = value.commits.findIndex((c) => c.hash === previousHash)
          setExpandedId(idx >= 0 ? idx : null)
        }
      })
      .catch((cause) => {
        if (cancelled || seq !== logSeq.current) return
        setLoading(false)
        setLoadError(messageOf(cause))
      })
    return () => { cancelled = true }
  }, [active, repoKey, branchFilter, showRemote, maxCommits, reloadTick, body])

  // Branch list for the header dropdown (remote entries only with the toggle).
  useEffect(() => {
    if (!active || sessionId === undefined) return
    const seq = ++branchesSeq.current
    let cancelled = false
    postWb<BranchesValue>('/wb-git/branches', body({ showRemote }))
      .then((value) => {
        if (cancelled || seq !== branchesSeq.current) return
        setBranches(value.branches)
      })
      .catch(() => { /* the dropdown simply stays with what it has */ })
    return () => { cancelled = true }
  }, [active, repoKey, showRemote, reloadTick, body])

  // Working-tree file list for the changes panel.
  useEffect(() => {
    if (!active || sessionId === undefined) return
    const seq = ++statusSeq.current
    let cancelled = false
    postWb<StatusFilesValue>('/wb-git/status-files', body())
      .then((value) => {
        if (cancelled || seq !== statusSeq.current) return
        setStatusFiles(value.files)
      })
      .catch(() => { setStatusFiles([]) })
    return () => { cancelled = true }
  }, [active, repoKey, reloadTick, body])

  // Inline expansion: load the commit detail for the expanded row.
  useEffect(() => {
    if (expandedId === null || sessionId === undefined || commits[expandedId] === undefined) {
      setDetail(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }
    const hash = commits[expandedId].hash
    if (hash === '*') {
      setDetail(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }
    const seq = ++detailSeq.current
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    postWb<DetailValue>('/wb-git/detail', body({ hash }))
      .then((value) => {
        if (cancelled || seq !== detailSeq.current) return
        setDetail(value)
        setDetailLoading(false)
      })
      .catch((cause) => {
        if (cancelled || seq !== detailSeq.current) return
        setDetailError(messageOf(cause))
        setDetailLoading(false)
      })
    return () => { cancelled = true }
  }, [expandedId, sessionId, body, commits, detailRetryTick])

  // Bottom detail panel: load the selected commit's detail (and reset the
  // file selection when the commit changes).
  useEffect(() => {
    if (panelHash === null || sessionId === undefined) {
      setPanelDetail(null)
      setSelectedFile(null)
      setOldContent(null)
      setNewContent(null)
      return
    }
    const seq = ++detailSeq.current
    let cancelled = false
    postWb<DetailValue>('/wb-git/detail', body({ hash: panelHash }))
      .then((value) => {
        if (cancelled || seq !== detailSeq.current) return
        setPanelDetail(value)
        setSelectedFile(value.files.length > 0 ? value.files[0].path : null)
        setOldContent(null)
        setNewContent(null)
      })
      .catch(() => { setPanelDetail(null) })
    return () => { cancelled = true }
  }, [panelHash, sessionId, body])

  // File content for the selected file (both sides, stale-guarded).
  useEffect(() => {
    if (panelHash === null || selectedFile === null || sessionId === undefined) {
      setOldContent(null)
      setNewContent(null)
      setContentLoading(false)
      return
    }
    const seq = ++contentSeq.current
    let cancelled = false
    setContentLoading(true)
    Promise.all([
      postWb<FileContentValue>('/wb-git/file-content', body({ hash: panelHash, path: selectedFile, side: 'old' })),
      postWb<FileContentValue>('/wb-git/file-content', body({ hash: panelHash, path: selectedFile, side: 'new' })),
    ])
      .then(([oldValue, newValue]) => {
        if (cancelled || seq !== contentSeq.current) return
        setOldContent(oldValue)
        setNewContent(newValue)
        setContentLoading(false)
      })
      .catch(() => {
        if (cancelled || seq !== contentSeq.current) return
        setOldContent(null)
        setNewContent(null)
        setContentLoading(false)
      })
    return () => { cancelled = true }
  }, [panelHash, selectedFile, sessionId, body])

  // Restore the scroll position after "load more" replaced the list.
  useEffect(() => {
    if (restoreScroll.current !== null && rowsRef.current !== null) {
      rowsRef.current.scrollTop = restoreScroll.current
      restoreScroll.current = null
    }
  }, [commits])

  // ── Mutating operations (one at a time) ──────────────────────────────────

  /** Run one mutating /wb-git operation under the busy guard; returns true on
   *  success. `summary` (localized) is shown on the result strip on success;
   *  `onError` receives the localized failure message (e.g. for a
   *  panel-local error area). */
  const runWrite = useCallback(async (
    summary: string | null,
    fn: () => Promise<void>,
    onError?: (message: string) => void,
  ): Promise<boolean> => {
    if (busyRef.current) {
      setOpError(t('operationBusy'))
      return false
    }
    busyRef.current = true
    setBusy(true)
    setOpMsg(null)
    setOpError(null)
    try {
      await fn()
      if (summary !== null) setOpMsg(summary)
      return true
    } catch (cause) {
      const message = t('operationFailed', { msg: messageOf(cause) })
      setOpError(message)
      onError?.(message)
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [t])

  /** After a successful write: reload the log, the branches and the files. */
  const refresh = useCallback((): void => {
    setReloadTick((n) => n + 1)
  }, [])

  const reloadStatus = useCallback((): void => {
    if (sessionId === undefined) return
    const seq = ++statusSeq.current
    postWb<StatusFilesValue>('/wb-git/status-files', body())
      .then((value) => {
        if (seq !== statusSeq.current) return
        setStatusFiles(value.files)
      })
      .catch(() => { /* the panel keeps its previous list */ })
  }, [sessionId, body])

  // ── Row interaction ──────────────────────────────────────────────────────

  /** Clicking a row selects it, toggles its inline expansion (the uncommitted
   *  pseudo-row can be selected but never expanded) and opens the bottom
   *  detail panel for that commit. */
  const toggleRow = useCallback((rowId: number): void => {
    setSelectedId(rowId)
    const isPseudo = commits[rowId]?.hash === '*'
    if (!isPseudo) setExpandedId((current) => (current === rowId ? null : rowId))
    const commit = commits[rowId]
    if (commit !== undefined && !isPseudo) {
      setPanelOpen(true)
      setPanelHash(commit.hash)
    }
  }, [commits])

  /** Select + expand the commit with the given hash (parent links), and open
   *  its bottom detail panel. */
  const selectByHash = useCallback((hash: string): void => {
    const id = commits.findIndex((c) => c.hash === hash)
    if (id >= 0) {
      setSelectedId(id)
      setExpandedId(id)
      setPanelOpen(true)
      setPanelHash(hash)
    }
  }, [commits])

  // ── Layout ───────────────────────────────────────────────────────────────

  const layout: LayoutResult = useMemo(() => {
    const input = commits.map((c) => ({ hash: c.hash, parents: c.parents }))
    const canExpand = expandedId !== null && commits[expandedId]?.hash !== '*'
    const options = canExpand ? { index: expandedId as number, height: INLINE_META_HEIGHT } : undefined
    return layoutGraph(input, head, options)
  }, [commits, head, expandedId])

  const toPx = useCallback((p: { x: number; y: number }): { x: number; y: number } => ({
    x: p.x * GRID.x + GRID.offsetX,
    y: p.y * GRID.y + GRID.offsetY,
  }), [])

  /** Dot position of one layout row; rows below the expanded band shift down
   *  by the strip height exactly like the DOM rows do. */
  const dotPosition = useCallback((row: { id: number; x: number }): { x: number; y: number } => {
    const shift = expandedId !== null && row.id > expandedId ? INLINE_META_HEIGHT / GRID.y : 0
    return {
      x: row.x * GRID.x + GRID.offsetX,
      y: (row.id + shift) * GRID.y + GRID.offsetY,
    }
  }, [expandedId])

  /** Same SVG path building as the preview script: consecutive segments with
   *  the same colour/committed state and a shared start point merge into one
   *  path. Lane changes are gentle same-row S-curves (the layout never emits
   *  long diagonals); vertical lanes are straight lines. */
  const buildSvgPaths = useCallback((lines: LayoutLine[]): { d: string; colourIndex: number; isCommitted: boolean }[] => {
    const paths: { d: string; colourIndex: number; isCommitted: boolean }[] = []
    let d = ''
    let curColour = -1
    let curCommitted = false
    let started = false
    let lastX = 0
    let lastY = 0
    const flush = (): void => {
      if (d !== '') {
        paths.push({ d, isCommitted: curCommitted, colourIndex: curColour })
        d = ''
        started = false
      }
    }
    for (const line of lines) {
      const p1 = toPx(line.p1)
      const p2 = toPx(line.p2)
      if (!started || curColour !== line.colourIndex || curCommitted !== line.isCommitted || lastX !== p1.x || lastY !== p1.y) {
        flush()
        d += `M${p1.x.toFixed(0)},${p1.y.toFixed(1)}`
        curColour = line.colourIndex
        curCommitted = line.isCommitted
        started = true
      }
      if (p1.x === p2.x) {
        d += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
      } else if (p1.y === p2.y) {
        // Same-row branch join: a smooth S whose tangents at both ends are
        // vertical, so it continues the incoming/outgoing lane lines without
        // a corner; the control points stay a fraction of a row apart.
        const m = GRID.y * 0.4
        d += `C${p1.x.toFixed(0)},${(p1.y + m).toFixed(1)} ${p2.x.toFixed(0)},${(p2.y - m).toFixed(1)} ${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
      } else {
        // Lane change over rows: control points pushed toward the band edges
        // (¾ of a row from each endpoint) so the bend spreads evenly and the
        // joins with the vertical lanes stay gentle — a rounder turn.
        const mid = GRID.y * 0.75
        d += `C${p1.x.toFixed(0)},${(p1.y + mid).toFixed(1)} ${p2.x.toFixed(0)},${(p2.y - mid).toFixed(1)} ${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
      }
      lastX = p2.x
      lastY = p2.y
    }
    flush()
    return paths
  }, [toPx])

  const svgPaths = useMemo(() => buildSvgPaths(layout.lines), [layout.lines, buildSvgPaths])

  // ── Header helpers ───────────────────────────────────────────────────────

  const repoName = useMemo(() => {
    const base = root !== null ? root.split('/').pop() : repoRoot !== undefined ? repoRoot.split('/').pop() : undefined
    return base ?? (typeof seedTitle === 'string' ? seedTitle : '')
  }, [root, repoRoot, seedTitle])

  const onLoadMore = useCallback((): void => {
    if (rowsRef.current !== null) restoreScroll.current = rowsRef.current.scrollTop
    setMaxCommits((n) => n + LOAD_MORE_STEP)
  }, [])

  const onRefresh = useCallback((): void => {
    setOpMsg(null)
    setOpError(null)
    refresh()
  }, [refresh])

  const onFetch = useCallback((): void => {
    void runWrite(t('fetchDone'), async () => {
      await postWb('/wb-git/fetch', body({}))
    }).then((ok) => {
      if (ok) refresh()
    })
  }, [runWrite, t, body, refresh])

  // ── Context menus ────────────────────────────────────────────────────────

  const copyText = useCallback((text: string): void => {
    void navigator.clipboard.writeText(text).catch(() => { /* clipboard unavailable */ })
  }, [])

  /**
   * Copy the FULL commit message. The log record (`GitLogCommit`) only carries
   * the subject, so fetch the commit detail and copy its `meta.body` (the full
   * message). The fetch is self-contained per click — no shared state, so no
   * sequence guard is needed; on failure or an empty body, fall back to the
   * subject and surface the problem on the result strip like other failures.
   */
  const copyCommitBody = useCallback((hash: string, subject: string): void => {
    if (sessionId === undefined) {
      copyText(subject)
      return
    }
    postWb<DetailValue>('/wb-git/detail', body({ hash }))
      .then((value) => {
        if (value.meta.body !== '') {
          copyText(value.meta.body)
        } else {
          copyText(subject)
          setOpError(t('operationFailed', { msg: 'commit body is empty' }))
        }
      })
      .catch((cause) => {
        copyText(subject)
        setOpError(t('operationFailed', { msg: messageOf(cause) }))
      })
  }, [sessionId, body, t, copyText])

  const openMenu = useCallback((event: ReactMouseEvent, items: MenuItem[]): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, items })
  }, [])

  /** Commit-row context menu (with branch actions when the commit carries a
   *  local branch). */
  const openCommitMenu = useCallback((event: ReactMouseEvent, rowId: number): void => {
    const commit = commits[rowId]
    if (commit === undefined) return
    const items: MenuItem[] = [
      { key: 'copy-hash', label: t('copyCommitHash'), onClick: () => copyText(commit.hash) },
      { key: 'copy-subject', label: t('copyCommitSubject'), onClick: () => copyText(commit.message) },
      ...(commit.hash !== '*'
        ? [
          { key: 'copy-body', label: t('copyCommitBody'), onClick: () => copyCommitBody(commit.hash, commit.message) },
          { key: 'div1', divider: true },
          { key: 'create-branch', label: t('createBranch'), onClick: () => setDialog({ kind: 'create-branch', hash: commit.hash }) },
          { key: 'add-tag', label: t('addTag'), onClick: () => setDialog({ kind: 'add-tag', hash: commit.hash }) },
          { key: 'checkout', label: t('checkoutCommit'), onClick: () => setDialog({ kind: 'checkout', hash: commit.hash }) },
        ]
        : []),
    ]
    if (commit.heads.length > 0) {
      const branchName = commit.heads[0]
      items.push({ key: 'div2', divider: true })
      items.push(
        { key: 'co-branch', label: t('checkoutBranch'), onClick: () => setDialog({ kind: 'checkout', name: branchName }) },
        { key: 'push-branch', label: t('pushBranch'), onClick: () => setDialog({ kind: 'push', target: 'branch', name: branchName }) },
        { key: 'rename-branch', label: t('renameBranch'), onClick: () => setDialog({ kind: 'rename-branch', name: branchName }) },
        { key: 'delete-branch', label: t('deleteBranch'), onClick: () => setDialog({ kind: 'delete-branch', name: branchName }) },
        { key: 'copy-branch', label: t('copyBranchName'), onClick: () => copyText(branchName) },
      )
    }
    openMenu(event, items)
  }, [commits, t, copyText, copyCommitBody, openMenu])

  /** Local-branch chip context menu. */
  const openBranchMenu = useCallback((event: ReactMouseEvent, name: string): void => {
    openMenu(event, [
      { key: 'co', label: t('checkoutBranch'), onClick: () => setDialog({ kind: 'checkout', name }) },
      { key: 'push', label: t('pushBranch'), onClick: () => setDialog({ kind: 'push', target: 'branch', name }) },
      { key: 'rename', label: t('renameBranch'), onClick: () => setDialog({ kind: 'rename-branch', name }) },
      { key: 'delete', label: t('deleteBranch'), danger: true, onClick: () => setDialog({ kind: 'delete-branch', name }) },
      { key: 'copy', label: t('copyBranchName'), onClick: () => copyText(name) },
    ])
  }, [t, copyText, openMenu])

  /** Remote-tracking chip context menu. */
  const openRemoteMenu = useCallback((event: ReactMouseEvent, name: string, remote: string | null): void => {
    const remoteBranch = remote !== null && name.startsWith(`${remote}/`) ? name.slice(remote.length + 1) : name
    openMenu(event, [
      { key: 'copy', label: t('copyRemoteName'), onClick: () => copyText(name) },
      { key: 'div', divider: true },
      {
        key: 'pull',
        label: t('pullIntoCurrent'),
        onClick: () => setDialog({ kind: 'pull', remote: remote ?? 'origin', branch: remoteBranch }),
      },
      {
        key: 'fetch-into',
        label: t('fetchIntoLocal'),
        onClick: () => setDialog({ kind: 'fetch-into', remote: remote ?? 'origin', branch: remoteBranch }),
      },
    ])
  }, [t, copyText, openMenu])

  /** Tag chip context menu. */
  const openTagMenu = useCallback((event: ReactMouseEvent, name: string): void => {
    openMenu(event, [
      { key: 'push', label: t('pushTag'), onClick: () => setDialog({ kind: 'push', target: 'tag', name }) },
      { key: 'delete', label: t('deleteTag'), danger: true, onClick: () => setDialog({ kind: 'delete-tag', name }) },
      { key: 'copy', label: t('copyTagName'), onClick: () => copyText(name) },
    ])
  }, [t, copyText, openMenu])

  // ── Dialog actions ───────────────────────────────────────────────────────

  /** Load the remote list when the push dialog opens. */
  useEffect(() => {
    if (dialog === null || dialog.kind !== 'push' || sessionId === undefined) return
    let cancelled = false
    postWb<{ remotes: RemoteRowWire[] }>('/wb-git/remote', body({ action: 'list' }))
      .then((value) => {
        if (cancelled) return
        setRemotes(value.remotes)
        setPushForm((form) => ({
          ...form,
          remote: value.remotes.some((r) => r.name === form.remote) ? form.remote : value.remotes[0]?.name ?? 'origin',
        }))
      })
      .catch(() => { setRemotes([]) })
    return () => { cancelled = true }
  }, [dialog, sessionId, body])

  const closeDialog = useCallback((): void => setDialog(null), [])

  const handleRefWrite = useCallback(async (
    payload: Record<string, unknown>,
    summary: string,
  ): Promise<void> => {
    await runWrite(summary, async () => {
      await postWb('/wb-git/ref', body(payload))
    })
    refresh()
  }, [runWrite, body, refresh])

  // ── Render ───────────────────────────────────────────────────────────────

  if (mode === 'settings') {
    return createElement(SettingsView, {
      sessionId,
      repoRoot,
      locale,
      t,
      onBack: () => setMode('graph'),
      dateFormat,
      onDateFormatChange: handleDateFormatChange,
    })
  }

  if (sessionId === undefined) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-err' }, t('noSession')))
  }

  if (loadError !== null && commits.length === 0 && isRepo === null) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-err' },
        createElement('div', null, `${t('error')}: ${loadError}`),
        createElement('button', { className: 'dg-btn', onClick: onRefresh }, t('retry'))))
  }

  if (isRepo === false) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-not-repo' },
        createElement('div', null, t('notRepo')),
        createElement('div', { className: 'dg-muted', style: { marginTop: 4 } }, t('notRepoHint')),
        createElement('button', { className: 'dg-btn', style: { marginTop: 8 }, onClick: onRefresh }, t('retry'))))
  }

  if (isRepo === true && commits.length === 0 && !loading && head === null) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-empty' },
        createElement('div', null, t('emptyRepo')),
        createElement('button', { className: 'dg-btn', style: { marginTop: 8 }, onClick: onRefresh }, t('refresh'))))
  }

  if (isRepo === true && commits.length === 0 && !loading) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-empty' }, t('noCommits')))
  }

  if (isRepo === null && loading) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-loading' }, t('loading')))
  }

  if (isRepo === null && commits.length === 0) {
    return createElement('div', { className: 'dsh-wb-view dg-view' },
      createElement('div', { className: 'dg-loading' }, t('loading')))
  }

  // ── Header ───────────────────────────────────────────────────────────────

  const headerNodes: ReactNode[] = [
    createElement('span', { key: 'repo', className: 'dg-repo', title: root ?? repoRoot }, repoName),
    createElement('span', { key: 'branch', className: 'dg-muted', title: branch ?? '' }, branch ?? ''),
    createElement('span', { key: 'count', className: 'dg-muted' }, t('commitsCount', { n: commits.length })),
    createElement('span', { key: 'spacer', className: 'dg-header-spacer' }),
  ]

  const branchOptions: Array<string | { value: string; label: string }> = [
    { value: '', label: t('allBranches') },
    ...branches
      .filter((b) => showRemote || b.remote === null)
      .map((b) => ({ value: b.name, label: b.current ? `${b.name} *` : b.name })),
  ]

  headerNodes.push(
    createElement('select', {
      key: 'filter',
      className: 'dg-header-select',
      value: branchFilter ?? '',
      title: t('allBranches'),
      onChange: (event: ChangeEvent<HTMLSelectElement>) => setBranchFilter(event.target.value === '' ? null : event.target.value),
    }, branchOptions.map((option) => {
      const value = typeof option === 'string' ? option : option.value
      const label = typeof option === 'string' ? option : option.label
      return createElement('option', { key: value, value }, label)
    })),
    createElement('label', { key: 'remote-toggle', className: 'dg-toggle' },
      createElement('input', {
        type: 'checkbox',
        checked: showRemote,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setShowRemote(event.target.checked),
      }),
      t('showRemoteBranches'),
    ),
    createElement('button', {
      key: 'changes',
      className: 'dg-btn',
      disabled: busy,
      onClick: () => setCommitPanelOpen((open) => !open),
    }, t('commitPanelTitle')),
    createElement('button', {
      key: 'settings',
      className: 'dg-btn',
      onClick: () => setMode('settings'),
    }, t('settings')),
    createElement('button', { key: 'refresh', className: 'dg-btn', disabled: busy, onClick: onRefresh }, t('refresh')),
    more
      ? createElement('button', { key: 'more', className: 'dg-btn', disabled: busy || loading, onClick: onLoadMore }, t('loadMore'))
      : null,
    createElement('button', { key: 'fetch', className: 'dg-btn', disabled: busy, onClick: onFetch }, t('fetchButton')),
  )

  // ── Rows + graph overlay ─────────────────────────────────────────────────

  const rowNodes: ReactNode[] = []
  for (const row of layout.rows) {
    const commit = commits[row.id]
    if (commit === undefined) continue
    const dot = dotPosition(row)
    const isPseudo = commit.hash === '*'

    const refNodes: ReactNode[] = []
    // Each ref badge is tinted with its OWN stable colour (text, border and a
    // translucent fill derived from the name), so several refs on the same
    // commit stay distinguishable; the checked-out branch adds the emphasis
    // ring via the dg-ref-active class.
    const refStyle = (name: string): { color: string; borderColor: string; background: string } => {
      const c = refColour(name)
      return { color: c, borderColor: c, background: `${c}1f` }
    }
    for (const headName of commit.heads) {
      const active = headName === branch
      refNodes.push(createElement('span', {
        key: `h-${headName}`,
        className: active ? 'dg-ref dg-ref-head dg-ref-active' : 'dg-ref dg-ref-head',
        style: refStyle(headName),
        title: headName,
        onContextMenu: (event: ReactMouseEvent) => openBranchMenu(event, headName),
      }, headName))
    }
    for (const remote of commit.remotes) {
      refNodes.push(createElement('span', {
        key: `r-${remote.name}`,
        className: 'dg-ref dg-ref-remote',
        style: refStyle(remote.name),
        title: remote.name,
        onContextMenu: (event: ReactMouseEvent) => openRemoteMenu(event, remote.name, remote.remote),
      }, remote.name))
    }
    for (const tag of commit.tags) {
      refNodes.push(createElement('span', {
        key: `t-${tag.name}`,
        className: 'dg-ref dg-ref-tag',
        style: refStyle(tag.name),
        title: tag.annotated ? `${tag.name} (annotated)` : tag.name,
        onContextMenu: (event: ReactMouseEvent) => openTagMenu(event, tag.name),
      }, tag.name))
    }

    const rowClass = `dg-row${row.id === selectedId ? ' dg-row-selected' : ''}${isPseudo ? ' dg-uncommitted' : ''}`
    rowNodes.push(
      createElement('div', {
        key: `row-${row.id}`,
        className: rowClass,
        style: { paddingLeft: layout.width + 10 },
        onClick: () => toggleRow(row.id),
        onContextMenu: (event: ReactMouseEvent) => openCommitMenu(event, row.id),
        title: isPseudo ? t('uncommittedChanges') : commit.message,
      },
        ...refNodes,
        createElement('span', { key: 'msg', className: 'dg-msg' }, commit.message),
        createElement('span', { key: 'date', className: 'dg-date dg-muted' }, formatDate(commit.date, Math.round(Date.now() / 1000), dateFormat, t)),
        createElement('span', { key: 'author', className: 'dg-author dg-muted' }, commit.author),
        createElement('span', { key: 'hash', className: 'dg-hash dg-muted' }, shortHash(commit.hash)),
      ),
    )

    // Inline expansion strip (only the expanded row; the graph band matches
    // its exact height so dots and lines stay aligned).
    if (row.id === expandedId && !isPseudo) {
      const inlineBody: ReactNode[] = []
      if (detailLoading) {
        inlineBody.push(createElement('div', { key: 'loading', className: 'dg-inline-meta-loading' }, t('loading')))
      } else if (detailError !== null) {
        inlineBody.push(
          createElement('div', { key: 'error', className: 'dg-inline-meta-loading' },
            t('operationFailed', { msg: detailError }),
            createElement('button', {
              className: 'dg-btn',
              style: { marginLeft: 8 },
              onClick: () => setDetailRetryTick((n) => n + 1),
            }, t('retry')),
          ),
        )
      } else if (detail !== null) {
        const meta = detail.meta
        inlineBody.push(
          createElement('div', { key: 'hash', className: 'dg-meta-row' },
            createElement('span', { className: 'dg-meta-label' }, t('commitLabel')),
            meta.hash,
          ),
          createElement('div', { key: 'parents', className: 'dg-meta-row' },
            createElement('span', { className: 'dg-meta-label' }, t('parentsLabel')),
            meta.parents.length === 0
              ? createElement('span', { className: 'dg-muted' }, t('root'))
              : meta.parents.map((parent, i) => createElement('span', {
                key: parent,
                className: 'dg-parent-link',
                style: { marginLeft: i > 0 ? 8 : 0 },
                onClick: (event: ReactMouseEvent) => {
                  event.stopPropagation()
                  selectByHash(parent)
                },
              }, shortHash(parent))),
          ),
          createElement('div', { key: 'author', className: 'dg-meta-row' },
            createElement('span', { className: 'dg-meta-label' }, t('authorLabel')),
            `${meta.author} <${meta.authorEmail}> ${formatDate(meta.authorDate, Math.round(Date.now() / 1000), dateFormat, t)}`,
          ),
          createElement('div', { key: 'committer', className: 'dg-meta-row' },
            createElement('span', { className: 'dg-meta-label' }, t('committerLabel')),
            `${meta.committer} <${meta.committerEmail}> ${formatDate(meta.committerDate, Math.round(Date.now() / 1000), dateFormat, t)}`,
          ),
          createElement('div', { key: 'body', className: 'dg-inline-body' }, meta.body),
        )
      }
      rowNodes.push(
        createElement('div', {
          key: `meta-${row.id}`,
          className: 'dg-inline-meta',
          style: { height: INLINE_META_HEIGHT },
        },
          // Transparent lane gutter (matches the rows' paddingLeft) so the
          // swimlane lines stay visible through the expansion band; the panel
          // itself starts right of the graph.
          createElement('div', { key: 'gutter', className: 'dg-inline-meta-gutter', style: { width: layout.width + 10 } }),
          createElement('div', { key: 'body', className: 'dg-inline-meta-body' }, ...inlineBody),
        ),
      )
    }
  }

  const svgNodes: ReactNode[] = []
  for (const path of svgPaths) {
    const stroke = path.isCommitted ? COLOURS[path.colourIndex] : '#808080'
    svgNodes.push(
      createElement('path', { key: `s-${svgNodes.length}`, className: 'shadow', d: path.d }),
      createElement('path', { key: `l-${svgNodes.length}`, className: 'line', d: path.d, stroke }),
    )
  }
  for (const row of layout.rows) {
    const dot = dotPosition(row)
    const colour = row.isCommitted ? COLOURS[row.colourIndex] : '#808080'
    if (row.isCurrent) {
      svgNodes.push(createElement('circle', {
        key: `dot-${row.id}`,
        className: 'current',
        cx: dot.x,
        cy: dot.y,
        r: 4,
        stroke: colour,
        onClick: () => toggleRow(row.id),
      }))
    } else {
      svgNodes.push(createElement('circle', {
        key: `dot-${row.id}`,
        cx: dot.x,
        cy: dot.y,
        r: 4,
        fill: colour,
        onClick: () => toggleRow(row.id),
      }))
    }
  }

  // ── Bottom detail panel (three columns + raw diff mode) ──────────────────

  let panelNode: ReactNode = null
  if (panelOpen && panelHash !== null) {
    const commit = commits.find((c) => c.hash === panelHash)
    const panelTitle = commit !== undefined ? commit.message : shortHash(panelHash)

    const handleResizeStart = (event: ReactMouseEvent): void => {
      event.preventDefault()
      const startY = event.clientY
      const startHeight = panelHeight
      const onMove = (moveEvent: MouseEvent): void => {
        const next = Math.min(520, Math.max(80, startHeight + (startY - moveEvent.clientY)))
        setPanelHeight(next)
      }
      const onUp = (): void => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }

    let bodyNode: ReactNode
    if (panelMode === 'diff') {
      // Raw commit diff mode (toggled on the panel head): one coloured line
      // per diff row — headers muted, hunk ranges tinted, additions/deletions
      // with the same red/green treatment as the side-by-side panes.
      const diffLines = panelDetail !== null ? panelDetail.diff.split('\n') : []
      bodyNode = createElement('div', { className: 'dg-detail-body' },
        panelDetail !== null
          ? createElement('div', { className: 'dg-raw-diff' },
            diffLines.map((line, i) => createElement('div', {
              key: `d-${i}`,
              className: rawDiffLineClass(line),
            }, line === '' ? '\u00a0' : line)))
          : createElement('div', { className: 'dg-loading' }, t('loading')),
      )
    } else {
      const groups = groupFiles(panelDetail?.files ?? [])
      const treeNodes: ReactNode[] = []
      if (panelDetail === null) {
        treeNodes.push(createElement('div', { key: 'loading', className: 'dg-loading' }, t('loading')))
      } else {
        for (const group of groups) {
          const collapsed = collapsedDirs.has(group.dir)
          if (group.dir !== '') {
            treeNodes.push(createElement('div', {
              key: `dir-${group.dir}`,
              className: 'dg-tree-dir dg-tree-item',
              onClick: () => {
                setCollapsedDirs((prev) => {
                  const next = new Set(prev)
                  if (next.has(group.dir)) next.delete(group.dir)
                  else next.add(group.dir)
                  return next
                })
              },
            },
              createElement('span', { className: 'dg-tree-arrow' }, collapsed ? '▸' : '▾'),
              createElement('span', { className: 'dg-tree-name' }, group.dir),
            ))
          }
          if (!collapsed) {
            for (const file of group.files) {
              const name = group.dir === '' ? file.path : file.path.slice(group.dir.length + 1)
              treeNodes.push(createElement('div', {
                key: file.path,
                className: `dg-tree-item${selectedFile === file.path ? ' dg-tree-active' : ''}`,
                onClick: () => setSelectedFile(file.path),
                title: file.path,
              },
                createElement('span', { className: `dg-file-status dg-file-${file.status}` }, file.status),
                createElement('span', { className: 'dg-tree-name' }, name),
                createElement('span', { className: 'dg-file-stats' },
                  file.additions !== null && file.additions > 0 ? createElement('span', { className: 'dg-file-add' }, `+${file.additions}`) : null,
                  file.deletions !== null && file.deletions > 0 ? createElement('span', { className: 'dg-file-del' }, `-${file.deletions}`) : null,
                ),
              ))
            }
          }
        }
        if (groups.length === 0) {
          treeNodes.push(createElement('div', { key: 'empty', className: 'dg-content-empty' }, t('noFileSelected')))
        }
      }

      // Side-by-side diff of the selected file.
      let diffNode: ReactNode
      if (selectedFile === null) {
        diffNode = createElement('div', { className: 'dg-content-empty' }, t('noFileSelected'))
      } else if (contentLoading) {
        diffNode = createElement('div', { className: 'dg-content-empty' }, t('loading'))
      } else if (oldContent === null || newContent === null) {
        diffNode = createElement('div', { className: 'dg-content-empty' }, t('noFileSelected'))
      } else if (oldContent.binary || newContent.binary) {
        diffNode = createElement('div', { className: 'dg-content-empty' }, t('binaryFile'))
      } else if (!oldContent.exists && newContent.exists) {
        diffNode = createElement('div', { className: 'dg-content-empty' }, t('fileMissingAdd'))
      } else if (oldContent.exists && !newContent.exists) {
        diffNode = createElement('div', { className: 'dg-content-empty' }, t('fileMissingDelete'))
      } else {
        const rows = diffText(oldContent.content, newContent.content)
        const lineClass = (cell: { type: string } | undefined): string => {
          if (cell === undefined) return 'dg-diff-line dg-diff-empty'
          if (cell.type === 'add') return 'dg-diff-line dg-diff-add'
          if (cell.type === 'del') return 'dg-diff-line dg-diff-del'
          return 'dg-diff-line dg-diff-same'
        }
        const oldPane = rows.map((row, i) =>
          createElement('div', { key: `o-${i}`, className: lineClass(row.old) }, row.old?.text ?? '\u00a0'))
        const newPane = rows.map((row, i) =>
          createElement('div', { key: `n-${i}`, className: lineClass(row.new) }, row.new?.text ?? '\u00a0'))
        const oldLines = oldContent.content.split('\n').length
        const newLines = newContent.content.split('\n').length
        const tooLong = oldContent.truncated || newContent.truncated
        const capped = oldLines > MAX_DIFF_LINES || newLines > MAX_DIFF_LINES
        diffNode = createElement('div', { className: 'dg-diff-container' },
          tooLong
            ? createElement('div', { className: 'dg-content-title' }, t('contentTooLong', { n: rows.length }))
            : null,
          createElement('div', { className: 'dg-diff' },
            createElement('div', { className: 'dg-diff-header' },
              createElement('div', { className: 'dg-content-title' }, t('beforeLabel')),
              createElement('div', { className: 'dg-content-title' }, t('afterLabel')),
            ),
            capped ? createElement('div', { className: 'dg-content-title' }, t('diffRowsTooLong', { n: rows.length })) : null,
            createElement('div', { className: 'dg-diff-body' },
              createElement('div', {
                className: 'dg-diff-pane',
                ref: oldPaneRef,
                onScroll: () => {
                  if (oldPaneRef.current !== null && newPaneRef.current !== null) {
                    newPaneRef.current.scrollLeft = oldPaneRef.current.scrollLeft
                    newPaneRef.current.scrollTop = oldPaneRef.current.scrollTop
                  }
                },
              }, ...oldPane),
              createElement('div', {
                className: 'dg-diff-pane',
                ref: newPaneRef,
                onScroll: () => {
                  if (oldPaneRef.current !== null && newPaneRef.current !== null) {
                    oldPaneRef.current.scrollLeft = newPaneRef.current.scrollLeft
                    oldPaneRef.current.scrollTop = newPaneRef.current.scrollTop
                  }
                },
              }, ...newPane),
            ),
          ),
        )
      }

      bodyNode = createElement('div', { className: 'dg-detail-panel-body' },
        createElement('div', { className: 'dg-detail-cols' },
          createElement('div', { className: 'dg-file-tree' },
            createElement('div', { className: 'dg-file-tree-title' }, t('filesLabel')),
            ...treeNodes,
          ),
          diffNode,
        ),
      )
    }

    panelNode = createElement('div', { className: 'dg-detail-panel-bottom', style: { height: panelHeight } },
      createElement('div', {
        className: 'dg-detail-resize',
        title: t('dragHint'),
        onMouseDown: handleResizeStart,
      }),
      createElement('div', { className: 'dg-detail-panel-head' },
        createElement('span', { className: 'dg-detail-panel-title', title: panelTitle }, panelTitle),
        createElement('button', {
          className: 'dg-btn',
          title: panelMode === 'files' ? t('viewDetails') : t('filesLabel'),
          onClick: () => setPanelMode((m) => (m === 'files' ? 'diff' : 'files')),
        }, panelMode === 'files' ? '⧉' : '≡'),
        createElement('button', {
          className: 'dg-btn',
          onClick: () => { setPanelOpen(false); setPanelHash(null) },
        }, t('close')),
      ),
      bodyNode,
    )
  }

  // ── Working-tree change panel ────────────────────────────────────────────

  let commitPanelNode: ReactNode = null
  if (commitPanelOpen) {
    const fileRows = statusFiles.map((file) => {
      const staged = file.staged
      return createElement('div', { key: file.path, className: 'dg-commit-row', title: file.oldPath !== undefined ? `${file.oldPath} → ${file.path}` : file.path },
        createElement('span', { className: `dg-file-status dg-file-${file.status}` }, file.status),
        createElement('span', { className: 'dg-tree-name' }, file.path),
        createElement('button', {
          className: 'dg-btn dg-commit-row-btn',
          disabled: busy,
          onClick: () => {
            void runWrite(null, async () => {
              await postWb('/wb-git/stage', body({ action: staged ? 'unstage' : 'add', path: file.path }))
            }).then((ok) => { if (ok) reloadStatus() })
          },
        }, staged ? t('unstage') : t('stage')),
      )
    })

    const stageAllDisabled = statusFiles.length === 0 || statusFiles.every((f) => f.staged)
    commitPanelNode = createElement('div', { className: 'dg-commit-panel' },
      createElement('div', { className: 'dg-commit-body' },
        statusFiles.length === 0
          ? createElement('div', { className: 'dg-commit-empty' }, t('noChanges'))
          : createElement('div', null, ...fileRows),
        createElement('div', { className: 'dg-commit-actions' },
          createElement('button', {
            className: 'dg-btn',
            disabled: busy || stageAllDisabled,
            onClick: () => {
              void runWrite(null, async () => {
                await postWb('/wb-git/stage', body({ action: 'add', all: true }))
              }).then((ok) => { if (ok) reloadStatus() })
            },
          }, t('stageAll')),
          createElement('span', { className: 'dg-commit-hint dg-muted' },
            commitMsg.trim() === '' ? t('emptyMessage') : ''),
        ),
        createElement('textarea', {
          className: 'dg-commit-msg',
          value: commitMsg,
          placeholder: t('commitMessagePlaceholder'),
          onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setCommitMsg(event.target.value),
        }),
        createElement('button', {
          className: 'dg-btn dg-commit-btn',
          disabled: busy || commitMsg.trim() === '',
          onClick: () => {
            const message = commitMsg.trim()
            void runWrite(null, async () => {
              const value = await postWb<{ action: string; hash: string | null }>('/wb-git/commit', body({ message }))
              setOpMsg(t('commitDone', { hash: value.hash !== null ? shortHash(value.hash) : '' }))
            }, (msg) => setCommitError(msg)).then((ok) => {
              if (ok) {
                setCommitMsg('')
                refresh()
                reloadStatus()
              }
            })
          },
        }, t('commitButton')),
        commitError !== null ? createElement('div', { className: 'dg-commit-error' }, commitError) : null,
      ),
    )
  }

  // ── Dialogs ──────────────────────────────────────────────────────────────

  let dialogNode: ReactNode = null
  if (dialog !== null) {
    switch (dialog.kind) {
      case 'create-branch':
        dialogNode = createElement(PromptDialog, {
          key: 'create-branch',
          title: t('createBranchTitle'),
          label: t('promptBranchName'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: (name) => {
            setDialog(null)
            void handleRefWrite({ action: 'create-branch', name, hash: dialog.hash }, t('branchCreated', { name }))
          },
          onCancel: closeDialog,
        })
        break
      case 'add-tag':
        dialogNode = createElement(PromptDialog, {
          key: 'add-tag',
          title: t('addTagTitle'),
          label: t('promptTagName'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: (name) => {
            setDialog(null)
            void handleRefWrite({ action: 'create-tag', name, hash: dialog.hash }, t('tagCreated', { name }))
          },
          onCancel: closeDialog,
        })
        break
      case 'checkout': {
        const refLabel = dialog.hash !== undefined ? shortHash(dialog.hash) : (dialog.name ?? '')
        dialogNode = createElement(Dialog, {
          key: 'checkout',
          open: true,
          title: t('checkoutTitle'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: () => {
            const payload = dialog.hash !== undefined
              ? { action: 'checkout', hash: dialog.hash }
              : { action: 'checkout', name: dialog.name }
            setDialog(null)
            void handleRefWrite(payload, t('checkedOut', { ref: refLabel }))
          },
          onCancel: closeDialog,
        },
          createElement('div', null, t('confirmCheckout', { ref: refLabel })),
        )
        break
      }
      case 'rename-branch':
        dialogNode = createElement(PromptDialog, {
          key: 'rename-branch',
          title: t('renameBranchTitle'),
          label: t('promptNewBranchName'),
          initialValue: dialog.name,
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: (newName) => {
            setDialog(null)
            void handleRefWrite({ action: 'rename-branch', name: dialog.name, newName }, t('branchRenamed', { name: newName }))
          },
          onCancel: closeDialog,
        })
        break
      case 'delete-branch':
        dialogNode = createElement(Dialog, {
          key: 'delete-branch',
          open: true,
          title: t('deleteBranchTitle'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: () => {
            setDialog(null)
            void handleRefWrite({ action: 'delete-branch', name: dialog.name }, t('branchDeleted', { name: dialog.name }))
          },
          onCancel: closeDialog,
        },
          createElement('div', null, t('confirmDeleteBranch', { name: dialog.name })),
        )
        break
      case 'delete-tag':
        dialogNode = createElement(Dialog, {
          key: 'delete-tag',
          open: true,
          title: t('deleteTagTitle'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: () => {
            setDialog(null)
            void handleRefWrite({ action: 'delete-tag', name: dialog.name }, t('tagDeleted', { name: dialog.name }))
          },
          onCancel: closeDialog,
        },
          createElement('div', null, t('confirmDeleteTag', { name: dialog.name })),
        )
        break
      case 'push': {
        const isBranch = dialog.target === 'branch'
        const okDisabled = remotes.length === 0 || pushForm.remote === ''
        dialogNode = createElement(Dialog, {
          key: 'push',
          open: true,
          title: isBranch ? t('pushDialogTitleBranch') : t('pushDialogTitleTag'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          okDisabled,
          onOk: () => {
            const { remote, setUpstream, mode } = pushForm
            setDialog(null)
            if (isBranch) {
              void handleRefWrite({ action: 'push-branch', name: dialog.name, remote, setUpstream, mode }, t('pushBranchDone'))
            } else {
              void handleRefWrite({ action: 'push-tag', name: dialog.name, remote }, t('pushTagDone'))
            }
          },
          onCancel: closeDialog,
        },
          createElement(DialogInput, {
            label: isBranch ? t('pushBranchLabel') : t('promptTagName'),
            value: dialog.name,
            onChange: () => { /* name is fixed by the caller */ },
          }),
          createElement(DialogSelect, {
            label: t('pushRemoteLabel'),
            value: pushForm.remote,
            options: remotes.length > 0 ? remotes.map((r) => r.name) : [t('emptyRemotes')],
            onChange: (remote) => setPushForm((f) => ({ ...f, remote })),
          }),
          isBranch
            ? createElement(DialogCheck, {
              label: t('pushSetUpstream'),
              checked: pushForm.setUpstream,
              onChange: (checked) => setPushForm((f) => ({ ...f, setUpstream: checked })),
            })
            : null,
          createElement(DialogSelect, {
            label: t('pushModeLabel'),
            value: pushForm.mode,
            options: [
              { value: 'normal', label: t('pushModeNormal') },
              { value: 'force-with-lease', label: t('pushModeForce') },
            ],
            onChange: (mode) => setPushForm((f) => ({ ...f, mode: mode === 'force-with-lease' ? 'force-with-lease' : 'normal' })),
          }),
        )
        break
      }
      case 'pull':
        dialogNode = createElement(Dialog, {
          key: 'pull',
          open: true,
          title: t('pullIntoCurrent'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: () => {
            const { remote, branch: branchName } = dialog
            setDialog(null)
            void runWrite(t('pullDone', { remote, branch: branchName }), async () => {
              await postWb('/wb-git/pull', body({ remote, branch: branchName }))
            }).then((ok) => { if (ok) refresh() })
          },
          onCancel: closeDialog,
        },
          createElement('div', null, t('confirmPull', { remote: dialog.remote, branch: dialog.branch })),
        )
        break
      case 'fetch-into':
        dialogNode = createElement(PromptDialog, {
          key: 'fetch-into',
          title: t('fetchIntoLocal'),
          label: t('promptLocalBranch'),
          okLabel: t('dialogOk'),
          cancelLabel: t('dialogCancel'),
          onOk: (localBranch) => {
            const { remote, branch: remoteBranch } = dialog
            setDialog(null)
            void runWrite(t('fetchIntoDone', { remote, remoteBranch, localBranch }), async () => {
              await postWb('/wb-git/fetch-into', body({ remote, remoteBranch, localBranch }))
            }).then((ok) => { if (ok) refresh() })
          },
          onCancel: closeDialog,
        })
        break
      default:
        break
    }
  }

  // ── Assemble ─────────────────────────────────────────────────────────────

  return createElement('div', { className: 'dsh-wb-view dg-view' },
    createElement('div', { className: 'dg-header' }, ...headerNodes),
    createElement('div', { className: 'dg-rows', ref: rowsRef },
      createElement('svg', { className: 'dg-graph', width: layout.width, height: layout.height },
        ...svgNodes,
      ),
      ...rowNodes,
    ),
    panelNode,
    commitPanelNode,
    opError !== null ? createElement('div', { className: 'dg-op-error', key: 'op-error' }, opError) : null,
    opMsg !== null ? createElement('div', { className: 'dg-op-msg', key: 'op-msg' }, opMsg) : null,
    menu !== null ? createElement(ContextMenu, {
      x: menu.x,
      y: menu.y,
      items: menu.items,
      onClose: () => setMenu(null),
    }) : null,
    dialogNode,
  )
}
