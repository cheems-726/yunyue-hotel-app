// V113-2.3 判据：tick 落库的 history 行**必须带指标所需的存量字段**（gop + 成本明细）
//   + metricView 能吃 history 行（新旧两种形状都不得崩；旧形状缺字段 ⇒ "—"，不补算）
//   反例 RV：把 tick 的 history 追加改成"只存 13 个投影字段" ⇒ 本条红。
import { advanceGroupOneDay } from '../src/serverTick.mjs'
import { metricView, 矩阵行 } from '../src/metricView.mjs'
import { readFileSync } from 'node:fs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

// ── ① 跑一次真实 tick（第 1 周第 7 天 ⇒ 结算第 1 周）
const save = {
  __groupKey: 'g1',
  week: 1,
  capital: 1490000,
  attrs: {},
  history: [],
  location: { district: '锦江区', attrs: { 客流: 3, 竞争: 3, 租金: 3, 消费: 3, 交通: 3, 环境: 3 } },
  brand: { name: '汉庭', level: '经济型', standard: '客房70间起' },
  doneDecisions: { pricing: '不跟降' },
  bizMode: 'direct',
}
const r = advanceGroupOneDay(save, 7, { groupKey: 'g1' })
ok(r && r.advanced === true, '第 7 天应结算出第 1 周')
const row = r && r.save && Array.isArray(r.save.history) ? r.save.history[r.save.history.length - 1] : null
ok(!!row, 'history 应追加一行')
ok(row && Number.isFinite(row.gop), 'history 行必须带 gop（指标派生要用）')
ok(row && row.weeklyExpenses && typeof row.weeklyExpenses === 'object', 'history 行必须带成本明细（weeklyExpenses = 卡上说的 cost{...}）')
ok(row && Object.keys(row.weeklyExpenses || {}).length >= 5, '成本明细至少 5 个科目')
for (const k of ['客房变动成本', '客房部固定', '人力固定', '公区能耗', '行政管理', '维修保养', '营销推广', 'OTA佣金']) {
  ok(row && Number.isFinite(Number((row.weeklyExpenses || {})[k])), `成本明细缺科目：${k}`)
}

// ── ② metricView 直接吃 history 行（这就是 2.4 矩阵的数据路径）
{
  const v = metricView(row)
  ok(v && v.分层.gop差额 === 0, `history 行的 GOP 差额必须 0（实得 ${v && v.分层.gop差额}）`)
  ok(v && Math.abs(v.成本.合计 - 1) <= 0.001, 'history 行成本结构应合计 100%±0.1%')
  ok(v && Number.isFinite(v.OCC) && Number.isFinite(v.RevPAR), 'OCC/RevPAR 应可算')
}

// ── ③ 旧形状（13 字段、无 gop/无成本明细）⇒ 不得崩；能算的算，缺的给 null
{
  const 旧 = { week: 3, occupancy: 55, occupiedRooms: 38, rooms: 70, price: 260, revenue: 49000, profit: -20000, goodRate: 80, finalGoodRate: 75, negativeCount: 2, reviewCount: 9, totalCost: 69000, totalExpenses: 69000 }
  const v = metricView(旧)
  ok(!!v, '旧行也必须有返回值（不许崩）')
  ok(v && v.分层.GOP === null && v.分层.gop差额 === null, '旧行无成本明细 ⇒ 分层为 null（不补算）')
  ok(v && Number.isFinite(v.OCC) && Number.isFinite(v.RevPAR), '旧行仍可算 OCC/RevPAR（字段够）')
  ok(v && v.成本.合计 === null, '旧行无成本明细 ⇒ 成本结构合计 null（不编）')
}

// ── ③b 矩阵行（2.4）：新行全可算；旧行 GOPPAR 必须 null（不补 0）
{
  const 旧行 = { week: 3, occupancy: 55, occupiedRooms: 38, rooms: 70, price: 260, revenue: 49000, profit: -20000, goodRate: 80, finalGoodRate: 75, negativeCount: 2, reviewCount: 9, totalCost: 69000 }
  const 行s = 矩阵行([旧行, row])
  ok(行s.length === 2 && 行s[0].week === 1 && 行s[1].week === 3, '矩阵行应按周升序并保留全部周')
  const 新行 = 行s.find(x => x.week === 1)
  ok(新行 && ['OCC', 'ADR', 'RevPAR', '好评率', 'GOPPAR'].every(k => Number.isFinite(新行[k])), '新行五列都应可算')
  const 旧 = 行s.find(x => x.week === 3)
  ok(旧 && 旧.GOPPAR === null, '旧行 GOPPAR 必须 null（不补 0）')
  ok(旧 && 旧.GOPPAR !== 0, '旧行 GOPPAR 不得被补成 0')
  ok(旧 && Number.isFinite(旧.OCC) && Number.isFinite(旧.RevPAR), '旧行能算的三列仍要算')
}

// ── ④ 静态：tick 必须把【整条结算结果】追加进 history（不是只存投影）
{
  const src = readFileSync('src/serverTick.mjs', 'utf8')
  // ★ V126：追加对象改为 结算结果 = { ...result, 决策数, 决策来源 }（整条引擎结果 + 审计标记）
  ok(/history:\s*\[\.\.\.history,\s*结算结果\]/.test(src), 'tick 的 history 追加必须是整条结算结果（gop/成本明细随行）')
  ok(/const 结算结果 = \{\s*\.\.\.result/.test(src), '结算结果 由整条 result 展开而来（不是只有投影字段）')
}

console.log('══ V113-2.3 history 存量字段（指标可用）══')
console.log(`  新行字段数 ${row ? Object.keys(row).length : 0} · gop=${row && row.gop} · 成本科目 ${row ? Object.keys(row.weeklyExpenses || {}).length : 0}`)
console.log(`  旧行（13 字段）：OCC=${(metricView({ week: 3, occupancy: 55, occupiedRooms: 38, rooms: 70, price: 260, revenue: 49000, profit: -20000, totalCost: 69000 }).OCC * 100).toFixed(1)}% · 分层 null（不补）`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
