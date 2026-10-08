// V81 · 事件数值生效【行为证据】（2026-10-08 · 挂 run-all fast）
// ★ 决策端补丁（15:3x）：E6 已接 v8 通道（settlement.js:217-232 读码实证）⇒ 本套件补「跑起来证明」：
//   [1] E6 注入 vs 不注入（同场景同周）：demandStrength/出租率 有可测差异 + 事件卡在
//   [2] 反向自检（可证伪 RV 的 RV）：把效力键剥掉 ⇒ 数字逐字节不变 ⇒ 若谁把消费点删了/键名写错，本探针立刻红
//   [3] 全通道行为 smoke：成本系数（E18）/罚款（E34）/属性（E28）各取真卡，符号与幅度逐一对账
// 场景照抄 settlement.test.mjs（SITE.竞争=3 < rivalOpen.minCompetition=4 ⇒ 随机竞店开业天然不触发，对照干净）
import { settle } from '../src/settlement.js'
import { 注入事件库, 构建注入事件 } from '../src/teacherEvents.mjs'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const 近 = (a, b, tol) => Math.abs(a - b) <= tol

console.log('▶ V81 事件数值生效行为证据')
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' }
const WEEK = 3

// [1] E6 客流对照（真卡 · 面板同款构建路径）
{
  const E6 = 构建注入事件({ 事件id: 'E6', 周: WEEK })
  ok(E6 && E6.engine && E6.engine.v8 === true && E6.engine['客流系数'] === 0.85, 'E6 真卡 engine = {v8, 客流系数 0.85}')
  const 无 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK })
  const 有 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK, injectedEvents: [E6] })
  ok(近(有.demandStrength, 无.demandStrength * 0.85, 0.01), `demandStrength 恰按 ×0.85 传导（${无.demandStrength} → ${有.demandStrength}）`)
  ok(有.occupancy < 无.occupancy, `出租率被压低（${无.occupancy}% → ${有.occupancy}%）`)
  ok(近(有.occupancy, 无.occupancy * 0.85, 1.5), '出租率降幅 ≈ −15%（整数量级舍入容差内）')
  ok(有.revenue < 无.revenue, '客流分流传导到营收（收入下降）')
  ok(有.events.some(e => /低价竞品|隔壁新开竞品/.test((e.name || '') + (e.text || ''))), 'E6 事件卡出现在本周 events')
  ok(!无.events.some(e => /低价竞品|隔壁新开竞品/.test((e.name || '') + (e.text || ''))), '不注入则无此卡（对照干净）')
}

// [2] 反向自检：效力键剥掉 ⇒ 与"从未注入"逐字节一致（0 消费回归必红）
{
  const 无 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK })
  const 剥卡 = { ...构建注入事件({ 事件id: 'E6', 周: WEEK }), engine: { v8: true } }   // 只剥效力键 · 其余（name/text）原样
  const 剥 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK, injectedEvents: [剥卡] })
  ok(剥.demandStrength === 无.demandStrength && 剥.occupancy === 无.occupancy && 剥.revenue === 无.revenue,
    '剥掉效力键 ⇒ 三数逐字节回到无注入基线（本探针抓得住"0 消费"复发）')
}

// [3] 全通道行为 smoke（每通道取一条单键真卡）
{
  const 无 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK })
  // 成本通道：E18 变动成本系数（单键）
  const E18 = 构建注入事件({ 事件id: 'E18', 周: WEEK })
  const 系18 = Number(E18.engine['变动成本系数'])
  ok(系18 > 1, `E18 成本系数 > 1（${系18}）`)
  const 有18 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK, injectedEvents: [E18] })
  ok(有18.totalCost > 无.totalCost, `成本通道真花钱（totalCost ${无.totalCost} → ${有18.totalCost}）`)
  // 罚款通道：E34 罚款（单键）
  const E34 = 构建注入事件({ 事件id: 'E34', 周: WEEK })
  const 罚34 = Number(E34.engine['罚款'])
  const 有34 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK, injectedEvents: [E34] })
  ok(近(有34.eventFine - 无.eventFine, 罚34, 0.01), `罚款通道恰入账（eventFine +${有34.eventFine - 无.eventFine} = 卡面 ${罚34}）`)
  // 属性通道：E28 士气（单键 · 无条件）
  const E28 = 构建注入事件({ 事件id: 'E28', 周: WEEK })
  const 士28 = Number(E28.engine['士气'])
  const 有28 = settle({ site: SITE, brand: BRAND, decisions: {}, week: WEEK, injectedEvents: [E28] })
  ok(近(有28.attrsAfterEvents.morale - 无.attrsAfterEvents.morale, 士28, 0.01),
    `属性通道恰落账（士气 ${无.attrsAfterEvents.morale} → ${有28.attrsAfterEvents.morale} · Δ=${有28.attrsAfterEvents.morale - 无.attrsAfterEvents.morale} = 卡面 ${士28}）`)
  // 消费点在引擎源码的位置（四通道各一处 · 防删）
  const eng = readFileSync(new URL('../src/settlement.js', import.meta.url), 'utf8')
  for (const [键, 字面] of [['客流系数', '注入v8客流系数'], ['变动成本系数', '注入v8成本系数'], ['罚款', '注入v8罚款'], ['品质/声誉/士气', '注入v8属性']]) {
    ok(eng.includes(字面), `源码消费点在：「${键}」→ ${字面}`)
  }
}



console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：注入与不注入可测差异（E6 ×0.85 传导到需求/出租/营收）· 剥键即归零（可证伪）· 四通道符号与幅度逐一对账')
process.exit(fail ? 1 : 0)
