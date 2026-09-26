// 逐字段漂移定位：×7 之后哪些字段变了、从第几周起
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-rev.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const STRATEGIES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
}
const FIELDS = ['occupancy', 'occupiedRooms', 'finalGoodRate', 'goodRate', 'negativeCount', 'reviewCount', 'revenue', 'totalCost', 'profit', 'capital']
for (const [name, dec] of Object.entries(STRATEGIES)) {
  let attrs = { ...ATTR_INIT }, pgO = null, pgN = null, cO = null, cN = null
  const diverge = {}
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const o = settleOld({ site: SITE, brand: BRAND, decisions: dec, week: w, prevGoodRate: pgO, prevCapital: cO, attrs: a })
    const n = settleNew({ site: SITE, brand: BRAND, decisions: dec, week: w, prevGoodRate: pgN, prevCapital: cN, attrs: a })
    for (const f of FIELDS) if (o[f] !== n[f] && !diverge[f]) diverge[f] = { w, o: o[f], n: n[f] }
    // ×7 算式检查（用新引擎字段 + 旧引擎字段）
    const revOK = n.revenue === 7 * o.revenue
    if (!revOK) console.log(`  ⚠ w${w} revenue 非 7×: ${o.revenue}→${n.revenue}`)
    pgO = o.finalGoodRate; pgN = n.finalGoodRate; cO = o.capital; cN = n.capital
    attrs = applyWeeklyDecay(a, BRAND.level)
  }
  console.log(`━━━ ${name} ━━━ 首次漂移周：`)
  for (const f of FIELDS) console.log(`   ${f.padEnd(14)} ${diverge[f] ? `w${diverge[f].w}  ${diverge[f].o} → ${diverge[f].n}` : '✅ 12 周全程一致'}`)
}
