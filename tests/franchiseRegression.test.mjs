// Wave 4 · W4-6B = 原 W3-6「加盟回归断言」（任务包 §5B 点名两项）
// 运行：node tests/franchiseRegression.test.mjs   （挂 run-all）
//
// 【A】零变化断言：加盟相关改动【不影响】自营模式的结算输出
//      —— 结构面（结算路径不引用加盟交互层模块）+ 数值面（两种经营模式的输出锚点）
// 【B】加盟数值断言：费率 / 年现金流 / 回本年数（与 W3-1/W3-2 同源锚点一致）
//
// ★ 断言要【同时钉条件与内容】（W3-1 教训）——本套件的结构类断言都写明"在哪个文件里、以什么形态"
import { readFileSync, readdirSync } from 'node:fs'
import { settle } from '../src/settlement.js'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'
import { propertyQuote } from '../src/propertyQuote.mjs'
import { onePageLedger, paybackText } from '../src/onePageLedger.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// 固定输入（自营/OTA 两模式共用）
const BASE = {
  site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  week: 1, attrs: { quality: 60, reputation: 70, morale: 65 },
}
const 汉庭 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' }
const 物业 = { name: '社区旁物业', areaNum: 2600, area: '2600㎡' }
const 区县 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }

console.log('▶ W4-6B / W3-6 · 加盟回归断言（零变化 + 数值）')

// ── 【A1】零变化 · 结构面 ────────────────────────────────────────────
console.log('\n[A1] 零变化（结构）：结算路径不引用加盟交互层模块')
{
  const 加盟模块 = ['propertyQuote', 'onePageLedger']
  const 结算路径 = [
    'src/settlement.js', 'src/serverTick.mjs', 'src/engine/index.js',
    'supabase/functions/advance-day/engine/settlement.js', 'supabase/functions/advance-day/engine/serverTick.mjs',
  ]
  const bad = []
  for (const f of 结算路径) {
    const code = strip(src(f))
    for (const m of 加盟模块) if (new RegExp(m).test(code)) bad.push(`${f} → ${m}`)
  }
  ok(bad.length === 0, `${结算路径.length} 个结算路径文件对 ${加盟模块.length} 个加盟模块零引用`, bad.join(' | '))
  // franchiseModel 在 barrel 里【只作参考资料】re-export；settlement/serverTick 本体不得直接引用
  const m = strip(src('src/settlement.js'))
  ok(!/franchiseModel/.test(m), 'settlement.js 本体不直接引用 franchiseModel（barrel 里的 re-export 属参考资料层）')
  ok(/参考资料：franchiseModel（纯数据，不参与计算）/.test(src('src/engine/index.js')),
    'engine/index.js 里写明 franchiseModel = 参考资料（不参与计算）')
  // Edge Function 组装物：不得包含两个交互层模块（否则服务端会带上 UI 层依赖）
  const names = readdirSync(new URL('../supabase/functions/advance-day/engine/', import.meta.url))
  ok(!names.some(n => /propertyQuote|onePageLedger/.test(n)),
    `Edge Function 组装物（${names.length} 个模块）不含交互层模块`)
}

// ── 【A2】零变化 · 数值面（两种经营模式的输出锚点）───────────────────
console.log('\n[A2] 零变化（数值）：自营 / OTA 两模式的输出锚点')
{
  const direct = settle({ ...BASE, bizMode: 'direct' })
  const 未给 = settle({ ...BASE })
  const ota = settle({ ...BASE, bizMode: 'ota' })
  // 自营锚点 = 各批次报告引用的"单配置"（与 W2/W3 报告同源）
  ok(direct.revenue === 126140 && direct.totalCost === 85753 && direct.netProfit === 40387,
    `自营（direct）：revenue ${direct.revenue} / totalCost ${direct.totalCost} / netProfit ${direct.netProfit}（与文档锚点一致）`)
  ok(JSON.stringify(direct) === JSON.stringify(未给), '不传 bizMode 与传 direct 完全等价（同一默认路径）')
  ok(ota.revenue === 168980 && ota.totalCost === 119920 && ota.netProfit === 49060,
    `OTA：revenue ${ota.revenue} / totalCost ${ota.totalCost} / netProfit ${ota.netProfit}（各自锚点，与自营不同属正常）`)
  ok(ota.weeklyExpenses['OTA佣金'] === Math.round(ota.revenue * 0.15),
    `OTA 佣金 = 营收 × 15% = ${ota.weeklyExpenses['OTA佣金']}（模式差异只由此产生）`)
  ok(direct.weeklyExpenses['OTA佣金'] === 0, '自营模式不收 OTA 佣金（模式差异点唯一）')
}

// ── 【B】加盟数值断言（与 W3-1/W3-2 同源）────────────────────────────
console.log('\n[B] 加盟数值：费率 / 年现金流 / 回本年数')
{
  // 费率：取自加盟资料（不写死 0.05 / 0.08）
  const t = FRANCHISE_MODEL['汉庭']
  const 管理费率 = t.管理费.费率.值
  const CRS费率 = t.中央预订系统_CRS.费率.值
  ok(管理费率 === 0.05 && CRS费率 === 0.08, `费率取自 franchiseModel 三件套：管理费 ${管理费率} · CRS ${CRS费率}`)

  const q = propertyQuote(汉庭, 物业, 区县)
  const l = onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 区县 })
  const 报价总投资 = q.lines.find(x => x.label === '总投资（估算）').value
  ok(l.总投资 === 报价总投资, `跨模块单源：onePageLedger 的总投资 === propertyQuote 的总投资 = ${报价总投资}`)
  ok(Math.abs(l.yearly.现金流 - (l.yearly.营收 - l.yearly.租金 - l.yearly.部门固定 - l.yearly.变动与其他 - l.yearly.管理费)) < 1e-9,
    `年现金流口径自洽 = ${Math.round(l.yearly.现金流)}（营收 − 租金 − 部门固定 − 变动 − 管理费）`)
  // 与 W3-1 同源锚点（此处复核一条，证明"加盟数值与引擎同源"）
  ok(Math.abs((l.yearly.现金流 + (l.yearly.管理费 ?? 0)) - l.引擎利润年化) < 1e-9,
    `同源锚点复核：现金流 + 管理费 = 引擎利润年化 ${Math.round(l.引擎利润年化)}`)
  // 回本 = 总投资 ÷ 年现金流（正分支/负分支都要如实）
  const p = paybackText(l)
  if (l.yearly.现金流 > 0) ok(Math.abs(l.回本年 - 报价总投资 / l.yearly.现金流) < 1e-9 && /约 [\d.]+ 年（外推/.test(p.text),
    `回本 = ${l.回本年.toFixed(1)} 年（外推标注在文案里）`)
  else ok(p.text.includes('不适用'), `现金流为负（${Math.round(l.yearly.现金流)}）⇒ 回本如实给"不适用"，不编年数`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：结算路径零引用加盟交互层 + 两模式锚点稳定 + 加盟数值与 W3-1/W3-2 同源')
process.exit(fail ? 1 : 0)
