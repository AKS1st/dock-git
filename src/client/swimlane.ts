/**
 * Swimlane graph-layout engine for dock-git (pure module: no runtime imports,
 * no DOM access, no process/global state, no UI framework). It turns an
 * ordered list of commits into a swimlane graph model — one row per commit
 * (lane column, colour, flags), branch-line segments between dots, and the
 * graph dimensions — that the view and the preview/smoke scripts consume.
 *
 * Determinism: identical input always produces identical output; the engine
 * keeps no state between invocations.
 *
 * Lane algorithm (top-down over the rows):
 *   - a commit claims the lane whose pending tip equals its hash; when several
 *     lanes wait on the same tip (a merge base reachable via two routes) the
 *     commit takes the lane with the largest column and every other waiting
 *     lane terminates at its dot, so no line dangles past a loaded commit;
 *   - the first parent keeps the commit's column (one dot per lane, linear
 *     histories occupy a single column); each additional merge parent either
 *     joins an already-open lane for the same tip (one column per branch
 *     chain, no matter how many merges feed it) or opens a fresh column that
 *     the parent's chain carries down;
 *   - a lane whose tip never appears among the loaded commits extends to the
 *     bottom edge of the graph (open line);
 *   - lanes end at root commits; their column and colour return to free pools
 *     and are reused by later lanes (colour reuse keeps the palette small);
 *   - the uncommitted pseudo-row (hash `*`) is drawn as an uncommitted row and
 *     flags its outgoing lane uncommitted (the view renders it grey).
 *
 * All coordinates are grid units (column/row indices); the view converts them
 * to pixels with the `GRID` constants (`px = x * GRID.x + GRID.offsetX`,
 * `py = y * GRID.y + GRID.offsetY`).
 */

/** Geometry constants: pixel spacing of the swimlane grid. */
export interface Grid {
  /** Horizontal spacing between adjacent lane columns, in px. */
  x: number
  /** Vertical spacing between adjacent rows, in px (equals the CSS row height). */
  y: number
  /** Left/right padding so the outermost dots are not clipped, in px. */
  offsetX: number
  /** Top/bottom padding so dots and line ends stay inside the graph, in px. */
  offsetY: number
}

export const GRID: Grid = { x: 16, y: 24, offsetX: 16, offsetY: 12 }

/**
 * Lane palette, indexed by a row/line `colourIndex`. The engine recycles
 * colours whose lanes have ended, so the palette never needs to be larger
 * than the number of simultaneously live lanes; the index wraps defensively.
 */
export const COLOURS: string[] = [
  '#d1242f',
  '#0969da',
  '#1a7f37',
  '#8250df',
  '#bf8700',
  '#cf222e',
  '#0550ae',
  '#116329',
  '#6639ba',
  '#9a6700',
  '#e16f24',
  '#6e7781',
]

/** One commit the layout engine lays out (the host strips ref decorations). */
export interface LayoutCommit {
  hash: string
  parents: string[]
}

/** One graph row: the layout of a single commit. */
export interface LayoutRow {
  /** The index of the commit in the input array (0 = top row). */
  id: number
  /** Lane column index (0-based, non-negative). */
  x: number
  /** Index into `COLOURS` for this lane. */
  colourIndex: number
  /** True only for the row whose hash equals the head hash. */
  isCurrent: boolean
  /** False for the uncommitted pseudo-row, true for every real commit. */
  isCommitted: boolean
}

/** A point in grid units (column/row indices); y grows downwards. */
export interface LayoutPoint {
  x: number
  y: number
}

/** One branch-line segment between two row dots. */
export interface LayoutLine {
  p1: LayoutPoint
  p2: LayoutPoint
  /** Index into `COLOURS`; equals the colour of the lane the line belongs to. */
  colourIndex: number
  /** False for lines that involve the uncommitted pseudo-row. */
  isCommitted: boolean
}

/** Inline-expansion descriptor: insert `height` px of space under row `index`. */
export interface LayoutOptions {
  index: number
  height: number
}

/** The layout result: rows, line segments and the graph dimensions in px. */
export interface LayoutResult {
  rows: LayoutRow[]
  lines: LayoutLine[]
  width: number
  height: number
}

/** One live lane: the pending tip that will next claim it, and where its
 *  current segment starts (the dot of the commit that fed the lane). */
interface Lane {
  column: number
  colourIndex: number
  tip: string
  fromRow: number
  fromCol: number
  /** False when the lane originates from the uncommitted pseudo-row. */
  committed: boolean
}

