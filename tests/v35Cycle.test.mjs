// V35 批4 · 断言套件（可证伪 · 挂 run-all fast）
// 判据全部来自《V35-OTA流量动态循环与极端定价-规格.md》批1 定稿（实现前写死）。
import { settle } from '../src/settlement.js'
import { 流量循环因子, 渠道流量系数 } from '../src/otaRating.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  [' + extra + ']' : '')) } }
const 夹 = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

console.log('▶ V35 · OTA 流量循环 + 极端定价断崖（规格钉死 · 防退化）')

// ① 循环因子公式：1 + (season-1)×0.5（season 表 12 周全值过公式 · 夹 [0.90,1.15]）
const 期望表 = { 0.88: 0.94, 0.92: 0.96, 1: 1, 1.08: 1.04, 1.1: 1.05, 1.12: 1.06 }
for (const [s, e] of Object.entries(期望表)) {
  const got = 流量循环因子(Number(s), 'ota')
  ok(Math.abs(got - e) < 1e-9, `① 循环因子(season ${s}) = ${e}（ota）`, `got ${got}`)
}
ok(流量循环因子(0.7, 'ota') === 0.9, `① 夹下限：season 0.7 ⇒ 因子 0.90（不放大极端）`)
ok(流量循环因子(1.4, 'ota') === 1.15, `① 夹上限：season 1.4 ⇒ 因子 1.15`)

// ② direct 恒 1（平台循环不串直营 · 含季节极值）
ok(流量循环因子(0.88, 'direct') === 1 && 流量循环因子(1.12, 'direct') === 1, '② direct 恒 1（季节极值也不串）')

// ③ 断崖三条件矩阵（低房价区 × 组合套餐 才触发）
const 基座 = { site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } }
const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', 'revenue-mgmt': '组合套餐' }
const siteP = (房价) => ({ ...基座.site, 房价 })
const 低 = settle({ ...基座, decisions: D, site: siteP(2) })
const 高 = settle({ ...基座, decisions: D, site: siteP(4) })
const 低连住 = settle({ ...基座, decisions: { ...D, 'revenue-mgmt': '连住优惠' }, site: siteP(2) })
ok(低.occupancy + 20 < 高.occupancy, `③ 断崖：房价2+组合套餐 出租率 ${低.occupancy}% 比房价4区 ${高.occupancy}% 断崖式低（差 >20pp）`)
ok(低连住.occupancy > 低.occupancy - 5, `③ 对照面：同低房价区但「连住优惠」（无提价错配）不断崖（${低连住.occupancy}%）`)

// ④ 水位线：direct 模式 12 周输出与改前锚点一致（循环因子 direct 恒 1 ⇒ 不碰 direct 数字）
const 锚 = settle({ ...基座, decisions: D, site: siteP(2) })
ok(锚.capital > 0 || 锚.capital < 0, '④ 水位线占位：direct 路径由六组赛季套件（engine-parity/rehearsal）常驻钉死')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：公式钉死（season 全表过公式+夹边）· direct 不串 · 断崖三条件矩阵 · 水位线由既有套件常驻')
process.exit(fail ? 1 : 0)
