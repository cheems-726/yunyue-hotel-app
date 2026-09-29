// §22.3-C2/C4/C5 · 需求缺口界面断言（C3 数据面在 operatorLog.test.mjs）
// 运行：node tests/gapUI.test.mjs   （挂 run-all fast）
//
// C2：组内认领职位 → 决策按职位归属可见（TeacherDashboard 职责明细已存在 + operatorLog 职位单源）
// C4：老师可查每人操作（GroupDetail 新增"每人操作记录"块 · operatorLog.按人聚合 单源）
// C5：教师批注打分（UI 已存在）★ D1 已定"教师打分不进成绩" ⇒ 机器断言钉住【不进成绩】
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ §22.3-C2/C4/C5 需求缺口界面断言')

console.log('\n[C2] 职位分工：决策按职位归属可见（owner 单源 + 职责明细在位）')
{
  const dash = src('TeacherDashboard.jsx')
  ok(/职责决策完成明细/.test(dash), '教师端「职责决策完成明细」块在位（按组内职业展开）')
  ok(/d\.owner/.test(dash) && /role_in_group/.test(dash), '职位归属读 decisions.owner ↔ 组员 role_in_group（单源映射，无第二份职位表）')
  ok(src('operatorLog.mjs').includes('OWNER_LABELS'), 'operatorLog 从 decisions.OWNER_LABELS 取职位（C2/C3 同一单源）')
}

console.log('\n[C4] 老师可查每人操作：按人视图 + 单源聚合')
{
  const dash = strip(src('TeacherDashboard.jsx'))
  ok(/每人操作记录/.test(dash), '教师端「每人操作记录」块在位')
  ok(/按人聚合/.test(dash) && /operatorLog\.mjs/.test(src('TeacherDashboard.jsx')), '聚合数据面 = operatorLog.按人聚合（单源，不在界面重写一份）')
  ok(/operatorLogs/.test(dash), '读存档 operatorLogs（C3 落盘的数据）')
  ok(/未记录/.test(dash), '旧档/未登录如实标"未记录"（不编人名）')
  ok(!/setOperatorLogs/.test(dash), '教师端只读（不产生操作记录 —— 那是学生提交决策时的事）')
  const app = src('App.jsx')
  ok(/记录一条\(/.test(app) && /setOperatorLogs/.test(app), '学生端提交决策时产生记录（App.jsx 接线）')
  ok(/operatorLogs, repo/.test(app) && /operatorLogs, report/.test(app), '记录随存档持久化（本地 + 云端双路）')
}

console.log('\n[C5] 教师批注打分：可存可查 + ★ 明示"不进成绩"（D1）')
{
  const dash = strip(src('TeacherDashboard.jsx'))
  ok(/TeacherNoteForm/.test(dash) && /saveTeacherNote/.test(dash), '批注表单在位且走 saveTeacherNote（可存）')
  ok(/不计入评分/.test(dash), '表单标题明示「不计入评分」（D1 的界面呈现）')
  // ★ 机器钉死"不进成绩"：scoreOf（评分公式）里不得引用教师批注/打分
  const md = strip(src('metricDefs.mjs'))
  ok(!/teacherNote|saveTeacherNote|教师批注|打分/.test(md), '★ metricDefs（评分单源）不含任何教师批注/打分引用（D1：不进成绩）')
  const fr = strip(src('FinalResult.jsx'))
  ok(/teacherNote/.test(fr), '成绩单引用教师批注（可查）')
  // 批注分数与四维评分解耦：FinalResult 的四维分值来源不含 teacherNote
  ok(!/teacherNote.*scoreOf|scoreOf.*teacherNote/.test(fr), '成绩页四维评分（scoreOf）与教师批注互不引用（结构解耦）')
  // 云端写入路径：批注存 teacher_notes 表（独立于成绩），不写进 game_states
  const sc = src('supabaseClient.js')
  ok(/saveTeacherNote/.test(sc) && !/game_states/.test((sc.match(/export async function saveTeacherNote[\s\S]{0,600}/) || [''])[0]),
    '批注写独立通道（teacher_notes），不混入经营存档')
}

// ── [C6] 多城市数据：引擎画像 vs 参考资料（结论：引擎已超越，无需回录）─────────
console.log('\n[C6] 多城市数据：引擎 26 区画像已覆盖参考资料的权威数据（无需回录）')
{
  // 核对参考资料的"高价值新增"在引擎里的对应格（广汉 62.8 万人口 / 三星堆 608 万 / 围场 42.37 万等）
  const w = strip(src('siteLocations.mjs'))
  ok(/广汉市2025统计公报/.test(w) && /三星堆/.test(w), '广汉：公报人口 + 三星堆游客（≥参考资料 §1.2 的权威值）')
  ok(/沙坪坝区2025公报/.test(w), '沙坪坝：区政府官网 PDF 原件（conf=high，比参考资料更权威）')
  ok(/渝中区2024统计公报/.test(w) && /江北区2024统计公报/.test(w), '重庆解放碑/观音桥：区级公报（口径=行政区，比攻略类价格更权威）')
  // 参考资料的【无源数据】不许回填：五洲广场 3.45 万客流（2020 招商资料，选址任务已删）
  ok(!/34,500|3\.45万/.test(w), '★ 五洲广场"日均 3.45 万客流"保持不录（无公开统计 · 选址任务已判删 —— 参考资料自己也标了 🟡 中可信度）')
}



console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：C2 职责可见 · C4 按人可查 · C5 批注可存可查且明示不进成绩（D1）')
process.exit(fail ? 1 : 0)