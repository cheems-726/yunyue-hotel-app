// T1.2 对比表脚本：6 组「12 周 vs 18 周」期末分（复刻 FinalResult 四维 + A4 处理率口径）
// 运行：node tests/_t12-compare.mjs
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

function run(dec, resolveOf, weeks) {
  let attrs = { ...ATTR_INIT }, prevGood = null, prevCap = null, pending = 0, resolved = 0
  const h = []
  for (let w = 1; w <= weeks; w++) {
    const decisions = dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: prevGood, prevCapital: prevCap, pendingNegatives: pending, resolvedCount: resolved })
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    const res = Math.ceil(negCards * resolveOf(w)); const pend = Math.max(0, pending + negCards - res)
    h.push({ occupancy: r.occupancy, finalGoodRate: r.finalGoodRate, negativeCount: r.negativeCount, profit: r.profit, handleStats: { pending: pend, resolved: res }, events: r.events || [] })
    prevGood = r.finalGoodRate; prevCap = r.capital; pending = pend; resolved = res
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return h
}
function score(h) {
  const totalProfit = h.reduce((s, x) => s + x.profit, 0)
  const avgOcc = Math.round(h.reduce((s, x) => s + x.occupancy, 0) / h.length)
  const avgGood = Math.round(h.reduce((s, x) => s + x.finalGoodRate, 0) / h.length)
  const totalNeg = h.reduce((s, x) => s + x.negativeCount, 0)
  const hw = h.filter(x => x.handleStats && (x.handleStats.pending + x.handleStats.resolved) > 0)
  const rate = hw.length ? hw.reduce((s, x) => s + x.handleStats.resolved / (x.handleStats.pending + x.handleStats.resolved), 0) / hw.length : null
  const p = totalProfit >= 50000 ? 100 : totalProfit >= 30000 ? 85 : totalProfit >= 10000 ? 70 : totalProfit >= 0 ? 55 : 40
  const rep = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
  const occ = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
  const neg = totalNeg === 0 ? 100 : rate != null ? (rate >= 0.9 ? 95 : rate >= 0.7 ? 85 : rate >= 0.5 ? 70 : rate >= 0.3 ? 55 : 40) : (totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50)
  return Math.round(p * 0.4 + rep * 0.25 + occ * 0.2 + neg * 0.15)
}

console.log('T1.2 · 6 组「12 周 vs 18 周」期末分对比')
console.log('   组别   | 12 周期末分 | 18 周期末分 | 变化')
for (const g of GROUPS) {
  const s12 = score(run(g.dec, g.resolve, 12))
  const s18 = score(run(g.dec, g.resolve, 18))
  const d = s18 - s12
  console.log(`   ${g.key} | ${String(s12).padStart(4)} | ${String(s18).padStart(4)} | ${d >= 0 ? '+' : ''}${d}`)
}
