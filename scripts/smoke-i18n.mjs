#!/usr/bin/env node
/**
 * i18n smoke test for dock-git: runs the pure dictionary module
 * (src/client/i18n.ts) directly under `node --experimental-strip-types`
 * (the file has no runtime imports) and asserts:
 *  - zh and en dictionaries are key-complete (same key set) and every key's
 *    {placeholder} set is identical between the two locales;
 *  - representative zh/en lookups;
 *  - {n} / {msg} placeholder replacement;
 *  - a missing en key falls back to zh (restored via try/finally), and an
 *    unknown key comes back verbatim;
 *  - detectLocale honours a fake ctx locale service and falls back to the
 *    navigator language when ctx carries no locale — including the no
 *    navigator boundary (defaults to en).
 *
 * Run:
 *   node --experimental-strip-types scripts/smoke-i18n.mjs
 */
import { DICTS, detectLocale, translate } from '../src/client/i18n.ts'

let failures = 0
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}${detail !== undefined ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

console.log('== dictionaries ==')
check(
  'dicts: zh and en define the same key set',
  Object.keys(DICTS.zh).length === Object.keys(DICTS.en).length
    && Object.keys(DICTS.zh).every((key) => key in DICTS.en),
  `zh=${Object.keys(DICTS.zh).length} en=${Object.keys(DICTS.en).length}`,
)
{
  const placeholdersOf = (template) => {
    const set = new Set()
    for (const match of template.matchAll(/\{(\w+)\}/g)) set.add(match[1])
    return set
  }
  const mismatches = []
  for (const key of Object.keys(DICTS.zh)) {
    const zhSet = placeholdersOf(DICTS.zh[key])
    const enSet = placeholdersOf(DICTS.en[key] ?? '')
    const equal = zhSet.size === enSet.size && [...zhSet].every((name) => enSet.has(name))
    if (!equal) mismatches.push(`${key}: zh={${[...zhSet].join(',')}} en={${[...enSet].join(',')}}`)
  }
  check(
    'dicts: placeholder sets identical per key (zh ↔ en)',
    mismatches.length === 0,
    mismatches.length > 0 ? mismatches.join(' | ') : undefined,
  )
}

console.log('== translate: zh/en lookups ==')
check('zh viewDetails', translate('zh', 'viewDetails') === '查看详情', translate('zh', 'viewDetails'))
check('en viewDetails', translate('en', 'viewDetails') === 'View Details', translate('en', 'viewDetails'))
check('zh graphTitle', translate('zh', 'graphTitle') === '提交历史', translate('zh', 'graphTitle'))
check('en graphTitle', translate('en', 'graphTitle') === 'Git History', translate('en', 'graphTitle'))
check('en notRepo', translate('en', 'notRepo') === 'The current workspace is not a git repository', translate('en', 'notRepo'))

console.log('== translate: placeholders ==')
check(
  'zh commitsCount {n}',
  translate('zh', 'commitsCount', { n: 3 }) === '3 个提交',
  translate('zh', 'commitsCount', { n: 3 }),
)
check(
  'en commitsCount {n}',
  translate('en', 'commitsCount', { n: 3 }) === '3 commits',
  translate('en', 'commitsCount', { n: 3 }),
)
check(
  'en operationFailed {msg}',
  translate('en', 'operationFailed', { msg: 'boom' }) === 'Operation failed: boom',
  translate('en', 'operationFailed', { msg: 'boom' }),
)
check(
  'en minutesAgo {n}',
  translate('en', 'minutesAgo', { n: 5 }) === '5 min ago',
  translate('en', 'minutesAgo', { n: 5 }),
)

console.log('== translate: fallbacks ==')
check(
  'unknown key returned verbatim',
  translate('zh', 'no-such-key-xyz') === 'no-such-key-xyz',
  translate('zh', 'no-such-key-xyz'),
)
{
  const original = DICTS.en.commitsCount
  try {
    delete DICTS.en.commitsCount
    const zh = translate('zh', 'commitsCount', { n: 7 })
    const en = translate('en', 'commitsCount', { n: 7 })
    check('missing en key falls back to zh', en === zh && en === '7 个提交', `en → ${en}`)
  } finally {
    DICTS.en.commitsCount = original
  }
}

console.log('== detectLocale ==')
const fakeCtx = (active) => ({ get: (name) => (name === 'locale' ? { getSnapshot: () => ({ active }) } : undefined) })
check('ctx locale zh wins', detectLocale(fakeCtx('zh')) === 'zh')
check('ctx locale en wins', detectLocale(fakeCtx('en')) === 'en')
check(
  'unsupported ctx active ignored',
  (() => { const r = detectLocale(fakeCtx('fr')); return r === 'zh' || r === 'en' })(),
  detectLocale(fakeCtx('fr')),
)
{
  const realNav = globalThis.navigator
  const def = (value) => Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
  try {
    def({ language: 'zh-CN' })
    check('no-ctx follows navigator zh', detectLocale({}) === 'zh', `navigator.language=zh-CN → ${detectLocale({})}`)
    def({ language: 'en-US' })
    check('no-ctx follows navigator en', detectLocale({}) === 'en', `navigator.language=en-US → ${detectLocale({})}`)
    def({ language: 'ja-JP' })
    check('no-ctx non-zh defaults to en', detectLocale({}) === 'en', `navigator.language=ja-JP → ${detectLocale({})}`)
    // No navigator at all (Node < 21 / embedded webview): must default to en.
    delete globalThis.navigator
    check('no-ctx without navigator defaults to en', detectLocale({}) === 'en', `typeof navigator=${typeof globalThis.navigator}`)
  } finally {
    if (realNav !== undefined) def(realNav)
    else delete globalThis.navigator
  }
}

console.log('')
if (failures > 0) {
  console.log(`SMOKE FAILED: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('SMOKE PASSED: all checks passed')