/**
 * Lay out `commits` (index 0 = top/newest row; the array may start with the
 * uncommitted pseudo-row whose hash is `*`, and may be empty) into a swimlane
 * graph model. `headHash` marks the current row; `options` inserts extra
 * vertical space under one row (see `applyExpandToLines`).
 */
export function layoutGraph(commits: LayoutCommit[], headHash?: string | null, options?: LayoutOptions): LayoutResult {
  const rows: LayoutRow[] = []
  const lines: LayoutLine[] = []
  const lanes: Lane[] = []
  const freeColumns: number[] = []
  const freeColours: number[] = []
  let nextColumn = 0
  let nextColour = 0

  /** The lowest free column, or a fresh one past the current high-water mark. */
  const takeColumn = (): number => {
    if (freeColumns.length > 0) return freeColumns.shift() as number
    const column = nextColumn
    nextColumn += 1
    return column
  }

  /** A recycled colour, or the next palette index (wrapped defensively). */
  const takeColour = (): number => {
    if (freeColours.length > 0) return freeColours.shift() as number
    const colour = nextColour % COLOURS.length
    nextColour += 1
    return colour
  }

  const releaseColumn = (column: number): void => {
    freeColumns.push(column)
    freeColumns.sort((a, b) => a - b)
  }

  const releaseColour = (colour: number): void => {
    if (!freeColours.includes(colour)) freeColours.push(colour)
  }

  const emitLine = (
    fromCol: number, fromRow: number,
    toCol: number, toRow: number,
    colourIndex: number, committed: boolean,
  ): void => {
    lines.push({
      p1: { x: fromCol, y: fromRow },
      p2: { x: toCol, y: toRow },
      colourIndex,
      isCommitted: committed,
    })
  }

  for (let id = 0; id < commits.length; id++) {
    const commit = commits[id]
    const isPseudo = commit.hash === '*'

    // Claim the lane this commit continues (the largest column among the
    // lanes waiting on this tip); any other lane waiting on the same tip
    // terminates at this row's dot so lines never dangle past a loaded commit.
    let column: number
    let colourIndex: number
    let committed: boolean
    let claimed = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].tip === commit.hash && (claimed === -1 || lanes[i].column > lanes[claimed].column)) claimed = i
    }
    if (claimed >= 0) {
      const lane = lanes[claimed]
      lanes.splice(claimed, 1)
      column = lane.column
      colourIndex = lane.colourIndex
      committed = lane.committed
      emitLine(lane.fromCol, lane.fromRow, column, id, colourIndex, committed)
      // Any other lane waiting on the same tip terminates at this dot; its
      // column and colour become reusable. The lane's line runs vertically to
      // the row(s) ABOVE the dot, then sweeps across the band(s) into the dot —
      // the turn never happens on the dot's own row, wider jumps start turning
      // proportionally earlier so the curve stays round, and the whole turn
      // keeps the lane's colour.
      for (let other = lanes.length - 1; other >= 0; other--) {
        if (lanes[other].tip === commit.hash) {
          const otherLane = lanes[other]
          if (id > 0) {
            const span = Math.max(1, Math.ceil(Math.abs(column - otherLane.column) / 2))
            const turnRow = Math.max(otherLane.fromRow, id - span)
            emitLine(otherLane.fromCol, otherLane.fromRow, otherLane.column, turnRow, otherLane.colourIndex, otherLane.committed)
            if (otherLane.column !== column) {
              emitLine(otherLane.column, turnRow, column, id, otherLane.colourIndex, otherLane.committed)
            }
          } else {
            // Top row: there is no band above; fall back to a same-row turn.
            emitLine(otherLane.fromCol, otherLane.fromRow, otherLane.column, id, otherLane.colourIndex, otherLane.committed)
            if (otherLane.column !== column) {
              emitLine(otherLane.column, id, column, id, otherLane.colourIndex, otherLane.committed)
            }
          }
          releaseColumn(otherLane.column)
          releaseColour(otherLane.colourIndex)
          lanes.splice(other, 1)
        }
      }
    } else {
      // Fresh lane (top row, or a commit whose child was not loaded).
      column = takeColumn()
      colourIndex = takeColour()
      committed = !isPseudo
    }

    rows.push({
      id,
      x: column,
      colourIndex,
      isCurrent: commit.hash === headHash,
      isCommitted: !isPseudo,
    })

    if (commit.parents.length > 0) {
      // First parent keeps this lane (same column and colour).
      lanes.push({ column, colourIndex, tip: commit.parents[0], fromRow: id, fromCol: column, committed: !isPseudo })
      // Each additional parent either joins an already-open lane (one column
      // per branch chain, no matter how many merges feed it) or opens a fresh
      // lane on a new column. In both cases the connection sweeps across the
      // band BELOW this row (never a same-row turn) and is drawn in the lane's
      // own colour, so the lane reads as one continuous stroke.
      for (let p = 1; p < commit.parents.length; p++) {
        const parent = commit.parents[p]
        const existing = lanes.findIndex((l) => l.tip === parent)
        if (existing >= 0) {
          const lane = lanes[existing]
          if (lane.column !== column) emitLine(column, id, lane.column, id + 1, lane.colourIndex, lane.committed)
        } else {
          const extraColumn = takeColumn()
          const extraColour = takeColour()
          // The connection sweeps the band(s) below this row; wider jumps span
          // more bands so the curve stays round, and the lane starts there.
          const span = Math.max(1, Math.ceil(Math.abs(extraColumn - column) / 2))
          if (extraColumn !== column) emitLine(column, id, extraColumn, id + span, extraColour, !isPseudo)
          lanes.push({ column: extraColumn, colourIndex: extraColour, tip: parent, fromRow: id + span, fromCol: extraColumn, committed: !isPseudo })
        }
      }
    } else {
      // Root commit: the lane ends here; column and colour become reusable.
      releaseColumn(column)
      releaseColour(colourIndex)
    }
  }

  // Open lines: lanes whose tip never appears among the loaded commits extend
  // to the bottom edge of the graph (the graph reads as continuing below).
  const bottom = commits.length
  for (const lane of lanes) {
    emitLine(lane.fromCol, lane.fromRow, lane.column, bottom, lane.colourIndex, lane.committed)
  }

  let maxColumn = 0
  for (const row of rows) maxColumn = Math.max(maxColumn, row.x)
  for (const line of lines) {
    maxColumn = Math.max(maxColumn, line.p1.x, line.p2.x)
  }
  const width = 2 * GRID.offsetX + maxColumn * GRID.x
  let height = commits.length * GRID.y + 2 * GRID.offsetY
  let resultLines = lines

  if (options !== undefined) {
    resultLines = applyExpandToLines(lines, options)
    height += options.height
  }

  return { rows, lines: resultLines, width, height }
}

