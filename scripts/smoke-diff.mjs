#!/usr/bin/env node
/**
 * Diff-algorithm smoke test for dock-git: runs the pure diff module
 * (src/client/diff.ts) directly under `node --experimental-strip-types`
 * and asserts correctness of the side-by-side line-level diff output.
 *
 * Run:
 *   node --experimental-strip-types scripts/smoke-diff.mjs
 */
import { diffText } from '../src/client/diff.ts'

let failures = 0
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}${detail !== undefined ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/** Shorthand: extract just the type pair from a DiffRow for easy assertion. */
function typePair(row) {
  return [row.old?.type ?? '_', row.new?.type ?? '_']
}

// ── 1. Pure add ─────────────────────────────────────────────────────────
console.log('== pure add: diffText("", "a\\nb") ==')
{
  const rows = diffText('', 'a\nb')
  check('pure add: 2 rows', rows.length === 2, `${rows.length} rows`)
  check('pure add: row 0 has no old', rows[0].old === undefined, String(rows[0].old))
  check('pure add: row 0 new.type=add', rows[0].new?.type === 'add', rows[0].new?.type)
  check('pure add: row 0 new.text="a"', rows[0].new?.text === 'a', rows[0].new?.text)
  check('pure add: row 1 new.type=add', rows[1].new?.type === 'add', rows[1].new?.type)
  check('pure add: row 1 new.text="b"', rows[1].new?.text === 'b', rows[1].new?.text)
}

// ── 2. Pure delete ──────────────────────────────────────────────────────
console.log('== pure delete: diffText("a\\nb", "") ==')
{
  const rows = diffText('a\nb', '')
  check('pure delete: 2 rows', rows.length === 2, `${rows.length} rows`)
  check('pure delete: row 0 has no new', rows[0].new === undefined, String(rows[0].new))
  check('pure delete: row 0 old.type=del', rows[0].old?.type === 'del', rows[0].old?.type)
  check('pure delete: row 0 old.text="a"', rows[0].old?.text === 'a', rows[0].old?.text)
  check('pure delete: row 1 old.type=del', rows[1].old?.type === 'del', rows[1].old?.type)
  check('pure delete: row 1 old.text="b"', rows[1].old?.text === 'b', rows[1].old?.text)
}

// ── 3. Modification ────────────────────────────────────────────────────
console.log('== modify: diffText("one\\ntwo\\nthree", "one\\nTWO\\nthree") ==')
{
  const rows = diffText('one\ntwo\nthree', 'one\nTWO\nthree')
  check('modify: 4 rows (prefix+del+add+suffix)', rows.length === 4, `${rows.length} rows`)
  check('modify: row 0 same "one"',
    rows[0].old?.type === 'same' && rows[0].new?.type === 'same'
    && rows[0].old?.text === 'one' && rows[0].new?.text === 'one',
    `row0: ${typePair(rows[0])} "${rows[0].old?.text}" / "${rows[0].new?.text}"`)
  check('modify: row 1 del "two"',
    rows[1].old?.type === 'del' && rows[1].old?.text === 'two' && rows[1].new === undefined,
    `row1: ${typePair(rows[1])} "${rows[1].old?.text}"`)
  check('modify: row 2 add "TWO"',
    rows[2].old === undefined && rows[2].new?.type === 'add' && rows[2].new?.text === 'TWO',
    `row2: ${typePair(rows[2])} "${rows[2].new?.text}"`)
  check('modify: row 3 same "three"',
    rows[3].old?.type === 'same' && rows[3].new?.type === 'same'
    && rows[3].old?.text === 'three',
    `row3: ${typePair(rows[3])} "${rows[3].old?.text}"`)
}

// ── 4. Add line in the middle ──────────────────────────────────────────
console.log('== add line: diffText("a\\nc", "a\\nb\\nc") ==')
{
  const rows = diffText('a\nc', 'a\nb\nc')
  check('add line: 3 rows (prefix+add+suffix)', rows.length === 3, `${rows.length} rows`)
  check('add line: row 0 same "a"',
    rows[0].old?.type === 'same' && rows[0].new?.type === 'same' && rows[0].old?.text === 'a',
    `row0: ${typePair(rows[0])}`)
  check('add line: row 1 add "b"',
    rows[1].old === undefined && rows[1].new?.type === 'add' && rows[1].new?.text === 'b',
    `row1: ${typePair(rows[1])}`)
  check('add line: row 2 same "c"',
    rows[2].old?.type === 'same' && rows[2].new?.type === 'same' && rows[2].old?.text === 'c',
    `row2: ${typePair(rows[2])}`)
}

// ── 5. Delete line in the middle ───────────────────────────────────────
console.log('== delete line: diffText("a\\nb\\nc", "a\\nc") ==')
{
  const rows = diffText('a\nb\nc', 'a\nc')
  check('delete line: 3 rows (prefix+del+suffix)', rows.length === 3, `${rows.length} rows`)
  check('delete line: row 0 same "a"',
    rows[0].old?.type === 'same' && rows[0].new?.type === 'same' && rows[0].old?.text === 'a',
    `row0: ${typePair(rows[0])}`)
  check('delete line: row 1 del "b"',
    rows[1].old?.type === 'del' && rows[1].old?.text === 'b' && rows[1].new === undefined,
    `row1: ${typePair(rows[1])}`)
  check('delete line: row 2 same "c"',
    rows[2].old?.type === 'same' && rows[2].new?.type === 'same' && rows[2].old?.text === 'c',
    `row2: ${typePair(rows[2])}`)
}

// ── 6. Large rewrite (degrade path) ────────────────────────────────────
console.log('== large rewrite (DP budget exceeded → all-changed) ==')
{
  // Construct arrays whose product exceeds DP_BUDGET (1_000_000).
  // 1100 × 1100 = 1_210_000 > 1_000_000.
  const N = 1100
  const oldLines = Array.from({ length: N }, (_, i) => `old-${i}`)
  const newLines = Array.from({ length: N }, (_, i) => `new-${i}`)
  const oldText = oldLines.join('\n')
  const newText = newLines.join('\n')
  let rows
  try {
    rows = diffText(oldText, newText)
  } catch (e) {
    check('large rewrite: does not throw', false, String(e))
    rows = []
  }
  check('large rewrite: does not throw', true)
  check('large rewrite: row count = old + new (all changed)',
    rows.length === N + N, `${rows.length} rows (expected ${N + N})`)
  // All old rows should be del, all new rows should be add.
  const allDel = rows.slice(0, N).every((r) => r.old?.type === 'del' && r.new === undefined)
  const allAdd = rows.slice(N).every((r) => r.old === undefined && r.new?.type === 'add')
  check('large rewrite: first half all del', allDel, `${rows.slice(0, 3).map(typePair)}`)
  check('large rewrite: second half all add', allAdd, `${rows.slice(N, N + 3).map(typePair)}`)
}

// ── 7. Empty inputs ────────────────────────────────────────────────────
console.log('== empty inputs ==')
{
  const rows1 = diffText('', '')
  check('empty-empty: 0 rows', rows1.length === 0, `${rows1.length} rows`)

  const rows2 = diffText('hello', '')
  check('text-empty: 1 del row', rows2.length === 1 && rows2[0].old?.type === 'del', `${rows2.length} rows`)

  const rows3 = diffText('', 'hello')
  check('empty-text: 1 add row', rows3.length === 1 && rows3[0].new?.type === 'add', `${rows3.length} rows`)
}

// ── 8. Identical inputs (all same) ─────────────────────────────────────
console.log('== identical inputs (all same) ==')
{
  const rows = diffText('a\nb\nc', 'a\nb\nc')
  check('identical: 3 rows', rows.length === 3, `${rows.length} rows`)
  check('identical: all same',
    rows.every((r) => r.old?.type === 'same' && r.new?.type === 'same'),
    rows.map(typePair).join(' | '))
}

// ── 9. maxLines truncation ─────────────────────────────────────────────
console.log('== maxLines truncation ==')
{
  const big = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n')
  const small = Array.from({ length: 100 }, (_, i) => `LINE ${i}`).join('\n')
  const rows = diffText(big, small, 10)
  // After truncation both arrays are 10 lines, fully different → 20 rows.
  check('maxLines: output bounded', rows.length <= 20, `${rows.length} rows`)
}

// ── 10. Large diff row truncation (MAX_DIFF_ROWS = 2000) ───────────────
// The renderer caps diff output at MAX_DIFF_ROWS (2000).  diffText itself
// doesn't enforce a row cap, but we verify that a diff producing > 2000
// rows is well-formed and can be safely sliced.
console.log('== large diff rows (simulated MAX_DIFF_ROWS cap) ==')
{
  const MAX_DIFF_ROWS = 2000
  // 1500 add + 1500 del = 3000 rows (exceeds MAX_DIFF_ROWS).
  const N = 1500
  const oldText = Array.from({ length: N }, (_, i) => `old-${i}`).join('\n')
  const newText = Array.from({ length: N }, (_, i) => `new-${i}`).join('\n')
  let rows
  try {
    rows = diffText(oldText, newText)
  } catch (e) {
    check('large diff rows: does not throw', false, String(e))
    rows = []
  }
  check('large diff rows: does not throw', true)
  check('large diff rows: row count > MAX_DIFF_ROWS', rows.length > MAX_DIFF_ROWS, `${rows.length} rows`)
  // Simulate the renderer's slice:
  const truncated = rows.slice(0, MAX_DIFF_ROWS)
  check('large diff rows: sliced to MAX_DIFF_ROWS', truncated.length === MAX_DIFF_ROWS, `${truncated.length} rows`)
  // Every row in the slice is well-formed (has old or new).
  check('large diff rows: all sliced rows well-formed',
    truncated.every((r) => r.old !== undefined || r.new !== undefined),
    `first 3: ${truncated.slice(0, 3).map(typePair)}`)
}

console.log('')
if (failures > 0) {
  console.log(`SMOKE FAILED: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('SMOKE PASSED: all checks passed')
