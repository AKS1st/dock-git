/**
 * dock-git dock-style modal dialogs: a generic `Dialog` (portal to <body>,
 * overlay + centred panel + title/body/actions) plus small controlled field
 * helpers — `DialogInput`, `DialogSelect`, `DialogCheck` — and a ready-made
 * `PromptDialog` (single text input + OK/Cancel, OK disabled while empty).
 *
 * Rendered through a portal so an ancestor transform (dock-mode floating
 * panel) cannot turn the fixed overlay into panel-relative space — the same
 * reasoning as context-menu.tsx. Closing: Escape, or a mousedown that starts
 * directly on the overlay (a press inside the panel that drags out cannot
 * close it), both call `onCancel`. All strings (labels, buttons) come
 * pre-localized from the caller.
 */
import { createElement, useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface DialogProps {
  open: boolean
  title: string
  children?: ReactNode
  okLabel?: string
  cancelLabel?: string
  onOk?: () => void
  onCancel: () => void
  /** Disable the OK button (empty required input, missing lists, …). */
  okDisabled?: boolean
  /** Panel width in px (defaults to the CSS min/max width). */
  width?: number
}

/** Dock-style modal: fixed overlay + centred panel, portal to <body>. */
export function Dialog(props: DialogProps): ReactNode {
  const { open, title, children, okLabel, cancelLabel, onOk, onCancel, okDisabled, width } = props

  // Escape closes the dialog (capture pattern like the context menu; the
  // stopPropagation keeps both capture listeners from reacting to one key).
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    createElement('div', {
      className: 'dg-dialog-overlay',
      // Close on a press that starts on the overlay itself (target ===
      // currentTarget): a mousedown inside the panel that drags out and is
      // released over the overlay must NOT close the dialog, so closing uses
      // mousedown (not click) and the panel stops mousedown propagation.
      onMouseDown: (event: MouseEvent) => {
        if (event.target === event.currentTarget) onCancel()
      },
    },
      createElement('div', {
        className: 'dg-dialog',
        style: width !== undefined ? { width } : undefined,
        onMouseDown: (event: MouseEvent) => { event.stopPropagation() },
      },
        createElement('div', { className: 'dg-dialog-title' }, title),
        createElement('div', { className: 'dg-dialog-body' }, children),
        createElement('div', { className: 'dg-dialog-actions' },
          createElement('button', { className: 'dg-btn', onClick: onCancel }, cancelLabel ?? 'Cancel'),
          createElement('button', {
            className: 'dg-btn',
            onClick: onOk,
            disabled: okDisabled === true,
          }, okLabel ?? 'OK'),
        ),
      ),
    ),
    document.body,
  )
}

/** One labelled text field (controlled; autoFocus for the first field). */
export interface DialogInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  placeholder?: string
}

export function DialogInput(props: DialogInputProps): ReactNode {
  const { label, value, onChange, autoFocus, placeholder } = props
  return createElement('label', { className: 'dg-dialog-field' },
    createElement('span', { className: 'dg-dialog-label' }, label),
    createElement('input', {
      className: 'dg-dialog-input',
      type: 'text',
      value,
      placeholder,
      autoFocus: autoFocus === true,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    }),
  )
}

/** One labelled dropdown; options are either bare values or {value,label}. */
export interface DialogSelectProps {
  label: string
  value: string
  options: Array<string | { value: string; label: string }>
  onChange: (value: string) => void
}

export function DialogSelect(props: DialogSelectProps): ReactNode {
  const { label, value, options, onChange } = props
  return createElement('label', { className: 'dg-dialog-field' },
    createElement('span', { className: 'dg-dialog-label' }, label),
    createElement('select', {
      className: 'dg-dialog-select',
      value,
      onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
    },
      options.map((option) => {
        const optionValue = typeof option === 'string' ? option : option.value
        const optionLabel = typeof option === 'string' ? option : option.label
        return createElement('option', { key: optionValue, value: optionValue }, optionLabel)
      }),
    ),
  )
}

/** One labelled checkbox. */
export interface DialogCheckProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function DialogCheck(props: DialogCheckProps): ReactNode {
  const { label, checked, onChange } = props
  return createElement('label', { className: 'dg-dialog-check' },
    createElement('input', {
      type: 'checkbox',
      checked,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked),
    }),
    label,
  )
}

/** Single-input dialog: title + one DialogInput + OK/Cancel. The OK button
 *  stays disabled while the trimmed value is empty; onOk receives the
 *  trimmed value. Used for branch/tag name entry and URL prompts. */
export interface PromptDialogProps {
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  okLabel?: string
  cancelLabel?: string
  onOk: (value: string) => void
  onCancel: () => void
}

export function PromptDialog(props: PromptDialogProps): ReactNode {
  const { title, label, initialValue, placeholder, okLabel, cancelLabel, onOk, onCancel } = props
  const [value, setValue] = useState(initialValue ?? '')
  return createElement(Dialog, {
    open: true,
    title,
    okLabel,
    cancelLabel,
    okDisabled: value.trim() === '',
    onOk: () => onOk(value.trim()),
    onCancel,
  },
    createElement(DialogInput, { label, value, onChange: setValue, autoFocus: true, placeholder }),
  )
}
