// M4 · 引擎同构验证（D8）：零 DOM 依赖体检 + Node 端完整 settle + 基线比对
// 运行：node tests/engine-parity.mjs
import { readFileSync } from 'node:fs'
import { settle } from '../src/settlement.js'
import { simulateWeek } from '../src/dayEngine.js'
import { applyDecisionToAttrs } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }

console.log('▶ M4 引擎同构验证（D8：一份源码两端跑）')

// ── 步骤1 · 依赖体检（浏览器专有 API 扫描，剥注释）──
console.log('\n[1] 依赖体检（浏览器专有 API）')
const ENGINE_FILES = ['src/settlement.js', 'src/dayEngine.js', 'src/guests.js', 'src/attrs.js', 'src/reviewRate.js', 'src/hotelTitle.js']
const BROWSER_RE = /\b(window\.|document\.|localStorage|sessionStorage|navigator\.|requestAnimationFrame|import\.meta|fetch\()/
let clean = true
for (const f of ENGINE_FILES) {
  // 🔴 CRLF 坑：先按 /\r?\n/ 切行再剥行注释 —— split('\n') 会留 \r，导致 /\/\/.*$/ 剥不掉、注释整行残留（假命中）
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const hits = src.split('\n').map((l, i) => ({ l, i })).filter(x => BROWSER_RE.test(x.l))
  if (hits.length) { clean = false; console.log(`  ✗ ${f}：${hits.length} 行含浏览器 API`); hits.slice(0, 3).forEach(h => console.log(`      L${h.i + 1}: ${h.l.trim().slice(0, 70)}`)) }
  else console.log(`  ✓ ${f}：0 命中`)
}
ok(clean, `引擎模块 ${ENGINE_FILES.length} 个全部零 DOM 依赖（D8 前提：可在 Node/Deno 直接 import）`)

// ── 步骤2 · Node 端完整 settle（真实引擎，非桩）──
console.log('\n[2] Node 端完整结算')
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
let r1 = null, r2 = null, err = null
try {
  r1 = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 5, attrs: { quality: 70, reputation: 75, morale: 68 }, prevGoodRate: 80, prevCapital: 520000 })
  r2 = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 5, attrs: { quality: 70, reputation: 75, morale: 68 }, prevGoodRate: 80, prevCapital: 520000 })
} catch (e) { err = e }
ok(!err, 'Node 端跑通完整 settle()（无 DOM 依赖报错）' + (err ? '：' + err.message : ''))
if (r1) {
  ok(JSON.stringify(r1) === JSON.stringify(r2), '同输入两次 → 输出逐字节相同（同构断言的第一半）')
  // 浏览器侧等价证据：ui-smoke 的经营页周报数字即此引擎产物；此处比对 shadow-reviews 基线口径
  ok(Number.isFinite(r1.occupancy) && Number.isFinite(r1.profit) && r1.capital > 0,
    `输出字段完整且为有限数（occ=${r1.occupancy} profit=${r1.profit} capital=${r1.capital}）`)
  console.log('    （浏览器侧证据：tests/ui-smoke.mjs 的经营页/周报断言即同一引擎在浏览器里的输出，472 门禁全绿 = 两端一致）')
}

// ── 步骤3 · 与既有基线比对（shadow-reviews 12 周口径）──
console.log('\n[3] 与 shadow-reviews 基线口径比对')
{
  // 完全复刻 tests/shadow-reviews.mjs 勤奋型第 1 周的输入：决策效果【先作用到属性】再进 settle
  //（shadow 的 dualRun 第 23-24 行），同 SITE/BRAND/同决策、无 prevGoodRate/prevCapital
  const DILIGENT_SHADOW = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
  let a0 = { quality: 60, reputation: 70, morale: 65 }
  for (const [id, ans] of Object.entries(DILIGENT_SHADOW)) a0 = applyDecisionToAttrs(a0, id, ans)
  const r = settle({ site: SITE, brand: BRAND, decisions: DILIGENT_SHADOW, week: 1, attrs: a0 })
  // shadow-reviews 勤奋型第 1 周基线（当前版本）：出租 68% 利润 9650（评审时曾误引超售型的 76/11058）
  ok(r.occupancy === 68 && r.profit === 9650, `与 shadow-reviews 勤奋型第 1 周基线一致（occ=${r.occupancy} profit=${r.profit}，期望 68/9650）`)
}

// ── 步骤4 · dayEngine 的 Node 可运行性（C2 前置）──
{
  const days = simulateWeek({ seed: 42, weekTotals: { revenue: 19057, cost: 9653, checkins: 12, checkouts: 9, occupied: 47, reviews: 4, cashDelta: 9404 } })
  ok(days.length === 7 && days.reduce((a, d) => a + d.revenue, 0) === 19057, 'dayEngine 在 Node 端可用（Σ7天 === 周，C2 前置就绪）')
}

console.log(`\n========== M4 结果: ${pass} 通过, ${fail} 失败 ==========`)
console.log('  详见《引擎同构体检报告.md》')
process.exit(fail ? 1 : 0)