/**
 * Apply the inline-expansion split to a line array produced without
 * expansion, returning a new array (the input is never mutated).
 *
 * The strip is inserted under row `index`, so everything at or below the
 * strip moves down by `height` px. A line that crosses the band (starts at or
 * above row `index` and ends at or below row `index + 1`) is split into three
 * segments — an approach ending at the upper boundary of the band, a vertical
 * bridge straight through the band (so the lane stays visually continuous
 * behind the expanded panel), and a continuation resuming at the lower
 * boundary — preserving colour and committed flag; a line entirely below the
 * band is shifted down as a whole. All resulting coordinates are
 * non-negative; a zero-length continuation (the line already ended at the
 * band's lower boundary) is dropped.
 */
export function applyExpandToLines(lines: LayoutLine[], options: LayoutOptions): LayoutLine[] {
  const { index, height } = options
  const shift = height / GRID.y
  const bandTop = index + 1
  const bandBottom = bandTop + shift
  const out: LayoutLine[] = []
  for (const line of lines) {
    if (line.p1.y <= index && line.p2.y >= bandTop) {
      out.push({
        p1: line.p1,
        p2: { x: line.p2.x, y: bandTop },
        colourIndex: line.colourIndex,
        isCommitted: line.isCommitted,
      })
      out.push({
        p1: { x: line.p2.x, y: bandTop },
        p2: { x: line.p2.x, y: bandBottom },
        colourIndex: line.colourIndex,
        isCommitted: line.isCommitted,
      })
      const resumedY = line.p2.y + shift
      if (resumedY > bandBottom) {
        out.push({
          p1: { x: line.p2.x, y: bandBottom },
          p2: { x: line.p2.x, y: resumedY },
          colourIndex: line.colourIndex,
          isCommitted: line.isCommitted,
        })
      }
    } else if (line.p1.y > index) {
      out.push({
        p1: { x: line.p1.x, y: line.p1.y + shift },
        p2: { x: line.p2.x, y: line.p2.y + shift },
        colourIndex: line.colourIndex,
        isCommitted: line.isCommitted,
      })
    } else {
      out.push(line)
    }
  }
  return out
}
