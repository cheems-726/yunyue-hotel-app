// V115-② 接线可见性：5 条死导出不是"改成 export 就完"，必须在**界面代码里真的被渲染**
//   反例 RV：把任一处渲染行删掉（只留 import）⇒ 本套件红。
import { readFileSync } from 'node:fs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }
const 读 = (f) => readFileSync('src/' + f, 'utf8')

// B-12 缺数据文案 → Claim 第 3 步
{
  const s = 读('Claim.jsx')
  ok(/from '\.\/investReturn\.mjs'/.test(s) && /缺数据文案/.test(s), 'B-12 缺数据文案：Claim 引入')
  ok(/\$\{缺数据文案\}/.test(s), 'B-12 缺数据文案：**渲染进文案**（不是只 import）')
}
// B-13 未核实项 → 证照页尾
{
  const s = 读('Establishment.jsx')
  ok(/未核实项/.test(s) && /unclear/.test('unclear'), 'B-13 未核实项：Establishment 引入')
  ok(/未核实（只给官方公示入口/.test(s) && /未核实项\.join/.test(s), 'B-13 未核实项：**拼进证照页尾文案**')
}
// B-14/15 接入范围 + 半接入 → 选品牌页
{
  const s = 读('BrandSelection.jsx')
  ok(/接入范围说明/.test(s) && /半接入说明/.test(s), 'B-14/15：BrandSelection 引入两条说明')
  ok(/\{接入范围说明\}/.test(s) && /\{半接入说明\}/.test(s), 'B-14/15：**两条都真的渲染**（展示有数 ≠ 引擎计费 · D313）')
}
// B-16 报告口径注 + 周标签 → 教师经营报告
{
  const s = 读('TeacherReport.jsx')
  ok(/报告口径注/.test(s) && /周标签/.test(s), 'B-16：TeacherReport 引入')
  ok(/\{报告口径注\.净利率\}/.test(s), 'B-16：**口径注渲染在报告里**')
  ok(/\{周标签\(r\.week\)\}/.test(s), 'B-16：**逐周表用 周标签()**（不再手写"第 N 周"）')
}

// B-15b 半接入必备字段（V116-P0-3：审计端点名处置 ⇒ 做成真断言）
{
  const fm = readFileSync('src/franchiseModel.mjs', 'utf8')
  ok(/半接入必备字段/.test(fm), '半接入必备字段 仍在单源里（口径表）')
  // 用它断言：半接入品牌**必须有造价 + 门槛，且不得有费率字段**（缺就是缺，不许编）
  const { FRANCHISE_MODEL } = await import('../src/franchiseModel.mjs')
  const { 半接入必备字段, 半接入禁止字段 } = await import('../src/franchiseModel.mjs')
  const 半 = Object.entries(FRANCHISE_MODEL).filter(([, t]) => t && t.单房造价 && !t.管理费 && !t.中央预订系统_CRS)
  ok(半.length >= 3, )
  for (const [名, t] of 半) {
    ok(!!t[半接入必备字段.造价], )
    ok(!!t[半接入必备字段.门槛], )
    for (const 禁 of 半接入禁止字段) ok(!(禁 in t), )
  }
}

console.log('══ V115-② 接线可见性（5 条）══')
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
