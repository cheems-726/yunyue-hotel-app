// 一次性脚本：添加组内只读 RLS 策略（跑完可删）
const { Client } = require('pg');

// ⚠️ 连接串改从环境变量读取（数据库密码已轮换，不再硬编码于仓库）
// 用法：SUPABASE_PG='postgresql://postgres.<ref>:<新密码>@<host>:5432/postgres' node add-group-read-policy.cjs
if (!process.env.SUPABASE_PG) {
  console.error("缺少 SUPABASE_PG 环境变量（数据库直连串，含密码故不入库）");
  process.exit(1);
}
const PG_URL = process.env.SUPABASE_PG
const c = new Client({ connectionString: PG_URL });
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
