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


console.log('[7] 事件影响属性（N1 接入）')
// 1. 公平红线：新增 attrs 入参不得改变随机序列（出租率/利润/事件序列逐一比对）
const sA = settle({ site: SITE, brand: BRAND, decisions: {}, week: 7 })
const sB = settle({ site: SITE, brand: BRAND, decisions: {}, week: 7, attrs: { quality: 30, reputation: 30, morale: 30 } })
ok(
  sA.occupancy === sB.occupancy && sA.profit === sB.profit &&
  JSON.stringify(sA.events.map(e => e.name)) === JSON.stringify(sB.events.map(e => e.name)),
  '新增 attrs 入参不消耗 rand（同周结果与事件序列一致）'
)
// 2. attrs 缺失 → 兜底等价于初值（旧调用方零改动、不报错不 NaN）
const noAttrs = settle({ site: SITE, brand: BRAND, decisions: {}, week: 3 })
const withInit = settle({ site: SITE, brand: BRAND, decisions: {}, week: 3, attrs: { quality: 60, reputation: 70, morale: 65 } })
ok(!!noAttrs.attrsAfter && JSON.stringify(noAttrs.attrsAfter) === JSON.stringify(withInit.attrsAfter), 'attrs 缺失时兜底为初值，不报错不 NaN')

// 3. 逐事件比对属性增量（规格第六节表）——扫描周次抓真实触发
const EVENT_EXPECT = {
  '设备故障': { quality: -2, reputation: -1 },
  '卫生敷衍': { quality: -2, reputation: -3 },
  '员工请假': { reputation: -1, morale: -3 },
  '深夜噪音投诉': { quality: -1, reputation: -2 },
  '员工关怀日': { morale: 4 },
  '网红探店': { reputation: 3 },
}
const seen = {}
for (let w = 1; w <= 400 && Object.keys(seen).length < 4; w++) {
  const r = settle({ site: SITE, brand: BRAND, decisions: {}, week: w, attrs: { quality: 80, reputation: 80, morale: 80 } })
  for (const eff of (r.eventAttrEffects || [])) {
    if (seen[eff.name] !== undefined) continue
    const exp = EVENT_EXPECT[eff.name]
    if (!exp) continue
    const hit = Object.keys(exp).length === Object.keys(eff.deltas).length && Object.keys(exp).every(k => eff.deltas[k] === exp[k])
    seen[eff.name] = hit
    ok(hit, '事件「' + eff.name + '」属性影响正确 ' + JSON.stringify(eff.deltas) + '（期望 ' + JSON.stringify(exp) + '）')
  }
}
const hitCount = Object.values(seen).filter(Boolean).length
ok(hitCount >= 2, '至少 2 个事件的属性影响可验证（实到 ' + hitCount + ' 个：' + (Object.keys(seen).join('/') || '无') + '）')

// 4. 无事件触发时属性完全不变
let noEventWeek = null
for (let w = 1; w <= 400 && !noEventWeek; w++) {
  const r = settle({ site: SITE, brand: BRAND, decisions: { hygiene: '停房深清洁' }, week: w, attrs: { quality: 60, reputation: 70, morale: 65 } })
  if ((r.events || []).length === 0) noEventWeek = r
}
ok(
  !!noEventWeek && JSON.stringify(noEventWeek.attrsAfter) === JSON.stringify({ quality: 60, reputation: 70, morale: 65 }),
  '无事件触发时属性不变',
  noEventWeek ? JSON.stringify(noEventWeek.attrsAfter) : '未找到无事件周'
)
// 5. eventAttrEffects 结构正确（仅含真变化事件）
const anyR = settle({ site: SITE, brand: BRAND, decisions: {}, week: 7, attrs: { quality: 60, reputation: 70, morale: 65 } })
ok(
  Array.isArray(anyR.eventAttrEffects) && anyR.eventAttrEffects.every(e => e.name && e.deltas && Object.keys(e.deltas).length > 0),
  'eventAttrEffects 结构正确（仅含真变化事件）'
)

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
