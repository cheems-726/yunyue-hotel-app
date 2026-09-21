// R0 第3步 · 影子运行（不登录真账号、不碰线上）
// 对比：改前引擎（src/settle-old-r0.mjs，R0 之前）vs 改后引擎（src/settlement.js）
// 目的：① 12 周逐周对比 ② 声誉双通道量化 ③ 是否有策略"必输" ④ 系数建议
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-r0.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' } // 中档：衰减 -2 / 放大 ×1.0

// 每周决策 = 18 项里的一组典型打法（简化为代表性 8 项，其余保持默认）
const STRATEGIES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', renovation: '投150万改造', 'quality-check': ['隔音', '卫生', '床品'] },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', 'quality-check': ['灯光', '电视', '窗帘'] },
  中间型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调优惠' },
}

// 逐周属性演变：每项决策的效果应用一次（与 App 行为一致：每周决策清空后重做）+ 周末衰减
function evolve(attrs, decisions, week, withDecay = true) {
  let a = attrs
  for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
  if (withDecay) a = applyWeeklyDecay(a, BRAND.level)
  return a
}

// 跑 12 周：返回逐周数据 + 累计 + 最终属性
function run12(engine, decisions, mode) {
  // mode: 'old' 用改前引擎 | 'new-neutral' 固定中性 | 'new-evolve' 属性演变（无衰减）| 'new-evolve-decay' 演变+衰减
  let attrs = { ...ATTR_INIT }
  let prevGood = null, capital = null, rows = [], totalProfit = 0
  for (let w = 1; w <= 12; w++) {
    const useAttrs = mode === 'new-neutral'
      ? { quality: 60, reputation: 70, morale: 65 }
      : (mode === 'new-evolve-decay' ? evolve(attrs, decisions, w, false) : attrs)
    const r = engine === settleOld
      ? settleOld({ site: SITE, brand: BRAND, decisions, week: w, prevGoodRate: prevGood, prevCapital: capital })
      : settleNew({ site: SITE, brand: BRAND, decisions, week: w, prevGoodRate: prevGood, prevCapital: capital, attrs: useAttrs })
    prevGood = r.finalGoodRate
    capital = r.capital
    totalProfit += r.profit
    rows.push({ w, occ: r.occupancy, profit: r.profit, good: r.finalGoodRate, neg: r.negativeCount, capital: r.capital })
    if (engine !== settleOld) {
      if (mode === 'new-evolve-decay') {
        // 真实接线后的行为：周内先应用决策效果 → 结算内部应用事件与每周衰减 → 返回 attrsAfter 作为下周输入
        attrs = r.attrsAfter
      } else {
        attrs = evolve(attrs, decisions, w, false)   // 仅决策累计（未接衰减的对照）
      }
    }
  }
  return { rows, totalProfit, finalAttrs: engine === settleOld ? null : attrs, endCapital: capital }
}

const avg = (arr, k) => Math.round(arr.reduce((s, x) => s + x[k], 0) / arr.length)

console.log('════════ R0 影子运行（全季·中档，12 周，固定种子）════════\n')

// ── ① 回归证明：改前 vs 改后（中性属性）必须逐周一致 ──
console.log('① 单元级回归证明（中性属性钉死、不衰减）——两者应逐周完全相同')
const oldNeutral = run12(settleOld, STRATEGIES.中间型, 'old')
const newNeutral = run12(settleNew, STRATEGIES.中间型, 'new-neutral')
const same = oldNeutral.rows.every((r, i) => r.occ === newNeutral.rows[i].occ && r.profit === newNeutral.rows[i].profit && r.good === newNeutral.rows[i].good)
console.log(`   改前 vs 改后(中性)：${same ? '✅ 12 周逐周完全一致（回归零变化成立）' : '❌ 存在差异！'}`)
console.log(`   累计利润 改前 ${oldNeutral.totalProfit} / 改后 ${newNeutral.totalProfit}\n`)

