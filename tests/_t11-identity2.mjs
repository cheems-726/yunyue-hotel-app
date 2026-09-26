// 通用算式验证：profit_new − 7·profit_old === 6 · otherOld
//   otherOld = 未被 ×7 的科目（营销/OTA佣金/超售赔偿/改造/事件罚款），取自旧引擎同轮结果
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-rev.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const CASES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
  带营销: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', campaign: '大促营销', reputation: '道歉+赔偿' },
  带改造: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', renovation: '投150万改造' },
  带诊断: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'report-diagnosis': '解决成本相关' },
}
const OTHER = ['营销推广', 'OTA佣金', '超售赔偿', '事件罚款']
let bad = 0
for (const [name, dec] of Object.entries(CASES)) {
  let attrs = { ...ATTR_INIT }, pgO = null, pgN = null, cO = null, cN = null
  const miss = []
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const o = settleOld({ site: SITE, brand: BRAND, decisions: dec, week: w, prevGoodRate: pgO, prevCapital: cO, attrs: a })
    const n = settleNew({ site: SITE, brand: BRAND, decisions: dec, week: w, prevGoodRate: pgN, prevCapital: cN, attrs: a })
    const otherOld = OTHER.reduce((s, k) => s + (o.weeklyExpenses?.[k] || 0), 0)
    const lhs = n.profit - 7 * o.profit, rhs = 6 * otherOld
    if (lhs !== rhs) miss.push(`w${w}: LHS=${lhs} RHS=${rhs} (差 ${lhs - rhs})`)
    if (n.revenue !== 7 * o.revenue) miss.push(`w${w}: revenue ${o.revenue}×7=${o.revenue * 7} ≠ ${n.revenue}`)
    pgO = o.finalGoodRate; pgN = n.finalGoodRate; cO = o.capital; cN = n.capital
    attrs = applyWeeklyDecay(a, BRAND.level)
  }
  if (miss.length) { bad++; console.log(`✗ ${name}: ${miss.slice(0, 4).join(' | ')}${miss.length > 4 ? ` …共 ${miss.length}` : ''}`) }
  else console.log(`✓ ${name}: 12 周全过（revenue=7× 且 profit−7·profitOld=6·otherOld）`)
}
console.log(bad ? `\n========== 有 ${bad} 组不成立 ==========` : '\n========== 6 组算式全部成立 ==========')
