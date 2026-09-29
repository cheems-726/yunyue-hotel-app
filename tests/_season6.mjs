// W2 口径共用模块：六组 × 12 周赛季聚合（★ 同一份场景，供多处引用）
//   · tests/_w2-numbers.mjs     —— 打印权威数字（报告引用）
//   · tests/dataDict.check.mjs  —— W2-4 华住现金流率对拍断言
//   · tests/metrics-w2-3.test.mjs —— W2-3 界面口径的数值断言（净利润/GOP 恒等式）
// 存在意义：口径场景【只定义一次】。若各处各写一份六组配置，将来改场景必然漏改某处（漂移）。
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

export const SEASON_SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
export const SEASON_BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }

const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const T = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 }
const M = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AG = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LP = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazy = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [k, v] = LP[(w * 3 + i) % LP.length]; o[k] = v } return o }

// 六种经营风格（1勤奋 · 2省钱 · 3中间 · 4躺平 · 5激进 · 6逆袭）
export const SEASON_GROUPS = {
  '1勤奋型': () => D,
  '2省钱型': () => T,
  '3中间型': () => M,
  '4躺平型': (w) => lazy(w),
  '5激进型': () => AG,
  '6逆袭型': (w) => (w <= 6 ? T : D),
}

// 可变成本 = 总成本 −（租金 + 部门固定成本 + 各非经常项）——与 deptCosts 去重纪律一致
// 可变成本 = 总成本 −（租金 + 部门固定成本 + 各非经常项 + 加盟两费）——与 deptCosts 去重纪律一致
// 🔴 §14.3 修正：加盟两费【必须】在此剔除 —— 否则它会被算进"可变成本/部门成本"⇒
//   六组赛季的部门成本率被污染（实测 42–48% 带 → 52.45%），W2-4 华住对拍跟着失真。
// 🔴 §22.2-B2 修正（2026-09-29）：开业一次性费用/保证金退还【同样必须剔除】——
//   它们是筹建期一次性/资产回冲项，混进"可变成本"会把部门成本率从 45% 污染到 68.6%（实测）。
export const variableOf = (r) => r.totalCost - r.rentCost - r.deptCost
  - (r.franchiseFees ? r.franchiseFees.合计 : 0)
  - (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
  - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金
  - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款

// 跑一个赛季（默认 6 组 × 12 周）。weeks 可选 1..N，用于单周场景。
export function runSeason6({ weeks = 12, brand = SEASON_BRAND, site = SEASON_SITE, groups = SEASON_GROUPS } = {}) {
  const total = { rev: 0, dept: 0, rent: 0, cost: 0, profit: 0, gop: 0, weeks: 0 }
  const perGroup = []
  for (const [name, pick] of Object.entries(groups)) {
    let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
    const a = { name, rev: 0, dept: 0, rent: 0, cost: 0, profit: 0, gop: 0, weeks: 0, weeksList: [], capitalEnd: null }
    for (let w = 1; w <= weeks; w++) {
      const d = pick(w)
      let x = attrs
      for (const [k, v] of Object.entries(d)) x = applyDecisionToAttrs(x, k, v)
      const r = settle({ site, brand, decisions: d, week: w, attrs: x, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
      a.rev += r.revenue; a.dept += r.deptCost + variableOf(r); a.rent += r.rentCost
      a.cost += r.totalCost; a.profit += r.netProfit; a.gop += r.gop; a.weeks++
      a.weeksList.push(r)
      pg = r.finalGoodRate; cap = r.capital
      const neg = r.generatedReviews.filter(y => Number(y.stars) <= 3).length
      rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
      attrs = normalizeAttrs(r.attrsAfter)
    }
    a.capitalEnd = cap
    a.deptRate = a.dept / a.rev; a.rentRate = a.rent / a.rev; a.gopRate = a.gop / a.rev
    a.netRate = a.profit / a.rev; a.costRate = a.cost / a.rev
    perGroup.push(a)
    for (const k of ['rev', 'dept', 'rent', 'cost', 'profit', 'gop', 'weeks']) total[k] += a[k]
  }
  const weighted = {
    rev: total.rev, dept: total.dept, rent: total.rent, cost: total.cost,
    profit: total.profit, gop: total.gop, weeks: total.weeks,
    deptRate: total.dept / total.rev, rentRate: total.rent / total.rev,
    gopRate: total.gop / total.rev, netRate: total.profit / total.rev, costRate: total.cost / total.rev,
  }
  return { perGroup, weighted, weeks }
}
