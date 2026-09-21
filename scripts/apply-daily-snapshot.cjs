// 一次性执行器：应用 daily_snapshots 迁移 + 7 项只读校验
// 复用 apply-decision-log.cjs 的模式：读环境变量、不含凭据、可重复执行（SQL 本身幂等）
//   SUPABASE_PG='postgresql://postgres.<ref>:<密码>@<host>:5432/postgres' node scripts/apply-daily-snapshot.cjs
// ⚠️ 会对线上库执行 DDL（建表/建函数/建调度）——属于"写操作"，需用户明确授权后再跑
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

if (!process.env.SUPABASE_PG) {
  console.error('缺少 SUPABASE_PG 环境变量（数据库直连串，含密码故不入库）')
  console.error("用法：SUPABASE_PG='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' node scripts/apply-daily-snapshot.cjs")
  process.exit(1)
}
const SQL_PATH = path.join(__dirname, '..', 'supabase-migration-daily-snapshot.sql')

;(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_PG })
  await c.connect()
  console.log('✅ 已连接线上库（连接串未回显）')

  // ① 执行迁移（整体一个简单查询，无参数）
  await c.query(fs.readFileSync(SQL_PATH, 'utf8'))
  console.log('✅ 迁移 SQL 执行完成\n')

  // ② 七项只读校验
  const q = async (sql) => (await c.query(sql)).rows

  const t = await q("select to_regclass('public.daily_snapshots') as t")
  console.log('① 表存在        :', t[0].t === 'daily_snapshots' ? '✓ daily_snapshots' : '❌ ' + t[0].t)

  const rls = await q("select relrowsecurity from pg_class where relname='daily_snapshots'")
  console.log('② RLS 已启用    :', rls[0] && rls[0].relrowsecurity ? '✓' : '❌')

  const pol = await q("select policyname, cmd from pg_policies where tablename='daily_snapshots' order by policyname")
  console.log(`③ 策略 ${pol.length} 条     :`, pol.map(p => `${p.policyname}[${p.cmd}]`).join(' / ') || '❌ 无')
  console.log('   写策略（应为 0）:', pol.filter(p => p.cmd !== 'SELECT').length)

  const idx = await q("select indexname from pg_indexes where tablename='daily_snapshots' order by 1")
  console.log(`④ 索引 ${idx.length} 个      :`, idx.map(i => i.indexname).join(', '))

  const fn = await q("select proname, prosecdef from pg_proc where proname='archive_daily'")
  console.log('⑤ 归档函数      :', fn[0] ? `✓ archive_daily（security definer=${fn[0].prosecdef}）` : '❌ 未创建')

  const job = await q("select jobid, jobname, schedule, active from cron.job where jobname='daily-archive'")
  console.log('⑥ cron 调度     :', job[0] ? `✓ #${job[0].jobid} ${job[0].schedule} active=${job[0].active}` : '❌ 未创建')

  const cnt = await q('select count(*)::int n from public.daily_snapshots')
  console.log('⑦ 当前行数      :', cnt[0].n, '（首次执行应为 0，等 02:00 归档或手动试跑）')

  await c.end()
  console.log('\n✅ 校验完毕')
  console.log('   提示：可手动试跑一次（幂等安全）→  select public.archive_daily();')
})().catch(e => { console.error('❌ 执行失败:', e.message); process.exit(1) })
