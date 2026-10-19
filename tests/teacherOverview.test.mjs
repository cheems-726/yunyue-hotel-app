// V127-#2/#3 · 教师端口径：班级平均口碑（不得二次除 20）+「本周已完成决策」文案
// 运行：node tests/teacherOverview.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 班级平均口碑 } from '../src/teacherMetrics.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ V127-#2/#3 · 教师端口径与文案')

console.log('\n[#2] 班级平均口碑：5 分制直接求平均')
{
  const 组 = [3.5, 3.8, 4.0, 3.4, 3.9, 3.6]
  const avg = 班级平均口碑(组)
  ok(avg === 3.7, `六组 [3.5,3.8,4.0,3.4,3.9,3.6] ⇒ 3.7（实得 ${avg}）`)
  ok(avg >= Math.min(...组) && avg <= Math.max(...组), '班级平均必须落在各组 [min, max] 区间内')
  ok(avg !== 0.1 && avg !== 0.2, '★ 不得等于 0.1 / 0.2（这条直接钉死二次折算）')
  ok(班级平均口碑([]) === null, '无数据 ⇒ null（界面显示 —，不显示 0.0）')
  ok(班级平均口碑([4.2, NaN, null, 3.8]) === 4, '非数值项被忽略（4.2/3.8 ⇒ 4.0）')
  const dash = src('TeacherDashboard.jsx')
  ok(/import \{ 班级平均口碑 \} from '\.\/teacherMetrics\.mjs'/.test(dash), '教师端使用单源口径函数')
  ok(/const avgRating = 班级平均口碑\(withData\.map\(g => g\.rating\)\)/.test(dash), 'avgRating = 班级平均口碑(各组 rating)')
  ok(/avgRating != null \? avgRating\.toFixed\(1\) : '—'/.test(dash), '显示 = avgRating.toFixed(1)（不再 /20）')
  ok(!/avgRating\s*\/\s*20/.test(dash), '★ 教师端不存在 avgRating / 20（二次折算已删）')
}

console.log('\n[#3] 「本周已完成决策」+ 结算后归零说明')
{
  const dash = src('TeacherDashboard.jsx')
  ok(/l: '本周已完成决策'/.test(dash), '标签改为「本周已完成决策」')
  ok(/结算后归零属正常（下周重新计）/.test(dash), '说明行含「结算后归零属正常（下周重新计）」')
  const 命中 = (dash.match(/结算后归零属正常（下周重新计）/g) || []).length
  ok(命中 >= 2, `tooltip 与说明行两处都有（实得 ${命中} 处）`)
  ok(!/'全班已完成决策'/.test(dash), '旧标签「全班已完成决策」已不存在（防回退）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
