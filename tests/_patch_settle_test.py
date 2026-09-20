# N1 测试补丁：追加 [7] 事件影响属性断言（LF 文件；用 chr(92) 规避转义）
import io

P = 'tests/settlement.test.mjs'
s = io.open(P, encoding='utf-8', newline='').read()

marker = "结果: ${pass} 通过, ${fail} 失败"
i = s.find(marker)
assert i > 0, '未找到结果行'
ls = s.rfind('\n', 0, i) + 1  # 结果行行首

block = '''
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
    ok('事件「' + eff.name + '」属性影响正确 ' + JSON.stringify(eff.deltas), hit, JSON.stringify(exp))
  }
}
const hitCount = Object.values(seen).filter(Boolean).length
ok('至少 2 个事件的属性影响可验证（实到 ' + hitCount + ' 个：' + (Object.keys(seen).join('/') || '无') + '）', hitCount >= 2)

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

'''
s = s[:ls] + block + s[ls:]
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('✅ 已追加 [7] 断言块（插入点行 %d）' % ls)
