// 结算引擎回归测试：node tests/settlement.test.mjs
// 夜间自动化改引擎后必跑，任何断言失败 => 阻止推送
import { settle, EVENT_CONFIG, negativeTexts, positiveTexts } from '../src/settlement.js'
import { tierDecay } from '../src/attrs.js'

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
// R0 修订：attrs 现在【有意】影响结果，故公平红线改为可观测形式——
//   ① 中性 attrs 与"无 attrs"完全一致（不额外消耗 rand、不改变既有平衡）
//   ② 同输入确定性（见 [8] ⑥）；每评价仍只消耗 1 次 rand（见 settlement.js 评价循环注释）
const sA = settle({ site: SITE, brand: BRAND, decisions: {}, week: 7 })
const sB = settle({ site: SITE, brand: BRAND, decisions: {}, week: 7, attrs: { quality: 60, reputation: 70, morale: 65 } })
ok(
  sA.occupancy === sB.occupancy && sA.profit === sB.profit &&
  JSON.stringify(sA.events.map(e => e.name)) === JSON.stringify(sB.events.map(e => e.name)),
  '中性 attrs 与无 attrs 结果一致（含事件序列）—— attrs 不额外消耗 rand'
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
  !!noEventWeek && JSON.stringify(noEventWeek.attrsAfterEvents) === JSON.stringify({ quality: 60, reputation: 70, morale: 65 }),
  '无事件触发时属性不变（比对衰减前值；衰减本身见 [8b]）',
  noEventWeek ? JSON.stringify(noEventWeek.attrsAfterEvents) : '未找到无事件周'
)
// 5. eventAttrEffects 结构正确（仅含真变化事件）
const anyR = settle({ site: SITE, brand: BRAND, decisions: {}, week: 7, attrs: { quality: 60, reputation: 70, morale: 65 } })
ok(
  Array.isArray(anyR.eventAttrEffects) && anyR.eventAttrEffects.every(e => e.name && e.deltas && Object.keys(e.deltas).length > 0),
  'eventAttrEffects 结构正确（仅含真变化事件）'
)


console.log('[8] R0 属性→经营结果（规格 §12）')
const ATTR_MID = { quality: 60, reputation: 70, morale: 65 }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', campaign: {}, linen: '自洗' }
const run = (attrs) => settle({ site: SITE, brand: BRAND, decisions: DEC, week: 6, attrs })

// ① 【最关键·单元级回归证明】属性【显式钉死中性值】时，公式本身与改前完全一致
//    （衰减只会改变"下周的输入"，不影响本周结果——故单周对比即可证明"公式没变"）
//    注：12 周逐周一致的旧证明已由影子脚本（tests/shadow-r0.mjs ①）承担，
//        接衰减后"连续多周"必然漂移（设计使然，非 bug）
const noA = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 6 })
const midA = run(ATTR_MID)
ok(
  noA.occupancy === midA.occupancy && noA.profit === midA.profit &&
  noA.finalGoodRate === midA.finalGoodRate && noA.negativeCount === midA.negativeCount,
  'attrs 缺失 == 中性值（归一化后系数=1.0，回归零变化）'
)

// ② 高声誉组出租率 > 低声誉组（声誉→出租率基线）
const repHi = run({ ...ATTR_MID, reputation: 95 })
const repLo = run({ ...ATTR_MID, reputation: 25 })
ok(repHi.occupancy > repLo.occupancy, `高声誉 ${repHi.occupancy}% > 低声誉 ${repLo.occupancy}%`)

// ③ 高品质组出租率 > 低品质组（品质→房价容忍度=客流）
const qHi = run({ ...ATTR_MID, quality: 95 })
const qLo = run({ ...ATTR_MID, quality: 25 })
ok(qHi.occupancy > qLo.occupancy, `高品质 ${qHi.occupancy}% > 低品质 ${qLo.occupancy}%`)

