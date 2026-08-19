/**
 * dock-git shell styles: the git history panel needs hover/selected feedback,
 * ref chips and the SVG line/dot styling, which inline styles cannot fully
 * express — injected once as a <style data-plugin="dock-git"> tag (same
 * pattern as dock-files / the dock base).
 *
 * Colours use DSH theme variables with light-theme fallbacks (the dock-files
 * convention); the swimlane palette and the ref chip accents are fixed values
 * adapted for DSH theming.
 */
const CSS = `
.dg-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, #1f2328);
  overflow: hidden;
}
.dg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  font-size: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
  row-gap: 4px;
}
.dg-repo {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
.dg-header-spacer { flex: 1; }
.dg-btn {
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
  border-radius: 5px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.dg-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dg-btn:disabled { opacity: 0.55; cursor: default; }
.dg-btn-danger { color: #d1242f; border-color: rgba(209, 36, 47, 0.45); }
.dg-btn-danger:hover { background: rgba(209, 36, 47, 0.10); }

/* Header controls: branch filter dropdown + show-remote toggle. */
.dg-header-select {
  max-width: 150px;
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  flex-shrink: 0;
}
.dg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.dg-toggle input { margin: 0; cursor: pointer; }

/* Rows container: SVG overlay is absolutely positioned over the row list. */
.dg-rows {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.dg-graph {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
}
.dg-graph circle { pointer-events: all; cursor: pointer; }
.dg-graph .shadow {
  fill: none;
  stroke: var(--dsw-alias-bg-layer-2, #ffffff);
  stroke-opacity: 0.75;
  stroke-width: 4;
}
.dg-graph .line { fill: none; stroke-width: 2; }
.dg-graph circle.current {
  fill: var(--dsw-alias-bg-layer-2, #ffffff);
  stroke-width: 2;
}

/* One commit row (24px = GRID.y, aligned with the SVG dots). */
.dg-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  line-height: 24px;
  padding-right: 12px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  box-sizing: border-box;
  border-left: 2px solid transparent;
}
.dg-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.10)); }
.dg-row-selected {
  background: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.12));
  border-left-color: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.6));
}
.dg-uncommitted { color: var(--dsw-alias-label-secondary, #656d76); font-style: italic; }

/* Ref chips (DSH-themed). */
.dg-ref {
  display: inline-block;
  height: 18px;
  line-height: 18px;
  margin: 2px 5px 0 0;
  padding: 0 6px;
  background-color: rgba(128, 128, 128, 0.15);
  border-radius: 5px;
  border: 1px solid rgba(128, 128, 128, 0.75);
  font-size: 12px;
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  vertical-align: top;
  flex-shrink: 0;
}
.dg-ref-head { border-color: #1a7f37; color: #1a7f37; background: rgba(26, 127, 55, 0.12); }
.dg-ref-remote { border-color: #8250df; color: #8250df; background: rgba(130, 80, 223, 0.12); }
.dg-ref-tag { border-color: #9a6700; color: #9a6700; background: rgba(154, 103, 0, 0.12); }
/* Current-branch badge: the lane colour arrives inline (border/color/background
   overrides from CommitView); the class adds the emphasis ring + weight,
   derived from currentColor (= the lane colour), so it adapts to light and
   dark themes automatically. */
.dg-ref-active {
  font-weight: 600;
  box-shadow: 0 0 0 1px currentColor;
}

.dg-msg { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dg-muted { color: var(--dsw-alias-label-secondary, #656d76); }
.dg-date, .dg-author, .dg-hash { font-size: 12px; flex-shrink: 0; }

/* Bottom-docked commit detail panel. */
.dg-detail-panel {
  flex-shrink: 0;
  max-height: 45%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
}

/* Compact inline commit info shown right under its expanded row. The lane
   gutter stays transparent (the swimlane lines bridge through the band), and
   the panel itself — background, borders — starts right of the graph. */
.dg-inline-meta {
  box-sizing: border-box; /* total height matches INLINE_META_HEIGHT/expandY */
  display: flex;
  align-items: stretch;
  overflow: hidden;
  flex-shrink: 0;
  font-size: 12px;
}
.dg-inline-meta-gutter {
  flex: 0 0 auto;
  height: 100%;
}
.dg-inline-meta-loading {
  color: var(--dsw-alias-label-secondary, #656d76);
  padding: 4px 10px;
}
.dg-inline-meta-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 10px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-left: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-inline-body {
  white-space: pre-wrap;
  font-size: 12px;
  margin: 2px 0 0;
  max-height: 44px;
  overflow-y: auto;
  /* pre-wrap wraps normal lines; hide the rare unbreakable-token scrollbar. */
  overflow-x: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
}

/* Bottom-docked three-column detail panel (resizable height). */
.dg-detail-panel-bottom {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  overflow: hidden;
}
.dg-detail-resize {
  height: 6px;
  min-height: 6px;
  cursor: ns-resize;
  background: var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.dg-detail-resize:hover {
  background: var(--dsw-alias-link-primary, #0969da);
}
.dg-detail-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  font-size: 12px;
  flex-shrink: 0;
}
.dg-detail-panel-title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-detail-panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dg-detail-cols {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dg-file-tree {
  flex: 0 0 28%;
  min-width: 120px;
  overflow: auto;
  border-right: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  padding: 4px 0;
  font-size: 12px;
}
.dg-file-tree-title {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px 4px;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dg-tree-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.10));
}
.dg-tree-active {
  background: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.12));
}
.dg-tree-dir {
  font-weight: 600;
  cursor: default;
}
.dg-tree-arrow {
  flex-shrink: 0;
  font-size: 10px;
}
.dg-tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.dg-content-title {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  color: var(--dsw-alias-label-secondary, #656d76);
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
}
.dg-content-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary, #656d76);
  font-size: 12px;
  padding: 8px;
}
.dg-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  font-size: 12px;
  flex-shrink: 0;
}
.dg-detail-title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-detail-body { overflow: auto; padding: 8px 10px; }
.dg-meta-row { font-size: 12px; line-height: 1.7; }
.dg-meta-label { color: var(--dsw-alias-label-secondary, #656d76); }
.dg-parent-link { color: var(--dsw-alias-link-primary, #0969da); cursor: pointer; text-decoration: underline; }
.dg-parent-link:hover { text-decoration: none; }
.dg-body {
  white-space: pre-wrap;
  font-size: 12px;
  margin: 8px 0;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-file { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 1px 0; }
.dg-file-status { font-weight: 700; flex-shrink: 0; }
.dg-file-A { color: #1a7f37; }
.dg-file-M { color: #9a6700; }
.dg-file-D { color: #d1242f; }
.dg-file-R { color: #8250df; }
/* Defensive: --diff-filter=AMDR never emits C/U today, but keep them styled
   in case a future filter change does (dark-scheme purple/orange). */
.dg-file-C { color: #8250df; }
.dg-file-U { color: #d29922; }
.dg-file-add { color: #1a7f37; }
.dg-file-del { color: #d1242f; }
.dg-file-stats { margin-left: auto; flex-shrink: 0; }

/* Side-by-side diff container (two independent scroll panes). */
.dg-diff-container {
  flex: 1 1 72%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dg-diff {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  margin: 0;
  white-space: normal;
}
.dg-diff-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-diff-header .dg-content-title {
  flex: 1 1 50%;
  min-width: 0;
  text-align: center;
  border-right: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-diff-header .dg-content-title:last-child {
  border-right: none;
}
/* Vertical scroll wrapper: scrolls both panes together vertically.
   The two child .dg-diff-pane each scroll independently horizontally. */
.dg-diff-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  display: flex;
}
/* Each pane (left = Before, right = After) scrolls independently
   horizontally.  Content rows inside use min-width: max-content so
   long lines widen the pane and produce its own horizontal scrollbar. */
.dg-diff-pane {
  flex: 1 1 50%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border-right: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-diff-pane:last-child {
  border-right: none;
}
/* A single content line within a pane.  Each row is one diff line
   (20px tall) and grows with max-content so the pane scrolls. */
.dg-diff-line {
  min-height: 20px;
  height: 20px;
  padding: 0 8px;
  min-width: max-content;
  font-size: 12px;
  line-height: 20px;
  white-space: pre;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-diff-add {
  background: #e6ffec;
  color: #1a7f37;
}
.dg-diff-del {
  background: #ffebe9;
  color: #d1242f;
}
.dg-diff-empty {
  background: rgba(127, 127, 127, 0.06);
  color: transparent;
}
.dg-diff-same {
  /* context line — same as base; reserved for future styling hooks. */
}

/* Raw commit-diff mode: one coloured line per row, hunk ranges tinted. */
.dg-raw-diff {
  font-size: 12px;
  margin: 8px 0;
  overflow-x: auto;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-raw-diff .dg-diff-line { min-width: max-content; }
.dg-diff-hunk {
  background: rgba(9, 105, 218, 0.10);
  color: #0969da;
}
.dg-diff-hdr {
  color: var(--dsw-alias-label-secondary, #656d76);
}

.dg-err { color: #d1242f; font-size: 12px; padding: 8px 12px; }
.dg-err .dg-btn { margin-top: 6px; }
.dg-loading { color: var(--dsw-alias-label-secondary, #656d76); font-size: 12px; padding: 8px 12px; }
.dg-not-repo { padding: 16px 12px; font-size: 13px; }
.dg-empty { padding: 16px 12px; font-size: 13px; color: var(--dsw-alias-label-secondary, #656d76); }

/* Repo selector (side-bar pane of multi-repo workspaces; like dock-files' tree). */
.dg-repo-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}
.dg-repo-list-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary, #656d76);
  padding: 4px 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.dg-repo-list-hint {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
  padding: 0 2px 6px;
}
.dg-repo-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  overflow: hidden;
}
.dg-repo-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dg-repo-item-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dg-repo-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-repo-path {
  color: var(--dsw-alias-label-secondary, #656d76);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-repo-depth {
  flex-shrink: 0;
  height: 16px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10px;
  white-space: nowrap;
  border: 1px solid var(--dsw-alias-link-primary, #0969da);
  color: var(--dsw-alias-link-primary, #0969da);
  background: rgba(9, 105, 218, 0.08);
}
.dg-repo-empty {
  padding: 12px 2px;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary, #656d76);
}

/* Context menu (portal to <body>, fixed; same idea as dock-files .df-context-menu). */
.dg-menu {
  position: fixed;
  z-index: 200;
  min-width: 160px;
  max-width: 280px;
  padding: 4px;
  border-radius: 8px;
  font-size: 13px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-menu-item {
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s ease;
}
.dg-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dg-menu-item:active { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.22)); }
.dg-menu-item-danger { color: #d1242f; }
.dg-menu-item-danger:hover { background: rgba(209, 36, 47, 0.10); }
.dg-menu-divider { height: 1px; margin: 4px 8px; background: var(--dsw-alias-border-l2, #d8dbe0); }

/* Settings panel. */
.dg-settings {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  font-size: 13px;
}
.dg-settings-section { margin-bottom: 18px; }
.dg-settings-section-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.dg-settings-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 12px; }
.dg-settings-label { width: 90px; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #656d76); }
.dg-settings-input {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-settings-input:focus { outline: 1px solid var(--dsw-alias-link-primary, #0969da); }
.dg-settings-remote-name-input { max-width: 120px; flex: 0 0 auto; }
.dg-settings-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 14px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.dg-settings-radio input { margin: 0; cursor: pointer; }
.dg-settings-remote {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}
.dg-settings-remote-name {
  font-weight: 600;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-settings-remote-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-settings-empty { font-size: 12px; padding: 4px 0; }
.dg-settings-lang { color: var(--dsw-alias-label-primary, #1f2328); }
.dg-settings-back { margin-top: 8px; }
.dg-saved { color: #1a7f37; font-size: 12px; margin-left: 6px; }

/* Dock-style modal dialog (portal to <body>, above the context menu). */
.dg-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 16vh;
}
.dg-dialog {
  min-width: 300px;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 13px;
  overflow: hidden;
}
.dg-dialog-title {
  font-weight: 600;
  font-size: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
}
.dg-dialog-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  line-height: 1.6;
}
.dg-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
}
.dg-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dg-dialog-label {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-dialog-input,
.dg-dialog-select {
  font-size: 13px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-dialog-input:focus,
.dg-dialog-select:focus {
  outline: 1px solid var(--dsw-alias-link-primary, #0969da);
}
.dg-dialog-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--dsw-alias-label-primary, #1f2328);
  white-space: nowrap;
}
.dg-dialog-check input { margin: 0; cursor: pointer; }

/* Commit panel (bottom-docked like the detail panel; VS Code style). */
.dg-commit-panel {
  flex-shrink: 0;
  max-height: 55%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
}
.dg-commit-body {
  overflow: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dg-commit-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 0;
}
.dg-commit-row-btn { margin-left: auto; flex-shrink: 0; }
.dg-commit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.dg-commit-hint { flex: 1; }
.dg-commit-msg {
  font-family: inherit;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
  resize: vertical;
  min-height: 56px;
  box-sizing: border-box;
}
.dg-commit-msg:focus { outline: 1px solid var(--dsw-alias-link-primary, #0969da); }
.dg-commit-btn { margin-left: auto; }
.dg-commit-empty {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-commit-error {
  font-size: 12px;
  color: #d1242f;
  background: rgba(209, 36, 47, 0.08);
  border: 1px solid rgba(209, 36, 47, 0.25);
  border-radius: 5px;
  padding: 6px 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Operation result strip (ref writes). */
.dg-op-error {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #d1242f;
  background: rgba(209, 36, 47, 0.08);
  border-top: 1px solid rgba(209, 36, 47, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-op-msg {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #1a7f37;
  background: rgba(26, 127, 55, 0.08);
  border-top: 1px solid rgba(26, 127, 55, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dark theme: fixed accents need darker-scheme values for contrast. */
body[data-ds-dark-theme] .dg-ref-head   { border-color: #3fb950; color: #3fb950; }
body[data-ds-dark-theme] .dg-ref-remote { border-color: #a371f7; color: #a371f7; }
body[data-ds-dark-theme] .dg-ref-tag    { border-color: #d29922; color: #d29922; }
body[data-ds-dark-theme] .dg-file-A, body[data-ds-dark-theme] .dg-diff-add { color: #3fb950; }
body[data-ds-dark-theme] .dg-file-M { color: #d29922; }
body[data-ds-dark-theme] .dg-file-R { color: #a371f7; }
body[data-ds-dark-theme] .dg-file-D, body[data-ds-dark-theme] .dg-diff-del { color: #ff7b72; }
body[data-ds-dark-theme] .dg-file-C { color: #a371f7; }
body[data-ds-dark-theme] .dg-file-U { color: #f0883e; }
body[data-ds-dark-theme] .dg-saved, body[data-ds-dark-theme] .dg-op-msg { color: #3fb950; }
body[data-ds-dark-theme] .dg-op-error, body[data-ds-dark-theme] .dg-menu-item-danger, body[data-ds-dark-theme] .dg-btn-danger { color: #ff7b72; }
body[data-ds-dark-theme] .dg-btn-danger { border-color: rgba(255, 123, 114, 0.45); }
body[data-ds-dark-theme] .dg-btn-danger:hover { background: rgba(255, 123, 114, 0.12); }
body[data-ds-dark-theme] .dg-menu-item-danger:hover { background: rgba(255, 123, 114, 0.12); }
body[data-ds-dark-theme] .dg-commit-error { color: #ff7b72; }
body[data-ds-dark-theme] .dg-detail-resize:hover { background: #79c0ff; }

/* Dark theme: side-by-side diff colours. */
body[data-ds-dark-theme] .dg-diff-add { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
body[data-ds-dark-theme] .dg-diff-del { background: rgba(255, 123, 114, 0.15); color: #ff7b72; }
body[data-ds-dark-theme] .dg-diff-empty { background: rgba(127, 127, 127, 0.10); }
body[data-ds-dark-theme] .dg-diff-hunk { background: rgba(56, 139, 253, 0.14); color: #79c0ff; }
body[data-ds-dark-theme] .dg-diff-hdr { color: var(--dsw-alias-label-secondary, #8b949e); }
`

export function mountStyles(): () => void {
  const existing = document.querySelector('style[data-plugin="dock-git"]')
  if (existing !== null) existing.remove()
  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'dock-git')
  style.textContent = CSS
  document.head.appendChild(style)
  return () => {
    // Only remove when this exact tag is still the mounted one: a later
    // mountStyles() call may have replaced us, and we must never remove
    // someone else's style tag.
    if (document.querySelector('style[data-plugin="dock-git"]') === style) style.remove()
  }
}
