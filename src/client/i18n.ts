/**
 * dock-git client i18n: a tiny, dependency-free dictionary module (zh / en)
 * plus a `detectLocale` helper that reads the DSH locale service
 * (`ctx.get('locale').getSnapshot().active`, backed by settings.yaml
 * locale.preference with the browser language as fallback).
 *
 * The module is deliberately pure — no runtime imports, no DOM, no React — so
 * it runs standalone under `node --experimental-strip-types`
 * (scripts/smoke-i18n.mjs). The view layer combines it with the DSH
 * `locale/change` event (ctx.on) to re-render on a system locale switch.
 *
 * Lookup order per key: DICTS[locale][key] → DICTS.zh[key] → the key itself
 * (missing text stays visible rather than blank).
 */

export type LocaleId = 'zh' | 'en'

export interface Dict {
  [key: string]: string
}

/** Complete dictionaries — every key below exists in BOTH locales. */
export const DICTS: Record<LocaleId, Dict> = {
  zh: {
    // ── Graph view ──────────────────────────────────────────────────────
    graphTitle: 'Git History',
    notRepo: '当前工作区不是 git 仓库',
    notRepoHint: '该目录下没有找到 git 仓库',
    noCommits: '没有提交',
    commitsCount: '{n} 个提交',
    refresh: '刷新',
    loadMore: '加载更多',
    loading: '加载中…',
    error: '加载失败',
    retry: '重试',
    close: '关闭',
    allBranches: '全部',
    showRemoteBranches: '显示远程分支',
    settings: '设置',
    uncommittedChanges: '未提交的更改',
    emptyRepo: '空仓库',
    // Relative dates (absolute dates are locale-neutral).
    justNow: '刚刚',
    minutesAgo: '{n} 分钟前',
    hoursAgo: '{n} 小时前',
    noSession: '无会话',

    // ── Context menus (commit / branch / tag) ───────────────────────────
    viewDetails: '查看详情',
    copyCommitHash: '复制提交哈希',
    copyCommitSubject: '复制提交标题',
    copyCommitBody: '复制提交正文',
    createBranch: '创建分支…',
    addTag: '添加标签…',
    checkoutCommit: '检出…',
    confirmCheckout: '确认检出 {ref}?',
    checkoutBranch: '检出分支',
    pushBranch: '推送分支…',
    renameBranch: '重命名…',
    deleteBranch: '删除分支…',
    confirmDeleteBranch: '确定要删除分支 {name}?',
    copyBranchName: '复制分支名',
    pushTag: '推送标签…',
    deleteTag: '删除标签…',
    confirmDeleteTag: '确定要删除标签 {name}?',
    copyTagName: '复制标签名',
    // Dock-style dialog chrome (replaces browser prompt/confirm).
    dialogOk: '确定',
    dialogCancel: '取消',
    createBranchTitle: '创建分支',
    addTagTitle: '添加标签',
    renameBranchTitle: '重命名分支',
    deleteBranchTitle: '删除分支',
    deleteTagTitle: '删除标签',
    checkoutTitle: '检出',
    promptBranchName: '分支名:',
    promptNewBranchName: '新分支名:',
    promptTagName: '标签名:',
    // Push dialog (branch/remote dropdowns + upstream + mode).
    pushDialogTitleBranch: '推送分支',
    pushDialogTitleTag: '推送标签',
    pushBranchLabel: '分支',
    pushRemoteLabel: '远程',
    pushSetUpstream: '设置上游',
    pushModeLabel: '推送模式',
    pushModeNormal: '正常',
    pushModeForce: '强制(Force With Lease)',
    operationFailed: '操作失败: {msg}',
    operationBusy: '有操作正在进行,请稍候',
    // operationDone passes the caller-built localized summary through ({msg}).
    operationDone: '{msg}',
    // Per-operation success summaries (fed into operationDone).
    branchCreated: '已创建分支 {name}',
    branchRenamed: '已重命名分支为 {name}',
    branchDeleted: '已删除分支 {name}',
    tagCreated: '已创建标签 {name}',
    tagDeleted: '已删除标签 {name}',
    checkedOut: '已检出 {ref}',
    pushBranchDone: '已推送分支',
    pushTagDone: '已推送标签',

    // ── Fetch / pull / fetch-into ───────────────────────────────────────
    fetchButton: 'Fetch',
    fetchDone: '已从远程更新',
    pullIntoCurrent: '拉取到当前分支',
    confirmPull: '将 {remote}/{branch} 拉取合并到当前分支?',
    fetchIntoLocal: '拉取到本地分支…',
    promptLocalBranch: '本地分支名:',
    pullDone: '已拉取 {remote}/{branch}',
    fetchIntoDone: '已拉取 {remote}/{remoteBranch} → {localBranch}',
    copyRemoteName: '复制远程分支名',

    // ── Commit detail panel ─────────────────────────────────────────────
    commitLabel: '提交: ',
    parentsLabel: '父提交: ',
    authorLabel: '作者: ',
    authorDateLabel: '作者时间: ',
    committerLabel: '提交者: ',
    committerDateLabel: '提交时间: ',
    root: '(根提交)',
    beforeLabel: '修改前',
    afterLabel: '修改后',
    filesLabel: '文件',
    noFileSelected: '选择文件查看内容',
    fileMissingAdd: '文件不存在(新增)',
    fileMissingDelete: '文件不存在(删除)',
    binaryFile: '二进制文件',
    dragHint: '拖动调整高度',
    contentTooLong: '内容过长,仅显示前 {n} 行',
    diffRowsTooLong: '差异行过多,仅显示前 {n} 行',

    // ── Commit panel (VS Code style: files + stage + message) ───────────
    commitPanelTitle: '更改',
    stageAll: '全部暂存',
    stage: '暂存',
    unstage: '取消暂存',
    commitMessagePlaceholder: '提交消息(必填)',
    commitButton: '提交',
    noChanges: '没有更改',
    emptyMessage: '请输入提交消息',
    commitDone: '已提交 {hash}',

    // ── Settings panel ──────────────────────────────────────────────────
    gitUserSection: 'Git 用户',
    userNameLabel: '用户名',
    userEmailLabel: '邮箱',
    save: '保存',
    saved: '已保存',
    remotesSection: '远程仓库',
    addRemote: '添加',
    remoteNamePlaceholder: '名称',
    remoteUrlPlaceholder: 'URL',
    removeRemote: '移除',
    updateUrl: '更新 URL',
    displaySection: '显示',
    dateFormatLabel: '日期格式',
    dateRelative: '相对时间',
    dateAbsolute: '绝对时间',
    languageLabel: '语言',
    followSystem: '跟随系统',
    backToGraph: '返回',
    emptyRemotes: '没有远程仓库',
    promptSetUrl: '新 URL:',
    confirmRemoveRemote: '确定要移除远程仓库 {name}?',

    // ── Launcher repo selector (multi-repo workspaces) ──────────────────
    repoSelectorTitle: 'Git 仓库',
    repoListHint: '选择要查看的仓库',
    noReposFound: '未找到 git 仓库',
    depthWorkspace: '工作区',
    depthSub: '子目录',
    depthNested: '孙目录',
    openRepo: '打开仓库',
  },
  en: {
    // ── Graph view ──────────────────────────────────────────────────────
    graphTitle: 'Git History',
    notRepo: 'The current workspace is not a git repository',
    notRepoHint: 'No git repository found in this directory',
    noCommits: 'No commits',
    commitsCount: '{n} commits',
    refresh: 'Refresh',
    loadMore: 'Load More',
    loading: 'Loading…',
    error: 'Load failed',
    retry: 'Retry',
    close: 'Close',
    allBranches: 'All branches',
    showRemoteBranches: 'Show remote branches',
    settings: 'Settings',
    uncommittedChanges: 'Uncommitted Changes',
    emptyRepo: 'Empty repository',
    justNow: 'Just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} hr ago',
    noSession: 'No session',

    // ── Context menus (commit / branch / tag) ───────────────────────────
    viewDetails: 'View Details',
    copyCommitHash: 'Copy Commit Hash',
    copyCommitSubject: 'Copy Commit Subject',
    copyCommitBody: 'Copy Commit Body',
    createBranch: 'Create Branch…',
    addTag: 'Add Tag…',
    checkoutCommit: 'Checkout…',
    confirmCheckout: 'Checkout {ref}?',
    checkoutBranch: 'Checkout Branch',
    pushBranch: 'Push Branch…',
    renameBranch: 'Rename…',
    deleteBranch: 'Delete Branch…',
    confirmDeleteBranch: 'Delete branch {name}?',
    copyBranchName: 'Copy Branch Name',
    pushTag: 'Push Tag…',
    deleteTag: 'Delete Tag…',
    confirmDeleteTag: 'Delete tag {name}?',
    copyTagName: 'Copy Tag Name',
    // Dock-style dialog chrome (replaces browser prompt/confirm).
    dialogOk: 'OK',
    dialogCancel: 'Cancel',
    createBranchTitle: 'Create Branch',
    addTagTitle: 'Add Tag',
    renameBranchTitle: 'Rename Branch',
    deleteBranchTitle: 'Delete Branch',
    deleteTagTitle: 'Delete Tag',
    checkoutTitle: 'Checkout',
    promptBranchName: 'Branch name:',
    promptNewBranchName: 'New branch name:',
    promptTagName: 'Tag name:',
    // Push dialog (branch/remote dropdowns + upstream + mode).
    pushDialogTitleBranch: 'Push Branch',
    pushDialogTitleTag: 'Push Tag',
    pushBranchLabel: 'Branch',
    pushRemoteLabel: 'Remote',
    pushSetUpstream: 'Set upstream',
    pushModeLabel: 'Push mode',
    pushModeNormal: 'Normal',
    pushModeForce: 'Force With Lease',
    operationFailed: 'Operation failed: {msg}',
    operationBusy: 'An operation is already in progress, please wait',
    operationDone: '{msg}',
    branchCreated: 'Branch {name} created',
    branchRenamed: 'Branch renamed to {name}',
    branchDeleted: 'Branch {name} deleted',
    tagCreated: 'Tag {name} created',
    tagDeleted: 'Tag {name} deleted',
    checkedOut: 'Checked out {ref}',
    pushBranchDone: 'Branch pushed',
    pushTagDone: 'Tag pushed',

    // ── Fetch / pull / fetch-into ───────────────────────────────────────
    fetchButton: 'Fetch',
    fetchDone: 'Fetched from remotes',
    pullIntoCurrent: 'Pull into current branch',
    confirmPull: 'Pull {remote}/{branch} into the current branch?',
    fetchIntoLocal: 'Fetch into local branch…',
    promptLocalBranch: 'Local branch name:',
    pullDone: 'Pulled {remote}/{branch}',
    fetchIntoDone: 'Fetched {remote}/{remoteBranch} → {localBranch}',
    copyRemoteName: 'Copy Remote Branch Name',

    // ── Commit detail panel ─────────────────────────────────────────────
    commitLabel: 'Commit: ',
    parentsLabel: 'Parents: ',
    authorLabel: 'Author: ',
    authorDateLabel: 'Author Date: ',
    committerLabel: 'Committer: ',
    committerDateLabel: 'Committer Date: ',
    root: '(root)',
    beforeLabel: 'Before',
    afterLabel: 'After',
    filesLabel: 'Files',
    noFileSelected: 'Select a file to view',
    fileMissingAdd: 'File does not exist (added)',
    fileMissingDelete: 'File does not exist (deleted)',
    binaryFile: 'Binary file',
    dragHint: 'Drag to resize',
    contentTooLong: 'Content too long, showing the first {n} lines',
    diffRowsTooLong: 'Too many diff rows, showing the first {n}',

    // ── Commit panel (VS Code style: files + stage + message) ───────────
    commitPanelTitle: 'Changes',
    stageAll: 'Stage All',
    stage: 'Stage',
    unstage: 'Unstage',
    commitMessagePlaceholder: 'Commit message (required)',
    commitButton: 'Commit',
    noChanges: 'No changes',
    emptyMessage: 'Enter a commit message',
    commitDone: 'Committed {hash}',

    // ── Settings panel ──────────────────────────────────────────────────
    gitUserSection: 'Git User',
    userNameLabel: 'User name',
    userEmailLabel: 'Email',
    save: 'Save',
    saved: 'Saved',
    remotesSection: 'Remotes',
    addRemote: 'Add',
    remoteNamePlaceholder: 'Name',
    remoteUrlPlaceholder: 'URL',
    removeRemote: 'Remove',
    updateUrl: 'Update URL',
    displaySection: 'Display',
    dateFormatLabel: 'Date format',
    dateRelative: 'Relative',
    dateAbsolute: 'Absolute',
    languageLabel: 'Language',
    followSystem: 'Follow system',
    backToGraph: 'Back',
    emptyRemotes: 'No remotes',
    promptSetUrl: 'New URL:',
    confirmRemoveRemote: 'Remove remote {name}?',

    // ── Launcher repo selector (multi-repo workspaces) ──────────────────
    repoSelectorTitle: 'Git Repositories',
    repoListHint: 'Select a repository to view',
    noReposFound: 'No git repositories found',
    depthWorkspace: 'workspace',
    depthSub: 'subdirectory',
    depthNested: 'nested',
    openRepo: 'Open repository',
  },
}

/**
 * Look up a dictionary key for a locale. Missing key → zh fallback → the key
 * itself (never blank). `{name}` placeholders are replaced from `params`.
 */
export function translate(locale: LocaleId, key: string, params?: Record<string, string | number>): string {
  const template = DICTS[locale]?.[key] ?? DICTS.zh[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    (name in params ? String(params[name]) : match))
}

/**
 * Resolve the active locale: the DSH locale service
 * (`ctx.get('locale')?.getSnapshot?.()?.active`, 'zh' | 'en') wins; otherwise
 * the browser language (`navigator.language.startsWith('zh')`) decides, with
 * English as the last resort. `ctx` may be absent (standalone runs).
 */
export function detectLocale(ctx: unknown): LocaleId {
  const locale = (ctx as { get?: (name: string) => unknown } | null | undefined)?.get?.('locale') as
    | { getSnapshot?: () => { active?: unknown } }
    | undefined
  const active = locale?.getSnapshot?.()?.active
  if (active === 'zh' || active === 'en') return active
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}
