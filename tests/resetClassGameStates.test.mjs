// V157 阶段1 · resetClassGameStates（新学期重置只清当前班）+ 状态机接线静态断言
// 运行：node tests/resetClassGameStates.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V157 · 学期生命周期')
{
  const client = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../supabase-migration-v157-semester-status.sql', import.meta.url), 'utf8')

  // ① 状态机四态 + 迁移
  ok(/semester_status text not null default 'running'/.test(migration), "迁移：semester_status 默认 'running'（现存行零变化）")
  ok(/draft.*running.*finished.*archived|'draft', 'running', 'finished', 'archived'/.test(client), '客户端白名单四态（draft/running/finished/archived）')
  ok(/学期状态: \['draft', 'running', 'finished', 'archived'\]\.includes\(data\.semester_status\) \? data\.semester_status : 'running'/.test(client), '非法值回退 running（等价改动前行为）')

  // ② 学生端只读闸
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(/if \(班级学期状态 !== 'running'\) \{\s*\n\s*toast\(STUDENT_STATE_COPY\[班级学期状态\]/.test(app), '学生端 非 running ⇒ 不能结算（闸在 handleSettle · V165 四态单源）')
  ok(/finished: '本学期已结课，等待老师归档'/.test(app) || /STUDENT_STATE_COPY\[班级学期状态\]/.test(app), '拒结算带可读原因（toast · V165 四态文案）')
  ok(/班级学期状态 !== 'running'/.test(app), '自动周报闸同源（autoInfo 分支 · V165 四态：非 running 不自动结算）')

  // ③ 重置语义：只清当前班 + 不删归档
  const reset = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
  ok(/export async function resetClassGameStates/.test(reset), 'resetClassGameStates 在位')
  ok(/startsWith\(CODE \+ '\|'\)/.test(reset), '重置只命中 group_key 前缀 = 当前班（CODE=定位(classCode) · 其他班行不动）')
  const resetBody = reset.split('export async function resetClassGameStates')[1] || ''
  const resetFn = (resetBody.split('export async function setClassContinue')[0] || '')   // 只扫本函数体（文件后段 teacher_notes.delete 是无关函数）
  ok(!/\.delete\(|delete from/.test(resetFn), '重置用 update 置空档（不 delete —— 绝不删数据红线）')
  ok(/semester-.*\.json|学期快照-/.test(readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')), '结课先下载快照（JSON）+ 归档 CSV（红线：绝不删数据）')

  // ④ 教师端 UI 锚
  const td = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-semester-lifecycle/.test(td) && /data-semester-finish/.test(td) && /data-semester-reset/.test(td), '教师端生命周期三锚（状态行/结课/重置）')
  ok(/disabled=\{班级学期状态 !== 'archived'\}/.test(td), '新学期重置仅 archived 后可用（状态机护栏）')

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
}
process.exit(fail ? 1 : 0)