// ④ 高士气组差评更少（士气→好评率 + 差评系数双重作用）
// 注：单周差评数极小（预期 0.1-0.3 条），单种子比较会被随机噪声翻转 → 按 24 周累计验证
const sumNeg = (attrs) => {
  let s = 0
  for (let w = 1; w <= 24; w++) s += settle({ site: SITE, brand: BRAND, decisions: DEC, week: w, attrs }).negativeCount
  return s
}
const negHi = sumNeg({ ...ATTR_MID, morale: 95 })
const negLo = sumNeg({ ...ATTR_MID, morale: 25 })
ok(negHi < negLo, `24 周累计差评：高士气 ${negHi} < 低士气 ${negLo}`)
// 极值对照（差距足够大，单周也能分辨）
const negHiX = run({ quality: 100, reputation: 70, morale: 100 })
const negLoX = run({ quality: 20, reputation: 70, morale: 20 })
ok(negHiX.negativeCount <= negLoX.negativeCount, `极值单周：全高差评 ${negHiX.negativeCount} ≤ 全低 ${negLoX.negativeCount}`)

// ⑤ 声誉→获客成本：做活动时，低声誉组的营销支出更高
const cacHi = run({ ...ATTR_MID, reputation: 95 })
const cacLo = run({ ...ATTR_MID, reputation: 25 })
ok(cacHi.totalCost < cacLo.totalCost, `高声誉总成本 ${cacHi.totalCost} < 低声誉 ${cacLo.totalCost}（营销更便宜）`)

// ⑥ 确定性未破（公平红线）：同输入两次结果全等
const d1 = run({ quality: 33, reputation: 44, morale: 55 })
const d2 = run({ quality: 33, reputation: 44, morale: 55 })
ok(JSON.stringify(d1) === JSON.stringify(d2), 'same 输入 → same 输出（固定种子未破）')

// ⑦ 极值不炸：全 100 / 全 20 时结果有限且出租率在合法区间
const extHi = run({ quality: 100, reputation: 100, morale: 100 })
const extLo = run({ quality: 20, reputation: 20, morale: 20 })
ok(
  Number.isFinite(extHi.profit) && Number.isFinite(extLo.profit) &&
  extHi.occupancy > 0 && extHi.occupancy <= 98 && extLo.occupancy >= 30 && extLo.occupancy <= 98,
  `极值区间：hi ${extHi.occupancy}% / lo ${extLo.occupancy}%（均在 [30,98]）`
)

// ⑧ 差评数不越界（差评 ≤ 评价总数）
ok(extLo.negativeCount <= extLo.reviewCount, `差评 ${extLo.negativeCount} ≤ 评价 ${extLo.reviewCount}`)


