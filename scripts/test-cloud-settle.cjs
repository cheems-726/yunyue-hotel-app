// 云端结算测试（旗舰版）：单组结算 + 确定性 + 前端JS引擎对齐
const { Client } = require('pg');
const fs = require('fs');
const c = new Client({ connectionString: 'postgresql://postgres.jgytwxaeeezmdbxfsyvs:Yunyue2026!Hotel%23Teach@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
const state = JSON.stringify({
  location: { attrs: { "客流": 4, "租金": 3, "竞争": 3, "波动": 2 } },
  brand: { name: "汉庭", price: "180-280元", standard: "客房70间起", level: "经济型 · 国民" },
  doneDecisions: { pricing: "不跟降", shifts: "满编保服务" },
});
c.connect().then(async () => {
  // 重新部署修好的 settle_group
  const sql = fs.readFileSync(__dirname + '/cloud-settle.sql', 'utf8');
  const m3 = sql.match(/create or replace function public\.settle_group\([\s\S]*?end \$\$;/);
  const dep = await c.query(m3[0]).catch(e => ({ err: e.message }));
  console.log('settle_group redeploy:', dep.err ? 'ERR ' + dep.err.slice(0, 120) : 'OK');

  const test = await c.query('select public.settle_group($1::jsonb, 3, null) as r', [state]).catch(e => ({ err: e.message }));
  if (test.err) { console.log('test ERR:', test.err.slice(0, 140)); await c.end(); return; }
  const rep = test.rows[0].r;
  console.log('云端结算:', JSON.stringify({ occ: rep.occupancy, rev: rep.revenue, profit: rep.profit, good: rep.finalGoodRate, neg: rep.negativeCount, events: (rep.events || []).length }));

  const t2 = await c.query('select public.settle_group($1::jsonb, 3, null) as r', [state]);
  console.log('确定性:', JSON.stringify(test.rows[0].r) === JSON.stringify(t2.rows[0].r) ? 'PASS' : 'FAIL');
  await c.end();
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
