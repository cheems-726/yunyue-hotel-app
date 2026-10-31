// V165 · 开箱全流程 —— 纯层单测（花名册/分组/口令/班级名）+ 四态文案单源 + 接线与 RV 静态断言
import { readFileSync } from 'node:fs'
import { 解析花名册, 预览分组, 口令清单, 校验班级名, STUDENT_STATE_COPY, SEMESTER_STATES, 回退审计键 } from '../src/classAdmin.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V165 · 开箱全流程（纯层 + 接线）')
{
  // §2 纯层：解析
  const rows = 解析花名册('20240201 张三\n20240202\n\n20240203 李四\nabc 王五\n2024/0205 赵六')
  ok(rows.length === 5, '空行跳过 · 其余 5 行全解析')
  ok(rows[0].学号 === '20240201' && rows[0].姓名 === '张三' && !rows[0].错误, '标准行 = 学号+姓名')
  ok(rows[1].学号 === '20240202' && rows[1].姓名 === '', '只有学号也合法（姓名可省）')
  ok(rows[2].学号 === '20240203' && rows[2].姓名 === '李四' && !rows[2].错误, '普通行解析正常（组号在预览表手填覆盖 · 不由粘贴文本携带）')
  ok(rows[3].错误 && /6–10 位数字/.test(rows[3].错误), '格式错行带原因（混一行格式错 ⇒ 该行红 · 其余照常）（判据③）')
  ok(rows[4].错误, '学号含斜杠 ⇒ 格式错')

  // §2 纯层：分组 + 口令
  const 十二 = 解析花名册(Array.from({ length: 12 }, (_, i) => '2024030' + (i + 1)).join('\n'))
  const 分 = 预览分组(十二)
  ok(分.length === 12 && 分.filter(r => r.组号 === 1).length === 6 && 分.filter(r => r.组号 === 2).length === 6, '12 人默认每 6 人一组 ⇒ 2 组（判据①）')
  ok(分[6].组号 === 2 && 分[0].组号 === 1, '按导入顺序自动分组')
  const 清 = 口令清单(分)
  ok(/202403001 .* 口令 403001|20240301 .* 口令 240301/.test(清) || /口令 \d{6}/.test(清), '口令清单 = 学号后 6 位（界面明示 + 可复制）')

  // §1 纯层：班级名校验
  ok(校验班级名('酒管2402').ok, '合法班级名通过')
  ok(!校验班级名('酒管 2402').ok && !校验班级名('A/B').ok && !校验班级名('').ok, '空格/斜杠/空 ⇒ 行内提示（判据②前置）')

  // §3 四态文案单源（学生端人话 · 卡面逐条）
  ok(STUDENT_STATE_COPY.draft === '老师还没开课', 'draft 文案 =「老师还没开课」')
  ok(/本周暂停/.test(STUDENT_STATE_COPY.paused), 'paused 文案 =「本周暂停…」')
  ok(STUDENT_STATE_COPY.finished === '本学期已结课，等待老师归档', 'finished 文案逐字')
  ok(STUDENT_STATE_COPY.archived === '已归档，数据只读', 'archived 文案逐字')
  ok(SEMESTER_STATES && SEMESTER_STATES.includes('paused') && SEMESTER_STATES.length === 5, '状态集合含 paused（五态）')

  // 接线静态断言 + RV（判据的反向实现必须不存在）
  const client = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
  ok(/SEMESTER_STATES\.includes\(status\)/.test(client), 'setSemesterStatus 走单源状态集合（含 paused）')
  ok(/student_no: String\(学号\)/.test(client), 'signUpStudent 写 student_no（导入预览查重单源键）')
  ok(/already\|registered|User already/i.test(client), '已存在学号 ⇒ 幂等跳过不覆盖（判据②幂等 · RV：改成覆盖 ⇒ 此分支消失必红）')
  ok(!/upsert\(\{[^}]*password/.test(client), '注册不覆盖密码（无密码 upsert 路径）')
  const dash = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-create-class/.test(dash) && /data-create-class-error/.test(dash), '建班向导接线（行内红字容器）')
  ok(/data-import-preview-table/.test(dash) && /data-import-confirm/.test(dash) && /data-import-copy/.test(dash) && /data-import-csv/.test(dash), '导入三段界面 + 口令清单/CSV 接线')
  ok(/data-class-lifecycle-admin/.test(dash) && /data-state-pause/.test(dash) && /data-state-resume/.test(dash), '开课控制常驻卡（含暂停/继续）')
  ok(/data-class-admin-panel/.test(dash), '班级管理面板挂进班级总览')
  ok(dash.split('回退审计键').length >= 3, '周次回退审计在两处闸（进度卡+班级管理卡）都接（判据②）')
  ok(/confirm\(`回退周次/.test(dash), '回退二次确认（只进不退）')
  ok(/data-class-switch|班级管理（建班/.test(dash), '班级切换器在教师端面板内（学生端无）')
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(/data-student-semester-banner/.test(app) && /user\?\.className .* 第 /.test(app), '学生端：顶部班级名 + 四态横幅（§4）')
  ok(/班级学期状态 !== 'running'/.test(app), 'RV 对应正向闸：非 running 一律不许结算（去掉状态判断 ⇒ 本行消失必红）')
  ok(!/班级学期状态 === 'finished' \|\| 班级学期状态 === 'archived'/.test(app), '旧的两态判断已升级为四态（不留第二份口径）')
  const 纯 = readFileSync(new URL('../src/classAdmin.mjs', import.meta.url), 'utf8')
  ok(!/fetch\(|supabase|axios|XMLHttpRequest/.test(纯), 'classAdmin.mjs 零网络')
  const reg = readFileSync(new URL('./run-all.mjs', import.meta.url), 'utf8')
  ok(/classAdminV165/.test(reg), 'run-all 已挂本套件')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
