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
import { type ReactNode } from 'react';
export interface DialogProps {
    open: boolean;
    title: string;
    children?: ReactNode;
    okLabel?: string;
    cancelLabel?: string;
    onOk?: () => void;
    onCancel: () => void;
    /** Disable the OK button (empty required input, missing lists, …). */
    okDisabled?: boolean;
    /** Panel width in px (defaults to the CSS min/max width). */
    width?: number;
}
/** Dock-style modal: fixed overlay + centred panel, portal to <body>. */
export declare function Dialog(props: DialogProps): ReactNode;
/** One labelled text field (controlled; autoFocus for the first field). */
export interface DialogInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
    placeholder?: string;
}
export declare function DialogInput(props: DialogInputProps): ReactNode;
/** One labelled dropdown; options are either bare values or {value,label}. */
export interface DialogSelectProps {
    label: string;
    value: string;
    options: Array<string | {
        value: string;
        label: string;
    }>;
    onChange: (value: string) => void;
}
export declare function DialogSelect(props: DialogSelectProps): ReactNode;
/** One labelled checkbox. */
export interface DialogCheckProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}
export declare function DialogCheck(props: DialogCheckProps): ReactNode;
/** Single-input dialog: title + one DialogInput + OK/Cancel. The OK button
 *  stays disabled while the trimmed value is empty; onOk receives the
 *  trimmed value. Used for branch/tag name entry and URL prompts. */
export interface PromptDialogProps {
    title: string;
    label: string;
    initialValue?: string;
    placeholder?: string;
    okLabel?: string;
    cancelLabel?: string;
    onOk: (value: string) => void;
    onCancel: () => void;
}
export declare function PromptDialog(props: PromptDialogProps): ReactNode;
