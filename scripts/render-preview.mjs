#!/usr/bin/env node
/**
 * Render preview for dock-git: lays out a REAL git history (the preview repo:
 * branch + merge + rename + annotated tag, created under /tmp/dock-git-preview
 * when missing) with the actual swimlane.ts layout engine, renders it with the
 * same SVG/row logic CommitView uses, writes a standalone HTML, and screenshots
 * it with playwright — visual proof of the graph without the dock workbench.
 *
 * Run:
 *   node --experimental-strip-types scripts/render-preview.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/home/zero/AgentX/plugins/dsh-mermaid/node_modules/playwright/index.mjs'
import { GRID, COLOURS, layoutGraph } from '../src/client/swimlane.ts'
import { SEP } from '../src/git-ops.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve('/tmp', 'dock-git-preview', 'smoke-repo')
const OUT = resolve('/tmp', 'dock-git-preview', 'preview.html')

const fmt = ['%H', '%P', '%an', '%ae', '%at', '%s'].join(SEP)

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' })
}

// The preview repo is self-contained: create it under the scratch path when it
// does not already exist (the host smoke script builds its own scratch repos).
if (!existsSync(join(REPO, '.git'))) {
  mkdirSync(REPO, { recursive: true })
  git(['init', '-b', 'main'])
  git(['config', 'user.name', 'Preview Tester'])
  git(['config', 'user.email', 'preview@example.com'])
  const commit = (message, minute) => {
    execFileSync('git', ['add', '-A'], { cwd: REPO, encoding: 'utf8' })
    const stamp = new Date(Date.UTC(2024, 0, 1, 0, minute, 0)).toISOString()
    const env = { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp }
    execFileSync('git', ['commit', '-m', message], { cwd: REPO, encoding: 'utf8', env })
  }
  const append = (name, content) => {
    const path = join(REPO, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  // main: c1 (add a.txt) → feature: c2 (rename) + c3 (modify + extra) →
  // main: c4 (add c.txt) → merge M ← feature → annotated tag v1.0.
  append('a.txt', 'a\n')
  commit('c1: add a.txt', 0)
  git(['checkout', '-q', '-b', 'feature'])
  git(['mv', 'a.txt', 'b.txt'])
  commit('c2: rename a.txt to b.txt', 1)
  append('b.txt', 'x\n')
  append('extra.txt', 'extra\n')
  commit('c3: modify b.txt, add extra.txt', 2)
  git(['checkout', '-q', 'main'])
  append('c.txt', 'c\n')
  commit('c4: add c.txt', 3)
  git(['merge', '--no-ff', 'feature', '-m', 'Merge feature branch'])
  git(['tag', '-a', 'v1.0', '-m', 'v1.0 release'])
}

// Real data from the smoke repo (c1 → rename c2 → c3 → merge M ← feature).
const log = git(['log', '--max-count=50', `--format=${fmt}`, '--date-order', '--branches', '--tags', 'HEAD', '--'])
  .split(/\r\n|\r|\n/g).filter((l) => l !== '').map((line) => {
    const f = line.split(SEP)
    return { hash: f[0], parents: f[1] === '' ? [] : f[1].split(' '), author: f[2], email: f[3], date: Number(f[4]), message: f[5] }
  })
const refs = git(['show-ref', '-d', '--head']).split(/\r\n|\r|\n/g).filter((l) => l !== '')
const heads = [], tags = [], remotes = []
let headHash = null
for (const line of refs) {
  const [hash, ...rest] = line.split(' ')
  const ref = rest.join(' ')
  if (ref === 'HEAD') headHash = hash
  else if (ref.startsWith('refs/heads/')) heads.push({ hash, name: ref.slice(11) })
  else if (ref.startsWith('refs/tags/')) { const a = ref.endsWith('^{}'); tags.push({ hash, name: a ? ref.slice(10, -3) : ref.slice(10), annotated: a }) }
  else if (ref.startsWith('refs/remotes/')) remotes.push({ hash, name: ref.slice(13) })
}
const commits = log.map((c) => ({
  ...c,
  heads: heads.filter((h) => h.hash === c.hash).map((h) => h.name),
  tags: tags.filter((t) => t.hash === c.hash).map((t) => ({ name: t.name, annotated: t.annotated })),
  remotes: remotes.filter((r) => r.hash === c.hash).map((r) => ({ name: r.name })),
}))

const layout = layoutGraph(commits.map((c) => ({ hash: c.hash, parents: c.parents })), headHash)
const toPx = (p) => ({ x: p.x * GRID.x + GRID.offsetX, y: p.y * GRID.y + GRID.offsetY })

// Same SVG path building as CommitView.buildSvgPaths.
function buildSvgPaths(lines) {
  const paths = []
  const u = GRID.y * 0.8
  let d = '', curColour = -1, curCommitted = false, started = false, lastX = 0, lastY = 0
  const flush = () => { if (d !== '') paths.push({ d, isCommitted: curCommitted, colourIndex: curColour }); d = ''; started = false }
  for (const line of lines) {
    const p1 = toPx(line.p1), p2 = toPx(line.p2)
    if (!started || curColour !== line.colourIndex || curCommitted !== line.isCommitted || lastX !== p1.x || lastY !== p1.y) {
      flush(); d += `M${p1.x.toFixed(0)},${p1.y.toFixed(1)}`; curColour = line.colourIndex; curCommitted = line.isCommitted; started = true
    }
    if (p1.x === p2.x) d += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
    else d += `C${p1.x.toFixed(0)},${(p1.y + u).toFixed(1)} ${p2.x.toFixed(0)},${(p2.y - u).toFixed(1)} ${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
    lastX = p2.x; lastY = p2.y
  }
  flush()
  return paths
}

const paths = buildSvgPaths(layout.lines)
const svgParts = paths.map((p, i) =>
  `<path class="shadow" d="${p.d}"/><path class="line" d="${p.d}" stroke="${p.isCommitted ? COLOURS[p.colourIndex] : '#808080'}"/>`)
for (const row of layout.rows) {
  const commit = commits[row.id]
  const colour = row.isCommitted ? COLOURS[row.colourIndex] : '#808080'
  const cx = row.x * GRID.x + GRID.offsetX, cy = row.id * GRID.y + GRID.offsetY
  svgParts.push(row.isCurrent
    ? `<circle class="current" cx="${cx}" cy="${cy}" r="4" stroke="${colour}"/>`
    : `<circle cx="${cx}" cy="${cy}" r="4" fill="${colour}"/>`)
}

const rowHtml = commits.map((c, i) => {
  const badges = [
    ...c.heads.map((n) => `<span class="ref head" title="${n}">${n}</span>`),
    ...c.tags.map((t) => `<span class="ref tag" title="${t.name}">${t.name}</span>`),
    ...c.remotes.map((r) => `<span class="ref remote" title="${r.name}">${r.name}</span>`),
  ].join('')
  const d = new Date(c.date * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `<div class="row" style="padding-left:${layout.width + 10}px"><span class="msg" title="${c.message.replace(/"/g, '&quot;')}">${c.message}</span><span class="meta">${date}</span><span class="meta">${c.author}</span><span class="meta hash">${c.hash.slice(0, 8)}</span>${badges}</div>`
}).join('\n')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { margin: 0; background: #f6f8fa; font-family: ui-sans-serif, system-ui, sans-serif; }
.wrap { padding: 12px; }
h1 { font-size: 14px; color: #333; }
.hint { font-size: 12px; color: #666; margin-bottom: 8px; }
.rows { position: relative; }
svg { position: absolute; left: 0; top: 0; pointer-events: none; }
.shadow { fill: none; stroke: #f6f8fa; stroke-opacity: 0.75; stroke-width: 4; }
.line { fill: none; stroke-width: 2; }
circle.current { fill: #f6f8fa; stroke-width: 2; }
.row { display: flex; align-items: center; gap: 6px; height: 24px; line-height: 24px; white-space: nowrap; font-size: 13px; }
.msg { overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
.meta { color: #656d76; font-size: 12px; margin-left: 8px; }
.hash { font-family: ui-monospace, monospace; }
.ref { display: inline-block; height: 18px; line-height: 18px; margin: 2px 5px 0 0; padding: 0 6px; border-radius: 5px; border: 1px solid rgba(128,128,128,.75); background: rgba(128,128,128,.15); font-size: 12px; }
.ref.head { border-color: #1a7f37; color: #1a7f37; background: rgba(26,127,55,.12); }
.ref.remote { border-color: #8250df; color: #8250df; background: rgba(130,80,223,.12); }
.ref.tag { border-color: #9a6700; color: #9a6700; background: rgba(154,103,0,.12); }
</style></head><body><div class="wrap">
<h1>dock-git 渲染预览 — ${commits.length} commits, ${layout.rows.length} rows, graph ${layout.width}×${layout.height}px</h1>
<div class="hint">数据来自 preview 仓库真实 git 历史;布局 = src/client/swimlane.ts;SVG 渲染逻辑与 CommitView 一致</div>
<div class="rows" style="height:${layout.height}px">
<svg width="${layout.width}" height="${layout.height}">${svgParts.join('')}</svg>
${rowHtml}
</div></div></body></html>`
writeFileSync(OUT, html)
console.log('preview written:', OUT, `(${commits.length} commits, graph ${layout.width}x${layout.height})`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 420 } })
await page.goto('file://' + OUT)
await page.waitForTimeout(600)
const shot = OUT.replace(/\.html$/, '.png')
await page.screenshot({ path: shot })
await browser.close()
console.log('screenshot:', shot)
