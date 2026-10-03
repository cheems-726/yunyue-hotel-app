// V10b 守门 · uiTokens（挂 run-all fast）
// 判据（单元卡-V10b §2 + 图标字典 §六）：
//   ① src(.jsx) 裸 emoji ≤ 2（白名单 ⚠️ ✅ 也计入总数 · 阈值只许下调）
//   ② 代码用到的图标键 ⊆ 图标字典（防随手新造）
//   ③ 所有 <button> 有可见文字或 aria-label/title（NN/g：图标不配标签就有歧义）
//   ④ styles.css 含三档 @media 且含 prefers-color-scheme: dark
//   ⑤ styles.css 无 box-shadow（DS：1px 边框分层 · 白名单为空）
//   ⑥ src(.jsx) 硬编码色值 ≤ 2（起点 1424 · 只许下调）
//   ⑦ index.html 不含 user-scalable=no / maximum-scale=1.0（V10a③ 并入）
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const DOC = join(APP, '..', '3-设计文档')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const isComment = (l) => { const t = l.trim(); return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*') }
// emoji 判定：符号区，排除排版符号（箭头/星/勾/圈数字等——它们是文字）
const 排版 = new Set([...'+-→⇑⇒↑↓←↔↩↺↳①②③④⑤⑥⑦✓✗✘★☆·—–−×÷'])
const EMO = /[\u2600-\u27BF\u2B00-\u2BFF\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\uFE0F\u2190-\u21FF]/gu

// ① 裸 emoji 计数（注释行除外）
let emojiCount = 0
const emojiFiles = []
for (const f of readdirSync(join(APP, 'src')).filter(f => f.endsWith('.jsx'))) {
  const lines = readFileSync(join(APP, 'src', f), 'utf8').split('\n')
  for (const l of lines) {
    if (isComment(l)) continue
    const hits = [...l.matchAll(EMO)].map(m => m[0]).filter(c => c !== '\uFE0F' && !排版.has(c))
    emojiCount += hits.length
    if (hits.length) emojiFiles.push(`${f}:${hits.join('')}`)
  }
}
ok(emojiCount <= 2, `① 裸 emoji ≤ 2（现 ${emojiCount} · 起点 656/817 口径见报告 · 阈值只许下调）`, emojiFiles.slice(0, 3).join(' | '))

// ② 图标键 ⊆ 字典
const dictSrc = readFileSync(join(DOC, '图标字典.md'), 'utf8')
const dictKeys = new Set()
for (const m of dictSrc.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) dictKeys.add(m[1])
const reg = readFileSync(join(APP, 'src', 'iconPaths.mjs'), 'utf8')
const regKeys = [...reg.matchAll(/^  '([^']+)':/gm)].map(m => m[1])
const 越界 = regKeys.filter(k => !dictKeys.has(k))
ok(越界.length === 0, `② 图标注册表键 ⊆ 图标字典（${regKeys.length} 键 · 字典 ${dictKeys.size} 键）`, 越界.join(','))
const 用到的 = new Set()
for (const f of readdirSync(join(APP, 'src')).filter(f => f.endsWith('.jsx'))) {
  const s = readFileSync(join(APP, 'src', f), 'utf8')
  for (const m of s.matchAll(/<Icon\s+name=\{?['"]([^'"}]+)['"]/g)) 用到的.add(m[1])
  for (const m of s.matchAll(/name=\{([a-zA-Z_][\w.]*(?:\.[\w]+)*)\s*(?:\|\|[^}]+)?\}/g)) {/* 动态键：由 ② 注册表⊆字典 兜底 */}
}
const 用到越界 = [...用到的].filter(k => !dictKeys.has(k))
ok(用到越界.length === 0, `②b <Icon name="…"> 字面键 ⊆ 字典（${用到的.size} 处字面引用）`, 用到越界.join(','))

// ③ <button> 有可见文字或 aria-label/title
let 无字按钮 = []
for (const f of readdirSync(join(APP, 'src')).filter(f => f.endsWith('.jsx'))) {
  const s = readFileSync(join(APP, 'src', f), 'utf8')
  for (const m of s.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    const inner = m[1].replace(/<[^>]*>/g, ' ')
    const 有文字 = /[一-鿿a-zA-Z0-9]/.test(inner.replace(/\{[^{}]*\}/g, x => x)) || /[一-鿿]/.test(inner)
    const 开 = m[0].slice(0, m[0].indexOf('>'))
    if (!有文字 && !/aria-label|title=/.test(开)) 无字按钮.push(`${f}: ${开.slice(0, 60)}`)
  }
}
ok(无字按钮.length === 0, '③ 所有 <button> 有可见文字或 aria-label/title', 无字按钮.slice(0, 2).join(' | '))

// ④ 三档 @media + 暗色
const css = readFileSync(join(APP, 'src', 'styles.css'), 'utf8')
ok(/@media \(max-width: 480px\)|max-width: 480px/.test(css) && /@media \(min-width: 481px\) and \(max-width: 1024px\)/.test(css) && /@media \(min-width: 1025px\)/.test(css),
  '④ styles.css 含三档断点（≤480 / 481–1024 / >1024）')
ok(/@media \(prefers-color-scheme: dark\)/.test(css), '④b styles.css 含 prefers-color-scheme: dark')

// ⑤ 无 box-shadow
const 阴影 = [...css.matchAll(/box-shadow/g)].length
ok(阴影 === 0, '⑤ styles.css 无 box-shadow（DS · 1px 边框分层 · 白名单为空）', `现 ${阴影} 处`)
let jsx阴影 = 0
for (const f of readdirSync(join(APP, 'src')).filter(f => f.endsWith('.jsx'))) {
  jsx阴影 += (readFileSync(join(APP, 'src', f), 'utf8').match(/boxShadow/g) || []).length
}
ok(jsx阴影 === 0, '⑤b jsx 无 boxShadow（内联）', `现 ${jsx阴影} 处`)

// ⑥ 硬编码色值 ≤ 2
let 色值 = 0
const 色值明细 = []
for (const f of readdirSync(join(APP, 'src')).filter(f => f.endsWith('.jsx'))) {
  const hits = readFileSync(join(APP, 'src', f), 'utf8').match(/#[0-9a-fA-F]{6}\b/g) || []
  if (hits.length) { 色值 += hits.length; 色值明细.push(`${f}:${hits.length}`) }
}
ok(色值 <= 2, `⑥ jsx 硬编码色值 ≤ 2（起点 1424 · 现 ${色值} · 只许下调）`, 色值明细.join(','))

// ⑦ index.html 允许缩放
const html = readFileSync(join(APP, 'index.html'), 'utf8')
ok(!html.includes('user-scalable=no') && !html.includes('maximum-scale=1.0'), '⑦ index.html 允许双指缩放（V10a③）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（tests/_rv-33v10b.mjs）：塞回裸emoji / 断点锁回480 / 删暗色媒体查询 ⇒ 各必红')
process.exit(fail ? 1 : 0)
