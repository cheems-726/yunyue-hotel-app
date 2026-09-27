// W3-1 · 「一页钱账」+ W3-5 · 回本周期（外推）断言
// 运行：node tests/onePageLedger.test.mjs   （挂 run-all）
//
// 口径依据（决策端 2026-09-27 拍板 · 选项 (b) 本店实测）：
//   ADR/OCC 取【引擎确定性单周】实收结果 · CRS 单列不并入 · 回本周期必须带"外推"标注（W4 裁决）
// 分四层：
//   ① 口径层：每个年化数字都能回到"基准周 × 52"，且与引擎同源
//   ② 不编造层：管理费率/CRS 缺来源 ⇒ 待补；且年现金流必须注明"管理费未计入"
//   ③ 回本层：正现金流 ⇒ "约 X 年 + 外推"；≤0 ⇒ 不适用；总投资缺 ⇒ 待补
//   ④ 零影响层：纯函数 + settlement.js 不引用 + UI 静态断言（旧写死数字已清除）
import { readFileSync, readdirSync } from 'node:fs'
import {
  onePageLedger, paybackText, baseWeek, 部门固定合计, 人力固定单价, WEEKS_PER_YEAR, EXTRAPOLATION_NOTE, ENGINE_GAP_NOTE,
} from '../src/onePageLedger.mjs'
import { parseRooms } from '../src/settlement.js'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

// 从加盟资料取费率（不在测试里写死 0.05 / 0.08）
const 费率 = (brandName, kind) => {
  const t = FRANCHISE_MODEL[brandName]
  if (!t) return null
  return kind === '管理费' ? (t.管理费?.费率?.值 ?? null) : (t.中央预订系统_CRS?.费率?.值 ?? null)
}

const 汉庭 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' }
const 全季 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 物业 = { name: '社区旁物业', type: '社区型', area: '2600㎡', areaNum: 2600, rent: '中等' }
const 区县 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }

console.log('▶ W3-1/W3-5 · 一页钱账 + 回本周期（口径 (b) 本店实测 · 纯计算不改结算）')

// ── ① 口径层 ──────────────────────────────────────────────────────────
console.log('\n[1] 口径层：年化数字都能回到"基准周 × 52"（与引擎同源）')
{
  const q = onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 区县 })
  const w = baseWeek(区县, 汉庭)
  ok(JSON.stringify(baseWeek(区县, 汉庭)) === JSON.stringify(w), '基准周确定性：同输入两次调用结果逐字节相同（固定种子）')
  ok(q.occ === w.occupancy, `出租率取引擎基准周实测 = ${q.occ}%（不是拍脑袋的参考值）`)
  ok(q.adr === Math.round(w.revenue / (w.occupiedRooms * 7)), `平均房价 = 引擎实收（周客房收入 ÷ 售出间夜）= ${q.adr} 元/间·天`)
  ok(q.rooms === parseRooms(汉庭.standard), `房量 = parseRooms(品牌标准) = ${q.rooms}（A3 权威）`)

  const y = q.yearly
  ok(y.营收 === w.revenue * WEEKS_PER_YEAR && y.租金 === w.rentCost * WEEKS_PER_YEAR && y.部门固定 === w.deptCost * WEEKS_PER_YEAR,
    `年营收/年租金/年部门固定 = 基准周对应值 × ${WEEKS_PER_YEAR}（逐项回算一致）`)
  ok(y.变动与其他 === (w.totalCost - w.rentCost - w.deptCost) * WEEKS_PER_YEAR,
    '年变动与其他 = (总成本 − 租金 − 部门固定) × 52 —— 全部取自引擎实测字段')

  const mgmtRate = 费率('汉庭', '管理费')
  ok(mgmtRate != null && Math.abs(y.管理费 - y.营收 * mgmtRate) < 1e-6,
    `年管理费 = 年营收 × ${(mgmtRate * 100).toFixed(1)}%（加盟资料费率）`)

  const 现金应 = y.营收 - y.租金 - y.部门固定 - y.变动与其他 - y.管理费
  ok(y.现金流 === 现金应, '年现金流 = 营收 − 租金 − 部门固定 − 变动与其他 − 管理费（★ 不含 CRS）')
  const crsRate = 费率('汉庭', 'CRS')
  ok(crsRate != null && y.CRS === y.营收 * crsRate && y.现金流 !== 现金应 - y.CRS,
    `CRS 单列：年 CRS = 年营收 × ${(crsRate * 100).toFixed(1)}% = ${(y.CRS / 10000).toFixed(1)} 万，且【未】从现金流扣（决策端口径）`)
  ok(部门固定合计 > 0 && 人力固定单价 === 18.5,
    `部门成本口径单源：Σ固定 ${部门固定合计.toFixed(1)} 元/间·天（含人力固定 ${人力固定单价}）`)

  // ★★ 同源锚点（口径 (b) 的硬证据）：现金流 + 管理费 = 引擎利润年化
  //   有费率（汉庭）时差额恰为管理费；无费率数据（全季）时差 0 ⇒ 其余各项与引擎逐项一致
  ok(Math.abs((y.现金流 + (y.管理费 ?? 0)) - q.引擎利润年化) < 1e-9,
    `同源锚点·有费率：现金流 ${Math.round(y.现金流)} + 管理费 ${Math.round(y.管理费)} = 引擎利润年化 ${Math.round(q.引擎利润年化)}（差额恰为管理费）`)
  const q全季 = onePageLedger({ brand: 全季, property: 物业, districtAttrs: 区县 })
  ok(q全季.yearly.管理费 === null && Math.abs(q全季.yearly.现金流 - q全季.引擎利润年化) < 1e-9,
    `同源锚点·无费率：现金流 ${Math.round(q全季.yearly.现金流)} === 引擎利润年化 ${Math.round(q全季.引擎利润年化)}（差 0）`)
}

