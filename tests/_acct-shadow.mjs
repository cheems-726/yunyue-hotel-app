// 账务闭环 · 影响面影子模拟（**分析用脚本，不改任何源码**）
//
// 回答四件事：
//   V0 现状：不传 prevCapital / 不传 bizMode（App 当前行为）
//   V1 修 B5：传 prevCapital（累积）+ bizMode='direct'  → 除"资金"外一切应不变
//   V2 修 B5 + OTA 组传 bizMode='ota'                  → 量化 OTA 差异（引擎 202-206 行 ×1.2 + 15% 佣金）
//   V3 账务闭环：结算改为"对账校准"                       → 证明期末资金与 V1 逐周严格相等
// 运行：node tests/_acct-shadow.mjs
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
  { key: '1勤奋型', dec: () => DILIGENT, biz: 'direct' },
  { key: '2省钱型', dec: () => THRIFTY, biz: 'direct' },
  { key: '3中间型', dec: () => MID, biz: 'direct' },
  { key: '4躺平型', dec: (w) => lazyWeek(w), biz: 'direct' },
  { key: '5激进型', dec: () => AGGRESSIVE, biz: 'ota' },      // 假设这组选了 OTA 模式（用于量化 V2）
  { key: '6逆袭型', dec: (w) => (w <= 6 ? THRIFTY : DILIGENT), biz: 'ota' },
]

// 模拟"实时层本周净额"（用于 V3）：退房结账收入 ≈ 每周营收的一部分 − 清扫/杂项支出
// 关键：这个数【随意取值】都不影响结论 —— 对账公式只把它当作"已经记过的部分"
function liveDelta(res, week, f = 0.31) {
  const rev = res.revenue
  return Math.round(rev * f - res.totalCost * 0.18)
}

function run(dec, biz, mode) {
  // mode: 'v0' 现状 / 'v1' 修B5 / 'v3' 闭环
  let attrs = { ...ATTR_INIT }
  let prevGoodRate = null
  let prevCapital = null          // v0 永远为 null（现状）
  let capitalV1 = 500000, capitalV3 = 500000
  let pendingNeg = 0, resolved = 0
  const rows = []
  for (let w = 1; w <= 12; w++) {
    const decisions = dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const args = { site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate, pendingNegatives: pendingNeg, resolvedCount: resolved }
    const r0 = settle({ ...args })                                      // v0：不传 prevCapital、不传 bizMode
    const r1 = mode === 'v0' ? r0 : settle({ ...args, prevCapital: capitalV1 })        // V1：只加 prevCapital（累积）
    const r2 = mode === 'v0' ? r0 : settle({ ...args, prevCapital: capitalV1, bizMode: biz })  // V2：再加 bizMode
    // v3：结算只写"调整额" = 应有净利 − 本周实时已记净额；实时层自己已把 D 入账
    const D = liveDelta(r1, w)
    const adjustment = r1.profit - D
    capitalV3 = capitalV3 + D + adjustment                              // 先实时入账 D，再结算补调整额
    const r = mode === 'v0' ? r0 : (mode === 'v2' ? r2 : r1)
    rows.push({ w, occupancy: r.occupancy, profit: r.profit, goodRate: r.finalGoodRate, neg: r.negativeCount, occupancy0: r0.occupancy, profit0: r0.profit, goodRate0: r0.finalGoodRate, neg0: r0.negativeCount, capV0: r0.capital, capV1: r1.capital, capV3: capitalV3, D, adj: adjustment, isBankrupt: r.isBankrupt, events: (r.events || []).map(e => e.name) })
    prevGoodRate = r.finalGoodRate
    capitalV1 = r1.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    resolved = Math.ceil(negCards * 0.5)
    pendingNeg = Math.max(0, pendingNeg + negCards - resolved)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return rows
}

console.log('▶ 账务闭环 · 影响面影子模拟（6 组 × 12 周）\n')
const out = {}
for (const g of GROUPS) out[g.key] = { v0: run(g.dec, g.biz, 'v0'), v1: run(g.dec, 'direct', 'v1'), v2: run(g.dec, g.biz, 'v2'), v3: run(g.dec, g.biz, 'v3') }

console.log('【表 1】V0 现状 vs V1 修 B5：非资金指标必须逐周一致（资金除外）')
console.log('   组别   | 出租率差异周数 | 利润差异周数 | 好评率差异周数 | 差评差异周数 | 期末资金 V0(每周重置) | 期末资金 V1(累积) | 破产事件')
for (const g of GROUPS) {
  const { v0, v1 } = out[g.key]
  const d = (f) => v0.filter((r, i) => r[f] !== v1[i][f]).length
  const bank = v1.filter(r => r.isBankrupt).length
  console.log(`   ${g.key} | ${String(d('occupancy')).padStart(6)} | ${String(d('profit')).padStart(6)} | ${String(d('goodRate')).padStart(7)} | ${String(d('neg')).padStart(6)} | ${String(v0[11].capV0).padStart(9)} | ${String(v1[11].capV1).padStart(9)} | ${bank}`)
}

console.log('\n【表 2】V3 账务闭环 vs V1 直接累积：期末资金必须严格相等（对账不双算）')
let allEqual = true
for (const g of GROUPS) {
  const { v1, v3 } = out[g.key]
  const same = v1.every((r, i) => r.capV1 === v3[i].capV3)
  if (!same) allEqual = false
  const Ds = v3.map(r => r.D), adjs = v3.map(r => r.adj)
  console.log(`   ${g.key} | V1 期末 ${v1[11].capV1} | V3 期末 ${v3[11].capV3} | ${same ? '✅ 逐周相等' : '❌ 不等'} | 本周实时净额示例 D=${Ds[0]} → 调整额 ${adjs[0]}`)
}
console.log(`   → ${allEqual ? '✅ 恒等式成立：Σ(D + (利润 − D)) = Σ利润（与 V1 完全一致）' : '❌ 有组不相等，需排查'}`)

console.log('\n【表 3】OTA 模式的影响（V1 传 bizMode="ota" vs 现状默认 direct）—— 只影响被传 ota 的组')
for (const g of GROUPS.filter(x => x.biz === 'ota')) {
  const { v0, v2: v1 } = out[g.key]
  const occ0 = Math.round(v0.reduce((a, r) => a + r.occupancy, 0) / 12), occ1 = Math.round(v1.reduce((a, r) => a + r.occupancy, 0) / 12)
  const p0 = v0.reduce((a, r) => a + r.profit, 0), p1 = v1.reduce((a, r) => a + r.profit, 0)
  console.log(`   ${g.key} | 平均出租 ${occ0}% → ${occ1}%（${occ1 - occ0 >= 0 ? '+' : ''}${occ1 - occ0}pt）| 累计利润 ${p0} → ${p1}（${p1 - p0 >= 0 ? '+' : ''}${p1 - p0}）`)
}

console.log('\n【表 4】资金口径对照（第 12 周，省钱型为例）')
{
  const { v0, v1, v3 } = out['2省钱型']
  console.log(`   周 | V0 现状(每周重置) | V1 累积 | V3 闭环 | 实时净额D | 结算调整额`)
  for (let i = 0; i < 12; i++) console.log(`   ${String(i + 1).padStart(2)} | ${String(v0[i].capV0).padStart(9)} | ${String(v1[i].capV1).padStart(8)} | ${String(v3[i].capV3).padStart(8)} | ${String(v3[i].D).padStart(8)} | ${String(v3[i].adj).padStart(9)}`)
}
