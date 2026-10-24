// V152 §2 · 续营 12 周（班级开关默认关 · 学期成果以【前 12 周】为准）
// 运行：node tests/v152Continue.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 下一周状态 } from '../src/weekRollover.mjs'
import { fetchClassState } from '../src/supabaseClient.js'
import { 学期成果 } from '../src/semesterResult.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V152 · 续营 12 周')
{
  // ① 周上限：默认 12（开关关）；开启 + 学生已续营 ⇒ 24
  const mk12 = (n) => Array.from({ length: n }, (_, i) => ({ week: i + 1, profit: 0, netProfit: 0, revenue: 1, occupancy: 60, finalGoodRate: 70 }))
  const h12 = mk12(12)
  const a = 下一周状态({ history: h12, report: null, week: 12 })
  ok(a.finished === true && a.week === 12, '默认（开关关）：第 12 周结算后即结业（学期口径不变）')
  const b = 下一周状态({ history: h12, report: null, week: 12, 总周数: 24 })
  ok(b.finished === false && b.week === 13, '开启 + 已续营：第 12 周后进入第 13 周（不结业）')
  const h24 = mk12(24).map((h, i) => ({ ...h, week: i + 1 }))
  const c = 下一周状态({ history: h24, report: null, week: 24, 总周数: 24 })
  ok(c.finished === true && c.week === 24, '续营上限 = 24 周（到第 24 周结算后结业）')
  const d = 下一周状态({ history: h24, report: null, week: 24 })
  ok(d.finished === true && d.week === 24, '总周数缺省仍 12 ⇒ 老调用方逐字节不变')
  // 周次连续：13→24 每步 +1（history 不断档）
  let 周 = 13, hist = [...h12], 连续 = true
  for (; 周 <= 24; 周++) {
    hist = [...hist, { week: 周, profit: 0, netProfit: 0, revenue: 1, occupancy: 60, finalGoodRate: 70 }]
    const st = 下一周状态({ history: hist, report: null, week: 周, 总周数: 24 })
    if (周 < 24 && (st.finished || st.week !== 周 + 1)) 连续 = false
  }
  ok(连续, '13–24 周逐周推进连续（不跳周）')
}

console.log('\n[开关默认关 · 读取口径]')
{
  // fetchClassState 只在 continue_enabled === true 时返回开（迁移未应用 ⇒ undefined ⇒ false）
  ok(/data\.continue_enabled === true/.test(readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')),
    '客户端读取：continue_enabled === true 才算开（缺列/未迁移 ⇒ 如实回退关）')
  ok(/export async function setClassContinue/.test(readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')),
    '教师写入口 setClassContinue 在位（RLS 限教师 · class_state 同通道）')
  ok(readFileSync(new URL('../supabase-migration-v152-continue.sql', import.meta.url), 'utf8').includes('continue_enabled boolean not null default false'),
    '迁移：新列默认 false（默认关 · 判据① RV 锚：把默认改 true ⇒ 此断言红）')
  ok(fetchClassState instanceof Function, 'fetchClassState 可导入（学生端开关来源）')
}

console.log('\n[前 12 周成果不被覆盖 · App 接线]')
{
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(/总周数: \(班级续营开关 && 续营\) \? 24 : 12/.test(app), 'App：进入下一周的周上限 = 开关 && 学生已续营 ? 24 : 12')
  ok(/data-semester-result-entry/.test(app), 'App：成果页入口锚在位（结业屏 + 我的页）')
  ok(/setWeek\(13\)/.test(app), 'App：点「继续经营」⇒ 进入第 13 周（不清 history）')
  ok(/游戏记录, 续营, \.\.\.\(pendingPenalty/.test(app.replace(/\s+/g, ' ')) || /游戏记录, 续营,/.test(app), '存档带 游戏记录/续营（换设备不丢）')
  // 学期成果前 12 周不被续营覆盖（同 semesterResult 但在这里对总表再钉一次）
  const mk = (w, net) => ({ week: w, revenue: 100000, netProfit: net, profit: net, occupancy: 60, finalGoodRate: 70, decisions: {}, events: [] })
  const h12 = Array.from({ length: 12 }, (_, i) => mk(i + 1, 1000 + i))
  const h15 = [...h12, mk(13, -99999), mk(14, 99999), mk(15, 0)]
  const A = 学期成果(h12), B = 学期成果(h15)
  ok(JSON.stringify(A) === JSON.stringify(B), '跑到 15 周后，学期成果逐字节 === 只跑 12 周（前 12 周成果不被覆盖）')
  ok(/学期成果（并排 · 不排名/.test(readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')) || /班级并排表/.test(readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')), '教师端总览有学期成果并排区')
  ok(/data-continue-toggle/.test(readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')), '教师端续营开关锚在位')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
