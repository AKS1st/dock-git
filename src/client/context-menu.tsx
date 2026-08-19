/**
 * Dock-git context menu: a small portal-to-<body> popup menu (fixed
 * positioning, `.dg-menu` styles from styles.ts, same idea as dock-files'
 * .df-context-menu). Rendered through a portal so an ancestor transform
 * (dock-mode floating panel) cannot turn the fixed coordinates into
 * panel-relative ones.
 *
 * Closing: outside mousedown, Escape, or any scroll. Each item fires once on
 * click (write operations guard themselves against double-fire separately).
 */
import { createElement, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** One menu entry. */
export interface MenuItem {
  /** Stable key (React list key). */
  key: string
  /** Visible label (already localized by the caller). */
  label?: string
  /** Danger item → red foreground + danger hover. */
  danger?: boolean
  /** Invoked once on click; the menu closes right after. */
  onClick?: () => void
  /** Divider row instead of a label/action. */
  divider?: boolean
}

export interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/** Menu size estimate used for viewport clamping (the menu is 160-280px wide). */
const MENU_MAX_WIDTH = 220
const MENU_MAX_HEIGHT = 320
const EDGE_MARGIN = 4

export function ContextMenu(props: ContextMenuProps): ReactNode {
  const { x, y, items, onClose } = props
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Clamp so the menu stays inside the viewport: a right-click at the bottom
  // or right edge must not push the menu off-screen.
  const left = Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - MENU_MAX_WIDTH - EDGE_MARGIN))
  const top = Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - MENU_MAX_HEIGHT - EDGE_MARGIN))

  useEffect(() => {
    const handleDown = (event: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) onClose()
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const handleScroll = (): void => onClose()
    // Capture phase so the menu cannot be closed by the same mousedown that
    // opens a nested popup (prompt/confirm open a separate native dialog).
    document.addEventListener('mousedown', handleDown, true)
    document.addEventListener('keydown', handleKey, true)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleDown, true)
      document.removeEventListener('keydown', handleKey, true)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  const nodes: ReactNode[] = []
  for (const item of items) {
    if (item.divider === true) {
      nodes.push(createElement('div', { key: item.key, className: 'dg-menu-divider' }))
      continue
    }
    const cls = `dg-menu-item${item.danger === true ? ' dg-menu-item-danger' : ''}`
    nodes.push(createElement('div', {
      key: item.key,
      className: cls,
      // Stop propagation so the document-level mousedown (capture) cannot
      // close the menu before this item's click lands.
      onMouseDown: (event: MouseEvent) => { event.stopPropagation() },
      onClick: () => {
        item.onClick?.()
        onClose()
      },
    }, item.label ?? ''))
  }

  return createPortal(
    createElement('div', {
      className: 'dg-menu',
      style: { left, top },
      ref: menuRef,
      onMouseDown: (event: MouseEvent) => { event.stopPropagation() },
    }, ...nodes),
    document.body,
  )
}
