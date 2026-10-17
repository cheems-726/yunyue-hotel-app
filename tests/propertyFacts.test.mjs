// V113-0.1 判据：候选物业「每档 ≥4 · 只给事实（无 match/无预设房量）· 房量由学生测算」
//   反例 RV（可证伪）：从任一一档删掉一个物业 ⇒ 该档 <4 ⇒ 本套件红。
//                  把 `match: '高'` 塞回任一物业 ⇒ 「无结论字段」红。
//                  把 estimateRooms 的 Math.floor 去掉 ⇒ 房量为小数 ⇒ 红。
import { PROPERTIES, estimateRooms, ROOM_ESTIMATE_DEFAULTS, getPropertyList, getPropertyTier } from '../src/propertyCatalog.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

const 档s = Object.keys(PROPERTIES)
ok(档s.length === 4, `应有 4 个物业档（实得 ${档s.length}：${档s.join('/')}）`)
for (const 档 of 档s) {
  const list = PROPERTIES[档]
  ok(Array.isArray(list) && list.length >= 4, `${档} 候选物业应 ≥4 个（实得 ${list.length}）`)
  for (const p of list) {
    ok(!!p.name && !!p.area && Number.isFinite(p.areaNum), `${档}「${p.name}」缺面积/areaNum`)
    for (const k of ['柱网', '电梯', '消防', '产权', 'rent', 'type']) ok(!!p[k], `${档}「${p.name}」缺事实字段 ${k}`)
    ok(!('match' in p), `${档}「${p.name}」仍带 match（匹配度结论 · V113-0.1 要求删）`)
    ok(!('rooms' in p), `${档}「${p.name}」仍预设 rooms（房量应学生自己算）`)
    ok(/㎡/.test(p.area), `${档}「${p.name}」面积格式应为 N㎡`)
  }
  // 默认测算参数齐全且合法
  const d = ROOM_ESTIMATE_DEFAULTS[档]
  ok(!!d && d.得房率 > 0 && d.得房率 <= 1 && d.单房建筑面积 > 0, `${档} 缺合法的测算默认参数`)
}

// 测算器行为（房量 = ⌊面积 × 得房率 ÷ 单房建筑面积⌋，且非法输入不返回 0）
ok(estimateRooms({ areaNum: 2600, 得房率: 0.68, 单房建筑面积: 26 }) === Math.floor((2600 * 0.68) / 26), '测算器不按公式取整')
ok(estimateRooms({ areaNum: 2600, 得房率: 0.68, 单房建筑面积: 25 }) > estimateRooms({ areaNum: 2600, 得房率: 0.68, 单房建筑面积: 26 }), '单房面积变大 ⇒ 房量应变少（单调性）')
ok(estimateRooms({ areaNum: 1000, 得房率: 0.65, 单房建筑面积: 30 }) === 21, '取整应为 floor（1000×0.65÷30 = 21.67 ⇒ 21）')
ok(estimateRooms({ areaNum: 0, 得房率: 0.6, 单房建筑面积: 30 }) === null, '面积 0 应返回 null（不许用 0 冒充结果）')
ok(estimateRooms({ areaNum: 2000, 得房率: 1.5, 单房建筑面积: 30 }) === null, '得房率 >100% 应返回 null')
ok(estimateRooms({}) === null, '空入参应返回 null')

// 映射：品牌档 → 物业档（同一映射供测算默认值）
ok(getPropertyTier('经济型连锁') === '经济型' && getPropertyTier('国民酒店') === '经济型', '经济/国民 应映射到经济型')
ok(getPropertyTier('中高端精选') === '中高档', '精选 应映射到中高档')
ok(getPropertyTier('豪华高档') === '高档', '高档 应映射到高档')
ok(getPropertyList('中档商务') === PROPERTIES['中档'], '中档 默认映射到中档')

console.log('══ V113-0.1 候选物业事实表 + 房量测算器 ══')
console.log(`  ${档s.length} 档 · ${档s.reduce((a, k) => a + PROPERTIES[k].length, 0)} 个物业 · ${检查数} 条判据`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
