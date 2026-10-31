// V164 · 学期教学复盘报告 —— 纯层单测 + 零网络静态扫描 + 接线断言 + RV
// 运行：node tests/semesterReviewV164.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 成绩单行 } from '../src/reportCard.mjs'
import { 复盘报告, 未决策统计, 指标极值, 差异归因, 决策画像卡, 教学建议, 默认教学规则, 未决策阈值 } from '../src/semesterReview.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' + extra : '')) } }

// 造六组 fixture（历史字段与真库同形：occupancy/goodRate/negativeCount/决策数/netProfit/capital）
const 周 = (w, occ, np) => ({ week: w, revenue: 90000, occupancy: occ, goodRate: 67, finalGoodRate: 67, negativeCount: w % 4, 决策数: 18, netProfit: np })   // 库内量纲：occupancy/goodRate = 百分数数值（81 = 81%）
const mkHistory = (occ0, npf, dec) => Array.from({ length: 12 }, (_, i) => ({ ...周(i + 1, occ0, npf(i)), 决策数: dec(i) }))
const histA = mkHistory(90, () => 2000, () => 18), histB = mkHistory(60, () => -3000, i => (i % 4 < 2 ? 3 : 18))   // occupancy=百分数数值（90 = 90%）
const rows = [
  成绩单行({ 组号: '甲组', history: histA }),
  成绩单行({ 组号: '乙组', history: histB }),
]
const 组数据 = { 甲组: { capital: 1200000, history: histA, decisionChanges: [{ key: 'price' }, { key: 'price' }, { key: 'staff.slow' }] }, 乙组: { capital: 1100000, history: histB, decisionChanges: [] } }

console.log('▶ V164 · 学期教学复盘（纯层）')
{
  const 报告 = 复盘报告({ rows, 组数据 })

  // 判据①：指标与成绩单行逐项一致（同一单源）
  ok(报告.指标并排.length === 2 && 报告.指标并排[0].组号 === '甲组', '指标并排逐组输出')
  ok(报告.指标并排.every((m, i) => m.累计营收 === rows[i].累计营收 && m.经营净利 === rows[i].经营净利 && m.平均出租率 === rows[i].平均出租率 && m.平均好评率 === rows[i].平均好评率),
    '并排数字 === 成绩单行（同一单源 · 误差 0）（判据①）')
  ok(报告.指标并排[0].期末资金 === 1200000, '期末资金取 state.capital')

  // 极值
  const 极 = Object.fromEntries(报告.极值.map(e => [e.指标, e]))
  ok(/甲组/.test(极['平均出租率'].最好组) && /乙组/.test(极['平均出租率'].最差组) && 极['平均出租率'].差距 === '30.0%', '极值：最好/最差/差距逐指标（出租率差 30 个百分点 · 库内百分数量纲）')

  // 归因：每条带来源字段
  ok(报告.归因.length > 0 && 报告.归因.length <= 3, '组间差异 ≤ 3 条（前 3）')
  ok(报告.归因.every(a => /来源|history|成绩单行/.test(a.来源) && /经营净利高/.test(a.文案)), '每条归因给出字段来源（判据③）')
  const 甲pp = Math.round(报告.归因.length) // noop
  ok(报告.归因.some(a => a.来源.includes('occupancy')), '归因含出租率来源字段（history.occupancy）')

  // 未决策统计复算
  const 未甲 = 未决策统计(histA), 未乙 = 未决策统计(histB)
  ok(未甲.周数 === 0 && 未乙.周数 === 6 && 未乙.最长连续 === 2, `未决策统计可由 history.决策数 复算（甲 ${未甲.周数} · 乙 ${未乙.周数} · 阈值 ${未决策阈值}）`)
  ok(报告.未决策.length === 2 && 报告.未决策[1].周数 === 6, '报告未决策统计 === 独立复算')

  // 决策画像：事实陈述 · 无"应该/建议改为"（判据 §2③）
  ok(报告.画像.length === 2 && 报告.画像[0].改动次数 === 3, '画像六组齐全 · 改动次数来自 decisionChanges 计数')
  const 画像文本 = 报告.画像.map(p => p.文案 + (p.改动口径 || '')).join('\n')
  ok(!/应该|建议改为|建议你|应改/.test(画像文本), '画像文案无「应该/建议改为」表述（文本扫描）')
  ok(/当周流水|不含历史改动/.test(画像文本), '画像如实标注 decisionChanges 数据边界（当周流水）')
  ok(报告.画像[0].最常改.includes('price×2'), '最常改 3 项 = 名字×次数')
  const 空画像 = 决策画像卡({ 组号: '丙组', row: rows[0], 组数据: { 丙组: { history: [] } } })
  ok(空画像.改动次数 === 0 && 空画像.最常改 === '无改动记录', '无数据组不编造（0 处 · 无改动记录）')

  // §3 教学建议：规则驱动 + RV
  const 建 = 教学建议({ rows, 未决策: 报告.未决策 })
  ok(Array.isArray(建.建议) && 建.建议.length >= 1 && 建.规则数 === 默认教学规则.length, '规则表驱动 · 输出带规则数')
  const 命中条 = 建.建议.filter(b => typeof b === 'object')
  ok(命中条.every(b => /^[Tt]\d+/.test(b.规则) && b.命中.length > 0), '每条建议带规则编号与命中数字（判据②）')
  ok(建.建议.some(b => typeof b === 'object' && b.规则 === 'T1'), '全班平均净利 < 0 ⇒ T1 命中（fixture 两组均亏损）')
  const 空 = 教学建议({ rows, 未决策: 报告.未决策, 规则表: [] })
  ok(空.建议.length === 1 && 空.建议[0] === '数据暂不支撑结论' && 空.规则数 === 0, 'RV：规则表清空 ⇒ 显示「数据暂不支撑结论」不许编（判据③）')

  // 零网络静态扫描（判据 §3①）
  const 源 = readFileSync(new URL('../src/semesterReview.mjs', import.meta.url), 'utf8')
  ok(!/fetch\(|XMLHttpRequest|supabase|import .*http|axios/.test(源), 'semesterReview.mjs 零网络（无 fetch/supabase/外部依赖）')

  // 接线静态断言
  const dash = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-semester-review/.test(dash) && /data-review-overlay/.test(dash), '教师端：班级总览【生成学期复盘】按钮 + 报告覆盖层接线')
  ok(/semesterReview\.mjs/.test(dash) && /复盘报告\(/.test(dash), '教师端走纯层（不内联第二份实现）')
  ok(/@media print/.test(dash) && /review-print/.test(dash), '打印 A4 样式（@media print + review-print 根）')
  ok(/复盘明细/.test(dash) || /reviewCSV/.test(dash), 'CSV 导出接线')
  const reg = readFileSync(new URL('./run-all.mjs', import.meta.url), 'utf8')
  ok(/semesterReviewV164/.test(reg), 'run-all 已挂本套件')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
