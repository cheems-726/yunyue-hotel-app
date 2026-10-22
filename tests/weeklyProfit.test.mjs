// V141 §1 · GOP 口径 / 周策略归因 / 回本外推（最近 4 周，不许整段平均）
import { 累计GOP, 本周GOP, 上周GOP, 周策略, 周归因, 最近四周均值, 一次性投入, 回本参考 } from '../src/weeklyProfit.mjs'
import { 选项代价 } from '../src/decisionRisk.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V141 · 经营利润口径')

const 周 = (week, gop, decisions = {}, oneTime = null) => ({ week, gop, profit: gop - 60000, decisions, ...(oneTime ? { oneTimeFees: { 合计: oneTime } } : {}) })
const h = [周(1, 10000, { pricing: '不跟降' }, 1000000), 周(2, 10000), 周(3, 10000), 周(4, 10000), 周(5, 40000), 周(6, 40000), 周(7, 40000), 周(8, 40000)]

ok(累计GOP(h) === 200000, `累计 GOP = 20 万（实得 ${累计GOP(h)}）`)
ok(本周GOP(h) === 40000 && 上周GOP(h) === 40000, '本周/上周 GOP 取最后两周')
ok(最近四周均值(h) === 40000, `最近 4 周均值 = 4 万（不是整段 2.5 万；实得 ${最近四周均值(h)}）`)
ok(一次性投入(h) === 1000000, '一次性投入 = 周报 oneTimeFees 合计')

const 策 = 周策略(h[0])
ok(策.length >= 1 && 策[0].id === 'pricing' && 策[0].选项 === '不跟降', '周策略取当周真实决策')
const 代价 = 选项代价('pricing', '不跟降')?.代价
ok(!!代价 && 周归因(h[0]).includes(代价), '归因文本 = 代价表原文（不是随机文本）')
ok(周归因(周(9, 0)) === '本周无决策记录（按维持现状执行）', '无决策周如实写无记录')

const 回 = 回本参考(h)
ok(回.投入 === 1000000 && 回.累计 === 200000 && Math.round(回.进度 * 100) === 20, '回本参考：投入/累计/进度自洽')
ok(回.约第N周 === 28, `外推用最近 4 周：8 + ceil(80万/4万) = 28（实得 ${回.约第N周}）`)

ok(累计GOP([]) === 0 && 本周GOP([]) === null && 回本参考([]).待补 === true, '空历史不出数字（待补）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
