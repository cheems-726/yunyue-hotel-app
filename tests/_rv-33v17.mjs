// RV · §33-V17 批1-T2 真防回归（简化版：直接篡改 JSON 验 docs-sync 断言响应）
// ① 篡改 _last-gate.json：往 已知红 数组塞一条重复 ⇒ docs-sync T2 断言必红
// ② 还原 ⇒ T2 断言绿
// ③ 删 docs-sync 断言 ⇒ 篡改不红（证明断言真的在抓）；补回 ⇒ 红
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const GATE = join(APP, 'tests', '_last-gate.json')
const DS = join(APP, 'tests', 'docs-sync.mjs')
const 跑sync = () => spawnSync('node', ['tests/docs-sync.mjs'], { cwd: APP, encoding: 'utf8', timeout: 30000 })

let 全过 = true
const gateRaw = readFileSync(GATE)
const 原始gate = gateRaw.toString('utf8')
const dsRaw = readFileSync(DS)
const 原始DS = dsRaw.toString('utf8')

try {
  // ── ① 篡改 JSON：往 已知红 塞一条重复 ⇒ T2 断言必红 ──
  const gate = JSON.parse(原始gate)
  const 已知红原 = JSON.parse(JSON.stringify(gate['已知红'] || []))
  gate['已知红'] = [...已知红原, 已知红原[0] || 'RV塞入']   // 塞重复
  writeFileSync(GATE, JSON.stringify(gate, null, 2) + '\n', 'utf8')
  console.log('  ① 已篡改 JSON（已知红 塞重复）· 跑 docs-sync…')
  const r1 = 跑sync()
  const out1 = (r1.stdout || '') + (r1.stderr || '')
  const 红1 = r1.status !== 0 && out1.includes('T2')
  console.log(`     塞重复后：exit=${r1.status} · T2断言红=${红1}`)

  // ── ② 还原 JSON ⇒ T2 断言绿 ──
  writeFileSync(GATE, gateRaw)   // 还原写 raw 原字节
  console.log('  ② 已还原 JSON · 跑 docs-sync…')
  const r2 = 跑sync()
  const 绿2 = r2.status === 0
  console.log(`     还原后：exit=${r2.status} · T2断言绿=${绿2}`)
  if (!(红1 && 绿2)) 全过 = false

  // ── ③ 再篡改 + 删断言 ⇒ 不红（证明断言真的在抓）──
  const gate2 = JSON.parse(readFileSync(GATE, 'utf8'))
  gate2['已知红'] = [...(gate2['已知红'] || []), (gate2['已知红'] || ['x'])[0]]
  writeFileSync(GATE, JSON.stringify(gate2, null, 2) + '\n', 'utf8')

  // 删 docs-sync T2 断言 —— 必须【整块摘除】（锚点到"统一尾行格式"之间）。
  //   不能用 if(false) 包裹：会多出一个不闭合的花括号 ⇒ docs-sync 直接 SyntaxError 崩溃，
  //   "崩溃"也会让 T2 不出现 ⇒ 假证据。判据必须是【绿着跑过且无 T2】= 没有断言时坏 JSON 不可见。
  const 锚头 = 原始DS.indexOf('// ★ V17批1-T2 真防回归')
  const 锚尾 = 原始DS.indexOf('// 新鲜度：src/ vs 关键文档')   // T2 块的下界（块已前移到 FACTS 循环之后）
  if (锚头 < 0 || 锚尾 < 0 || 锚尾 <= 锚头) {
    console.log('     ✗ 靶③ 锚点未命中（断言块不在预期位置）'); 全过 = false
  } else {
  const 无断言DS = 原始DS.slice(0, 锚头) + '// (T2 断言已删 · RV 靶③验证用)\n' + 原始DS.slice(锚尾)
  writeFileSync(DS, 无断言DS)
  console.log('  ③ 已删 T2 断言 · 再篡改 JSON · 跑 docs-sync…')
  const r3 = 跑sync()
  const out3 = (r3.stdout || '') + (r3.stderr || '')
  const 不红3 = r3.status === 0 && !out3.includes('T2')   // 绿着跑过（exit=0）且无 T2 ⇒ 坏 JSON 不可见 = 断言真的在抓
  console.log(`     删断言+篡改后：exit=${r3.status} · 绿且无T2=${不红3}`)

  // 还原全部
  writeFileSync(GATE, gateRaw)
  writeFileSync(DS, dsRaw)
  console.log('  已还原 JSON + docs-sync')
  if (!不红3) 全过 = false
  } // 靶③ else 收尾

  console.log(`\n判定：${全过 ? '✓ T2 真防回归 RV 全过（篡改红 · 还原绿 · 删断言不红=断言真的在抓）' : '❌ T2 RV 验收失败'}`)
} finally {
  writeFileSync(GATE, gateRaw)
  writeFileSync(DS, dsRaw)
}
process.exit(全过 ? 0 : 1)