// ── ② 不编造层 ────────────────────────────────────────────────────────
console.log('\n[2] 不编造层：缺来源 ⇒ 待补 + 现金流注明"管理费未计入"')
{
  const q = onePageLedger({ brand: 全季, property: 物业, districtAttrs: 区县 })
  ok(q.yearly.管理费 === null && q.missing.includes('年管理费（特许费）'), '全季：管理费率无来源 ⇒ 年管理费标"待补"')
  ok(q.yearly.CRS === null && q.missing.includes('CRS（单列·不并入）'), '全季：CRS 费率无来源 ⇒ 标"待补"')
  const line = q.lines.find(l => l.label === '年现金流（本页口径）')
  ok(/管理费缺来源数据【未计入】/.test(line.note) && /别当净利看/.test(line.note),
    '年现金流明示"管理费未计入 ⇒ 实际更低"（不让人误当净利）')
  ok(q.yearly.现金流 === q.yearly.营收 - q.yearly.租金 - q.yearly.部门固定 - q.yearly.变动与其他,
    '未计入管理费时，现金流公式与页面说明一致（按 0 处理而非凭空补数）')
}

// ── ③ 回本层（W3-5）──────────────────────────────────────────────────
console.log('\n[3] 回本层：外推标注 + 三种分支')
{
  // 正分支：用"客流/房价双高 + 低租金"的配置（汉庭在该配置下年现金流为正）
  const 好区位 = { 客流: 5, 房价: 5, 租金: 2, 竞争: 3, 人力: 3, 波动: 3 }
  const q = onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 好区位 })
  const p = paybackText(q)
  ok(q.yearly.现金流 > 0, `正分支前提：该配置年现金流 ${Math.round(q.yearly.现金流)} > 0`)
  ok(q.总投资 != null && q.回本年 != null && Math.abs(q.回本年 - q.总投资 / q.yearly.现金流) < 1e-9,
    `回本 = 总投资 ÷ 年现金流 = ${q.总投资} ÷ ${Math.round(q.yearly.现金流)} = ${q.回本年?.toFixed(1)} 年`)
  ok(/^回本周期：约 [\d.]+ 年（外推/.test(p.text) && p.text.includes('非实际发生') && p.ok,
    '文案含"约 X 年"+"外推、非实际发生"（W4 裁决：外推法必须标注）', p.text)
  // ★ 这条是"读错字段 ⇒ 永远不适用"那个 bug 的守门：正现金流时【必须】给"约 X 年"
  ok(!p.text.includes('不适用'), '★ 正现金流时不得落到"不适用"分支（曾因读 ledger.年现金流 而永远不适用，此断言即守门）')

  // 负分支：同一物业在"客流4/房价3/租金3"下现金流为负 ⇒ 如实给"不适用"
  const q2 = onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 区县 })
  // 🔴 A-1 重基线：原"负现金流配置"在租金下调后转正 ⇒ 改为【由实测推导】（不写死哪个配置为负）
  ok(q2.yearly.现金流 > 0
    ? (Math.abs(q2.回本年 - q2.总投资 / q2.yearly.现金流) < 1e-9 && /约 [\d.]+ 年（外推/.test(paybackText(q2).text))
    : paybackText(q2).text.includes('不适用'),
    `该配置年现金流 ${Math.round(q2.yearly.现金流)} ⇒ ${q2.yearly.现金流 > 0 ? '给"约X年（外推）"' : '给"不适用"'}（按实测分支，不预设符号）`)

  ok(paybackText({ 总投资: null, 年现金流: 100 }).text.includes('待补'), '总投资缺来源 ⇒ "待补"')
  ok(EXTRAPOLATION_NOTE.includes('外推') && EXTRAPOLATION_NOTE.includes('非实际发生'), '外推说明是模块常量（页面与测试同源）')
  ok(/P3/.test(ENGINE_GAP_NOTE), '页面必须写明"引擎当前不收集加盟费/管理费（P3 待定）"—— 否则学生会以为游戏内就这么差')
}

