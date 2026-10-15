// V102/V104：把 dist 产物里的 Supabase 地址/key 改指向目标（**不改 src**）
//
// 用法：
//   NEW_KEY=<anon JWT> [NEW_URL=...] node _v102_rewrite.mjs     # 指定 URL
//   MODE=origin NEW_KEY=<anon JWT> node _v102_rewrite.mjs       # ★ 同源：URL 字面量 → (location.origin)
//
// ★ D278 纪律：锚点式替换会静默失效 ⇒ **写入必回读断言**，且断言必须**不可能假绿**：
//   不用"文件里存在 location.origin"（supabase-js 内部本来就有一处，会假绿），
//   改用**替换前后 location.origin 出现次数必须恰好增加 N**（N=替换点）+ 旧值必须归零。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'dist/assets'
const OLD_URL = 'https://jgytwxaeeezmdbxfsyvs.supabase.co'
const OLD_KEY = 'sb_publishable_bIXR5wi0l43WcRUsa0di0Q_2nVhdsU8'
const MODE = process.env.MODE || 'url'
const NEW_URL = process.env.NEW_URL || 'http://121.196.196.37'
const NEW_KEY = process.env.NEW_KEY
if (!NEW_KEY) { console.error('缺少 NEW_KEY'); process.exit(1) }

const urlRepl = MODE === 'origin' ? '(location.origin)' : JSON.stringify(NEW_URL)
const urlOldLit = JSON.stringify(OLD_URL)
const keyOldLit = JSON.stringify(OLD_KEY)
const keyNewLit = JSON.stringify(NEW_KEY)
const js = readdirSync(DIR).filter(f => f.endsWith('.js'))
const count = (s, sub) => s.split(sub).length - 1

// 基线：替换前 location.origin 出现次数
let originBefore = 0
for (const f of js) originBefore += count(readFileSync(join(DIR, f), 'utf8'), 'location.origin')

// 替换
let files = 0, urlHits = 0, keyHits = 0
for (const f of js) {
  const p = join(DIR, f)
  const before = readFileSync(p, 'utf8')
  const c1 = count(before, urlOldLit), c2 = count(before, keyOldLit)
  if (!c1 && !c2) continue
  writeFileSync(p, before.split(urlOldLit).join(urlRepl).split(keyOldLit).join(keyNewLit))
  files++; urlHits += c1; keyHits += c2
  console.log(`  ${f}: url x${c1}, key x${c2}`)
}
console.log(`替换：文件 ${files} 个 · url ${urlHits} 处 · key ${keyHits} 处`)

// ── 回读断言（不可能假绿）──
console.log('── 回读断言 ──')
let bad = 0
let originAfter = 0, oldUrlLeft = 0, newKeySeen = 0
for (const f of js) {
  const s = readFileSync(join(DIR, f), 'utf8')
  originAfter += count(s, 'location.origin')
  oldUrlLeft += count(s, OLD_URL)
  const k = count(s, NEW_KEY)
  newKeySeen += k
  if (count(s, OLD_KEY)) { console.log(`  ✗ ${f} 仍含线上 key`); bad++ }
}
const wantOrigin = urlHits * (MODE === 'origin' ? 1 : 0)
console.log(`  location.origin 次数: ${originBefore} → ${originAfter}（期望 +${wantOrigin}）`)
console.log(`  旧线上地址残留: ${oldUrlLeft}（期望 0）· 新 key 出现: ${newKeySeen}（期望 ${keyHits}）`)
if (oldUrlLeft !== 0) { console.log('  ✗ 旧线上地址未清干净'); bad++ }
if (newKeySeen !== keyHits) { console.log('  ✗ 新 key 写入数与替换点数不符'); bad++ }
if (originAfter !== originBefore + wantOrigin) { console.log('  ✗ location.origin 增量不符（替换未生效？）'); bad++ }
if (MODE !== 'origin') {
  const u = js.reduce((a, f) => a + count(readFileSync(join(DIR, f), 'utf8'), NEW_URL), 0)
  console.log(`  目标 URL 出现: ${u}（期望 ${urlHits}）`)
  if (u !== urlHits) { console.log('  ✗ 目标 URL 写入数不符'); bad++ }
}
// 片段打印（人工可核）
for (const f of js) {
  const s = readFileSync(join(DIR, f), 'utf8')
  const i = s.indexOf(MODE === 'origin' ? '(location.origin)' : NEW_URL)
  if (i >= 0) console.log(`  ✓ ${f} 片段: ${JSON.stringify(s.slice(Math.max(0, i - 26), i + 20))}`)
}
if (bad) { console.error(`断言失败 ${bad} 项 —— 不假绿，exit 1`); process.exit(1) }
console.log('✅ 回读断言全过')
