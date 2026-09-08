// 结算引擎回归测试：node tests/settlement.test.mjs
// 夜间自动化改引擎后必跑，任何断言失败 => 阻止推送
import { settle, EVENT_CONFIG } from '../src/settlement.js'

let pass = 0, fail = 0
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.error('  ✗ FAIL:', name) }
}

console.log('[0] 事件配置合法性')
ok(Object.entries(EVENT_CONFIG).every(([k, c]) => c.prob > 0 && c.prob < 1), `全部事件概率在(0,1)内（${Object.keys(EVENT_CONFIG).length}个事件）`)

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' }

console.log('[1] 确定性：同参数两次结算完全一致')
const a = settle({ site: SITE, brand: BRAND, decisions: { pricing: '不跟降' }, week: 3 })
const b = settle({ site: SITE, brand: BRAND, decisions: { pricing: '不跟降' }, week: 3 })
ok(JSON.stringify(a) === JSON.stringify(b), '同周同参数结果一致')

console.log('[2] 数值范围合法')
const r1 = settle({ site: SITE, brand: BRAND, decisions: {}, week: 1 })
ok(r1.occupancy >= 30 && r1.occupancy <= 100, `出租率 30-100（实际 ${r1.occupancy}）`)
ok(r1.rooms === 70, `房量解析 70（实际 ${r1.rooms}）`)
ok(r1.finalGoodRate >= 30 && r1.finalGoodRate <= 100, `好评率 30-100（实际 ${r1.finalGoodRate}）`)
ok(r1.revenue > 0 && r1.totalCost > 0, '营收与成本为正')

console.log('[3] 决策真实生效')
const lazy = settle({ site: SITE, brand: BRAND, decisions: { shifts: '精简省成本', energy: 20 }, week: 2 })
const full = settle({ site: SITE, brand: BRAND, decisions: { shifts: '满编保服务', energy: 23 }, week: 2 })
ok(lazy.totalCost < full.totalCost, '精简排班成本 < 满编')
const priceDown = settle({ site: SITE, brand: BRAND, decisions: { pricing: '降价 20% 抢客' }, week: 2 })
ok(priceDown.price < r1.price, '降价后房价低于默认')

console.log('[4] 事件系统')
let crisisHit = false, bonusHit = false, eventSeen = false
for (let w = 1; w <= 12 && !(crisisHit && bonusHit); w++) {
  const rc = settle({ site: SITE, brand: BRAND, decisions: {}, week: w, pendingNegatives: 3 })
  if (rc.events.some(e => e.name === '差评发酵')) crisisHit = true
  if (rc.events.length > 0) eventSeen = true
  const rb = settle({ site: SITE, brand: BRAND, decisions: {}, week: w + 100, resolvedCount: 3 })
  if (rb.events.some(e => e.name === '整改获认可·追加好评')) bonusHit = true
}
ok(crisisHit, '差评发酵可在12周内触发')
ok(bonusHit, '整改追加好评可触发')
ok(eventSeen, '常规事件存在')
const crisis = settle({ site: SITE, brand: BRAND, decisions: { reputation: '模板回复' }, week: 5, pendingNegatives: 2 })
const crisisClear = settle({ site: SITE, brand: BRAND, decisions: { reputation: '模板回复' }, week: 5, pendingNegatives: 0 })
ok(crisis.goodRate <= crisisClear.goodRate, '差评发酵降低口碑（欠差评 ≤ 无欠差评）')

console.log('[5] 好评率跨周延续 & 危机应对')
const c1 = settle({ site: SITE, brand: BRAND, decisions: {}, week: 2, prevGoodRate: 60, crisisResponse: '立即公开整改+补偿' })
const c0 = settle({ site: SITE, brand: BRAND, decisions: {}, week: 2, prevGoodRate: 60, crisisResponse: null })
ok(c1.goodRate > c0.goodRate, '果断危机应对提升口碑')

console.log('[6] 决策快照')
ok(a.decisions && a.decisions.pricing === '不跟降', '结算结果携带决策快照')

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
