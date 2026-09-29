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
import { franchiseFees, 已接入品牌 } from '../src/franchiseFees.mjs'   // §17.1-③：口径分离断言要用

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
  // 🔴 §22.2 重基线（B2）：week1 结算含【开业一次性费用】（全季 80 间 = 349,000）
  //    ⇒ totalCost 81087+349000=430087 · netProfit 45053−349000=−303947 · 营收不变
  ok(direct.revenue === 126140 && direct.totalCost === 430087 && direct.netProfit === -303947,
    `自营（direct）：revenue ${direct.revenue} / totalCost ${direct.totalCost} / netProfit ${direct.netProfit}（§22.2 锚点：含开业一次性费用 349,000）`)
  ok(direct.oneTimeFees?.开业费用 === 349000, `开业一次性费用明细随行（${direct.oneTimeFees?.开业费用}）`)
  ok(JSON.stringify(direct) === JSON.stringify(未给), '不传 bizMode 与传 direct 完全等价（同一默认路径）')
  // 🔴 §22.2 重基线：OTA 同受 B2 影响 ⇒ 118425+349000=467425 · 50555−349000=−298445 · 营收不变
  ok(ota.revenue === 168980 && ota.totalCost === 467425 && ota.netProfit === -298445,
    `OTA：revenue ${ota.revenue} / totalCost ${ota.totalCost} / netProfit ${ota.netProfit}（§22.2 锚点）`)
  ok(ota.weeklyExpenses['OTA佣金'] === Math.round(ota.revenue * 0.15),
    `OTA 佣金 = 营收 × 15% = ${ota.weeklyExpenses['OTA佣金']}`)
  ok(direct.weeklyExpenses['OTA佣金'] === 0, '自营模式不收 OTA 佣金')
  // 🔴 §17.1-③（2026-09-28）更正一处**注释口径**：原先这里写"模式差异只由此产生"/"模式差异点唯一"——
  //   **不准确**：引擎里 bizMode 还有【价格竞争力】差异（settlement 的 `priceCompetitive *= 1.2`(ota)
  //   vs `*= 0.85`(direct)）⇒ 营收/出租率随之不同（本用例 168980 vs 126140，差额**大部分不是佣金**）。
  //   ⇒ 差异**共两处**：① 佣金（15% vs 0）② 线上流量/获客（经价格竞争力）。下面把它断言住。
}

// ── 【A2b】§17.1-③ C1：开店模式的引擎侧差异必须【可观察】且断言钉住（走真实传递链）──
//   需求文档原话："已有 UI，缺引擎，改动量小价值高"。清点结论：UI 只有两种模式（direct/ota），
//   引擎侧差异**已存在但从未被完整断言**；本层把它钉住，并守住 D55-c 的"三处口径不许混"。
console.log('\n[A2b] C1 · 开店模式差异（可观察）+ 口径分离（门槛按品牌 · 佣金按 bizMode）')
{
  const direct = settle({ ...BASE, bizMode: 'direct' })
  const ota = settle({ ...BASE, bizMode: 'ota' })
  // ① UI 承诺"线上客源多且稳定 · 起步容易" ⇒ 引擎侧必须**可观察**：OTA 的出租率高于自营
  ok(ota.occupancy > direct.occupancy,
    `UI 承诺"OTA 线上客源更多"在引擎里成立：出租率 ${ota.occupancy}% > 自营 ${direct.occupancy}%（走真实传递链）`)
  ok(ota.occupiedRooms > direct.occupiedRooms, `售出间夜同步更高：${ota.occupiedRooms} > ${direct.occupiedRooms}`)
  // ② 佣金差异是【按 bizMode】，不是按品牌 —— 换品牌（同为已接入）佣金率不变
  const 换品牌 = settle({ ...BASE, brand: 汉庭, bizMode: 'ota' })
  ok(Math.abs(换品牌.weeklyExpenses['OTA佣金'] / 换品牌.revenue - 0.15) < 1e-9,
    `换品牌后佣金率仍为 15%（佣金按 bizMode，不按品牌）`, String(换品牌.weeklyExpenses['OTA佣金'] / 换品牌.revenue))
  // ③ 加盟两费是【按品牌】，与 bizMode 无关 —— 费率一致（金额随营收变，那是正常的）
  const 费率集 = 已接入品牌.map(n => franchiseFees({ name: n }, 100000).费率.合计)
  ok(new Set(费率集).size === 1 && Math.abs(费率集[0] - 0.074) < 1e-9,
    `加盟两费率对所有已接入品牌一致 = ${(费率集[0] * 100).toFixed(2)}%（按品牌名单，与 bizMode 无关）`)
  ok(!/bizMode/.test(strip(src('src/franchiseFees.mjs'))),
    '★ 口径分离（D55-c）：franchiseFees 源码里【不出现 bizMode】⇒ 加盟费不可能被平台佣金口径污染')
  // ④ 结构上：两费的计算入口不接收 bizMode
  ok(franchiseFees.length === 2, `franchiseFees(brand, revenue) 只有 2 个入参（无 bizMode）`, String(franchiseFees.length))
  // ⑤ 两模式的差异**共两处**，不许只归因于佣金（更正口径后钉住）
  const 佣金差 = ota.weeklyExpenses['OTA佣金'] - direct.weeklyExpenses['OTA佣金']
  const 营收差 = ota.revenue - direct.revenue
  ok(营收差 > 0 && 佣金差 > 0, `两模式差异两处并存：营收差 ${营收差}（流量） + 佣金差 ${佣金差}（费率）`)
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
  ok(Math.abs(l.yearly.现金流 - (l.yearly.营收 - l.yearly.租金 - l.yearly.部门固定 - l.yearly.变动与其他 - l.yearly.加盟两费)) < 1e-9,
    `年现金流口径自洽 = ${Math.round(l.yearly.现金流)}（营收 − 租金 − 部门固定 − 变动 − 加盟两费，读引擎实收）`)
  // 与 W3-1 同源锚点（此处复核一条，证明"加盟数值与引擎同源"）
  // 🔴 §22.2-B2：锚点恒等式更新 —— 现金流 === 引擎利润年化 + 一次性项年化（两边都剔开业费用，差 0）
  ok(Math.abs(l.yearly.现金流 - (l.引擎利润年化 + l.一次性项年化)) < 1e-9,
    `同源锚点复核：现金流 === 引擎利润年化 ${Math.round(l.引擎利润年化)} + 一次性项年化 ${Math.round(l.一次性项年化)}（含两费 · 剔一次性，差 0）`)
  // 回本 = 总投资 ÷ 年现金流（正分支/负分支都要如实）
  const p = paybackText(l)
  if (l.yearly.现金流 > 0) ok(Math.abs(l.回本年 - 报价总投资 / l.yearly.现金流) < 1e-9 && /约 [\d.]+ 年（外推/.test(p.text),
    `回本 = ${l.回本年.toFixed(1)} 年（外推标注在文案里）`)
  else ok(p.text.includes('不适用'), `现金流为负（${Math.round(l.yearly.现金流)}）⇒ 回本如实给"不适用"，不编年数`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：结算路径零引用加盟交互层 + 两模式锚点稳定 + 加盟数值与 W3-1/W3-2 同源')
process.exit(fail ? 1 : 0)
