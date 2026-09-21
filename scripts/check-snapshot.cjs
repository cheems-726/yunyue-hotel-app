// 快照断档检查（只读）：确认 daily_snapshots 每天 02:00 归档有没有漏
// 用法：SUPABASE_PG='postgresql://postgres.<ref>:<密码>@<host>:5432/postgres' node scripts/check-snapshot.cjs [天数，默认14]
// 特点：只执行 SELECT，不写任何数据；表还没建时给出明确提示而不是报错刷屏
//
// 退出码：0 = 无断档   1 = 发现断档/异常   2 = 无法检查（表或调度未就绪）
//
// 判定口径（避免误报）：
//   · 期望区间 = [max(首条快照日, 今天-N天) .. 昨天] + 今天（仅当北京已过 02:00，归档时点）
//   · 迁移执行前的日期不计入断档（脚本自动从"首条快照日"起算）
//   · 某天有行但行数明显少于当天存档数 → 记为"疑似部分归档"
const { Client } = require('pg')

if (!process.env.SUPABASE_PG) {
  console.error('缺少 SUPABASE_PG 环境变量（数据库直连串，含密码故不入库）')
  console.error("用法：SUPABASE_PG='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' node scripts/check-snapshot.cjs [天数]")
  process.exit(2)
}
const WINDOW = Math.max(1, Math.min(365, Number(process.argv[2]) || 14))

// 北京时间（UTC+8）当天与当前小时
const bj = () => new Date(Date.now() + 8 * 3600 * 1000)
const bjDate = (d = bj()) => d.toISOString().slice(0, 10)
const bjHour = () => bj().getUTCHours()
const dayList = (fromYmd, toYmd) => {
  const out = []
  let t = Date.parse(fromYmd + 'T00:00:00Z')
  const end = Date.parse(toYmd + 'T00:00:00Z')
  while (t <= end) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000 }
  return out
}
const shift = (ymd, days) => new Date(Date.parse(ymd + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)

;(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_PG })
  await c.connect()
  const q = async (sql, p = []) => (await c.query(sql, p)).rows
  const today = bjDate()

  console.log(`📸 daily_snapshots 断档检查   ·  北京时间 ${today} ${String(bjHour()).padStart(2, '0')} 时  ·  检查窗口 ${WINDOW} 天\n`)

  // ① 表 / 函数 / 调度是否就绪
  const t = await q("select to_regclass('public.daily_snapshots') as t")
  const fn = await q("select proname, prosecdef from pg_proc where proname='archive_daily'")
  let job = []
  try { job = await q("select jobid, jobname, schedule, active from cron.job where jobname='daily-archive'") } catch (e) { job = [] }
  console.log(`表      : ${t[0].t ? '✓ daily_snapshots' : '❌ 未创建（迁移未执行）'}`)
  console.log(`函数    : ${fn[0] ? '✓ archive_daily (security definer=' + fn[0].prosecdef + ')' : '❌ 未创建'}`)
  console.log(`调度    : ${job[0] ? `✓ #${job[0].jobid} “${job[0].schedule}” active=${job[0].active}` : '❌ 未创建'}`)
  if (!t[0].t || !fn[0] || !job[0]) {
    console.log('\n⏸  快照机制尚未就绪 —— 请先在 Supabase SQL Editor 执行：')
    console.log('   hotel-app/supabase-migration-daily-snapshot.sql')
    await c.end()
    process.exit(2)
  }

  // ② 已归档日期与每日行数
  const rows = await q(`
    select snapshot_date::text as d, count(*)::int as n
    from public.daily_snapshots
    group by 1 order by 1 desc
  `)
  const byDay = new Map(rows.map(r => [r.d, r.n]))
  const gsCount = (await q('select count(*)::int n from public.game_states'))[0].n
  const total = rows.reduce((s, r) => s + r.n, 0)
  const firstDay = rows.length ? rows[rows.length - 1].d : null
  const lastDay = rows.length ? rows[0].d : null
  console.log(`\n数据    : 共 ${total} 行 / ${rows.length} 个归档日  首条 ${firstDay || '—'}  最近 ${lastDay || '—'}`)
  console.log(`当前存档: ${gsCount} 行（部分归档的判定基准）`)

  // ③ 期望区间 → 断档
  const windowStart = shift(today, -(WINDOW - 1))
  const start = firstDay && firstDay > windowStart ? firstDay : windowStart   // 迁移前的日期不计
  const expectEnd = bjHour() >= 2 ? today : shift(today, -1)                   // 今天 02:00 前不算缺今天
  const expected = dayList(start, expectEnd)
  const missing = expected.filter(d => !byDay.has(d))

  // ④ 逐日表（最近 WINDOW 天）
  console.log(`\n最近 ${WINDOW} 天逐日：`)
  const tail = dayList(windowStart, today)
  const partial = []
  tail.forEach(d => {
    const n = byDay.get(d)
    const isToday = d === today
    let mark, note = ''
    if (n === undefined) {
      mark = isToday && bjHour() < 2 ? '⏳ 待归档(02:00)' : (d < start ? '· 迁移前' : '❌ 断档')
    } else {
      mark = '✅'
      if (n < gsCount) { mark = '⚠️'; note = `少于当前存档 ${gsCount}`; partial.push(`${d}(${n}/${gsCount})`) }
    }
    console.log(`  ${d}  ${(n === undefined ? '  -' : String(n).padStart(3))} 行  ${mark}${note ? ' ' + note : ''}`)
  })

  // ⑤ 结论
  const problems = []
  if (missing.length) problems.push(`断档 ${missing.length} 天：${missing.join(', ')}`)
  if (partial.length) problems.push(`疑似部分归档 ${partial.length} 天：${partial.join(', ')}`)
  if (!job[0].active) problems.push(`调度未激活（active=${job[0].active}）`)
  if (lastDay && shift(today, -1) > lastDay) problems.push(`最近一次归档是 ${lastDay}，昨天(缺失) → 检查服务是否跑过`)

  console.log('\n' + (problems.length ? '❌ 发现问题：' : '✅ 无断档，归档连续'))
  problems.forEach(p => console.log('   · ' + p))
  await c.end()
  process.exit(problems.length ? 1 : 0)
})().catch(e => { console.error('❌ 检查失败:', e.message); process.exit(2) })
