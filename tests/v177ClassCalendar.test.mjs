// V177§3 · 班级教学日历（纯函数）+ 教师端按班徽标接线
// 运行：node tests/v177ClassCalendar.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 班教学日, 班进度, 班徽标, 选默认班 } from '../src/classCalendar.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V177 · 班级教学日历 + 按班徽标')

console.log('\n[① 日历口径（与 tick.mjs classDayNow 一致）]')
{
  ok(班教学日({ start_date: '2026-11-03', teacher_offset_days: 0 }, '2026-11-03') === 1, '开学当天 ⇒ 第 1 天')
  ok(班教学日({ start_date: '2026-11-03', teacher_offset_days: 7 }, '2026-11-03') === 8, 'offset 7 ⇒ 第 8 天（班级独立推进）')
  ok(班教学日({ start_date: '2026-10-28' }, '2026-11-03') === 7, '6 天前开学 ⇒ 第 7 天')
  ok(班教学日({ start_date: null }, '2026-11-03') === 0, '未设 start_date ⇒ 0（未开学）')
  ok(班教学日({}, '2026-11-03') === 0, '空行 ⇒ 0')
  ok(班教学日({ start_date: '2026-10-01' }, '2026-11-03') === 34, '10-01 到 11-03 ⇒ 34（跨月正确）')
}

console.log('\n[② 周/天换算 + 徽标文案]')
{
  const p1 = 班进度({ start_date: '2026-11-03' }, '2026-11-03')
  ok(p1.week === 1 && p1.dayIndex === 1, `第 1 周第 1 天（实得 ${p1.week}/${p1.dayIndex}）`)
  const p8 = 班进度({ start_date: '2026-11-03', teacher_offset_days: 7 }, '2026-11-03')
  ok(p8.week === 2 && p8.dayIndex === 1, `第 8 天 ⇒ 第 2 周第 1 天（实得 ${p8.week}/${p8.dayIndex}）`)
  ok(班徽标({ start_date: '2026-11-03', teacher_offset_days: 7 }, '2026-11-03') === '第 2 周 · 第 1/7 天', '徽标文案含周与天')
  ok(班徽标({}, '2026-11-03') === '未开学', '未开学文案')
}

console.log('\n[④ T3 教师端默认班级选择]')
{
  const 班表 = [
    { class_code: '酒管2401', semester_status: 'archived' },
    { class_code: '彩排-V105', semester_status: 'running' },
  ]
  ok(选默认班(班表, '酒管2401', null) === '彩排-V105', '我的班已归档 + 唯一 running 班 ⇒ 选 running 班（t2024 现场场景）')
  ok(选默认班(班表, '酒管2401', 'all') === '', '上次显式选"全部" ⇒ 保持全部（不自动跳回）')
  ok(选默认班(班表, '酒管2401', '酒管2401') === '酒管2401', '上次选过具体班 ⇒ 用上次的')
  ok(选默认班([{ class_code: 'A班', semester_status: 'running' }, { class_code: 'B班', semester_status: 'running' }], 'A班', null) === 'A班', '多班都在跑 ⇒ 优先我的班')
  ok(选默认班([{ class_code: 'A班', semester_status: 'draft' }], 'A班', null) === 'A班', '只有草稿班 ⇒ 仍回落到我的班（不空白）')
  ok(选默认班([], 'A班', null) === '', '列表为空（一个班都没有）⇒ 全部（不凭空选中不存在的班；取列表失败走 catch 用我的班兜底）')
  ok(选默认班([], '', null) === '', '什么都没有 ⇒ 全部')
}

console.log('\n[⑤ 教师端接线（按班徽标 + 本班行）]')
{
  const ui = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/from '\.\/classCalendar\.mjs'/.test(ui), 'TeacherDashboard import 班徽标（单源日历）')
  ok(/data-class-progress/.test(ui) && /本班：/.test(ui), '班级切换器下有「本班：…」进度行')
  ok(/第\$\{c\.current_week/.test(ui) || /current_week/.test(ui), '每个班标签带周次徽标')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
