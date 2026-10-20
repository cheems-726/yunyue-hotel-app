// V131 §2 · 老师端推进一周（不跳周 · 第 7 天才可进下一周）
// 运行：node tests/advanceWeek.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 推进目标, 本周第几天, 推进后周次 } from '../src/advanceWeek.mjs'
import { dayToWeekDay } from '../src/weeklyAuto.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V131 §2 · 推进一周')

console.log('\n[①] 本周第几天')
{
  ok(本周第几天(1) === 1 && 本周第几天(7) === 7, '第 1 天 ⇒ 1 / 第 7 天 ⇒ 7')
  ok(本周第几天(8) === 1 && 本周第几天(14) === 7, '第 8 天 ⇒ 第 2 周第 1 天 / 第 14 天 ⇒ 第 7 天')
  ok(本周第几天(0) === 1 && 本周第几天(null) === 1, '非法值归到第 1 天（不 NaN）')
}

console.log('\n[②] 推进到本周结束：精确落在第 7 天（不是 +7）')
{
  const a = 推进目标(1, '本周结束')
  ok(a.可执行 && a.目标 === 7 && a.增量 === 6, `第 1 天 ⇒ 第 7 天（实得 +${a.增量} → ${a.目标}）`)
  const b = 推进目标(3, '本周结束')
  ok(b.目标 === 7 && b.增量 === 4, '第 3 天 ⇒ +4（不是 +7）')
  const c = 推进目标(7, '本周结束')
  ok(c.可执行 === false && c.目标 === 7, '已在第 7 天 ⇒ 不再推')
  ok(dayToWeekDay(a.目标).week === dayToWeekDay(1).week, '推完仍在同一周（不跨周）')
}

console.log('\n[③] 进入下一周：只在第 7 天可用')
{
  const a = 推进目标(7, '下一周')
  ok(a.可执行 && a.目标 === 8 && a.增量 === 1, '第 7 天 ⇒ 第 8 天（下周第 1 天）')
  ok(dayToWeekDay(8).week === 2, '第 8 天 = 第 2 周')
  const b = 推进目标(3, '下一周')
  ok(b.可执行 === false && /不许跳周|第 7 天/.test(b.原因), '第 3 天点「下一周」⇒ 拒绝（不许跳周）')
  ok(推进目标(14, '下一周').目标 === 15, '第 2 周第 7 天 ⇒ 第 15 天（第 3 周第 1 天）')
}

console.log('\n[④] 周次连续：1→7→8→14→15（1,1,2,2,3）')
{
  const 序 = [1]
  for (const 模式 of ['本周结束', '下一周', '本周结束', '下一周']) 序.push(推进目标(序[序.length - 1], 模式).目标)
  const 周s = 序.map(d => dayToWeekDay(d).week)
  ok(JSON.stringify(序) === JSON.stringify([1, 7, 8, 14, 15]), `天序 1/7/8/14/15（实得 ${序.join('/')}）`)
  ok(JSON.stringify(周s) === JSON.stringify([1, 1, 2, 2, 3]), `周次 1/1/2/2/3（实得 ${周s.join('/')}）`)
  ok(周s.every((w, i) => i === 0 || w === 周s[i - 1] || w === 周s[i - 1] + 1), '★ 周次只允许"不变或 +1"（无跳周）')
  const r = 推进后周次(3, '本周结束')
  ok(r.从 === 1 && r.到 === 1, '第 3 天推到周末 ⇒ 周次不变')
}

console.log('\n[⑤] 接线（静态）：两个按钮 + 只写 teacher_offset_days')
{
  const td = readFileSync('src/TeacherDashboard.jsx', 'utf8')
  ok(/推进到本周结束（结算）/.test(td) && /进入下一周（第 7 天可用）/.test(td), '教师端两个按钮在位')
  ok(/推进目标\(classDay, '本周结束'\)/.test(td) && /推进目标\(classDay, '下一周'\)/.test(td), '按钮用纯函数算目标（不直接 +7）')
  ok(/advanceClassOffset\(t\.增量\)/.test(td), '写库走 advanceClassOffset')
  const sc = readFileSync('src/supabaseClient.js', 'utf8')
  ok(/update\(\{ teacher_offset_days: next \}\)/.test(sc), '只写 teacher_offset_days')
  ok(/RLS 限教师/.test(sc), '注释写明 RLS（学生 JWT 应 403/42501）')
  ok(/r\.code === '42501'/.test(td), '403/42501 有明确提示（无权限）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
