const { Client } = require('pg');

// ⚠️ 连接串改从环境变量读取（数据库密码已轮换，不再硬编码于仓库）
// 用法：SUPABASE_PG='postgresql://postgres.<ref>:<新密码>@<host>:5432/postgres' node _check-tables.cjs
if (!process.env.SUPABASE_PG) {
  console.error("缺少 SUPABASE_PG 环境变量（数据库直连串，含密码故不入库）");
  process.exit(1);
}
const PG_URL = process.env.SUPABASE_PG
const c = new Client({ connectionString: PG_URL });
c.connect().then(async () => {
  const tables = await c.query(`select tablename from pg_tables where schemaname='public' order by 1`);
  console.log('表:', tables.rows.map(r => r.tablename).join(', '));
  const cols = await c.query(`select table_name, column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('profiles','game_states','teacher_notes','class_state','settle_runs') order by table_name, ordinal_position`);
  cols.rows.forEach(r => console.log(`${r.table_name}.${r.column_name}: ${r.data_type}`));
  const policies = await c.query(`select tablename, policyname, cmd from pg_policies where schemaname='public' order by tablename, policyname`);
  policies.rows.forEach(p => console.log(`RLS: ${p.tablename}.${p.policyname} [${p.cmd}]`));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
