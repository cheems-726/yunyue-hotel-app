// T1.1 基线脚本：科目时间口径 量级自检 + 6组×12周 对比数据（现状 vs revenue×7）
// 运行：node tests/_t11-baseline.mjs
// 只读分析：不改任何业务代码
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5 }
const THRIFTY = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20, overbook: 0 }
const MID = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AGGRESSIVE = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LAZY_POOL = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazyWeek = (w) => { const out = {}; const n = 3 + (w % 3); for (let i = 0; i < n; i++) { const [id, ans] = LAZY_POOL[(w * 3 + i) % LAZY_POOL.length]; out[id] = ans } return out }
const GROUPS = [
  { key: '1勤奋型', dec: () => DILIGENT, resolve: () => 0.9 },
  { key: '2省钱型', dec: () => THRIFTY, resolve: () => 0.2 },
  { key: '3中间型', dec: () => MID, resolve: () => 0.5 },
  { key: '4躺平型', dec: (w) => lazyWeek(w), resolve: () => 0 },
  { key: '5激进型', dec: () => AGGRESSIVE, resolve: () => 0.1 },
  { key: '6逆袭型', dec: (w) => (w <= 6 ? THRIFTY : DILIGENT), resolve: (w) => (w <= 6 ? 0.2 : 0.9) },
]

function run(dec, resolveOf) {
  let attrs = { ...ATTR_INIT }, prevGood = null, prevCap = null, pending = 0, resolved = 0
  let totalRevenue = 0, totalCost = 0, totalProfit = 0
  for (let w = 1; w <= 12; w++) {
    const decisions = dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: prevGood, prevCapital: prevCap, pendingNegatives: pending, resolvedCount: resolved })
    totalRevenue += r.revenue; totalCost += r.totalCost; totalProfit += r.profit
    prevGood = r.finalGoodRate; prevCap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    resolved = Math.ceil(negCards * resolveOf(w)); pending = Math.max(0, pending + negCards - resolved)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return { totalRevenue, totalCost, totalProfit }
}

console.log('▶ T1.1 量级自检（第 1 周、中档全季 80 间）')
{
  const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5 }
  const r = settle({ site: SITE, brand: BRAND, decisions: DILIGENT, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  console.log(`  revenue=${r.revenue}（一晚口径：51间×340元）`)
  console.log(`  营销 5000 占比：现状 ${(5000 / r.revenue * 100).toFixed(1)}% ｜ 若营收×7：${(5000 / (r.revenue * 7) * 100).toFixed(1)}% ｜ 行业 3-5%`)
  console.log(`  OTA 15% 佣金跟随营收，自动适配任一口径`)
}

console.log('\n▶ 6 组 × 12 周对比（改前=现状 / 改后=改法一 revenue×7 量级）')
console.log('   组别   | Σ营收 改前→改后 | Σ总成本 改前→改后 | Σ利润 改前→改后')
for (const g of GROUPS) {
  const s = run(g.dec, g.resolve)
  // 改法一：营收×7；成本中"一晚"科目（变动成本=occupied×perRoom）×7，"周级"科目（fixed/marketing/改造）保持，OTA佣金跟随×7
  const costAfter = Math.round(s.totalCost + s.totalRevenue * 6 * 0.62)   // 变动成本约占总成本 62% 的估算（教学口径示意，实际以拍板后的分摊为准）
  console.log(`   ${g.key} | ${String(s.totalRevenue).padStart(8)} → ${String(s.totalRevenue * 7).padStart(8)} | ${String(s.totalCost).padStart(7)} → 约${costAfter} | ${String(s.totalProfit).padStart(7)} → 待拍板后精确计算`)
}
console.log('\n⚠️ 上表"改后成本/利润"为量级示意（分摊细则待 W9 拍板后才能精确定）——')
console.log('   能精确的只有：营收 ×7；周级科目（fixed/营销/改造）不变；OTA 佣金跟随 ×7。')
console.log('   因此利润增长率各不相同，期末 profitScore 分段（50000/30000/10000）必须重标定。')
