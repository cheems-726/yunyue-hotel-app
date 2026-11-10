// D366 · 教师端分母统一 9（课堂模式），18 只在深度模式折叠显示
// 运行：node tests/teacherDenom.test.mjs   （挂 run-all fast）
//
// 判据（卡 §四）：
//   ① 教师端主数字用 9（与学生端一致）
//   ② 深度 18 存在于折叠区（data-deep-denom）
//   ③ 反向判据：把主数字写回 18 ⇒ 本套件必红
//   ④ classAlerts 的显示分母也走 9，且 课堂节奏 暴露「目标数」
import { readFileSync } from 'node:fs'
import { 课堂节奏, 课堂告警, 阈值 } from '../src/classAlerts.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const app = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')

console.log('▶ D366 · 教师端 9 口径')

console.log('\n[① 主数字 = 9]')
{
  ok(/\{weekDecisions\} \/ 9</.test(app), '组卡主数字渲染为 {weekDecisions} / 9')
  ok(!/\{weekDecisions\} \/ 18</.test(app), '主数字不再是 / 18（反向判据：写回 18 本行必红）')
  ok(/本周决策完成度/.test(app), '标签「本周决策完成度」保留')
  ok(/weekDecisions >= 9/.test(app), '进度条判据用 9（>= 9 视为完成）')
}

console.log('\n[② 深度 18 折叠]')
{
  ok(/data-deep-denom/.test(app), '存在折叠容器 data-deep-denom')
  ok(/深度模式 \{weekDecisions\} \/ 18/.test(app), '折叠区显示「深度模式 x / 18」')
  const i9 = app.indexOf('{weekDecisions} / 9')
  const i18 = app.indexOf('深度模式 {weekDecisions} / 18')
  ok(i9 > 0 && i18 > i9, '18 出现在 9 之后（主数字在前、解释在后）')
}

console.log('\n[③ 其它教师端口径同步]')
{
  ok(/组数 × 9 项/.test(app), '总览「本周已完成决策」分母说明改 9')
  ok(/\$\{本班组数 \* 9\}/.test(app), '总览分母 = 本班组数 × 9（班级隔离：分母不许混入他班）')
  ok(/\/ 9 项`/.test(app), '人均完成显示 / 9 项')
}

console.log('\n[④ classAlerts 显示口径]')
{
  ok(阈值.课堂目标数 === 9, '阈值.课堂目标数 = 9')
  const 节 = 课堂节奏({ groups: [{ state: { doneDecisions: { a: 1 } } }], dayIndex: 1, 当前周: 1 })
  ok(节.目标数 === 9, '课堂节奏 暴露 目标数=9')
  const alerts = 课堂告警({ groups: [{ uid: 'u1', state: { doneDecisions: {} } }], dayIndex: 5, 当前周: 1, 组名映射: { u1: '第1组' } })
  const a1 = alerts.find(a => a.id === 'A1')
  ok(!!a1 && /0\/9/.test(a1.详情), 'A1 文案分母是 9（不再 0/18）', a1 && a1.详情)
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
