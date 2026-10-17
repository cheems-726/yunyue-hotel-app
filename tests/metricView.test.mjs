// V113-2.1/2.2 判据：
//   ① **GOP 差额 0**（拿真实引擎结算跑 · 钉死分层恒等式）
//   ② 成本结构条形 **合计 100% ±0.1%**（一次性项单列，不进 100%）
//   ③ 分母守卫（revenue = 0 ⇒ 全部 null，不产出 NaN/Infinity）
//   ④ 边界：metricView **不得 import settlement / decisions / attrs**（不许变成第二个真相源）
//   反例 RV：把"营销推广"改一个字（多 1 元）⇒ 差额 ≠ 0 ⇒ ① 红；把一次性项塞回 100% ⇒ ② 红。
import { settle } from '../src/settlement.js'
import { metricView, 成本结构 } from '../src/metricView.mjs'
import { readFileSync } from 'node:fs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

// ── 真实引擎跑一周（与生产同一条结算路径）
const site = { 客流: 3, 竞争: 3, 租金: 3, 消费: 3, 交通: 3, 环境: 3, district: '锦江区' }
const brand = { name: '汉庭', level: '经济型', standard: '客房70间起' }
const row = settle({ site, brand, decisions: { pricing: '不跟降' }, week: 2, bizMode: 'direct', prevCapital: 1490000 })

const v = metricView(row)
ok(!!v, 'metricView 应返回对象')
ok(v && v.分层.gop差额 === 0, `GOP 差额必须为 0（实得 ${v && v.分层.gop差额}）`)
ok(v && v.分层.GOP === row.gop, `派生 GOP 应 === row.gop（${v && v.分层.GOP} vs ${row.gop}）`)
ok(v && Math.abs(v.成本.合计 - 1) <= 0.001, `成本结构合计应 100%±0.1%（实得 ${v && v.成本.合计}）`)

// RevPAR = OCC × ADR（同源自洽）
ok(v && Math.abs(v.RevPAR - v.OCC * v.ADR) <= Math.max(0.5, v.RevPAR * 0.001),
  `RevPAR 应 ≈ OCC × ADR（${v && v.RevPAR.toFixed(2)} vs ${v && (v.OCC * v.ADR).toFixed(2)}）`)

// 一次性项单列：在项里标一次性，且不进 100%
{
  const 一次项 = v.成本.项.filter(x => x.一次性)
  ok(一次项.every(x => x.占比 == null), '一次性项的占比必须为 null（不进条形 100%）')
  ok(v.成本.项.some(x => !x.一次性 && x.占比 != null), '经营项应有占比')
}

// ── 分母守卫：revenue = 0 ⇒ null（不产出 NaN）
{
  const 空 = metricView({ ...row, revenue: 0 })
  const 值s = [空.OCC, 空.ADR, 空.RevPAR, 空.GOP率, 空.净利率, 空.分层.部门利润]
  ok(值s.every(x => x === null), 'revenue = 0 ⇒ 比值类指标全部 null（不是 0/NaN）')
  ok(值s.every(x => !Number.isNaN(x)), '不得出现 NaN')
}

// ── 反例 RV：改 1 元营销 ⇒ 差额 ≠ 0（证明①不是空转）
{
  const 篡改 = { ...row, weeklyExpenses: { ...row.weeklyExpenses, 营销推广: (row.weeklyExpenses.营销推广 || 0) + 1 } }
  const v2 = metricView(篡改)
  ok(v2.分层.gop差额 === -1, `篡改成本后差额应为 −1（实得 ${v2.分层.gop差额}）`)
}

// ── 边界：metricView 不得 import 引擎/决策/属性
{
  const src = readFileSync('src/metricView.mjs', 'utf8')
  ok(!/from\s+'\.\/(settlement|decisions|attrs)/.test(src), 'metricView 不得 import settlement/decisions/attrs（纯派生）')
}

// 成本结构单独取（与 metricView 内一致）
ok(成本结构(row).合计 === v.成本.合计, '成本结构() 与 metricView().成本 同源')

console.log('══ V113-2.1/2.2 指标派生层 + 成本结构 ══')
console.log(`  真实一周：营收 ${row.revenue} · GOP ${row.gop} · 派生 GOP ${v.分层.GOP} · 差额 ${v.分层.gop差额}`)
console.log(`  OCC ${(v.OCC * 100).toFixed(1)}% · ADR ${Math.round(v.ADR)} · RevPAR ${v.RevPAR.toFixed(1)} · GOPPAR ${v.GOPPAR.toFixed(1)} · GOP率 ${(v.GOP率 * 100).toFixed(1)}%`)
console.log(`  成本结构合计 ${(v.成本.合计 * 100).toFixed(2)}% · 一次性项 ${v.成本.项.filter(x => x.一次性).length} 个（单列）`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
