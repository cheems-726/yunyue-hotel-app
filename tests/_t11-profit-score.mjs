// T1.1 步骤4 · profitScore 重标定（判据：6 组评级分布一致）
// 原理：四维加权分里只有 profitScore 受 ×7 影响 ⇒ 只要"各组落进同一档"，
//       最终加权分与评级必然逐个不变（比"分布一致"更强）。
// 运行：node tests/_t11-profit-score.mjs
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
  { key: '1勤奋型', decisions: () => DILIGENT, resolve: () => 0.9 },
  { key: '2省钱型', decisions: () => THRIFTY, resolve: () => 0.2 },
  { key: '3中间型', decisions: () => MID, resolve: () => 0.5 },
  { key: '4躺平型', decisions: (w) => lazyWeek(w), resolve: () => 0 },
  { key: '5激进型', decisions: () => AGGRESSIVE, resolve: () => 0.1 },
  { key: '6逆袭型', decisions: (w) => (w <= 6 ? THRIFTY : DILIGENT), resolve: (w) => (w <= 6 ? 0.2 : 0.9) },
]

function season(engine, g) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  let totalProfit = 0, totalRev = 0
  for (let w = 1; w <= WEEKS; w++) {
    const decisions = g.decisions(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = engine({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    totalProfit += r.profit; totalRev += r.revenue
    pg = r.finalGoodRate; cap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * g.resolve(w)); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return { totalProfit, totalRev }
}

const OLD = [50000, 30000, 10000, 0]
const bucket = (p, t) => (p >= t[0] ? 100 : p >= t[1] ? 85 : p >= t[2] ? 70 : p >= t[3] ? 55 : 40)

const rows = GROUPS.map(g => {
  const o = season(settleOld, g), n = season(settleNew, g)
  return { key: g.key, pO: o.totalProfit, pN: n.totalProfit, bO: bucket(o.totalProfit, OLD), revN: n.totalRev }
})

console.log('════════ T1.1 步骤4 · profitScore 重标定（6 组 × 12 周赛季总利润）════════\n')
console.log('组别      | 改前总利润(一晚口径) | 档位 | 改后总利润(周口径)  | 倍数   | 旧分段下会变成')
for (const r of rows) {
  const naive = bucket(r.pN, OLD)
  console.log(`${r.key} | ${String(r.pO).padStart(14)} | ${String(r.bO).padStart(4)} | ${String(r.pN).padStart(14)} | ${(r.pN / r.pO).toFixed(2).padStart(6)} | ${naive}${naive === r.bO ? '（同）' : ' ❌ 变了'}`)
}

const P = rows.filter(r => r.pN > 0).map(r => r.pN / r.pO)
const N = rows.filter(r => r.pN < 0)
console.log(`\n正利润组倍数：${P.map(v => v.toFixed(3)).join(' / ')}（均值 ${(P.reduce((a, b) => a + b, 0) / P.length).toFixed(3)}）`)
console.log(`负利润组：${N.length ? N.map(r => r.key).join('、') + '（改前改后皆 <0 → 档位恒 40，不受分段影响）' : '无'}`)

// 反推新分段：让每组落回同一档
const cands = [
  { name: '×7（50万/30万/10万/0 → ×7）', t: [350000, 210000, 70000, 0] },
  { name: '取整（35万/21万/7万/0）', t: [350000, 210000, 70000, 0] },
]
console.log('\n【候选新分段实测】')
for (const c of cands) {
  const bad = rows.filter(r => bucket(r.pN, c.t) !== r.bO)
  console.log(`  ${c.name}：${c.t.join(' / ')} → ${bad.length === 0 ? '✅ 6 组档位与改前全同（评级逐个不变）' : '❌ ' + bad.map(r => r.key).join('、') + ' 档位不符'}`)
}
// 边界鲁棒性：每档留的余量（新值距阈值多远）
console.log('\n【各档边界余量】（新值 / 阈值，>1 即在上方；越接近 1 越脆）')
const T = [350000, 210000, 70000, 0]
for (const r of rows) {
  const which = r.pN >= T[0] ? 0 : r.pN >= T[1] ? 1 : r.pN >= T[2] ? 2 : r.pN >= T[3] ? 3 : -1
  const rel = which >= 0 && T[which] > 0 ? (r.pN / T[which]).toFixed(2) : '—'
  console.log(`  ${r.key}：利润 ${String(r.pN).padStart(8)} · 落入第 ${which + 1} 档（阈值 ${T[which] === undefined ? '—' : T[which]}）· 余量 ${rel}`)
}