// ── ② 12 周逐周对比表（改前 vs 改后·属性演变）──
for (const [name, dec] of Object.entries(STRATEGIES)) {
  for (const [mode, label] of [['new-evolve', '仅决策累计(未接衰减·对照)'], ['new-evolve-decay', '决策+每周衰减(本轮采纳)']]) {
    const before = run12(settleOld, dec, 'old')
    const after = run12(settleNew, dec, mode)
    console.log(`━━━ ${name} · ${label} ━━━`)
    console.log('   周 |  改前 出租率/利润/好评 |  改后 出租率/利润/好评 | Δ利润')
    before.rows.forEach((b, i) => {
      const a = after.rows[i]
      const d = a.profit - b.profit
      console.log(`   ${String(b.w).padStart(2)} | ${String(b.occ).padStart(3)}% ${String(b.profit).padStart(7)} ${String(b.good).padStart(3)}% | ${String(a.occ).padStart(3)}% ${String(a.profit).padStart(7)} ${String(a.good).padStart(3)}% | ${d >= 0 ? '+' : ''}${d}`)
    })
    console.log(`   累计利润：改前 ${before.totalProfit} → 改后 ${after.totalProfit}（Δ ${after.totalProfit - before.totalProfit >= 0 ? '+' : ''}${after.totalProfit - before.totalProfit}，${((after.totalProfit - before.totalProfit) / Math.abs(before.totalProfit) * 100).toFixed(1)}%）`)
    console.log(`   平均出租率：改前 ${avg(before.rows, 'occ')}% → 改后 ${avg(after.rows, 'occ')}%  |  平均好评率：${avg(before.rows, 'good')}% → ${avg(after.rows, 'good')}%`)
    console.log(`   期末属性：${JSON.stringify(after.finalAttrs)}  期末资金：改前 ${before.endCapital} → 改后 ${after.endCapital}\n`)
  }
}

// ── ③ 声誉双通道量化 ──
console.log('━━━ ③ 声誉双通道量化（同一打法，只改声誉）━━━')
const decQ = STRATEGIES.勤奋型
const repTraj = run12(settleNew, decQ, 'new-evolve-decay').finalAttrs.reputation
const runWithRep = (rep) => {
  let prevGood = null, capital = null, occs = []
  for (let w = 1; w <= 12; w++) {
    const r = settleNew({ site: SITE, brand: BRAND, decisions: decQ, week: w, prevGoodRate: prevGood, prevCapital: capital, attrs: { quality: 60, reputation: rep, morale: 65 } })
    prevGood = r.finalGoodRate; capital = r.capital; occs.push(r.occupancy)
  }
  return Math.round(occs.reduce((a, b) => a + b, 0) / occs.length)
}
const occRep70 = runWithRep(70), occRep90 = runWithRep(90), occRep40 = runWithRep(40)
const occFactorOf = r => (0.9 + (r - 70) / 250) / 0.9
console.log(`   声誉 70（中性）→ 平均出租率 ${occRep70}%`)
console.log(`   声誉 90        → 平均出租率 ${occRep90}%（合计 ${((occRep90 - occRep70) / occRep70 * 100).toFixed(1)}%）`)
console.log(`   声誉 40        → 平均出租率 ${occRep40}%（合计 ${((occRep40 - occRep70) / occRep70 * 100).toFixed(1)}%）`)
console.log(`   ├ 直接通道 occFactor（纯乘数）：声誉90 ×${occFactorOf(90).toFixed(3)} / 声誉40 ×${occFactorOf(40).toFixed(3)}`)
console.log(`   └ 间接通道 reputationFactor（阈值式，经好评率）：好评分档 1.2/1.0/0.8/0.5（本打法好评率高，落在 1.2 档）`)
console.log(`   本打法属性轨迹下的声誉终值：${repTraj}（对应 occFactor ×${occFactorOf(repTraj).toFixed(3)}）\n`)

// ── ④ 策略区分度（是否"必输"）──
console.log('━━━ ④ 策略区分度（12周累计利润，改前 vs 改后）━━━')
const res = {}
for (const [name, dec] of Object.entries(STRATEGIES)) {
  const b = run12(settleOld, dec, 'old').totalProfit
  const a1 = run12(settleNew, dec, 'new-evolve').totalProfit
  const a2 = run12(settleNew, dec, 'new-evolve-decay').totalProfit
  res[name] = { b, a1, a2 }
  console.log(`   ${name}：改前 ${String(b).padStart(8)} → 仅决策 ${String(a1).padStart(8)} → 含衰减 ${String(a2).padStart(8)}`)
}
console.log(`   勤奋−省钱 差距：改前 ${res.勤奋型.b - res.省钱型.b} → 仅决策 ${res.勤奋型.a1 - res.省钱型.a1} → 含衰减 ${res.勤奋型.a2 - res.省钱型.a2}`)
console.log(`   省钱型是否亏损：改前 ${res.省钱型.b < 0 ? '亏' : '赚'}${res.省钱型.b} → 仅决策 ${res.省钱型.a1 < 0 ? '亏' : '赚'}${res.省钱型.a1} → 含衰减 ${res.省钱型.a2 < 0 ? '亏' : '赚'}${res.省钱型.a2}`)
