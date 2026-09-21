// 一次性执行器：把 decision_log 迁移 SQL 应用到线上库，并做只读校验
// 注意：不打印连接串（含密码）；SQL 文件本身幂等（IF NOT EXISTS / DROP IF EXISTS）
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const SQL_PATH = path.join(__dirname, '..', 'supabase-migration-decision-log.sql')
const sql = fs.readFileSync(SQL_PATH, 'utf8')

;(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_PG })
  await c.connect()
  console.log('✅ 已连接线上库（连接串未回显）')

  // ① 执行迁移（整体一个简单查询，无参数）
  await c.query(sql)
  console.log('✅ 迁移 SQL 执行完成')

  // ② 只读校验
  const t = await c.query("select to_regclass('public.decision_log') as t")
  console.log('① 表存在:', t.rows[0].t || '❌ 未创建')

  const p = await c.query("select policyname, cmd from pg_policies where tablename='decision_log' order by policyname")
  console.log('② 策略数:', p.rows.length)
  p.rows.forEach(r => console.log(`     · ${r.policyname} [${r.cmd}]`))

  const i = await c.query("select indexname from pg_indexes where tablename='decision_log' order by indexname")
  console.log('③ 索引数:', i.rows.length)
  i.rows.forEach(r => console.log(`     · ${r.indexname}`))

  const pub = await c.query("select count(*)::int as n from pg_publication_tables where tablename='decision_log'")
  console.log('④ realtime 发布:', pub.rows[0].n === 1 ? '已加入 ✓' : '未加入 ❌')

  const rls = await c.query("select relrowsecurity from pg_class where relname='decision_log'")
  console.log('⑤ RLS 已启用:', rls.rows[0].relrowsecurity ? '✓' : '❌')

  const cols = await c.query("select column_name, data_type from information_schema.columns where table_name='decision_log' order by ordinal_position")
  console.log('⑥ 字段:', cols.rows.map(r => r.column_name).join(', '))

  const cnt = await c.query('select count(*)::int as n from public.decision_log')
  console.log('⑦ 当前行数:', cnt.rows[0].n, '（接入写入后开始增长）')

  await c.end()
  console.log('✅ 校验完毕')
})().catch(e => { console.error('❌ 执行失败:', e.message); process.exit(1) })
