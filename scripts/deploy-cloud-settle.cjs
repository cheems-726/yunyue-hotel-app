// 部署云端结算系统
const { Client } = require('pg');

// ⚠️ 连接串改从环境变量读取（数据库密码已轮换，不再硬编码于仓库）
// 用法：SUPABASE_PG='postgresql://postgres.<ref>:<新密码>@<host>:5432/postgres' node deploy-cloud-settle.cjs
if (!process.env.SUPABASE_PG) {
  console.error("缺少 SUPABASE_PG 环境变量（数据库直连串，含密码故不入库）");
  process.exit(1);
}
const PG_URL = process.env.SUPABASE_PG
const fs = require('fs');
const c = new Client({ connectionString: PG_URL });
const strip = (s) => s.replace(/^--[^\n]*\n/gm, '').trim();
c.connect().then(async () => {
  const sql = fs.readFileSync(__dirname + '/cloud-settle.sql', 'utf8');
  const m1 = sql.match(/create or replace function public\.rand_next[\s\S]*?\$\$;/);
  const m2 = sql.match(/create or replace function public\.rand_float[\s\S]*?\$\$;/);
  const m3 = sql.match(/create or replace function public\.settle_group\([\s\S]*?end \$\$;/);
  const m4 = sql.match(/create or replace function public\.settle_all_groups\(\)[\s\S]*?end \$\$;/);
  const tablePart = sql.slice(sql.indexOf('-- 结算运行日志表'));
  for (const stmt of tablePart.split(';').map(s => s.trim()).filter(Boolean)) {
    const clean = strip(stmt);
    if (!clean) continue;
    await c.query(clean).catch(e => console.log('table ERR:', e.message.slice(0, 90)));
  }
  console.log('table done');
  for (const [name, stmt] of [['rand_next', m1], ['rand_float', m2], ['settle_group', m3], ['settle_all_groups', m4]]) {
    if (!stmt) { console.log(name, ': NOT MATCHED'); continue; }
    const r = await c.query(stmt[0]).catch(e => ({ err: e.message }));
    console.log(name + ':', r.err ? 'ERR ' + r.err.slice(0, 140) : 'OK');
  }
  const state = JSON.stringify({ location: { attrs: { "客流": 4, "租金": 3, "竞争": 3, "波动": 2 } }, brand: { name: "汉庭", price: "180-280元", standard: "客房70间起" }, doneDecisions: { pricing: "不跟降", shifts: "满编保服务" } });
  const test = await c.query('select public.settle_group($1::jsonb, 3, null) as r', [state]).catch(e => ({ err: e.message }));
  if (test.err) { console.log('settle test ERR:', test.err.slice(0, 140)); }
  else {
    const rep = test.rows[0].r;
    console.log('单组结算:', JSON.stringify({ occ: rep.occupancy, rev: rep.revenue, profit: rep.profit, good: rep.finalGoodRate, neg: rep.negativeCount }));
    const t2 = await c.query('select public.settle_group($1::jsonb, 3, null) as r', [state]);
    console.log('确定性:', JSON.stringify(test.rows[0].r) === JSON.stringify(t2.rows[0].r) ? 'OK' : 'FAIL');
  }
  const cron = await c.query("select cron.schedule('yunyue-daily-settle','0 18 * * *', $$select public.settle_all_groups()$$)").catch(e => ({ err: e.message }));
  console.log('pg_cron:', cron.err ? 'ERR ' + cron.err.slice(0, 90) : 'OK 北京02:00');
  await c.end();
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
