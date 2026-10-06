// V47 · _rv-33v38 可证伪 RV（铁律3 ·sixDimWiring 守门"必红"从注释变实测）
// 三柱：
//   柱1 绿态：未注入 ⇒ sixDimWiring 输出「6/6 全部被结算消费」且 0 失败（按输出内容判定，不按 exit）
//   柱2 红态：临时短路 src/settlement.js 波动维唯一消费点（:406 volatility ⇒ 恒 1）⇒
//             sixDimWiring 必红，且失败信息【点名 波动】（失败 extra 列出未接线维）
//   柱3 还原：finally 还原后逐字节比对 + 复跑绿态（还原成立且套件未伤）
// 判据方向：若柱2 不红 ⇒ sixDimWiring 守门是假守门；若失败信息不含「波动」⇒ 红因不对 ⇒ 都算 RV 失败。
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TARGET = join(ROOT, 'src', 'settlement.js')
const TEST = 'tests/sixDimWiring.test.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const runTest = () => spawnSync('node', [TEST], { cwd: ROOT, encoding: 'utf8' })
const out = (r) => String(r.stdout || '') + String(r.stderr || '')

const orig = readFileSync(TARGET, 'utf8')
const ANCHOR = 'const volatility = 1 + (s.波动 || 3) * 0.02'
const PATCH = 'const volatility = 1 // RV47: 波动维短路（临时 · 由 _rv-33v38 注入并还原）'
if (!orig.includes(ANCHOR)) {
  console.error('  ✗ FAIL: 短路锚点未命中（settlement.js 波动消费点可能已改）⇒ RV 判据失效，拒绝注入')
  process.exit(1)
}

console.log('▶ RV-33v38 · sixDimWiring 守门可证伪验证（波动维注入短路）')

// 柱1 绿态（未注入）
const g1 = runTest()
ok(g1.status === 0 && out(g1).includes('6/6 全部被结算消费') && out(g1).includes('0 失败'),
  `柱1 绿态：未注入 ⇒ 7/0 全绿（输出含 6/6 + 0 失败 · exit=${g1.status}）`)

// 柱2 红态（注入短路 · finally 保证还原）
let r2 = null
try {
  writeFileSync(TARGET, orig.replace(ANCHOR, PATCH))
  r2 = runTest()
  const o2 = out(r2)
  ok(r2.status !== 0 && o2.includes('✗ FAIL'), `柱2 红态：注入后套件必红（exit=${r2.status} · 见 FAIL 行）`)
  ok(o2.includes('波动'), `柱2 红因指向：失败信息点名被短路的维「波动」⇒ ${o2.includes('★ 六维') ? o2.split('\n').find(l => l.includes('★ 六维')).trim().slice(0, 80) : '(见套件输出)'} `)
} finally {
  writeFileSync(TARGET, orig)
}
const restored = readFileSync(TARGET, 'utf8') === orig
ok(restored, '柱3 还原：settlement.js 逐字节还原（含 :406 波动消费点）')

// 柱3b 还原后复跑绿（套件未伤）
const g3 = runTest()
ok(g3.status === 0 && out(g3).includes('0 失败'), '柱3b 还原后复跑 ⇒ 绿态如初（引擎未被 RV 误伤）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
if (fail) console.error('RV 验收失败 ⇒ sixDimWiring 守门不可信，需修套件或守门')
process.exit(fail ? 1 : 0)
