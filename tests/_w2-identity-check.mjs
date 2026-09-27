// W2 重基线前置：验证【差额恒等式】在 W2 之后仍然成立
//   profit_new = 7×profit_old + 6×other_old − deptCost_new
//   （old = 旧引擎：pre-T1.1；other = 未被 ×7 的科目 营销/OTA/超售/罚款/改造）
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
const OTHER = ['营销推广', 'OTA佣金', '超售赔偿', '事件罚款']
let bad = 0, cases = 0
for (const [name, dec] of Object.entries(STRATEGIES)) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null
  const miss = []
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const o = settleOld({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap })
    const n = settleNew({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap })
    const otherOld = OTHER.reduce((s, k) => s + (o.weeklyExpenses?.[k] || 0), 0) + (dec.renovation === '投150万改造' ? 2000 : 0)
    cases++
    const revOK = n.revenue === 7 * o.revenue
    const profitOK = n.profit === 7 * o.profit + 6 * otherOld - n.deptCost
    if (!revOK || !profitOK) miss.push(`w${w}: rev ${o.revenue}→${n.revenue}${revOK ? '' : ' ✗'} | profit ${o.profit}→${n.profit} 期望 ${7 * o.profit + 6 * otherOld - n.deptCost}${profitOK ? '' : ' ✗'} | dept ${n.deptCost}`)
    pg = o.finalGoodRate; cap = o.capital
    attrs = applyWeeklyDecay(a, BRAND.level)
  }
  if (miss.length) { bad++; console.log(`✗ ${name}：${miss.length}/12 周不符`); miss.slice(0, 3).forEach(m => console.log('    ' + m)) }
  else console.log(`✅ ${name}：12 周全部成立（revenue=7×旧 且 profit = 7×profit_old + 6×other_old − deptCost_new）`)
}
// 结构不变量必须【逐字节不变】（这是真不变量，红了就是 A 类红旗）
import { settle as settlePreW2 } from '../src/settle-old-w2.mjs'
let structBad = 0
for (const [name, dec] of Object.entries(STRATEGIES)) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const o = settlePreW2({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap })
    const n = settleNew({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap })
    const same = ['occupancy', 'occupiedRooms', 'goodRate', 'finalGoodRate', 'reviewCount', 'negativeCount', 'revenue', 'rentCost', 'price', 'rooms'].filter(k => o[k] !== n[k])
    if (same.length) { structBad++; console.log(`  ✗ 结构不变量漂移 ${name} w${w}：${same.join(',')}`) }
    pg = o.finalGoodRate; cap = o.capital
    attrs = applyWeeklyDecay(a, BRAND.level)
  }
}
console.log(`\n结构不变量（出租率/在店/好评率/评价数/营收/租金/房价/房量，vs W2 前快照）：${structBad === 0 ? '✅ 36 周逐项不变（A 类无红旗）' : '✗ ' + structBad + ' 处漂移 ⇒ 停'}`)
console.log(`\n========== 差额恒等式：${cases - bad * 12}/${cases} 周成立（${bad} 组不符）==========`)
process.exit(bad || structBad ? 1 : 0)
