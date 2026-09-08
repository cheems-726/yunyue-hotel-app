// 一次性脚本：添加组内只读 RLS 策略（跑完可删）
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.jgytwxaeeezmdbxfsyvs:Yunyue2026!Hotel%23Teach@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
c.connect().then(async () => {
  await c.query(`create policy "game_states_group_read" on public.game_states for select using (
    auth.uid() = user_id
    or exists(
      select 1 from public.profiles me, public.profiles other
      where me.user_id = auth.uid()
        and other.user_id = game_states.user_id
        and me.role = 'student' and other.role = 'student'
        and me.group_no is not null
        and me.class_name = other.class_name
        and me.group_no = other.group_no
    )
  )`).catch(e => console.log('policy:', e.message));
  const p = await c.query("select policyname from pg_policies where tablename='game_states'");
  console.log('policies:', p.rows.map(x => x.policyname).join(', '));
  await c.end();
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
