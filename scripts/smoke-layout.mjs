#!/usr/bin/env node
/**
 * Layout-model smoke test for dock-git: runs the pure swimlane layout engine
 * (src/client/swimlane.ts) directly under `node --experimental-strip-types`
 * (the file has no runtime imports) and asserts the swimlane assignment on
 * hand-built histories: linear history, branch + merge, and the uncommitted
 * pseudo-row.
 *
 * Run:
 *   node --experimental-strip-types scripts/smoke-layout.mjs
 */
import { GRID, layoutGraph } from '../src/client/swimlane.ts'

let failures = 0
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}${detail !== undefined ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/**
 * Reconstruct maxNextX from the layout output: lanes are allocated
 * contiguously from column 0 (a freed column may be reused, but the high-water
 * mark only grows when a new lane needs a fresh column), so the widest row's
 * next free column is one past the maximum x coordinate appearing anywhere in
 * the output.
 */
function maxNextX(result) {
  let max = 0
  for (const row of result.rows) max = Math.max(max, row.x)
  for (const line of result.lines) {
    max = Math.max(max, line.p1.x, line.p2.x)
  }
  return max + 1
}

function summary(result) {
  const rows = result.rows
    .map((r) => `#${r.id}(x=${r.x},c${r.colourIndex}${r.isCurrent ? ',cur' : ''}${r.isCommitted ? '' : ',nc'})`)
    .join(' ')
  const lines = result.lines
    .map((l) => `(${l.p1.x},${l.p1.y})->(${l.p2.x},${l.p2.y})${l.isCommitted ? '' : '*'}`)
    .join(' ')
  return `rows: ${rows}\n    lines: ${lines}`
}

console.log('== case 1: linear history A<-B<-C ==')
const linear = layoutGraph(
  [
    { hash: 'c', parents: ['b'] },
    { hash: 'b', parents: ['a'] },
    { hash: 'a', parents: [] },
  ],
  'c',
)
console.log('  ' + summary(linear))
check('linear: 3 rows', linear.rows.length === 3, `${linear.rows.length} rows`)
check(
  'linear: all rows on column 0',
  linear.rows.every((r) => r.x === 0),
  linear.rows.map((r) => `#${r.id}:x${r.x}`).join(','),
)
check(
  'linear: head row (c) marked current',
  linear.rows.length === 3 && linear.rows[0].isCurrent === true && linear.rows[1].isCurrent === false,
  `rows[0].isCurrent=${linear.rows[0]?.isCurrent}`,
)
const linearMaxNextX = maxNextX(linear)
check(
  'linear: width = 2*offsetX + (maxNextX-1)*x with maxNextX=1',
  linear.width === 2 * GRID.offsetX + (linearMaxNextX - 1) * GRID.x && linearMaxNextX === 1,
  `width=${linear.width}, maxNextX=${linearMaxNextX}`,
)
check('linear: exact width 32', linear.width === 32, `width=${linear.width}`)
check(
  'linear: every line vertical (no lane change)',
  linear.lines.length > 0 && linear.lines.every((l) => l.p1.x === l.p2.x),
  `${linear.lines.length} lines`,
)

console.log('== case 2: branch + merge (c3 parents=[c2,c1]) ==')
const merged = layoutGraph(
  [
    { hash: 'c3', parents: ['c2', 'c1'] },
    { hash: 'c2', parents: ['c1'] },
    { hash: 'c1', parents: ['c0'] },
    { hash: 'c0', parents: [] },
  ],
  'c3',
)
console.log('  ' + summary(merged))
check('merge: 4 rows', merged.rows.length === 4, `${merged.rows.length} rows`)
check(
  'merge: merge row and first-parent row share a column',
  merged.rows[0].x === merged.rows[1].x,
  `c3.x=${merged.rows[0].x}, c2.x=${merged.rows[1].x}`,
)
check(
  'merge: c3 connects down to c2 (row0 -> row1)',
  merged.lines.some((l) => l.p1.y === 0 && l.p2.y === 1),
  '',
)
check(
  'merge: inflow reaches c1 dot column (x=0 at row 2)',
  merged.lines.some((l) => l.p2.x === 0 && l.p2.y === 2),
  '',
)
check(
  'merge: at least one lane-change segment (p1.x !== p2.x)',
  merged.lines.some((l) => l.p1.x !== l.p2.x),
  '',
)
const mergedMaxNextX = maxNextX(merged)
check(
  'merge: width = 2*offsetX + (maxNextX-1)*x with maxNextX=2',
  merged.width === 2 * GRID.offsetX + (mergedMaxNextX - 1) * GRID.x && mergedMaxNextX === 2,
  `width=${merged.width}, maxNextX=${mergedMaxNextX}`,
)
check('merge: exact width 48', merged.width === 48, `width=${merged.width}`)

console.log('== case 3: uncommitted pseudo-row ==')
const uncommitted = layoutGraph(
  [
    { hash: '*', parents: ['h'] },
    { hash: 'h', parents: [] },
  ],
  'h',
)
console.log('  ' + summary(uncommitted))
check(
  'uncommitted: first row isCommitted === false',
  uncommitted.rows.length > 0 && uncommitted.rows[0].isCommitted === false,
  `rows=${uncommitted.rows.length}`,
)
check(
  'uncommitted: head row (h) marked current',
  uncommitted.rows[1]?.isCurrent === true,
  `rows[1].isCurrent=${uncommitted.rows[1]?.isCurrent}`,
)
check(
  'uncommitted: first line segment flagged uncommitted',
  uncommitted.lines.length > 0 && uncommitted.lines[0].isCommitted === false,
  `${uncommitted.lines.length} lines`,
)

console.log('== case 4: expandY support ==')
const expandLinear = layoutGraph(
  [
    { hash: 'c', parents: ['b'] },
    { hash: 'b', parents: ['a'] },
    { hash: 'a', parents: [] },
  ],
  'c',
  { index: 1, height: 320 },
)
const linearNoExpand = layoutGraph(
  [
    { hash: 'c', parents: ['b'] },
    { hash: 'b', parents: ['a'] },
    { hash: 'a', parents: [] },
  ],
  'c',
)
check(
  'expand: height with expand > height without',
  expandLinear.height > linearNoExpand.height,
  `expand=${expandLinear.height} noexpand=${linearNoExpand.height}`,
)
check(
  'expand: height delta equals expandHeight',
  expandLinear.height === linearNoExpand.height + 320,
  `delta=${expandLinear.height - linearNoExpand.height}`,
)
check(
  'expand: rows unchanged',
  expandLinear.rows.length === linearNoExpand.rows.length && expandLinear.rows.every((r, i) => r.x === linearNoExpand.rows[i].x),
  `rows=${expandLinear.rows.length}`,
)
// applyExpandToLines: test the split logic
import { applyExpandToLines } from '../src/client/swimlane.ts'
const expandLines = applyExpandToLines(linearNoExpand.lines, { index: 1, height: 320 })
check(
  'expand: applyExpandToLines produces more segments (split at row 1)',
  expandLines.length >= linearNoExpand.lines.length,
  `before=${linearNoExpand.lines.length} after=${expandLines.length}`,
)
check(
  'expand: all expand line segments have valid coordinates',
  expandLines.every((l) => l.p1.x >= 0 && l.p2.x >= 0 && l.p1.y >= 0 && l.p2.y >= 0),
  `lines=${expandLines.length}`,
)

console.log('')
if (failures > 0) {
  console.log(`SMOKE FAILED: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('SMOKE PASSED: all checks passed')
