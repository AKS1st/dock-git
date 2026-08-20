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
import { type ReactNode } from 'react';
/** One menu entry. */
export interface MenuItem {
    /** Stable key (React list key). */
    key: string;
    /** Visible label (already localized by the caller). */
    label?: string;
    /** Danger item → red foreground + danger hover. */
    danger?: boolean;
    /** Invoked once on click; the menu closes right after. */
    onClick?: () => void;
    /** Divider row instead of a label/action. */
    divider?: boolean;
}
export interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}
export declare function ContextMenu(props: ContextMenuProps): ReactNode;
