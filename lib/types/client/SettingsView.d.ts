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
import { type ReactNode } from 'react';
import type { LocaleId } from './i18n';
/** Date rendering mode, persisted under 'dock-git:date-format'. */
export type DateFormat = 'relative' | 'absolute';
export interface SettingsViewProps {
    sessionId?: string;
    /** Repository root the window was opened with (host runs git there). */
    repoRoot?: string;
    locale: LocaleId;
    t: (key: string, params?: Record<string, string | number>) => string;
    onBack: () => void;
    dateFormat: DateFormat;
    onDateFormatChange: (format: DateFormat) => void;
}
export declare function SettingsView(props: SettingsViewProps): ReactNode;
