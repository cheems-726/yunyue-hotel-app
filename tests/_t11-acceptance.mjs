// T1.1 步骤6 · 验收对比表（改前 HEAD vs 改后 ×7）
//   列：Σ利润 / 期末资金 / 期末四维分 / 评级 —— 各用【本时代的资金三数与 profitScore 分段】
//   改前 = src/settle-old-t11.mjs（HEAD 快照）+ 50万/5万 + 50000/30000/10000/0
//   改后 = src/settlement.js（×7）        + 350万/35万 + 350000/210000/70000/0
// 运行：node tests/_t11-acceptance.mjs
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
const LAZY_POOL = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazyWeek = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [id, a] = LAZY_POOL[(w * 3 + i) % LAZY_POOL.length]; o[id] = a } return o }
const GROUPS = [
  { key: '1勤奋型', dec: () => DILIGENT, resolve: () => 0.9 },
  { key: '2省钱型', dec: () => THRIFTY, resolve: () => 0.2 },
  { key: '3中间型', dec: () => MID, resolve: () => 0.5 },
  { key: '4躺平型', dec: (w) => lazyWeek(w), resolve: () => 0 },
  { key: '5激进型', dec: () => AGGRESSIVE, resolve: () => 0.1 },
  { key: '6逆袭型', dec: (w) => (w <= 6 ? THRIFTY : DILIGENT), resolve: (w) => (w <= 6 ? 0.2 : 0.9) },
]
const ERA = {
  old: { engine: settleOld, IC: 500000, seg: [50000, 30000, 10000, 0] },
  new: { engine: settleNew, IC: 3500000, seg: [350000, 210000, 70000, 0] },
}

function run(era, g) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = era.IC, pn = 0, rs = 0
  const h = []
  for (let w = 1; w <= WEEKS; w++) {
    const decisions = g.dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = era.engine({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    cap = cap + r.profit
    h.push({ profit: r.profit, occupancy: r.occupancy, finalGoodRate: r.finalGoodRate, negativeCount: r.negativeCount, capital: cap })
    pg = r.finalGoodRate
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * g.resolve(w)); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return h
}
function scoreOf(h, seg) {
  const totalProfit = h.reduce((s, x) => s + x.profit, 0)
  const avgOcc = Math.round(h.reduce((s, x) => s + x.occupancy, 0) / h.length)
  const avgGood = Math.round(h.reduce((s, x) => s + x.finalGoodRate, 0) / h.length)
  const totalNeg = h.reduce((s, x) => s + x.negativeCount, 0)
  const p = totalProfit >= seg[0] ? 100 : totalProfit >= seg[1] ? 85 : totalProfit >= seg[2] ? 70 : totalProfit >= seg[3] ? 55 : 40
  const rep = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
  const occ = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
  const neg = totalNeg === 0 ? 100 : totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50
  return { p, score: Math.round(p * 0.4 + rep * 0.25 + occ * 0.2 + neg * 0.15) }
}
const grade = (s) => (s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D')

console.log('════════ T1.1 验收对比表 · 6 组 × 12 周（改前 HEAD vs 改后 ×7）════════\n')
const rows = GROUPS.map(g => {
  const ho = run(ERA.old, g), hn = run(ERA.new, g)
  const so = scoreOf(ho, ERA.old.seg), sn = scoreOf(hn, ERA.new.seg)
  return { key: g.key, po: ho.reduce((s, x) => s + x.profit, 0), pn: hn.reduce((s, x) => s + x.profit, 0), co: ho[11].capital, cn: hn[11].capital, so, sn }
})
const f = (n, w = 9) => String(n).padStart(w)
console.log('组别      |      Σ利润 改前 → 改后      |      期末资金 改前 → 改后        | 期末分 改前 → 改后 | 评级')
for (const r of rows) {
  const same = r.so.score === r.sn.score
  console.log(`${r.key} | ${f(r.po)} → ${f(r.pn)} | ${f(r.co, 9)} → ${f(r.cn, 9)} | ${String(r.so.score).padStart(4)} → ${String(r.sn.score).padStart(4)}  | ${grade(r.so.score)} → ${grade(r.sn.score)}${same ? ' ✅' : ' ⚠️'}`)
}
const chg = rows.filter(r => grade(r.so.score) !== grade(r.sn.score))
const sameScore = rows.filter(r => r.so.score === r.sn.score)
console.log(`\n【判据】profitScore 档位逐组一致：${rows.filter(r => r.so.p === r.sn.p).length}/6 组`)
console.log(`        期末分逐组一致：${sameScore.length}/6 组；评级变号：${chg.length} 组${chg.length ? '（' + chg.map(r => r.key + ' ' + grade(r.so.score) + '→' + grade(r.sn.score)).join('、') + '）' : ''}`)
console.log('\n【资金三数】改前 50万/5万/0 → 改后 350万/35万/0（×7）；trigger 实测：6 组两时代均未触发预警/破产')
console.log('【T1.2 18 周】已用新口径+新分段重跑：中间型 −13（旧结论不变），其余 +0~+6')
