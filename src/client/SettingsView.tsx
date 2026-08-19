/**
 * Git History settings panel (rendered inside the 'git-history' floating window):
 *
 *  1. Git user — read/save `user.name` / `user.email` via /wb-git/config
 *     (repo-local config; a work tree is required by the host).
 *  2. Remotes — list / add / remove / set-url via /wb-git/remote.
 *  3. Display — date format (localStorage 'dock-git:date-format',
 *     'relative' default) and the current language (read-only: follows the
 *     system locale).
 *
 * All copy goes through the injected `t` (translate bound to the active
 * locale). Failures surface per-section via operationFailed.
 */
import { createElement, useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { LocaleId } from './i18n'
import { Dialog, PromptDialog } from './dialog'
import { messageOf, postWb, wbBody, type ConfigValue, type RemoteListValue, type RemoteRow } from './wb'

/** Date rendering mode, persisted under 'dock-git:date-format'. */
export type DateFormat = 'relative' | 'absolute'

export interface SettingsViewProps {
  sessionId?: string
  /** Repository root the window was opened with (host runs git there). */
  repoRoot?: string
  locale: LocaleId
  t: (key: string, params?: Record<string, string | number>) => string
  onBack: () => void
  dateFormat: DateFormat
  onDateFormatChange: (format: DateFormat) => void
}

export function SettingsView(props: SettingsViewProps): ReactNode {
  const { sessionId, repoRoot, locale, t, onBack, dateFormat, onDateFormatChange } = props

  // ── Git user section ───────────────────────────────────────────────────
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userSaving, setUserSaving] = useState(false)
  const [userSaved, setUserSaved] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)

  // ── Remotes section ────────────────────────────────────────────────────
  const [remotes, setRemotes] = useState<RemoteRow[]>([])
  const [remoteName, setRemoteName] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  /** One open dock-style dialog (set-url prompt / remove confirm). */
  const [dialog, setDialog] = useState<{ kind: 'set-url' | 'remove'; name: string } | null>(null)

  /** Sequence guard so a stale /wb-git/remote list response cannot overwrite a newer one. */
  const remoteSeq = useRef(0)

  const loadRemotes = useCallback(async (): Promise<void> => {
    if (sessionId === undefined) return
    const seq = ++remoteSeq.current
    // Drop the previous repo's list up front so a repoRoot switch cannot
    // flash stale remotes while the new list loads.
    setRemotes([])
    setRemoteError(null)
    try {
      const value = await postWb<RemoteListValue>('/wb-git/remote', wbBody(sessionId, repoRoot, { action: 'list' }))
      if (seq !== remoteSeq.current) return
      setRemotes(value.remotes)
      setRemoteError(null)
    } catch (cause) {
      if (seq !== remoteSeq.current) return
      setRemoteError(t('operationFailed', { msg: messageOf(cause) }))
    }
  }, [sessionId, repoRoot, t])

  // Load current user config on mount / session switch.
  useEffect(() => {
    let cancelled = false
    if (sessionId === undefined) return
    void Promise.all([
      postWb<ConfigValue>('/wb-git/config', wbBody(sessionId, repoRoot, { key: 'user.name' })),
      postWb<ConfigValue>('/wb-git/config', wbBody(sessionId, repoRoot, { key: 'user.email' })),
    ]).then(([nameValue, emailValue]) => {
      if (cancelled) return
      setUserName(nameValue.value ?? '')
      setUserEmail(emailValue.value ?? '')
    }).catch(() => { /* inputs stay empty on failure */ })
    return () => { cancelled = true }
  }, [sessionId, repoRoot])

  useEffect(() => {
    void loadRemotes()
  }, [loadRemotes])

  const saveUser = async (): Promise<void> => {
    if (sessionId === undefined || userSaving) return
    // Never run `git config user.name ""` (blanks the repo-local identity).
    if (userName.trim() === '' || userEmail.trim() === '') return
    setUserSaving(true)
    setUserSaved(false)
    setUserError(null)
    try {
      await postWb<ConfigValue>('/wb-git/config', wbBody(sessionId, repoRoot, { key: 'user.name', value: userName }))
      await postWb<ConfigValue>('/wb-git/config', wbBody(sessionId, repoRoot, { key: 'user.email', value: userEmail }))
      setUserSaved(true)
    } catch (cause) {
      setUserError(t('operationFailed', { msg: messageOf(cause) }))
    } finally {
      setUserSaving(false)
    }
  }

  const addRemote = async (): Promise<void> => {
    if (sessionId === undefined || remoteBusy) return
    const name = remoteName.trim()
    const url = remoteUrl.trim()
    if (name === '' || url === '') return
    setRemoteBusy(true)
    setRemoteError(null)
    try {
      await postWb('/wb-git/remote', wbBody(sessionId, repoRoot, { action: 'add', name, url }))
      setRemoteName('')
      setRemoteUrl('')
      await loadRemotes()
    } catch (cause) {
      setRemoteError(t('operationFailed', { msg: messageOf(cause) }))
    } finally {
      setRemoteBusy(false)
    }
  }

  const updateRemoteUrl = async (name: string, url: string): Promise<void> => {
    if (sessionId === undefined || remoteBusy) return
    const trimmed = url.trim()
    if (trimmed === '') return
    setRemoteBusy(true)
    setRemoteError(null)
    try {
      await postWb('/wb-git/remote', wbBody(sessionId, repoRoot, { action: 'set-url', name, url: trimmed }))
      await loadRemotes()
    } catch (cause) {
      setRemoteError(t('operationFailed', { msg: messageOf(cause) }))
    } finally {
      setRemoteBusy(false)
    }
  }

  const removeRemote = async (name: string): Promise<void> => {
    if (sessionId === undefined || remoteBusy) return
    setRemoteBusy(true)
    setRemoteError(null)
    try {
      await postWb('/wb-git/remote', wbBody(sessionId, repoRoot, { action: 'remove', name }))
      await loadRemotes()
    } catch (cause) {
      setRemoteError(t('operationFailed', { msg: messageOf(cause) }))
    } finally {
      setRemoteBusy(false)
    }
  }

  const onInput = (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>): void => setter(event.target.value)

  const localeLabel = locale === 'zh' ? '中文' : 'English'

  return createElement('div', { className: 'dg-settings' },

    // ── Git user ─────────────────────────────────────────────────────────
    createElement('div', { className: 'dg-settings-section' },
      createElement('div', { className: 'dg-settings-section-title' }, t('gitUserSection')),
      createElement('div', { className: 'dg-settings-row' },
        createElement('span', { className: 'dg-settings-label' }, t('userNameLabel')),
        createElement('input', {
          className: 'dg-settings-input',
          value: userName,
          placeholder: t('userNameLabel'),
          onChange: onInput(setUserName),
        }),
      ),
      createElement('div', { className: 'dg-settings-row' },
        createElement('span', { className: 'dg-settings-label' }, t('userEmailLabel')),
        createElement('input', {
          className: 'dg-settings-input',
          value: userEmail,
          placeholder: t('userEmailLabel'),
          onChange: onInput(setUserEmail),
        }),
      ),
      createElement('div', { className: 'dg-settings-row' },
        createElement('button', {
          className: 'dg-btn',
          onClick: () => void saveUser(),
          // An empty value would run `git config user.name ""` and blank the
          // repo-local identity — require both fields before saving.
          disabled: userSaving || userName.trim() === '' || userEmail.trim() === '',
        }, t('save')),
        userSaved ? createElement('span', { className: 'dg-saved' }, t('saved')) : null,
      ),
      userError !== null ? createElement('div', { className: 'dg-op-error' }, userError) : null,
    ),

    // ── Remotes ──────────────────────────────────────────────────────────
    createElement('div', { className: 'dg-settings-section' },
      createElement('div', { className: 'dg-settings-section-title' }, t('remotesSection')),
      createElement('div', { className: 'dg-settings-row' },
        createElement('input', {
          className: 'dg-settings-input dg-settings-remote-name-input',
          value: remoteName,
          placeholder: t('remoteNamePlaceholder'),
          onChange: onInput(setRemoteName),
        }),
        createElement('input', {
          className: 'dg-settings-input',
          value: remoteUrl,
          placeholder: t('remoteUrlPlaceholder'),
          onChange: onInput(setRemoteUrl),
        }),
        createElement('button', { className: 'dg-btn', onClick: () => void addRemote(), disabled: remoteBusy }, t('addRemote')),
      ),
      remotes.length === 0
        ? createElement('div', { className: 'dg-muted dg-settings-empty' }, t('emptyRemotes'))
        : createElement('div', null, remotes.map((remote) =>
          createElement('div', { key: remote.name, className: 'dg-settings-remote' },
            createElement('span', { className: 'dg-settings-remote-name', title: remote.name }, remote.name),
            createElement('span', { className: 'dg-settings-remote-url', title: remote.url }, remote.url),
            createElement('button', {
              className: 'dg-btn',
              onClick: () => setDialog({ kind: 'set-url', name: remote.name }),
              disabled: remoteBusy,
            }, t('updateUrl')),
            createElement('button', {
              className: 'dg-btn dg-btn-danger',
              onClick: () => setDialog({ kind: 'remove', name: remote.name }),
              disabled: remoteBusy,
            }, t('removeRemote')),
          ),
        )),
      remoteError !== null ? createElement('div', { className: 'dg-op-error' }, remoteError) : null,
    ),

    // ── Display ──────────────────────────────────────────────────────────
    createElement('div', { className: 'dg-settings-section' },
      createElement('div', { className: 'dg-settings-section-title' }, t('displaySection')),
      createElement('div', { className: 'dg-settings-row' },
        createElement('span', { className: 'dg-settings-label' }, t('dateFormatLabel')),
        createElement('label', { className: 'dg-settings-radio' },
          createElement('input', {
            type: 'radio',
            name: 'dg-date-format',
            checked: dateFormat === 'relative',
            onChange: () => onDateFormatChange('relative'),
          }),
          t('dateRelative'),
        ),
        createElement('label', { className: 'dg-settings-radio' },
          createElement('input', {
            type: 'radio',
            name: 'dg-date-format',
            checked: dateFormat === 'absolute',
            onChange: () => onDateFormatChange('absolute'),
          }),
          t('dateAbsolute'),
        ),
      ),
      createElement('div', { className: 'dg-settings-row' },
        createElement('span', { className: 'dg-settings-label' }, t('languageLabel')),
        createElement('span', { className: 'dg-settings-lang' }, `${t('followSystem')}(${localeLabel})`),
      ),
    ),

    // ── Back to the graph ────────────────────────────────────────────────
    createElement('div', { className: 'dg-settings-back' },
      createElement('button', { className: 'dg-btn', onClick: onBack }, t('backToGraph')),
    ),

    // ── Dock-style dialogs (set-url prompt / remove confirm) ─────────────
    dialog !== null && dialog.kind === 'set-url'
      ? createElement(PromptDialog, {
        key: 'set-url',
        title: t('updateUrl'),
        label: t('promptSetUrl'),
        okLabel: t('dialogOk'),
        cancelLabel: t('dialogCancel'),
        onOk: (url) => {
          setDialog(null)
          void updateRemoteUrl(dialog.name, url)
        },
        onCancel: () => setDialog(null),
      })
      : null,
    dialog !== null && dialog.kind === 'remove'
      ? createElement(Dialog, {
        key: 'remove',
        open: true,
        title: t('removeRemote'),
        okLabel: t('dialogOk'),
        cancelLabel: t('dialogCancel'),
        onOk: () => {
          setDialog(null)
          void removeRemote(dialog.name)
        },
        onCancel: () => setDialog(null),
      },
        createElement('div', null, t('confirmRemoveRemote', { name: dialog.name })),
      )
      : null,
  )
}
