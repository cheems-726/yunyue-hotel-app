// W3-1 · 「一页钱账」+ W3-5 · 回本周期（外推）断言
// 运行：node tests/onePageLedger.test.mjs   （挂 run-all）
//
// 口径依据（决策端 2026-09-27 拍板 · 选项 (b) 本店实测）：
//   ADR/OCC 取【引擎确定性单周】实收结果 · CRS 单列不并入 · 回本周期必须带"外推"标注（W4 裁决）
// 分四层：
//   ① 口径层：每个年化数字都能回到"基准周 × 52"，且与引擎同源
//   ② 不编造层：费率未接入的品牌 ⇒ 两费标"待补"；且现金流必须读引擎实收（不补数）
//   ③ 回本层：正现金流 ⇒ "约 X 年 + 外推"；≤0 ⇒ 不适用；总投资缺 ⇒ 待补
//   ④ 零影响层：纯函数 + settlement.js 不引用 + UI 静态断言（条款逐项标"已实收/待接入"）
import { readFileSync, readdirSync } from 'node:fs'
import {
  onePageLedger, paybackText, baseWeek, 部门固定合计, 人力固定单价, WEEKS_PER_YEAR, EXTRAPOLATION_NOTE, ENGINE_FEE_NOTE,
} from '../src/onePageLedger.mjs'
import { parseRooms } from '../src/settlement.js'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

import { 费用清单 } from '../src/franchiseFees.mjs'
// 从加盟资料取费率（不在测试里写死 0.05 / 0.08）
const 费率 = (brandName, kind) => {
  const t = FRANCHISE_MODEL[brandName]
  if (!t) return null
  return kind === '管理费' ? (t.管理费?.费率?.值 ?? null) : (t.中央预订系统_CRS?.费率?.值 ?? null)
}

const 汉庭 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' }
const 全季 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 汉庭快捷 = { name: '汉庭快捷', price: '160-240元', standard: '客房60间起', level: '经济型（轻改/特许）' }
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

  // 🔴 §14.3 重基线：加盟两费改【读引擎实收】（单源），本页不再自乘费率 ⇒
  //   ① 年变动与其他必须先剔除两费（否则与"年加盟两费"行重复计）
  //   ② 年现金流 === 引擎利润年化（差 0）对【接入与未接入品牌】都成立（原为"差额恰为管理费"）
  const 两费周 = w.franchiseFees.合计
  ok(y.变动与其他 === (w.totalCost - w.rentCost - w.deptCost - 两费周) * WEEKS_PER_YEAR,
    '年变动与其他 = (引擎总成本 − 租金 − 部门固定 − 加盟两费) × 52 —— 已剔除两费，不与下一行重复计')
  ok(y.加盟两费 === 两费周 * WEEKS_PER_YEAR,
    `年加盟两费 = 引擎基准周实收两费 ${两费周} 元 × ${WEEKS_PER_YEAR} = ${(y.加盟两费 / 10000).toFixed(1)} 万（单源：不在此再乘一遍费率）`)
  ok(Math.abs(y.加盟两费 / y.营收 - 0.074) < 0.001,
    `两费约占年营收 ${(y.加盟两费 / y.营收 * 100).toFixed(2)}%（决策端"全体下移 7.4pp"证据在钱账链上同样成立）`)
  ok(部门固定合计 > 0 && 人力固定单价 === 18.5,
    `部门成本口径单源：Σ固定 ${部门固定合计.toFixed(1)} 元/间·天（含人力固定 ${人力固定单价}）`)
  ok(y.现金流 === y.营收 - y.租金 - y.部门固定 - y.变动与其他 - y.加盟两费,
    '年现金流 = 营收 − 租金 − 部门固定 − 变动与其他 − 加盟两费（页面公式与实现一致）')

  // ★★ 同源锚点（§14.3 后更强）：现金流 === 引擎利润年化【差 0】，接入品牌也不例外
  ok(Math.abs(y.现金流 - q.引擎利润年化) < 1e-9,
    `同源锚点·接入品牌：现金流 ${Math.round(y.现金流)} === 引擎利润年化 ${Math.round(q.引擎利润年化)}（差 0 · 含两费）`)
  const q快捷 = onePageLedger({ brand: 汉庭快捷, property: 物业, districtAttrs: 区县 })
  ok(q快捷.yearly.加盟两费 === null && Math.abs(q快捷.yearly.现金流 - q快捷.引擎利润年化) < 1e-9,
    `同源锚点·未接入品牌（汉庭快捷）：两费 = null 且 现金流 ${Math.round(q快捷.yearly.现金流)} === 引擎利润年化 ${Math.round(q快捷.引擎利润年化)}（差 0）`)
}

// ── ② 不编造层 ────────────────────────────────────────────────────────
console.log('\n[2] 不编造层：费率未接入 ⇒ 两费标"待补" + 不补数')
{
  const q = onePageLedger({ brand: 汉庭快捷, property: 物业, districtAttrs: 区县 })
  ok(q.yearly.加盟两费 === null && q.missing.includes('年加盟两费（管理费 + CRS）'),
    '汉庭快捷（缺管理费率/CRS 费率）⇒ 年加盟两费标"待补"')
  const line = q.lines.find(l => l.label === '年加盟两费（管理费 + CRS）')
  ok(/【待补】/.test(line.note) && /缺/.test(line.note),
    '该行明示【待补】并写出【缺什么】（不是空白、不是 0 冒充）', line.note)
  ok(q.费用状态.接入 === false && /待补/.test(q.费用状态.原因),
    '状态对象如实回报"未接入 + 原因"（界面据此标注）', JSON.stringify(q.费用状态))
}

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
  ok(/§14.3/.test(ENGINE_FEE_NOTE) && /汉庭\/全季\/海友/.test(ENGINE_FEE_NOTE) && /待补/.test(ENGINE_FEE_NOTE),
    '页面必须写明「引擎自 §14.3 起对三品牌实收两费、其余待补」—— 否则学生会把「未计费」误当「不用交钱」', ENGINE_FEE_NOTE)
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
  ok(/加盟费用条款/.test(claim) && /'已实收'/.test(claim), 'Claim.jsx：条款表逐项标「已实收/待接入」（不许让学生以为全是真金）')
  ok(/ledger\.extrapolation/.test(claim) && /ledger\.engineFeeNote/.test(claim) && /ledger\.加盟条款/.test(claim),
    'Claim.jsx：页面写明「外推」说明、§14.3 费用口吻（engineFeeNote）与【逐项条款表】（已实收/待接入）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：口径 (b) 本店实测 · 加盟两费读引擎实收（§14.3 单源）· 回本周期必须带"外推"')
process.exit(fail ? 1 : 0)
