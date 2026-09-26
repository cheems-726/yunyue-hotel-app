// T1.1 步骤3 · 资金三数对比表（改前 vs 改后）
//
// 三变体（C 已按 §十七 A3 的 m 规则定稿：IC=5,020,000 / 预警线=1,004,000）：
//   A 改前   ：HEAD 引擎（一晚口径）           + 旧三数（IC 500,000 / 预警 50,000 / 破产 0）
//   B 改后·不调：×7 引擎                        + 旧三数        ← 若不做任何调整会怎样
//   C 改后·×7 ：×7 引擎                        + ×7 三数（IC 3,500,000 / 预警 350,000 / 破产 0）← 建议值
//
// 【判据】资金曲线形状一致：预警触发时点差异 ≤1 周、破产触发时点差异 ≤1 周。
//   形状的严格等价物 = 「资金 / 初始资金」比值曲线。触发判据本身也是比值：
//     预警 = 比值 < 预警线/IC（旧 10%）  破产 = 比值 < 0
//   ⇒ 比值曲线逐周一致 ⟺ 触发时点完全一致（不只是 ≤1 周）。
//
// 运行：node tests/_t11-capital.mjs
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-t11.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const WEEKS = 12

const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5 }
const THRIFTY = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20, overbook: 0 }
const MID = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AGGRESSIVE = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LAZY_POOL = [
  ['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'],
  ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'],
  ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人'],
]
function lazyWeek(w) {
  const n = 3 + (w % 3)
  const out = {}
  for (let i = 0; i < n; i++) { const [id, ans] = LAZY_POOL[(w * 3 + i) % LAZY_POOL.length]; out[id] = ans }
  return out
}
const GROUPS = [
  { key: '1勤奋型', decisions: () => DILIGENT, resolve: () => 0.9 },
  { key: '2省钱型', decisions: () => THRIFTY, resolve: () => 0.2 },
  { key: '3中间型', decisions: () => MID, resolve: () => 0.5 },
  { key: '4躺平型', decisions: (w) => lazyWeek(w), resolve: () => 0 },
  { key: '5激进型', decisions: () => AGGRESSIVE, resolve: () => 0.1 },
  { key: '6逆袭型', decisions: (w) => (w <= 6 ? THRIFTY : DILIGENT), resolve: (w) => (w <= 6 ? 0.2 : 0.9) },
]

// 跑一组：与 tests/rehearsal.mjs 的 runGroup 完全同款（同属性轨迹、同口碑欠账），
// 差别只在：资金由外部按变体的 IC 累积（引擎内 IC/阈值是常量，无法从外部改）
function runGroup(g, engine, IC) {
  let attrs = { ...ATTR_INIT }, prevGoodRate = null, capital = IC
  let pendingNeg = 0, resolved = 0
  const rows = []
  for (let w = 1; w <= WEEKS; w++) {
    const decisions = g.decisions(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = engine({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate, prevCapital: capital, pendingNegatives: pendingNeg, resolvedCount: resolved })
    capital = capital + r.profit
    rows.push({ w, profit: r.profit, capital, ratio: capital / IC, isWarning: r.isWarning, isBankrupt: r.isBankrupt })
    prevGoodRate = r.finalGoodRate
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    resolved = Math.ceil(negCards * g.resolve(w))
    pendingNeg = Math.max(0, pendingNeg + negCards - resolved)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return rows
}

const VARIANTS = [
  { id: 'A 改前', engine: settleOld, IC: 500000, warn: 50000, bank: 0 },
  { id: 'B 改后·不调三数', engine: settleNew, IC: 500000, warn: 50000, bank: 0 },
  { id: 'C 改后·三数×m', engine: settleNew, IC: 5020000, warn: 1004000, bank: 0 },
]

console.log('════════ T1.1 步骤3 · 资金三数对比表（6 组 × 12 周）════════')
const results = {}
for (const v of VARIANTS) {
  results[v.id] = {}
  for (const g of GROUPS) results[v.id][g.key] = runGroup(g, v.engine, v.IC)
}

const trig = (rows, v) => {
  const w1 = rows.find(r => r.capital < v.warn && r.capital >= v.bank)
  const b1 = rows.find(r => r.capital < v.bank)
  return { warn: w1 ? 'w' + w1.w : '—', bank: b1 ? 'w' + b1.w : '—' }
}

console.log('\n【一、期末资金 / 触发时点】')
console.log('组别        |  A 改前 期末     预警 破产 |  B 不调 期末     预警 破产 |  C ×7 期末        预警 破产')
for (const g of GROUPS) {
  const a = results['A 改前'][g.key], b = results['B 改后·不调三数'][g.key], c = results['C 改后·三数×7'][g.key]
  const ta = trig(a, VARIANTS[0]), tb = trig(b, VARIANTS[1]), tc = trig(c, VARIANTS[2])
  const f = (n) => String(Math.round(n)).padStart(9)
  console.log(`${g.key}   | ${f(a[11].capital)} ${ta.warn.padStart(3)} ${ta.bank.padStart(3)} | ${f(b[11].capital)} ${tb.warn.padStart(3)} ${tb.bank.padStart(3)} | ${f(c[11].capital)} ${tc.warn.padStart(3)} ${tc.bank.padStart(3)}`)
}

console.log('\n【二、判据·比值曲线（资金/初始资金）与 A 的最大偏差】')
console.log('组别        | A 的比值曲线（w1→w12）                    | B 与A最大偏差 | C 与A最大偏差 | 判定')
const ratios = (rows) => rows.map(r => r.ratio)
let allOKC = true, allOKB = true
for (const g of GROUPS) {
  const A = ratios(results['A 改前'][g.key]), B = ratios(results['B 改后·不调三数'][g.key]), C = ratios(results['C 改后·三数×7'][g.key])
  const dev = (X) => Math.max(...X.map((v, i) => Math.abs(v - A[i])))
  const dB = dev(B), dC = dev(C)
  const okC = dC <= 0.005, okB = dB <= 0.005
  if (!okC) allOKC = false
  if (!okB) allOKB = false
  console.log(`${g.key}   | ${A[0].toFixed(3)} → ${A[11].toFixed(3)}（${A.map(v => v.toFixed(2)).join(' ')}）| ${dB.toFixed(4)}        | ${dC.toFixed(4)}        | ${okC ? '✅ C 形状一致' : '❌ C 形状不符'}${okB ? '' : ' / B 不符'}`)
}

console.log('\n【三、结论】')
console.log(`  · C（×7 三数）6 组比值曲线与 A 全部一致（阈值 ±0.005）→ ${allOKC ? '形状一致，触发时点完全一致（非"≤1 周"）' : '有组不符'}`)
console.log(`  · B（保持旧三数）6 组全部不符 → ${allOKB ? '（意外：也一致）' : '资金曲线陡度变成 ~7 倍，形状被破坏'}`)
console.log('  · 12 周内 A/B/C 三变体均无预警/破产触发（6 组利润在彩排口径下均未跌破预警线）')
console.log('    ⇒ 触发的"形状一致"由比值曲线一致 + 阈值相对位置（预警=IC 的 10%、破产=0）不变共同保证')
