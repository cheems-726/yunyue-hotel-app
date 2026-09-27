// Wave 1 · W1-5 ★ 老师端"进度落后"提示验收（T3.7）
// 运行：node tests/progressLag.test.mjs   （已挂 run-all）
// 验收（§二十二·三 W1-5）：**构造"3 天没提交决策"的组 → 老师端有明确提示**
import { progressLag, dayToWeekDay, DAYS_PER_WEEK } from '../src/serverTick.mjs'
import { readFileSync } from 'node:fs'

const APP = 'D:/教学app/hotel-app/'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const read = (p) => readFileSync(APP + p, 'utf8')

console.log('▶ Wave 1 · W1-5 老师端进度落后提示（T3.7）')

console.log('\n[1] ★ 验收场景：构造"3 天没提交决策"的组')
{
  // 服务端已推进到第 5 天，该组只算到第 2 天（= 3 天没跟上）
  const r = progressLag({ classDay: 5, lastComputedDay: 2, lastDecisionAt: new Date(Date.now() - 3 * 86400000) })
  ok(r.lagDays === 3, `落后天数 = ${r.lagDays}（期望 3）`)
  ok(r.level === 'behind', `档位 = ${r.level}（≥3 天判为 behind）`)
  ok(/落后 3 天/.test(r.label), `提示文案明确：「${r.label}」`)
  ok(/3 天前提交决策/.test(r.sinceLabel || ''), `含最后决策时间：「${r.sinceLabel}」`)
}

console.log('\n[2] 档位边界：0=正常 / 1-2=留意 / ≥3=落后')
{
  const cases = [[5, 5, 'ok'], [5, 4, 'watch'], [5, 3, 'watch'], [5, 2, 'behind'], [5, 0, 'behind'], [12, 3, 'behind']]
  for (const [cd, ld, want] of cases) {
    const r = progressLag({ classDay: cd, lastComputedDay: ld })
    ok(r.level === want, `classDay=${cd} 算到第 ${ld} 天 → ${r.level}（期望 ${want}），文案「${r.label}」`)
  }
  ok(progressLag({ classDay: 5, lastComputedDay: 5 }).label === '进度正常', '持平时文案为「进度正常」')
}

console.log('\n[3] 周/天混排文案（落后跨周时要写周）')
{
  const r = progressLag({ classDay: 12, lastComputedDay: 3 })
  ok(r.lagDays === 9 && r.lagWeeks === 1, `9 天 = 1 周 + 2 天（lagWeeks=${r.lagWeeks}）`)
  ok(/1 周/.test(r.label), `跨周文案含周：「${r.label}」`)
  const exact = progressLag({ classDay: 15, lastComputedDay: 1 })   // 14 天 = 整 2 周
  ok(/2 周/.test(exact.label), `整周文案：「${exact.label}」`)
}

console.log('\n[4] 鲁棒性：非法/缺失输入不抛异常')
{
  const bad = [undefined, {}, { classDay: null }, { classDay: NaN, lastComputedDay: NaN }, { classDay: -5, lastComputedDay: 100 }]
  let threw = 0
  for (const b of bad) { try { const r = progressLag(b); if (typeof r.label !== 'string') threw++ } catch (e) { threw++ } }
  ok(threw === 0, `${bad.length} 种非法输入全部不抛异常且返回文案`)
  ok(progressLag({ classDay: -5, lastComputedDay: 100 }).lagDays === 0, '负 classDay 归 0，不出现负落后')
  const future = progressLag({ classDay: 5, lastComputedDay: 99 })
  ok(future.lagDays === 0 && future.level === 'ok', '该组超前于服务端 → 不报落后（lagDays 不为负）')
  ok(progressLag({ classDay: 5, lastComputedDay: 5, lastDecisionAt: null }).sinceLabel === null, '无决策时间 → sinceLabel 为 null')
  ok(progressLag({ classDay: 5, lastComputedDay: 5, lastDecisionAt: 'not-a-date' }).sinceLabel === null, '非法时间字符串 → 不崩、返回 null')
}

