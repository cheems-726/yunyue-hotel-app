// W2-1 权威数字（供报告引用；单配置 vs 六组赛季均值【分开列】）
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
const one = settle({ site: SITE, brand: BRAND, decisions: D, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
console.log('── 单配置（中档全季 80 间 / 勤奋型 / 第 1 周 / 固定输入，确定性可复算）──')
console.log(`  revenue ${one.revenue} · totalCost ${one.totalCost} · profit ${one.profit} · deptCost ${one.deptCost}`)
console.log(`  gop ${one.gop} (${(one.gopRate*100).toFixed(1)}%) · netProfit ${one.netProfit} (${(one.netProfitRate*100).toFixed(1)}%) · ΣweeklyExpenses ${Object.values(one.weeklyExpenses).reduce((a,b)=>a+b,0)}`)
const oneVar = one.totalCost - one.rentCost - one.deptCost - one.weeklyExpenses.营销推广 - one.weeklyExpenses.OTA佣金 - one.weeklyExpenses.超售赔偿 - one.weeklyExpenses.改造投资 - one.weeklyExpenses.事件罚款
console.log(`  【完整部门成本】/营收 ${((one.deptCost + oneVar)/one.revenue*100).toFixed(1)}%（固定 ${(one.deptCost/one.revenue*100).toFixed(1)}% + 变动 ${(oneVar/one.revenue*100).toFixed(1)}%）`)
let tot = { dept: 0, rev: 0, cost: 0, profit: 0, gop: 0, rent: 0 }
console.log('\n── 六组 × 12 周赛季（加权平均）──')
for (const [n, f] of Object.entries(G)) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const a = { dept: 0, rev: 0, cost: 0, profit: 0, gop: 0 }
  for (let w = 1; w <= 12; w++) {
    const d = f(w)
    let x = attrs
    for (const [k, v] of Object.entries(d)) x = applyDecisionToAttrs(x, k, v)
    const r = settle({ site: SITE, brand: BRAND, decisions: d, week: w, attrs: x, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    const varC = r.totalCost - r.rentCost - r.deptCost - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金 - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款
    a.dept += r.deptCost + varC; a.rev += r.revenue; a.cost += r.totalCost; a.profit += r.profit; a.gop += r.gop
    pg = r.finalGoodRate; cap = r.capital
    const neg = r.generatedReviews.filter(y => Number(y.stars) <= 3).length
    rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  tot.dept += a.dept; tot.rev += a.rev; tot.cost += a.cost; tot.profit += a.profit; tot.gop += a.gop
  console.log(`  ${n}：部门成本/营收 ${(a.dept/a.rev*100).toFixed(1)}% · 净利率 ${(a.profit/a.rev*100).toFixed(1)}% · 期末资金 ${cap}`)
}
console.log(`  ★ 六组加权：部门成本/营收 ${(tot.dept/tot.rev*100).toFixed(1)}% · GOP 率 ${(tot.gop/tot.rev*100).toFixed(1)}% · 净利率 ${(tot.profit/tot.rev*100).toFixed(1)}%`)
console.log(`  ★ 总成本/营收（含租金）${(tot.cost/tot.rev*100).toFixed(1)}%`)