console.log('[8b] R0 每周衰减接入')
// ① 单周：衰减量应等于该品牌档位值（BRAND 为经济型 → 品质 -3）+ 声誉 -1 + 士气 -1（下限 20）
const DECAY_Q = tierDecay(BRAND.level)
const decay1 = settle({ site: SITE, brand: BRAND, decisions: {}, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
ok(
  decay1.attrsAfterEvents && decay1.attrsAfter &&
  decay1.attrsAfter.quality === decay1.attrsAfterEvents.quality - DECAY_Q &&
  decay1.attrsAfter.morale === decay1.attrsAfterEvents.morale - 1,
  `${BRAND.level} 单周衰减 品质-${DECAY_Q}/士气-1：事件后 ${JSON.stringify(decay1.attrsAfterEvents)} → 衰减后 ${JSON.stringify(decay1.attrsAfter)}`
)
// ② 品质 < 50 → 声誉额外惩罚（(50-q)/10 × 档次放大，中档 ×1.0）
const decayQ = settle({ site: SITE, brand: BRAND, decisions: {}, week: 1, attrs: { quality: 30, reputation: 70, morale: 65 } })
const extraRepLoss = (decayQ.attrsAfterEvents.reputation - decayQ.attrsAfter.reputation) - 1
ok(extraRepLoss >= 1.9 && extraRepLoss <= 2.1, `品质30 时声誉额外损失 ≈2（实测 ${extraRepLoss.toFixed(2)}；= (50-30)/10 × 1.0）`)
// ③ 连续 N 周：属性确实持续下降（把上周 attrsAfter 喂回本周）
let traj = { quality: 60, reputation: 70, morale: 65 }
const snaps = []
for (let w = 1; w <= 12; w++) {
  const r = settle({ site: SITE, brand: BRAND, decisions: {}, week: w, attrs: traj })
  traj = r.attrsAfter
  snaps.push({ ...traj })
}
ok(traj.quality < 60 && traj.reputation < 70 && traj.morale < 65, `12 周不投入 → 属性下降：${JSON.stringify(traj)}`)
ok(snaps.every((s2, idx) => idx === 0 || s2.quality <= snaps[idx - 1].quality), '品质逐周非递增（持续衰减）')
// ④ 下限 20：24 周仍不破 20
let low = { quality: 25, reputation: 25, morale: 25 }
for (let w = 1; w <= 24; w++) low = settle({ site: SITE, brand: BRAND, decisions: {}, week: w, attrs: low }).attrsAfter
ok(low.quality >= 20 && low.reputation >= 20 && low.morale >= 20, `24 周后仍不低于下限：${JSON.stringify(low)}`)
// ⑤ attrs 缺失（旧档）→ 走同一衰减路径，不报错
const noAttr2 = settle({ site: SITE, brand: BRAND, decisions: {}, week: 1 })
ok(noAttr2.attrsAfter && noAttr2.attrsAfter.quality < 60, `旧档无 attrs：按中性值起算并正常衰减 ${JSON.stringify(noAttr2.attrsAfter)}`)


console.log('[9] 结构化评价生成（评价系统升级 第2步）')
const REV_DEC = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', energy: 20, linen: '外包', overbook: 2 }
const rv = settle({ site: SITE, brand: BRAND, decisions: REV_DEC, week: 5, attrs: { quality: 45, reputation: 60, morale: 55 } })

// ① 身份自洽：不会出现"先生/女士"与头像不符
const badGuest = rv.generatedReviews.filter(r => !r.guest || !((r.guest.gender === 'male' && r.guest.title === '先生' && r.guest.avatar === '🧑') || (r.guest.gender === 'female' && r.guest.title === '女士' && r.guest.avatar === '👩')))
ok(rv.generatedReviews.length > 0 && badGuest.length === 0, `身份自洽（${rv.generatedReviews.length} 条评价，全部 avatar↔title↔gender 一致）`, JSON.stringify(badGuest.slice(0, 1)))
ok(rv.generatedReviews.every(r => r.avatar === r.guest.avatar && r.name === r.guest.card), 'avatar/name(名片) 与 guest 一致')

// ② cause 绑定 + 可解释：每条都有合法 cause，且能反查到来源决策或明确为 null
const LEGAL = ['front_slow', 'hygiene', 'cold', 'hot', 'facility', 'overprice', 'no_room', 'busy_service', 'noise', 'misc', 'praise_clean', 'praise_service', 'praise_member', 'praise_location', 'praise_value', 'praise_misc']
ok(rv.generatedReviews.every(r => LEGAL.includes(r.cause)), '每条评价都有合法 cause', JSON.stringify(rv.generatedReviews.map(r => r.cause)))
ok(rv.generatedReviews.every(r => 'relatedDecision' in r), '每条评价都带 relatedDecision 字段（供「关联经营」反查）')

// ③ 超售必出 no_room（不走概率）
ok(rv.generatedReviews.some(r => r.cause === 'no_room'), '超售组必有 no_room 差评', JSON.stringify(rv.generatedReviews.map(r => r.cause)))
const noOverbook = settle({ site: SITE, brand: BRAND, decisions: { ...REV_DEC, overbook: 0 }, week: 5, attrs: { quality: 45, reputation: 60, morale: 55 } })
ok(!noOverbook.generatedReviews.some(r => r.cause === 'no_room'), '未超售则无 no_room')

// ④ 同一次结算生成的多条评价互不相同（独立流每条推进一次）
const texts = rv.generatedReviews.map(r => r.text)
ok(new Set(texts).size === texts.length, `同批 ${texts.length} 条文本互不相同`, `唯一 ${new Set(texts).size}`)

// ⑤ 文本已升级（不再等于旧文本池里的整句）
ok(rv.generatedReviews.every(r => !negativeTexts.includes(r.text) && !positiveTexts.includes(r.text)), '文本不再是旧文本池的整句（组合式生成生效）')
// 差评含具体细节（不是"卫生差"这类笼统词）
// 具体名词表（语料库提炼）+ 结构代理（有分句 = 带细节，而非一句笼统话）
const CONCRETE = ['发霉', '黄', '头发', '味道', '怪味', '水渍', '污渍', '褶皱', '硬', '薄', '旧', '失灵', '异响', '透光', '撕就破', '分钟', '排队', '没人接', '占线', '忙不过来', '一人', '人手', '充电器', '枕头', '吹风机', '餐盘', '没房', '快捷酒店', '系统问题', '冷', '热', '闷', '响', '吵', '凌晨', '一清二楚', '不值', '转不开身', '早餐', '房间', '前台', '空调', '电梯', '墙', '毛巾', '床', '茶', '卫', '厕']
const BANNED_GENERIC = ['卫生差,', '服务慢', '态度差,', '环境不好,']
const negs = rv.generatedReviews.filter(r => r.status !== 'good')
ok(
  negs.length > 0 && negs.every(r => CONCRETE.some(w => r.text.includes(w)) && !BANNED_GENERIC.some(w => r.text.startsWith(w))),
  `差评均含具体细节（非笼统）：${negs.length} 条`,
  negs.map(r => r.text.slice(0, 30)).join(' | ')
)

// ⑥ 【关键】内容随机与数值隔离：只改 recentReviewTexts（纯内容参数）→ 数值必须完全不变、文本必须变
const revA = settle({ site: SITE, brand: BRAND, decisions: REV_DEC, week: 5, attrs: { quality: 45, reputation: 60, morale: 55 } })
const revB = settle({ site: SITE, brand: BRAND, decisions: REV_DEC, week: 5, attrs: { quality: 45, reputation: 60, morale: 55 }, recentReviewTexts: revA.generatedReviews.map(r => r.text) })
ok(
  revA.occupancy === revB.occupancy && revA.profit === revB.profit &&
  revA.finalGoodRate === revB.finalGoodRate && revA.negativeCount === revB.negativeCount &&
  revA.attrsAfter.quality === revB.attrsAfter.quality && revA.attrsAfter.morale === revB.attrsAfter.morale,
  '内容参数（recentReviewTexts）不影响任何数值：出租率/利润/好评率/差评数/属性全等'
)
ok(JSON.stringify(revA.generatedReviews.map(r => r.text)) !== JSON.stringify(revB.generatedReviews.map(r => r.text)), '同周不同历史 → 文本变化（去重生效）')

console.log('\n[10] 触发条件回归：18 项决策全做完且答案一致（曾被 TDZ 崩掉）')
{
  // 触发条件只能靠【垃圾输入】构造：18 项答案字符串完全相同就不可能每项都合法
  const ids = ['pricing', 'shifts', 'overbook', 'hygiene', 'linen', 'energy', 'campaign', 'ota',
    'member-convert', 'member-threshold', 'corporate', 'reputation', 'hr-optimize', 'renovation',
    'quality-check', 'service', 'breakfast', 'parking']
  const same = {}
  ids.forEach(k => { same[k] = '统一答案' })
  let r = null, err = null
  try { r = settle({ site: SITE, brand: BRAND, decisions: same, week: 1 }) } catch (e) { err = e }
  ok(!err, '18 项同答案 → settle 不抛异常（TDZ 修复回归）' + (err ? ' 实际：' + err.message : ''))
  ok(!!r && Array.isArray(r.insights) && r.insights.some(x => String(x.text).includes('决策模式异常一致')),
    '防作弊提醒照常产出（insights 含决策模式异常一致）')
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
