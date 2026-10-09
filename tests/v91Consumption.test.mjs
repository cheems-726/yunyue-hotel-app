// ★ V91（2026-10-09）区域消费水平结构化 —— 接线行为证据 + 结构位守门
// 目的（决策端 V91 卡②之验收核心）：证明『有结构化值 ⇒ 引擎输出确实变了』，且『无值 ⇒ 逐字节回落代理』。
// 口径（settlement.js 现读）：消费力 = 人均可支配(元/年) ÷ 250 夹在 [180,400]；无值 ⇒ 150 + 房价档×30。
import { settle } from '../src/settlement.js'
import { LOCATION_PROFILE, 结构化覆盖 } from '../src/siteLocations.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  ← ' + extra : '')) } }

const 区 = '锦江区'
const 原值 = LOCATION_PROFILE[区].人均可支配
const DEC = { pricing: '提价 50%', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '标准排班',
  marketing: '不发券', 'room-mix': '标准', training: '常规培训', energy: '常规', 'channel-mix': '均衡',
  'checkin-mode': '标准', 'restaurant-mode': '含早', 'pms-upgrade': '不升级' }
// ★ 形状要点：settle 内 `s = site`（无 attrs 时）⇒ 区县名必须落在 `district`（引擎全域按 district 取名）
const mk = (房价 = 5, pricing = '提价 50%') => settle({
  site: { district: 区, name: 区, 客流: 4, 房价, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: { ...DEC, pricing },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  week: 1, attrs: { quality: 60, reputation: 70, staff: 60 },
})

console.log('▶ V91 · 区域消费水平结构化（接线行为证据）')

try {
  // ① 结构位存在性（26/26 键都有两个字段）
  const 键 = Object.keys(LOCATION_PROFILE)
  const 有字段 = 键.filter(k => '社零' in LOCATION_PROFILE[k] && '人均可支配' in LOCATION_PROFILE[k])
  ok(有字段.length === 键.length, `① 结构位存在：${有字段.length}/${键.length} 区位都有『社零/人均可支配』`,
     `缺 ${键.length - 有字段.length} 个`)

  // ② 覆盖数【随实际 · 不写死】+ 真约束：有值 ⇒ 必须有来源与年份（否则不算可核数据）
  const c = 结构化覆盖()
  ok(c.社零有值 >= 0 && c.社零有值 <= c.总区位 && c.可支配有值 >= 0 && c.可支配有值 <= c.总区位,
     `② 有值区位数随实际（现读：社零 ${c.社零有值}/26 · 人均可支配 ${c.可支配有值}/26）`)
  const 有值无来源 = 键.filter(k => { const v = LOCATION_PROFILE[k].人均可支配; return v && Number.isFinite(Number(v.值)) && !v.来源 })
  ok(有值无来源.length === 0, `② 可核性：凡有值必有『来源』（否则不许入库·三件套红线）`, 有值无来源.join(','))

  // ③ ★ 行为证据 A：同一区位、同一决策 —— 有值 vs 无值 ⇒ 引擎输出【确实不同】
  LOCATION_PROFILE[区].人均可支配 = 原值              // 无值 ⇒ 代理 150+5×30=300 ⇒ 510/300=1.70 < 2 不触发
  const 无值 = mk()
  LOCATION_PROFILE[区].人均可支配 = { 值: 50000, 年: 2024, 来源: 'V91 测试注入（非入库数据）' }  // 50000/250=200 ⇒ 510/200=2.55 ≥ 2 触发
  const 有值 = mk()
  ok(有值.occupancy < 无值.occupancy && 有值.revenue < 无值.revenue,
     `③ 有值真的改变输出：出租率 ${无值.occupancy}% → ${有值.occupancy}% · 营收 ${Math.round(无值.revenue)} → ${Math.round(有值.revenue)}`,
     `两者相同 ⇒ 接线没生效`)
  ok(无值.occupancy - 有值.occupancy >= 20, `③ 差异显著 ≥20pp：${(无值.occupancy - 有值.occupancy).toFixed(1)}pp（断崖형态）`)

  // ④ ★ 行为证据 B：把结构化值设成【与代理等价的折算值】⇒ 输出逐字节相同（映射同量级 + 回落等价）
  LOCATION_PROFILE[区].人均可支配 = { 值: 300 * 250, 年: 2024, 来源: 'V91 等价性测试（300×250）' }
  const 等价 = mk()
  ok(JSON.stringify(等价) === JSON.stringify(无值), '④ 等价性：值=代理×250 ⇒ 消费力=代理 ⇒ 输出与无值【逐字节相同】')

  // ⑤ 回落分支一视同仁：null / 缺字段 / 非数 ⇒ 互相逐字节相同（防'某一种空值穿了别的分支'）
  LOCATION_PROFILE[区].人均可支配 = null
  const A_null = mk()
  delete LOCATION_PROFILE[区].人均可支配
  const B_缺字段 = mk()
  LOCATION_PROFILE[区].人均可支配 = { 值: 'abc', 年: 2024, 来源: 'V91 非数测试' }
  const C_非数 = mk()
  ok(JSON.stringify(A_null) === JSON.stringify(B_缺字段) && JSON.stringify(B_缺字段) === JSON.stringify(C_非数),
     '⑤ 空值三态（null / 缺字段 / 非数）⇒ 一律回落代理且【互相逐字节相同】')
  // ⑤b 缺 district 的匿名 site ⇒ 不抛错（回落代理）· 与既有测试（flat site 无 district）同形
  const 匿名 = settle({ site: { 客流: 4, 房价: 5, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
    brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
    decisions: { ...DEC }, week: 1, attrs: { quality: 60, reputation: 70, staff: 60 } })
  ok(Number.isFinite(匿名.revenue) && Number.isFinite(匿名.occupancy), `⑤b 匿名 site 不抛错（营收 ${Math.round(匿名.revenue)} · 出租率 ${匿名.occupancy}%）`)

  // ⑥ 低值夹逼：极低收入区不许把消费力压到 180 以下（否则断崖失真）
  LOCATION_PROFILE[区].人均可支配 = { 值: 10000, 年: 2024, 来源: 'V91 夹逼测试' }
  const 极低 = mk(1)   // 10000/250=40 ⇒ 夹到 180；无值代理也是 180 ⇒ 应相同
  LOCATION_PROFILE[区].人均可支配 = 原值
  const 代理H1 = mk(1)
  ok(JSON.stringify(极低) === JSON.stringify(代理H1), '⑥ 夹逼下界 180：极低值区与档1代理等价（不许低于 180）')
} finally {
  LOCATION_PROFILE[区].人均可支配 = 原值   // 还原（防污染同进程后续断言）
}

  // ⑦ ★ 口径必标（V91 批3 教训：子串误判 ⇒ 来源串必须写明口径词，否则后人无法判断）
  const 键2 = Object.keys(LOCATION_PROFILE)
  const 缺口径 = 键2.filter(k => { const v = LOCATION_PROFILE[k].人均可支配; return v && Number.isFinite(Number(v.值)) && !/(全体|城镇|农村|全市)居民/.test(String(v.来源)) })
  ok(缺口径.length === 0, '⑦ 口径必标：凡『人均可支配』有值，来源串必须写明口径（全体/城镇/农村/全市居民）', 缺口径.join(','))

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
if (fail) process.exit(1)
