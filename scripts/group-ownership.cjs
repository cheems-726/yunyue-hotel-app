// 组队共管 v1：game_states 归属改为"组"（group_key = 班级+组号），同组共享读写
// 迁移策略：兼容旧数据——有组的学生把 user_id 档案迁到组档；无组的保持个人档
const { Client } = require('pg');

// ⚠️ 连接串改从环境变量读取（数据库密码已轮换，不再硬编码于仓库）
// 用法：SUPABASE_PG='postgresql://postgres.<ref>:<新密码>@<host>:5432/postgres' node group-ownership.cjs
if (!process.env.SUPABASE_PG) {
  console.error("缺少 SUPABASE_PG 环境变量（数据库直连串，含密码故不入库）");
  process.exit(1);
}
const PG_URL = process.env.SUPABASE_PG
const c = new Client({ connectionString: PG_URL });
c.connect().then(async () => {
  // 1. 加组键列（group_key = class_name|group_no）
  await c.query(`alter table public.game_states add column if not exists group_key text`);
  // 2. 已分组的学生，把 group_key 回填
  await c.query(`update public.game_states gs set group_key = p.class_name || '|' || p.group_no
    from public.profiles p
    where p.user_id = gs.user_id and p.group_no is not null and p.class_name is not null`);
  // 3. 同组合并：保留 updated_at 最新的一条为主档，其余标记入组（数据由前端在首启时合并历史）
  const r = await c.query(`select group_key, count(*) from public.game_states where group_key is not null group by 1 having count(*) > 1`);
  console.log('多档组数:', r.rows.length, r.rows.map(x => `${x.group_key}(${x.count})`).join(', '));
  // 4. RLS：自己可读写自己的行；同组（profiles 同 class+group）可读写组档；教师可读
  await c.query(`create policy "game_states_group_write" on public.game_states for all using (
    group_key is not null and exists(
      select 1 from public.profiles me
      where me.user_id = auth.uid() and me.role = 'student'
        and me.group_no is not null
        and (me.class_name || '|' || me.group_no) = game_states.group_key
    )
  ) with check (
    group_key is not null and exists(
      select 1 from public.profiles me
      where me.user_id = auth.uid() and me.role = 'student'
        and me.group_no is not null
        and (me.class_name || '|' || me.group_no) = game_states.group_key
    )
  )`).catch(e => console.log('policy:', e.message.slice(0, 90)));
  // 5. 唯一约束：一组一档
  await c.query(`create unique index if not exists game_states_group_key_uq on public.game_states (group_key) where group_key is not null`).catch(e => console.log('idx:', e.message.slice(0, 90)));
  const p = await c.query(`select policyname from pg_policies where tablename='game_states' order by 1`);
  console.log('policies:', p.rows.map(x => x.policyname).join(', '));
  await c.end();
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
