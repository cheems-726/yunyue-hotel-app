const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.jgytwxaeeezmdbxfsyvs:Yunyue2026!Hotel%23Teach@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
c.connect().then(async () => {
  const cols = await c.query(`select column_name from information_schema.columns where table_name='teacher_notes' order by ordinal_position`);
  console.log('列:', cols.rows.map(r => r.column_name).join(', '));
  const pk = await c.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid='teacher_notes'::regclass and i.indisprimary`);
  console.log('主键:', pk.rows.map(r => r.attname).join(','));
  const sample = await c.query(`select id, note, week from teacher_notes order by updated_at desc limit 2`).catch(e => ({ error: e.message }));
  console.log('样例:', sample.rows ? JSON.stringify(sample.rows.map(r => ({ id: r.id, week: r.week, note: (r.note||'').slice(0,12) }))) : sample.error);
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
