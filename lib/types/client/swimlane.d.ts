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
    x: number;
    /** Vertical spacing between adjacent rows, in px (equals the CSS row height). */
    y: number;
    /** Left/right padding so the outermost dots are not clipped, in px. */
    offsetX: number;
    /** Top/bottom padding so dots and line ends stay inside the graph, in px. */
    offsetY: number;
}
export declare const GRID: Grid;
/**
 * Lane palette, indexed by a row/line `colourIndex`. The engine recycles
 * colours whose lanes have ended, so the palette never needs to be larger
 * than the number of simultaneously live lanes; the index wraps defensively.
 */
export declare const COLOURS: string[];
/** One commit the layout engine lays out (the host strips ref decorations). */
export interface LayoutCommit {
    hash: string;
    parents: string[];
}
/** One graph row: the layout of a single commit. */
export interface LayoutRow {
    /** The index of the commit in the input array (0 = top row). */
    id: number;
    /** Lane column index (0-based, non-negative). */
    x: number;
    /** Index into `COLOURS` for this lane. */
    colourIndex: number;
    /** True only for the row whose hash equals the head hash. */
    isCurrent: boolean;
    /** False for the uncommitted pseudo-row, true for every real commit. */
    isCommitted: boolean;
}
/** A point in grid units (column/row indices); y grows downwards. */
export interface LayoutPoint {
    x: number;
    y: number;
}
/** One branch-line segment between two row dots. */
export interface LayoutLine {
    p1: LayoutPoint;
    p2: LayoutPoint;
    /** Index into `COLOURS`; equals the colour of the lane the line belongs to. */
    colourIndex: number;
    /** False for lines that involve the uncommitted pseudo-row. */
    isCommitted: boolean;
}
/** Inline-expansion descriptor: insert `height` px of space under row `index`. */
export interface LayoutOptions {
    index: number;
    height: number;
}
/** The layout result: rows, line segments and the graph dimensions in px. */
export interface LayoutResult {
    rows: LayoutRow[];
    lines: LayoutLine[];
    width: number;
    height: number;
}
/**
 * Lay out `commits` (index 0 = top/newest row; the array may start with the
 * uncommitted pseudo-row whose hash is `*`, and may be empty) into a swimlane
 * graph model. `headHash` marks the current row; `options` inserts extra
 * vertical space under one row (see `applyExpandToLines`).
 */
export declare function layoutGraph(commits: LayoutCommit[], headHash?: string | null, options?: LayoutOptions): LayoutResult;
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
export declare function applyExpandToLines(lines: LayoutLine[], options: LayoutOptions): LayoutLine[];