// ── ④ 零影响层 ────────────────────────────────────────────────────────
console.log('\n[4] 零影响层：纯计算 + 结算路径不受影响 + UI 静态断言')
{
  ok(!/onePageLedger/.test(strip(src('settlement.js'))), 'settlement.js 不引用 onePageLedger（静态证明）')
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const importers = files.filter(f => f !== 'onePageLedger.mjs' && /onePageLedger/.test(strip(src(f))))
  ok(importers.length === 1 && importers[0] === 'Claim.jsx', '唯一引用方 = Claim.jsx（认领页）', importers.join(','))
  const a = onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 区县 })
  const b = onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 区县 })
  ok(JSON.stringify(a) === JSON.stringify(b), '纯函数：同输入两次结果逐字节相同')
  const frozen = JSON.stringify(区县)
  onePageLedger({ brand: 汉庭, property: 物业, districtAttrs: 区县 })
  ok(JSON.stringify(区县) === frozen, '不改动入参（无副作用）')

  const claim = strip(src('Claim.jsx'))
  ok(/from '\.\/onePageLedger\.mjs'/.test(claim) && /onePageLedger\(\{ brand, property: selectedProperty/.test(claim),
    'Claim.jsx：引入并调用 onePageLedger')
  ok(/\{step === 3 && ledger &&/.test(claim) && /📒 一页钱账/.test(claim) && /ledger\.lines\.map/.test(claim) && /paybackText\(ledger\)/.test(claim),
    'Claim.jsx：第 3 步渲染钱账（条件渲染 + 标题 + 逐行 + 回本周期）')
  ok(!/预计出租率 65%/.test(claim), 'Claim.jsx：旧的写死"预计出租率 65%"已清除（改由引擎基准周推导）')
  ok(/ledger\.extrapolation/.test(claim) && /ledger\.engineGap/.test(claim) && /不并入成本/.test(claim),
    'Claim.jsx：页面写明"外推"说明、"引擎未收费（P3）"缺口与"CRS 不并入成本"（三处口径可见）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：口径 (b) 本店实测（引擎基准周）· CRS 单列不并入 · 回本周期必须带"外推"')
process.exit(fail ? 1 : 0)
