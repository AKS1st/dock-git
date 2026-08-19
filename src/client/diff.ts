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
  text: string
  type: 'same' | 'add' | 'del'
}

export interface DiffRow {
  old?: DiffCell
  new?: DiffCell
}

const DEFAULT_MAX_LINES = 5000
/** DP cell budget — beyond this the middle region degrades to "all changed". */
const DP_BUDGET = 1_000_000

/**
 * Split `text` into lines, removing a trailing empty line produced by a
 * final `\n`.  An empty (or whitespace-only) string yields an empty array.
 */
function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  // A trailing newline creates an empty final element — drop it.
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

/**
 * Count the length of the common prefix of two string arrays.
 */
function commonPrefixLen(a: string[], b: string[]): number {
  const len = Math.min(a.length, b.length)
  let i = 0
  while (i < len && a[i] === b[i]) i++
  return i
}

/**
 * Count the length of the common suffix of two string arrays, bounded so
 * that prefix + suffix never exceeds the shorter array.
 */
function commonSuffixLen(a: string[], b: string[], prefixLen: number): number {
  const maxSuffix = Math.min(a.length, b.length) - prefixLen
  let i = 0
  while (i < maxSuffix && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

/**
 * LCS-align two string arrays and return aligned `DiffRow[]` for the
 * middle region only (prefix/suffix are handled by the caller).
 *
 * If `oldMid.length × newMid.length` exceeds `DP_BUDGET`, the function
 * degrades: every old line becomes a `del` row, every new line becomes an
 * `add` row (interleaved: all dels first, then all adds).
 */
function alignMiddle(oldMid: string[], newMid: string[]): DiffRow[] {
  const oldLen = oldMid.length
  const newLen = newMid.length

  // Degrade path: large rewrite — mark everything as changed.
  if (oldLen * newLen > DP_BUDGET) {
    const rows: DiffRow[] = []
    for (let i = 0; i < oldLen; i++) {
      rows.push({ old: { text: oldMid[i], type: 'del' } })
    }
    for (let j = 0; j < newLen; j++) {
      rows.push({ new: { text: newMid[j], type: 'add' } })
    }
    return rows
  }

  // ── 2D DP table (standard LCS length) ─────────────────────────────────
  // dp[i][j] = LCS length of oldMid[0..i) and newMid[0..j).
  // We only need two rows at a time, but we need the full table for
  // backtracking, so we allocate the full (oldLen+1)×(newLen+1) grid.
  const dp: number[][] = []
  for (let i = 0; i <= oldLen; i++) {
    dp[i] = new Array<number>(newLen + 1).fill(0)
  }
  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldMid[i - 1] === newMid[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // ── Backtrack to recover alignment ─────────────────────────────────────
  // Walk from (oldLen, newLen) back to (0, 0).  Collect moves, then reverse.
  type Move = { kind: 'same'; oldIdx: number; newIdx: number }
    | { kind: 'del'; oldIdx: number }
    | { kind: 'add'; newIdx: number }

  const moves: Move[] = []
  let i = oldLen
  let j = newLen
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldMid[i - 1] === newMid[j - 1]) {
      moves.push({ kind: 'same', oldIdx: i - 1, newIdx: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      moves.push({ kind: 'add', newIdx: j - 1 })
      j--
    } else {
      moves.push({ kind: 'del', oldIdx: i - 1 })
      i--
    }
  }
  moves.reverse()

  // ── Convert moves → DiffRow[] ──────────────────────────────────────────
  // Each move becomes its own row: same → both cells, del → only old,
  // add → only new.  Consecutive dels then adds are emitted in LCS order
  // (all dels first, then all adds), which is the standard side-by-side
  // diff convention.
  const rows: DiffRow[] = []
  for (const move of moves) {
    if (move.kind === 'same') {
      rows.push({
        old: { text: oldMid[move.oldIdx], type: 'same' },
        new: { text: newMid[move.newIdx], type: 'same' },
      })
    } else if (move.kind === 'del') {
      rows.push({ old: { text: oldMid[move.oldIdx], type: 'del' } })
    } else {
      rows.push({ new: { text: newMid[move.newIdx], type: 'add' } })
    }
  }

  return rows
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
export function diffText(oldText: string, newText: string, maxLines?: number): DiffRow[] {
  const limit = maxLines ?? DEFAULT_MAX_LINES

  let oldLines = splitLines(oldText)
  let newLines = splitLines(newText)

  // Truncate overlong inputs.
  if (oldLines.length > limit) oldLines = oldLines.slice(0, limit)
  if (newLines.length > limit) newLines = newLines.slice(0, limit)

  // Fast paths.
  if (oldLines.length === 0 && newLines.length === 0) return []
  if (oldLines.length === 0) {
    return newLines.map((text) => ({ new: { text, type: 'add' as const } }))
  }
  if (newLines.length === 0) {
    return oldLines.map((text) => ({ old: { text, type: 'del' as const } }))
  }

  // Trim common prefix.
  const prefixLen = commonPrefixLen(oldLines, newLines)
  // Trim common suffix (don't overlap with prefix).
  const suffixLen = commonSuffixLen(oldLines, newLines, prefixLen)

  const rows: DiffRow[] = []

  // Emit prefix (same lines).
  for (let i = 0; i < prefixLen; i++) {
    rows.push({
      old: { text: oldLines[i], type: 'same' },
      new: { text: newLines[i], type: 'same' },
    })
  }

  // Align the middle region.
  const oldMid = oldLines.slice(prefixLen, oldLines.length - suffixLen)
  const newMid = newLines.slice(prefixLen, newLines.length - suffixLen)
  if (oldMid.length > 0 || newMid.length > 0) {
    const middleRows = alignMiddle(oldMid, newMid)
    rows.push(...middleRows)
  }

  // Emit suffix (same lines).
  for (let i = 0; i < suffixLen; i++) {
    const idx = oldLines.length - suffixLen + i
    rows.push({
      old: { text: oldLines[idx], type: 'same' },
      new: { text: newLines[idx], type: 'same' },
    })
  }

  return rows
}