console.log('\n[5] 与逐日推进的一致性：lastComputedDay 口径 = history 覆盖的天数')
{
  for (const d of [1, 7, 8, 14, 15]) {
    const { week, dayIndex } = dayToWeekDay(d)
    const covered = (week - 1) * DAYS_PER_WEEK + dayIndex
    ok(covered === d, `第 ${d} 天 → 第 ${week} 周第 ${dayIndex} 天 ⇒ 覆盖天数 ${covered}（一致）`)
  }
  // 口径说明：服务端推进到第 D 天时 lastComputedDay 应为 D（等价于 ceil(D/7) 周）
  const r = progressLag({ classDay: 8, lastComputedDay: 7 })
  ok(r.lagDays === 1, '服务端第 8 天 vs 该组第 7 天 → 落后 1 天（跨周边界不误判为 7 天）')
}

console.log('\n[6] 教师端接线：字段与渲染都在（且不再引用未声明标识符）')
{
  const t = read('src/TeacherDashboard.jsx')
  ok(/import \{ progressLag \}/.test(t), 'TeacherDashboard 已 import progressLag')
  ok(/function summarize\(gs, profile, classDay = 0\)/.test(t), 'summarize 签名已带 classDay')
  ok(/\blag,\s*\/\/ W1-5/.test(t), 'summarize 返回里带 lag 字段')
  ok(/进度落后/.test(t) && /lag\.level === 'behind'/.test(t), '界面有「进度落后」清单渲染')
  // ⚠️ 必须先剥注释再查标识符 —— 否则本文件里那句"原先写了 classDayState"的修复注释
  //    会把检查自己绊倒（本项目静态检查已因"忘剥注释"误报过三次：B2.5 index.ts、W1-3 Edge Function、此处）
  const stripCode = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/classDayState/.test(stripCode(t)), '★ 代码中不再引用未声明的 classDayState（上一版会 ReferenceError 被 try/catch 吞掉）')
  ok(/fetchClassDay\(\)/.test(t) && /fetchClassDay\s*\(/.test(t), '已接服务端 classDay（fetchClassDay）')
  const sc = read('src/supabaseClient.js')
  ok(/export async function fetchClassDay/.test(sc), 'supabaseClient 有 fetchClassDay（走 class_day_now() RPC，失败回 0）')
  // 静态：传给 summarize 的实参必须是已声明标识符（防同类"未声明变量"再犯）
  const declared = new Set()
  for (const l of t.split(/\r?\n/)) {
    for (const m of l.matchAll(/const\s*\[\s*([A-Za-z_$][\w$]*)\s*,/g)) declared.add(m[1])
    for (const m of l.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=/g)) declared.add(m[1])
  }
  const badArgs = []
  for (const m of t.matchAll(/summarize\(([^)]*)\)/g)) {
    m[1].split(',').map(x => x.trim()).filter(x => /^[A-Za-z_$][\w$]*$/.test(x))
      .forEach(v => { if (!declared.has(v) && !['gs', 'profile'].includes(v)) badArgs.push(v) })
  }
  ok(badArgs.length === 0, `summarize 的实参全部为已声明标识符（未声明 ${badArgs.length}：${badArgs.join(',')}）`)
}

console.log('\n[6b] ★ 元教训：本套件的静态检查必须先剥注释（已踩三次）')
{
  const stripCode = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const probe = 'const x = 1 // 这里提到 classDayState 应当被忽略\n/* 块注释里的 classDayState 也算 */'
  ok(!/classDayState/.test(stripCode(probe)), '剥注释后，注释里的标识符不再参与匹配（元断言）')
  const t2 = read('src/TeacherDashboard.jsx')
  ok(/classDayState/.test(t2) && !/classDayState/.test(stripCode(t2)), 'TeacherDashboard 里只剩注释提到它，代码里已无')
}

console.log('\n[7] 迁移脚本含 classDay 的权威定义（供部署后启用）')
{
  const sql = read('supabase/migrations/20260927_server_tick.sql')
  ok(/create or replace function public\.class_day_now/.test(sql), '迁移里有 class_day_now()')
  ok(/start_date/.test(sql) && /teacher_offset_days/.test(sql), 'class_state 扩了 start_date / teacher_offset_days')
  ok(/server_tick_log/.test(sql), '幂等流水表 server_tick_log 已定义')
  ok(/pg_cron/.test(sql) && /advance-day-tick/.test(sql), 'pg_cron 定时任务已定义')
  ok(/需用户执行/.test(sql), '迁移明确标注「需用户执行」（不擅自对生产执行）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
