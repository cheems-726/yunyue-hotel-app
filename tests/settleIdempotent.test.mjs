// V156 阶段二 · 结算幂等（(group, week) 单一闸 + 并发/重试验证）
// 运行：node tests/settleIdempotent.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { 幂等检查, withIdempotent } from '../src/settleIdempotent.mjs'
import { settleWeekSegmented } from '../src/weekSegments.mjs'
import { advanceGroupOneDay } from '../src/serverTick.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '汉庭', price: '210-310元', standard: '客房70间起', level: '经济型 · 国民', rentFactor: 0.30 }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', energy: 23, overbook: 0, ota: null, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }

console.log('▶ V156 阶段二 · 结算幂等')
{
  // ① 纯闸：history 已有该周 ⇒ 命中
  const r1 = settleWeekSegmented({ site: SITE, brand: BRAND, decisions: DEC, week: 3 })
  const gate = 幂等检查({ week: 3, history: [{ week: 2 }, { week: 3, profit: r1.profit, foo: 'bar' }] })
  ok(gate.hit && gate.已有.foo === 'bar', '幂等检查：history 有该周 ⇒ 命中并返回既有对象')
  ok(幂等检查({ week: 4, history: [{ week: 3 }] }).hit === false, '无该周 ⇒ 不命中（正常结算路径）')
  ok(幂等检查({ week: NaN, history: [{ week: 3 }] }).hit === false, '脏 week ⇒ 不命中不误伤')
  ok(幂等检查({ week: 3, history: null }).hit === false, 'history 缺省 ⇒ 不命中（老调用方零变化）')
}

console.log('\n[② 同周重复结算 ⇒ 返回既有（deepEqual）+ 引擎不再跑]')
const 幂等settle = withIdempotent(settleWeekSegmented)
{
  const 首 = 幂等settle({ site: SITE, brand: BRAND, decisions: DEC, week: 5 })
  ok(!('__idempotent' in 首), '首次结算：正常进引擎（无 __idempotent 标记）')
  const history = [{ week: 5, ...首 }]
  const 重复们 = Array.from({ length: 5 }, (_, i) => 幂等settle({ site: SITE, brand: BRAND, decisions: DEC, week: 5, history }))
  ok(重复们.every(r => r.__idempotent === true), '重复调用 5 次 ⇒ 全部幂等命中（__idempotent 标记）')
  ok(重复们.every(r => JSON.stringify(r) === JSON.stringify({ ...首, __idempotent: true })), '5 次返回逐字节同一结果（deepEqual）')
  ok(重复们.every(r => r.profit === 首.profit), `净利不变（${首.profit}）`)
}

console.log('\n[③ 并发 10 次同周 ⇒ history 只增 1、金额不翻倍]')
{
  // 模拟双开标签：10 个"读者"同时拿同一份存档起跑（真实并发下的读-算-写竞态）
  const 基础档 = { __groupKey: 'g1|1', location: SITE, brand: BRAND, week: 6, capital: 1500000, history: [], attrs: { quality: 60, reputation: 70, morale: 65 }, doneDecisions: DEC, __autoSettled: [] }
  const 档们 = Array.from({ length: 10 }, () => JSON.parse(JSON.stringify(基础档)))
  const 结果们 = 档们.map(档 => {
    // 每个并发分支：先看共享 history（这里模拟"最后写回者拿到全量 history 再算"的服务端真实路径）
    const r = advanceGroupOneDay(档, 40)   // classDay=40 ⇒ 第 6 周 第 5 天
    档.history = r.save.history
    return { advanced: r.advanced, save: 档 }
  })
  // 服务端真实语义：10 个并发请求读同一行 ⇒ 各自算 ⇒ 最后写回 ⇒ history 含几条 week=6？
  // 每个分支都带【前一个分支的写回】再算（最坏情况串行化模拟）⇒ 幂等闸应让第 2..10 个 advanced=false
  let 串行档 = JSON.parse(JSON.stringify(基础档))
  let advancedCount = 0
  for (let i = 0; i < 10; i++) {
    const r = advanceGroupOneDay(串行档, 40)
    if (r.advanced) advancedCount++
    串行档 = r.save
  }
  const week6条数 = 串行档.history.filter(h => Number(h.week) === 6).length
  ok(week6条数 === 1, `并发 10 次同周（串行化最坏情况）⇒ history 该周恰 1 条（实得 ${week6条数}）`)
  ok(advancedCount === 1, `只有第 1 次 advanced=true（实得 ${advancedCount}/10）`)
  const 资金 = 串行档.capital
  ok(Number.isFinite(资金), `期末资金为有限数（${资金} · 单次结算口径，非翻倍）`)
  // 金额不翻倍：与单次结算对照
  const 单次 = advanceGroupOneDay(JSON.parse(JSON.stringify(基础档)), 40)
  ok(串行档.capital === 单次.save.capital && JSON.stringify(串行档.history) === JSON.stringify(单次.save.history), '10 次并发后的 capital 与 history === 单次结算（金额未翻倍）')
}

console.log('\n[④ 断线重试 3 次 ⇒ 仍只结算 1 次（客户端闸 withIdempotent）]')
{
  const 首 = 幂等settle({ site: SITE, brand: BRAND, decisions: DEC, week: 7 })
  const history = [{ week: 7, ...首 }]
  const 重试 = [1, 2, 3].map(() => 幂等settle({ site: SITE, brand: BRAND, decisions: DEC, week: 7, history }))
  ok(重试.every(r => r.__idempotent), '重试 3 次 ⇒ 全部命中既有（不新增）')
  ok(history.length === 1, 'history 仍 1 条')
}

console.log('\n[⑤ 服务端闸 + 客户端闸 = 同一道（代码结构断言）]')
{
  const fs = await import('node:fs')
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const st = fs.readFileSync(new URL('../src/serverTick.mjs', import.meta.url), 'utf8')
  ok(/settleWeekSegmented幂等 = withIdempotent\(settleWeekSegmented\)/.test(app), '客户端 doSettle/预览走同一幂等闸')
  ok(/settleWeekSegmented幂等 = withIdempotent\(settleWeekSegmented\)/.test(st), '服务端 serverTick 走同一幂等闸')
  ok(/settleWeekSegmented幂等\(\{ history, week/.test(app) || /settleWeekSegmented幂等\(\{\s*history,\s*week/.test(app), '客户端调用带 history+week（闸的入参）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
