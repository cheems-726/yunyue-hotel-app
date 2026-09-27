// W2-1 费率【正确】标定：目标 = 【完整部门成本】/营收 ∈ 42–48%
//   完整部门成本 = variableCost（随入住量）+ deptCost（固定，按可售房）
//   由 GOP 恒等式反推：部门成本/营收 = 1 − GOP率 − (营销+OTA)/营收
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const T = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 }
const M = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AG = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LP = [['pricing','跟降 10%'],['shifts','精简省成本'],['hygiene','不停房'],['linen','外包'],['energy',20],['overbook',2],['reputation','模板回复'],['campaign','大促营销'],['ota','全渠道上架'],['member-convert','强调优惠'],['hr-optimize','裁员1人']]
const lazy = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [k, v] = LP[(w * 3 + i) % LP.length]; o[k] = v } return o }
const G = { '1勤奋型': () => D, '2省钱型': () => T, '3中间型': () => M, '4躺平型': (w) => lazy(w), '5激进型': () => AG, '6逆袭型': (w) => (w <= 6 ? T : D) }
function run(k) {
  let tot = { full: 0, rev: 0, profit: 0, dept: 0, varCost: 0 }
  const per = []
  for (const [n, f] of Object.entries(G)) {
    let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
    let a = { full: 0, rev: 0, profit: 0 }
    for (let w = 1; w <= 12; w++) {
      const d = f(w)
      let x = attrs
      for (const [kk, v] of Object.entries(d)) x = applyDecisionToAttrs(x, kk, v)
      const r = settle({ site: SITE, brand: BRAND, decisions: d, week: w, attrs: x, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
      const varC = r.totalCost - r.rentCost - r.deptCost - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金 - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款
      a.full += r.deptCost + varC; a.rev += r.revenue; a.profit += r.profit
      tot.full += r.deptCost + varC; tot.rev += r.revenue; tot.profit += r.profit; tot.dept += r.deptCost; tot.varCost += varC
      pg = r.finalGoodRate; cap = r.capital
      const neg = r.generatedReviews.filter(y => Number(y.stars) <= 3).length
      rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
      attrs = normalizeAttrs(r.attrsAfter)
    }
    per.push([n, a.full / a.rev, a.profit / a.rev])
  }
  return { per, fullRatio: tot.full / tot.rev, netRatio: tot.profit / tot.rev, fixedRatio: tot.dept / tot.rev, varRatio: tot.varCost / tot.rev }
}
for (const k of [1, 0.75, 0.6, 0.5, 0.4, 0.3]) {
  const r = run(k)
  console.log(`k=${k.toFixed(2)}（Σ=${(71.5 * k).toFixed(1)} 元/间/天）完整部门成本/营收 ${(r.fullRatio * 100).toFixed(1)}%（固定 ${(r.fixedRatio * 100).toFixed(1)}% + 变动 ${(r.varRatio * 100).toFixed(1)}%）· 净利率 ${(r.netRatio * 100).toFixed(1)}%`)
  console.log(`    逐组：${r.per.map(([n, f, p]) => `${n} ${(f * 100).toFixed(0)}%/${(p * 100).toFixed(0)}%`).join(' · ')}`)
}
