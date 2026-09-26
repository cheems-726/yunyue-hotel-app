// A4 影响面：6 组期末分「改前（条数口径） vs 改后（真处理率口径）」对比表
// 用 rehearsal.mjs 同款策略与 resolveRate 假设（勤奋0.9/省钱0.2/中间0.5/躺平0/激进0.1/逆袭 前0.2后0.9）
// 运行：node tests/_a4-impact.mjs（分析脚本，不改口径）
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

const oldNeg = (totalNeg) => totalNeg === 0 ? 100 : totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50
const newNeg = (rate) => rate >= 0.9 ? 95 : rate >= 0.7 ? 85 : rate >= 0.5 ? 70 : rate >= 0.3 ? 55 : 40
const tier = (v, rows) => v >= 90 ? 95 : v >= 85 ? 85 : v >= 75 ? 70 : v >= 60 ? 55 : 40
const occTier = (v) => v >= 75 ? 95 : v >= 65 ? 80 : v >= 55 ? 65 : v >= 45 ? 50 : 40

function run(dec, resolveOf) {
  let attrs = { ...ATTR_INIT }, prevGood = null, prevCap = null, pending = 0, resolved = 0
  const history = []
  for (let w = 1; w <= 12; w++) {
    const decisions = dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: prevGood, prevCapital: prevCap, pendingNegatives: pending, resolvedCount: resolved })
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    const res = Math.ceil(negCards * resolveOf(w))
    const pend = Math.max(0, pending + negCards - res)
    // 周快照（A4）：只数结算卡 ⇒ 与 App 语义一致
    history.push({ occupancy: r.occupancy, finalGoodRate: r.finalGoodRate, negativeCount: r.negativeCount, profit: r.profit, handleStats: { pending: pend, resolved: res } })
    pending = pend; resolved = res
    prevGood = r.finalGoodRate; prevCap = r.capital
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return history
}
function scores(history) {
  const totalProfit = history.reduce((s, h) => s + h.profit, 0)
  const avgOcc = Math.round(history.reduce((s, h) => s + h.occupancy, 0) / history.length)
  const avgGood = Math.round(history.reduce((s, h) => s + h.finalGoodRate, 0) / history.length)
  const totalNeg = history.reduce((s, h) => s + h.negativeCount, 0)
  const hw = history.filter(h => h.handleStats && (h.handleStats.pending + h.handleStats.resolved) > 0)
  const rate = hw.length ? hw.reduce((s, h) => s + h.handleStats.resolved / (h.handleStats.pending + h.handleStats.resolved), 0) / hw.length : null
  const profitScore = totalProfit >= 50000 ? 100 : totalProfit >= 30000 ? 85 : totalProfit >= 10000 ? 70 : totalProfit >= 0 ? 55 : 40
  const repScore = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
  const occScore = occTier(avgOcc)
  const negOld = oldNeg(totalNeg)
  const negNew = totalNeg === 0 ? 100 : (rate != null ? newNeg(rate) : negOld)
  const total = (neg) => Math.round(profitScore * 0.4 + repScore * 0.25 + occScore * 0.2 + neg * 0.15)
  return { totalProfit, avgOcc, avgGood, totalNeg, rate, profitScore, repScore, occScore, negOld, negNew, oldTotal: total(negOld), newTotal: total(negNew) }
}

console.log('A4 影响面：6 组期末分 改前(条数口径) vs 改后(真处理率口径)\n')
console.log('   组别   | 平均处理率 | 15%分 改前→改后 | 期末总分 改前→改后 | Δ')
for (const g of GROUPS) {
  const s = scores(run(g.dec, g.resolve))
  const d = s.newTotal - s.oldTotal
  console.log(`   ${g.key} | ${s.rate == null ? '—(零差评)' : (Math.round(s.rate * 100) + '%').padEnd(6)} | ${String(s.negOld).padStart(3)} → ${String(s.negNew).padStart(3)} | ${String(s.oldTotal).padStart(3)} → ${String(s.newTotal).padStart(3)} | ${d >= 0 ? '+' : ''}${d}`)
}
console.log('\n（利润/口碑/出租率三维输入不变：profitScore/repScore/occScore 仅由 profit/finalGoodRate/occupancy 推得，A4 未触碰）')
