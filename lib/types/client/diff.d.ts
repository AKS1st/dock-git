/**
 * Line-level side-by-side diff algorithm (pure module, no runtime imports).
 *
 * Produces `DiffRow[]` — aligned old/new pairs — suitable for rendering a
 * GitHub/VSCode-style two-column diff view.  The algorithm:
 *
 *   1. Split by `\n`, strip trailing blank lines.
 *   2. Trim common prefix & suffix (same lines).
 *   3. LCS-align the middle region (2D DP + backtrack).
 *      Budget: oldMid × newMid ≤ 1_000_000 cells; beyond that the entire
 *      middle is treated as "all changed" (old → del, new → add), which is
 *      the standard degrade for large rewrites.
 *   4. Emit rows: prefix same → aligned middle → suffix same.
 *
 * Runs under `node --experimental-strip-types` with zero imports.
 */
export interface DiffCell {
    text: string;
    type: 'same' | 'add' | 'del';
}
export interface DiffRow {
    old?: DiffCell;
    new?: DiffCell;
}
/**
 * Compute a side-by-side line-level diff between two strings.
 *
 * @param oldText  Content before the change (empty string for pure adds).
 * @param newText  Content after the change (empty string for pure deletes).
 * @param maxLines Maximum input lines (default 5000); excess lines are
 *                 truncated before diffing.
 * @returns Array of aligned `DiffRow` objects ready for rendering.
 */
export declare function diffText(oldText: string, newText: string, maxLines?: number): DiffRow[];
