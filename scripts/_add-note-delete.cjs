const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.jgytwxaeeezmdbxfsyvs:Yunyue2026!Hotel%23Teach@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
c.connect().then(async () => {
  const existing = await c.query(`select policyname, cmd from pg_policies where tablename='teacher_notes'`);
  console.log('现有策略:', JSON.stringify(existing.rows));
  await c.query(`create policy "teacher_notes_teacher_delete" on public.teacher_notes for delete to authenticated using (teacher_uid = auth.uid())`).catch(e => console.log('policy:', e.message.slice(0, 80)));
  const p2 = await c.query(`select policyname, cmd from pg_policies where tablename='teacher_notes'`);
  console.log('策略后:', JSON.stringify(p2.rows));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
